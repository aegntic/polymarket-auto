const fs = require('fs');

let orch = fs.readFileSync('src/ts/pipeline/orchestrator.ts', 'utf8');

orch = orch.replace(
  "const observations = pairs\n      .map(pairToObservation)\n      .filter((o): o is TokenObservation => Boolean(o));",
  "const rawObs = await Promise.all(pairs.map(pairToObservation));\n    const observations = rawObs.filter((o): o is TokenObservation => o !== null);"
);

fs.writeFileSync('src/ts/pipeline/orchestrator.ts', orch);

let ingest = fs.readFileSync('src/ts/recon/live-ingest.ts', 'utf8');

ingest = ingest.replace(
  "const observations = pairs\n    .map(pairToObservation)\n    .filter((o): o is TokenObservation => Boolean(o));",
  "const rawObs = await Promise.all(pairs.map(pairToObservation));\n  const observations = rawObs.filter((o): o is TokenObservation => o !== null);"
);

fs.writeFileSync('src/ts/recon/live-ingest.ts', ingest);

console.log("Fixed the actual strings");
