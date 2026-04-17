import { publishEvent } from "../shared/redis";
import { TokenObservation } from "../shared/types";
import { NarrativeEngine } from "./narratives";

export class ViralSwarm {
  private narrativeEngine: NarrativeEngine;

  constructor() {
    this.narrativeEngine = new NarrativeEngine();
  }

  async triggerSwarm(
    obs: TokenObservation,
    cloneMintAddress: string,
  ): Promise<void> {
    const numProfiles = Math.floor(Math.random() * (8 - 3 + 1)) + 3;
    console.log(
      `[VIRAL] Spinning up swarm with ${numProfiles} profiles for ${obs.symbol} (${cloneMintAddress})`,
    );

    const { distance, match } =
      await this.narrativeEngine.calculateNarrativeDistance(
        obs.name,
        obs.symbol,
      );
    const narrativeContext = match
      ? `Aligns with narrative: "${match.content}" (Distance: ${distance})`
      : "General hype";

    for (let i = 0; i < numProfiles; i++) {
      const profileId = `profile-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")}`;
      const message = `Just aped into ${obs.symbol}! 🚀 This one is going to the moon! 💎🙌 contract: ${cloneMintAddress} | ${narrativeContext}`;

      console.log(`[VIRAL] Spinning up ${profileId}...`);
      console.log(`[VIRAL] [${profileId}] Generated message: ${message}`);

      await publishEvent("viral:posts", {
        timestamp: Date.now().toString(),
        module: "viral",
        event_type: "post_generated",
        payload: {
          profileId,
          cloneMintAddress,
          originalSymbol: obs.symbol,
          message,
        },
      });
    }
  }
}
