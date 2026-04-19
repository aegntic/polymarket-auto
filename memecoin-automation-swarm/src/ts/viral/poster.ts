export class ViralPoster {
  private readonly minIntervalMs: number;
  private lastPostByChannel = new Map<string, number>();

  constructor(opts?: { minIntervalMs?: number }) {
    this.minIntervalMs = opts?.minIntervalMs ?? 1000;
  }

  async postToTwitter(content: string): Promise<void> {
    const bearerToken = process.env.X_BEARER_TOKEN;
    if (!bearerToken) {
      return;
    }

    await this.withRateLimit("twitter");
    await this.postJson(
      "https://api.twitter.com/2/tweets",
      { text: content },
      { Authorization: `Bearer ${bearerToken}` },
    );
  }

  async postToTelegram(content: string): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
      return;
    }

    await this.withRateLimit("telegram");
    await this.postJson(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, text: content },
    );
  }

  async postToDiscord(content: string): Promise<void> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }

    await this.withRateLimit("discord");
    await this.postJson(webhookUrl, { content });
  }

  private async withRateLimit(channel: string): Promise<void> {
    const now = Date.now();
    const lastPostAt = this.lastPostByChannel.get(channel) ?? 0;
    const waitMs = this.minIntervalMs - (now - lastPostAt);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastPostByChannel.set(channel, Date.now());
  }

  private async postJson(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<void> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(headers ?? {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `Failed to post viral content: ${response.status} ${message}`,
      );
    }
  }
}
