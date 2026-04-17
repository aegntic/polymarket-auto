const fs = require('fs');
let rpc = fs.readFileSync('src/ts/recon/rpc.ts', 'utf8');

// Use parsed transaction to avoid address lookup table errors if possible
rpc = rpc.replace(
  "const tx = await connection.getTransaction(oldestSig, { maxSupportedTransactionVersion: 0 });",
  "const tx = await connection.getParsedTransaction(oldestSig, { maxSupportedTransactionVersion: 0 });"
);

rpc = rpc.replace(
  "if (tx) {\n          const keys = tx.transaction.message.getAccountKeys();",
  "if (tx && tx.transaction.message.accountKeys.length > 0) {\n          const keys = tx.transaction.message.accountKeys;"
);

rpc = rpc.replace(
  "creator_address = keys.get(0)?.toString() || \"\";",
  "creator_address = keys[0]?.pubkey.toString() || \"\";"
);

fs.writeFileSync('src/ts/recon/rpc.ts', rpc);
