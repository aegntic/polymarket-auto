/**
 * Shared types used across the frontend.
 *
 * These types are the canonical source of truth for Chain and CircuitBreakerLevel.
 * Both mock-data.ts and api-collector.ts re-export them for backward compatibility,
 * but new code should import directly from here.
 */

export type Chain = "solana" | "base" | "bnb";
export type CircuitBreakerLevel = "green" | "yellow" | "orange" | "red";
