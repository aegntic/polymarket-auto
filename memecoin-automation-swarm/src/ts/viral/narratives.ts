import { getRedis } from "../shared/redis";
import "dotenv/config";
// For simplicity, we will simulate fetching live tweets/news.
// In production, this would use the X API or specific RSS feeds.

export interface NarrativeEvent {
  id: string;
  source: string;
  author: string;
  content: string;
  keywords: string[];
  timestamp: number;
  velocity: number; // engagement per minute
}

export class NarrativeEngine {
  private redis = getRedis();
  private readonly WINDOW_KEY = "viral:narratives:live";
  private readonly TTL_SECONDS = 3600; // 1 hour sliding window

  /**
   * Ingests a raw social post, extracts keywords using simple NLP/Regex,
   * and stores it in the active narrative sliding window.
   */
  async ingestSocialPost(source: string, author: string, content: string, engagement: number) {
    const keywords = this.extractKeywords(content);
    
    // Only care if it contains trackable memecoin keywords
    if (keywords.length === 0) return;

    const event: NarrativeEvent = {
      id: `${source}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      source,
      author,
      content,
      keywords,
      timestamp: Date.now(),
      velocity: engagement,
    };

    // Store in Redis Sorted Set by timestamp to maintain the sliding window
    await this.redis.zadd(this.WINDOW_KEY, event.timestamp, JSON.stringify(event));
    
    // Clean up old narratives outside the 1-hour window
    const oneHourAgo = Date.now() - (this.TTL_SECONDS * 1000);
    await this.redis.zremrangebyscore(this.WINDOW_KEY, 0, oneHourAgo);
    
    console.log(`[VIRAL] Ingested narrative from ${author}: [${keywords.join(", ")}]`);
  }

  /**
   * Retrieves the current active narratives weighted by velocity and recency.
   */
  async getActiveNarratives(): Promise<NarrativeEvent[]> {
    const raw = await this.redis.zrevrange(this.WINDOW_KEY, 0, 50);
    return raw.map((r) => JSON.parse(r) as NarrativeEvent);
  }

  /**
   * Calculates the Narrative Distance between a new token and the active zeitgeist.
   * Distance of 0 = Perfect Match (e.g. Elon just tweeted the exact ticker).
   * Distance of 100 = No relation to anything happening right now.
   */
  async calculateNarrativeDistance(tokenName: string, tokenSymbol: string): Promise<{ distance: number; match: NarrativeEvent | null }> {
    const narratives = await this.getActiveNarratives();
    const tokenKeywords = this.extractKeywords(`${tokenName} ${tokenSymbol}`);

    if (narratives.length === 0 || tokenKeywords.length === 0) {
      return { distance: 100, match: null };
    }

    let minDistance = 100;
    let bestMatch: NarrativeEvent | null = null;

    for (const n of narratives) {
      // Find intersection of keywords
      const intersection = n.keywords.filter(k => tokenKeywords.includes(k));
      
      if (intersection.length > 0) {
        // Base distance is 50 if there's a match.
        let distance = 50;
        
        // Decrease distance (better match) if it's highly engaged
        if (n.velocity > 1000) distance -= 20;
        
        // Decrease distance if the author is a God-Tier KOL (e.g., Elon)
        if (n.author.toLowerCase() === "elonmusk" || n.author.toLowerCase() === "vitalikbuterin") distance -= 25;
        
        // Increase distance if the narrative is getting old (decay over the hour)
        const ageMinutes = (Date.now() - n.timestamp) / 60000;
        distance += (ageMinutes * 0.5); // Adds 0.5 distance per minute of age

        distance = Math.max(0, Math.min(100, distance)); // Clamp 0-100

        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = n;
        }
      }
    }

    return { distance: minDistance, match: bestMatch };
  }

  private extractKeywords(text: string): string[] {
    // Very basic extraction: remove punctuation, lowercase, split by space, remove common stop words.
    const stopWords = new Set(["the", "is", "at", "which", "on", "and", "a", "an", "of", "in", "to", "for", "with"]);
    const words = text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
    return words.filter(w => w.length > 2 && !stopWords.has(w));
  }
}
