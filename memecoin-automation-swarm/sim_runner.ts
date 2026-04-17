import { spawn } from 'child_process';
import Redis from 'ioredis';

const redis = new Redis('redis://localhost:6379');

async function run() {
  console.log("Starting server...");
  const server = spawn('bun', ['run', 'src/ts/api/server.ts']);
  
  server.stdout.on('data', (data) => console.log(`[SERVER]: ${data}`));
  server.stderr.on('data', (data) => console.error(`[SERVER ERR]: ${data}`));

  setTimeout(async () => {
    console.log("Publishing test signals...");
    await redis.publish('recon:signals', JSON.stringify({
      timestamp: Date.now(),
      module: 'recon',
      event_type: 'signal_detected',
      payload: {
        address: 'BZZ...',
        name: 'MoonDog',
        symbol: 'MDOG',
        chain: 'solana',
        dex: 'raydium',
        liquidityUSD: 85000,
        initialBuyBuyCrank: true,
        narrative_score: 95,
        dev_history: 'unknown'
      }
    }));
  }, 3000);

  setTimeout(() => {
    console.log("Killing server.");
    server.kill();
    redis.quit();
    process.exit(0);
  }, 8000);
}

run();
