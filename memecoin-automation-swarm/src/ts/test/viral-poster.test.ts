import { afterEach, describe, expect, test } from "bun:test";
import { ViralPoster } from "../viral/poster";

const originalFetch = globalThis.fetch;
const originalEnv = {
  X_BEARER_TOKEN: process.env.X_BEARER_TOKEN,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.X_BEARER_TOKEN = originalEnv.X_BEARER_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = originalEnv.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_CHAT_ID = originalEnv.TELEGRAM_CHAT_ID;
  process.env.DISCORD_WEBHOOK_URL = originalEnv.DISCORD_WEBHOOK_URL;
});

describe("ViralPoster", () => {
  test("skips posting when channel credentials are missing", async () => {
    delete process.env.X_BEARER_TOKEN;

    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    const poster = new ViralPoster();
    await poster.postToTwitter("hello");
    expect(called).toBe(false);
  });

  test("posts to configured channels", async () => {
    process.env.X_BEARER_TOKEN = "x-token";
    process.env.TELEGRAM_BOT_TOKEN = "tg-token";
    process.env.TELEGRAM_CHAT_ID = "123";
    process.env.DISCORD_WEBHOOK_URL = "https://discord.local/webhook";

    const urls: string[] = [];
    globalThis.fetch = (async (url: unknown) => {
      urls.push(String(url));
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    const poster = new ViralPoster({ minIntervalMs: 0 });
    await poster.postToTwitter("hello x");
    await poster.postToTelegram("hello tg");
    await poster.postToDiscord("hello dc");

    expect(urls).toEqual([
      "https://api.twitter.com/2/tweets",
      "https://api.telegram.org/bottg-token/sendMessage",
      "https://discord.local/webhook",
    ]);
  });
});
