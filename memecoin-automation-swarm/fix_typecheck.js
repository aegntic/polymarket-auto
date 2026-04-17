const fs = require('fs');

let rpc = fs.readFileSync('src/ts/recon/rpc.ts', 'utf8');
rpc = rpc.replace(/e\.message/g, '(e as Error).message');
rpc = rpc.replace(/error\.message/g, '(error as Error).message');
// Fix accountKeys access for VersionedMessage
rpc = rpc.replace(
  "if (tx && tx.transaction.message.accountKeys.length > 0) {",
  "if (tx) {\n          const keys = tx.transaction.message.getAccountKeys();\n          if (keys.length > 0) {"
);
rpc = rpc.replace(
  "creator_address = tx.transaction.message.accountKeys[0].toString() || tx.transaction.message.accountKeys[0].pubkey.toString();",
  "creator_address = keys.get(0)?.toString() || \"\";\n          }"
);
fs.writeFileSync('src/ts/recon/rpc.ts', rpc);

// Fix orchestrator map error (I accidentally replaced the wrong thing)
let orch = fs.readFileSync('src/ts/pipeline/orchestrator.ts', 'utf8');
// Fix Type 'TokenObservation' is missing from 'Promise'
orch = orch.replace("const observations = obsPromises.filter(Boolean) as TokenObservation[];", "const observations = obsPromises.filter(Boolean) as any as TokenObservation[];");
orch = orch.replace("const obsPromises = await Promise.all(pairs.map(pairToObservation));\n      const observations = obsPromises.filter(Boolean) as any as TokenObservation[];", "const obsPromises = await Promise.all(pairs.map(pairToObservation));\n      const observations = obsPromises.filter((o) => o !== null) as TokenObservation[];");

// Fix map properties by explicitly making it TokenObservation
orch = orch.replace("obsPromises.filter((o) => o !== null) as TokenObservation[];", "obsPromises.filter((o): o is TokenObservation => o !== null);");
fs.writeFileSync('src/ts/pipeline/orchestrator.ts', orch);

let ingest = fs.readFileSync('src/ts/recon/live-ingest.ts', 'utf8');
ingest = ingest.replace("const observations = obsPromises.filter(Boolean) as TokenObservation[];", "const observations = obsPromises.filter((o): o is TokenObservation => o !== null);");
fs.writeFileSync('src/ts/recon/live-ingest.ts', ingest);

console.log("Fixed types");
