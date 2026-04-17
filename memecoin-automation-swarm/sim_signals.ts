import Redis from 'ioredis';

const redis = new Redis('redis://localhost:6379');

async function sendSignals() {
  console.log("Publishing mock signals...");

  // 1. Send a good signal
  await redis.publish('recon:signals', JSON.stringify({
    timestamp: Date.now(),
    module: 'recon',
    event_type: 'signal_detected',
    payload: {
      address: '7aX...',
      name: 'CatCoin',
      symbol: 'CAT',
      chain: 'solana',
      dex: 'raydium',
      liquidityUSD: 150000,
      initialBuyBuyCrank: true,
      narrative_score: 85,
      dev_history: 'clean'
    }
  }));

  // 2. Send a bad signal
  await redis.publish('recon:signals', JSON.stringify({
    timestamp: Date.now(),
    module: 'recon',
    event_type: 'signal_detected',
    payload: {
      address: '8bY...',
      name: 'RugToken',
      symbol: 'RUG',
      chain: 'solana',
      dex: 'raydium',
      liquidityUSD: 1000,
      initialBuyBuyCrank: false,
      narrative_score: 20,
      dev_history: 'rug'
    }
  }));

  console.log("Signals published. Waiting for classification...");
  
  // Wait to see the pipeline logs in the background process
  setTimeout(() => {
    console.log("Done.");
    redis.quit();
    process.exit(0);
  }, 3000);
}

sendSignals();
