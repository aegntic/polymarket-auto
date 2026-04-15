use anyhow::{Context, Result};
use serde::Serialize;

#[derive(Debug, Clone)]
pub struct ClickHouseClient {
    base_url: String,
    client: reqwest::Client,
}

impl ClickHouseClient {
    pub fn new(host: &str, port: u16, database: &str) -> Self {
        Self {
            base_url: format!("http://{}:{}/?database={}", host, port, database),
            client: reqwest::Client::new(),
        }
    }

    pub fn from_url(url: &str) -> Self {
        Self {
            base_url: url.to_string(),
            client: reqwest::Client::new(),
        }
    }

    pub async fn insert<T: Serialize>(
        &self,
        table: &str,
        batch: &[T],
    ) -> Result<()> {
        if batch.is_empty() {
            return Ok(());
        }

        let body = batch
            .iter()
            .map(|row| serde_json::to_string(row).context("serialize row"))
            .collect::<Result<Vec<_>, _>>()?
            .join("\n");

        let url = format!("{}&query=INSERT+INTO+{}+FORMAT+JSONEachRow", self.base_url, table);

        self.client
            .post(&url)
            .header("Content-Type", "application/x-ndjson")
            .body(body)
            .send()
            .await
            .context("ClickHouse insert request failed")?
            .error_for_status()
            .context("ClickHouse insert returned error")?;

        Ok(())
    }

    pub async fn query(&self, sql: &str) -> Result<String> {
        let url = format!("{}&query={}", self.base_url, urlencoding::encode(sql));

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .context("ClickHouse query request failed")?
            .error_for_status()
            .context("ClickHouse query returned error")?;

        let body = response
            .text()
            .await
            .context("failed to read ClickHouse response")?;

        Ok(body)
    }

    pub async fn ping(&self) -> Result<bool> {
        let url = format!("{}/ping", self.base_url.split('/').next().unwrap_or("http://localhost:8123"));
        let result = self
            .client
            .get(&url)
            .send()
            .await
            .context("ClickHouse ping failed");
        Ok(result.is_ok())
    }
}
