interface Metric {
  name: string;
  type: "counter" | "gauge" | "histogram";
  help: string;
  labels: string[];
}

const METRICS: Metric[] = [
  { name: "mas_clone_deployments_total", type: "counter", help: "Total clone deployments", labels: ["chain", "strategy"] },
  { name: "mas_tokens_classified_total", type: "counter", help: "Total tokens classified", labels: ["classification", "model"] },
  { name: "mas_classification_duration_seconds", type: "histogram", help: "Classification duration", labels: ["model"] },
  { name: "mas_llm_cost_dollars", type: "counter", help: "LLM API cost in USD", labels: ["model"] },
  { name: "mas_circuit_breaker_fires", type: "counter", help: "Circuit breaker triggers", labels: ["level"] },
];

const counters = new Map<string, number>();

function key(name: string, labels: Record<string, string> = {}): string {
  const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",");
  return labelStr ? `${name}{${labelStr}}` : name;
}

export function inc(name: string, labels: Record<string, string> = {}, value = 1): void {
  const k = key(name, labels);
  counters.set(k, (counters.get(k) ?? 0) + value);
}

export function observe(name: string, labels: Record<string, string> = {}, _value: number): void {
  // Simplified: treat as counter for now
  inc(name, labels);
}

export function metricsOutput(): string {
  const lines: string[] = [];
  for (const m of METRICS) {
    lines.push(`# HELP ${m.name} ${m.help}`);
    lines.push(`# TYPE ${m.name} ${m.type}`);
  }
  for (const [k, v] of counters) {
    lines.push(`${k} ${v}`);
  }
  return lines.join("\n");
}
