use anyhow::{Context, Result};
use redis::aio::MultiplexedConnection;
use redis::AsyncCommands;
use serde_json;

use crate::EventEnvelope;

const LUA_INCREMENT_WITH_LIMIT: &str = r#"
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
if current > tonumber(ARGV[2]) then
    redis.call('DECR', KEYS[1])
    return 0
end
return 1
"#;

const LUA_LEDGER_TRANSFER: &str = r#"
local from_balance = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[1])
if from_balance < amount then
    return 0
end
redis.call('DECRBY', KEYS[1], amount)
redis.call('INCRBY', KEYS[2], amount)
return 1
"#;

#[derive(Clone)]
pub struct RedisPool {
    conn: MultiplexedConnection,
}

impl RedisPool {
    pub async fn new(url: &str) -> Result<Self> {
        let client = redis::Client::open(url)
            .context("failed to create Redis client")?;
        let conn = client
            .get_multiplexed_async_connection()
            .await
            .context("failed to create Redis multiplexed connection")?;
        Ok(Self { conn })
    }

    pub async fn publish(&mut self, channel: &str, event: &EventEnvelope) -> Result<()> {
        let payload = serde_json::to_string(event)
            .context("failed to serialize event envelope")?;
        redis::cmd("PUBLISH")
            .arg(channel)
            .arg(payload)
            .exec_async(&mut self.conn)
            .await
            .context("failed to publish to Redis channel")?;
        Ok(())
    }

    pub async fn set(&mut self, key: &str, value: &str, ttl: Option<u64>) -> Result<()> {
        let _: () = if let Some(ttl_secs) = ttl {
            self.conn.set_ex(key, value, ttl_secs).await?
        } else {
            self.conn.set(key, value).await?
        };
        Ok(())
    }

    pub async fn get(&mut self, key: &str) -> Result<Option<String>> {
        let val: Option<String> = self.conn.get(key).await?;
        Ok(val)
    }

    pub async fn increment_with_limit(
        &mut self,
        key: &str,
        limit: u64,
        window_secs: u64,
    ) -> Result<bool> {
        let script = redis::Script::new(LUA_INCREMENT_WITH_LIMIT);
        let result: i32 = script
            .key(key)
            .arg(window_secs.to_string())
            .arg(limit.to_string())
            .invoke_async(&mut self.conn)
            .await
            .context("Lua increment_with_limit failed")?;
        Ok(result == 1)
    }

    pub async fn atomic_ledger_transfer(
        &mut self,
        from_key: &str,
        to_key: &str,
        amount: i64,
    ) -> Result<bool> {
        let script = redis::Script::new(LUA_LEDGER_TRANSFER);
        let result: i32 = script
            .key(from_key)
            .key(to_key)
            .arg(amount.to_string())
            .invoke_async(&mut self.conn)
            .await
            .context("Lua ledger transfer failed")?;
        Ok(result == 1)
    }

    pub async fn incr(&mut self, key: &str) -> Result<i64> {
        let val: i64 = self.conn.incr(key, 1).await?;
        Ok(val)
    }

    pub async fn incr_by_float(&mut self, key: &str, delta: f64) -> Result<()> {
        let _: () = self.conn.incr(key, format!("{:.6}", delta)).await?;
        Ok(())
    }

    pub fn conn(&self) -> MultiplexedConnection {
        self.conn.clone()
    }
}
