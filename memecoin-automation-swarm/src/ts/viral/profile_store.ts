import { getRedis } from "../shared/redis";

export interface ViralProfile {
  id: string;
  displayName: string;
  tone: string;
  platforms: ("twitter" | "telegram" | "discord")[];
}

export class ProfileStore {
  private readonly keyPrefix = "mas:viral:profile:";

  async put(profile: ViralProfile): Promise<void> {
    const redis = getRedis();
    await redis.set(this.key(profile.id), JSON.stringify(profile));
  }

  async get(profileId: string): Promise<ViralProfile | null> {
    const redis = getRedis();
    const raw = await redis.get(this.key(profileId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as ViralProfile;
  }

  async delete(profileId: string): Promise<void> {
    const redis = getRedis();
    await redis.del(this.key(profileId));
  }

  private key(profileId: string): string {
    return `${this.keyPrefix}${profileId}`;
  }
}
