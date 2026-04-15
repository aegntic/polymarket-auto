export class ViralPoster {
  async postToTwitter(_content: string): Promise<void> {
    throw new Error("Twitter integration not yet implemented");
  }

  async postToTelegram(_content: string): Promise<void> {
    throw new Error("Telegram integration not yet implemented");
  }

  async postToDiscord(_content: string): Promise<void> {
    throw new Error("Discord integration not yet implemented");
  }
}
