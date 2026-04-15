import type { CircuitBreakerLevel } from "../shared/types";
import { getCounter } from "../shared/redis";

export interface RiskStatus {
  circuit_breaker: CircuitBreakerLevel;
  clones_today: number;
  llm_spent_today: number;
  hourly_rate: number;
}

export async function getRiskStatus(): Promise<RiskStatus> {
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().toISOString().slice(0, 13);

  const [clonesToday, llmSpent, hourlyRate] = await Promise.all([
    getCounter(`mas:risk:clones:${today}`),
    getCounter(`mas:risk:llm_cost:${today}`),
    getCounter(`mas:risk:hourly:${hour}`),
  ]);

  let circuitBreaker: CircuitBreakerLevel = "green";
  if (hourlyRate >= 40) {
    circuitBreaker = "orange";
  } else if (hourlyRate >= 30) {
    circuitBreaker = "yellow";
  }

  return {
    circuit_breaker: circuitBreaker,
    clones_today: clonesToday,
    llm_spent_today: llmSpent,
    hourly_rate: hourlyRate,
  };
}
