import type { CircuitBreakerLevel } from "../shared/types";
import { getCounter } from "../shared/redis";

export interface RiskStatus {
  circuit_breaker: CircuitBreakerLevel;
  clones_today: number;
  llm_spent_today: number;
  observations_hourly: number;
}

export async function getRiskStatus(): Promise<RiskStatus> {
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().toISOString().slice(0, 13);

  const [clonesToday, llmSpent, obsHourly] = await Promise.all([
    getCounter(`mas:clones:daily:${today}`),
    getCounter(`mas:economy:llm_cost:${today}`),
    getCounter(`mas:observations:hourly:${hour}`),
  ]);

  let circuitBreaker: CircuitBreakerLevel = "green";
  if (clonesToday >= 200 * 0.9) {
    circuitBreaker = "red";
  } else if (clonesToday >= 200 * 0.7) {
    circuitBreaker = "orange";
  } else if (clonesToday >= 200 * 0.4) {
    circuitBreaker = "yellow";
  }

  return {
    circuit_breaker: circuitBreaker,
    clones_today: clonesToday,
    llm_spent_today: llmSpent,
    observations_hourly: obsHourly,
  };
}
