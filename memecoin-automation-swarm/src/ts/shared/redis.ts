import Redis from "ioredis";
import { createEnvelope, EventEnvelope, CHANNELS } from "./types";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new Redis(url, { maxRetriesPerRequest: 3 });
  }
  return redis;
}

export async function publishEvent(channel: string, envelope: EventEnvelope): Promise<void> {
  const r = getRedis();
  await r.publish(channel, JSON.stringify(envelope));
}

export function subscribeToChannel(
  channel: string,
  handler: (envelope: EventEnvelope) => void | Promise<void>,
): void {
  const sub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  sub.subscribe(channel);
  sub.on("message", (_ch: string, data: string) => {
    try {
      const envelope = JSON.parse(data) as EventEnvelope;
      handler(envelope);
    } catch {
      // malformed message, skip
    }
  });
}

export async function atomicIncrement(
  key: string,
  limit: number,
  windowSecs: number,
): Promise<boolean> {
  const r = getRedis();
  const script = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    if current > tonumber(ARGV[2]) then
      redis.call('DECR', KEYS[1])
      return 0
    end
    return 1
  `;
  const result = await r.eval(script, 1, key, String(windowSecs), String(limit));
  return result === 1;
}

export async function getCounter(key: string): Promise<number> {
  const r = getRedis();
  const val = await r.get(key);
  return val ? parseInt(val, 10) : 0;
}

export async function incrFloat(key: string, delta: number): Promise<void> {
  const r = getRedis();
  await r.incrbyfloat(key, delta);
}
