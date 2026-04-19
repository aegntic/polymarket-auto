import Redis from "ioredis";
import { EventEnvelope } from "./types";

let redis: Redis | null = null;

const activeSubscriptions: Map<string, Redis> = new Map();

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redis.on("reconnecting", () => {
      console.warn("[Redis] Reconnecting...");
    });

    redis.on("ready", () => {
      console.log("[Redis] Connected and ready.");
    });
  }
  return redis;
}

export async function publishEvent(
  channel: string,
  envelope: EventEnvelope,
): Promise<void> {
  const r = getRedis();
  await r.publish(channel, JSON.stringify(envelope));
}

export function subscribeToChannel(
  channel: string,
  handler: (_envelope: EventEnvelope) => void | Promise<void>,
): void {
  // Reuse existing subscriber for the same channel
  if (activeSubscriptions.has(channel)) {
    return;
  }

  const sub = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  sub.on("error", (err) => {
    console.error(`[Redis:sub:${channel}] Error:`, err.message);
  });

  sub.on("end", () => {
    activeSubscriptions.delete(channel);
  });

  activeSubscriptions.set(channel, sub);
  sub.subscribe(channel);
  sub.on("message", (_ch: string, data: string) => {
    try {
      const envelope = JSON.parse(data) as EventEnvelope;
      const result = handler(envelope);
      if (result instanceof Promise) {
        result.catch((err: unknown) => {
          console.error(`[Redis:sub:${channel}] Handler error:`, err);
        });
      }
    } catch (err) {
      console.debug(`[Redis:sub:${channel}] Malformed message skipped:`, err);
    }
  });
}

export function closeAllSubscriptions(): void {
  for (const [channel, sub] of activeSubscriptions) {
    sub.disconnect();
    activeSubscriptions.delete(channel);
  }
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
  const result = await r.eval(
    script,
    1,
    key,
    String(windowSecs),
    String(limit),
  );
  return result === 1;
}

export async function getCounter(key: string): Promise<number> {
  const r = getRedis();
  const val = await r.get(key);
  if (!val) return 0;
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
}

export async function incrFloat(key: string, delta: number): Promise<void> {
  const r = getRedis();
  await r.incrbyfloat(key, delta);
}
