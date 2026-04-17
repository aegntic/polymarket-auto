const fs = require('fs');

// In live-ingest.ts we need to await the array of promises
let ingest = fs.readFileSync('src/ts/recon/live-ingest.ts', 'utf8');
ingest = ingest.replace(
  "const observations = pairs\n    .map(pairToObservation)\n    .filter(Boolean) as TokenObservation[];",
  "const obsPromises = await Promise.all(pairs.map(pairToObservation));\n  const observations = obsPromises.filter(Boolean) as TokenObservation[];"
);

// We must also update the clickhouse insert statement to include supply and decimals.
ingest = ingest.replace(
  "symbol: obs.symbol,",
  "symbol: obs.symbol,\n    decimals: obs.decimals,\n    supply: obs.supply || \"\","
);

fs.writeFileSync('src/ts/recon/live-ingest.ts', ingest);

// Do the same for orchestrator.ts
let orch = fs.readFileSync('src/ts/pipeline/orchestrator.ts', 'utf8');
orch = orch.replace(
  "const observations = pairs.map(pairToObservation).filter(Boolean) as TokenObservation[];",
  "const obsPromises = await Promise.all(pairs.map(pairToObservation));\n      const observations = obsPromises.filter(Boolean) as TokenObservation[];"
);
orch = orch.replace(
  "symbol: obs.symbol,",
  "symbol: obs.symbol,\n        decimals: obs.decimals,\n        supply: obs.supply || \"\","
);

fs.writeFileSync('src/ts/pipeline/orchestrator.ts', orch);
console.log("Updated live-ingest.ts and orchestrator.ts");
