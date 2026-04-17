import { NarrativeEngine } from "../viral/narratives";

async function run() {
  console.log("=== Testing Viral Narrative Sliding Window ===");
  const engine = new NarrativeEngine();
  
  // 1. Simulate Elon Musk tweeting about a new robot dog
  console.log("\n[1] Elon Musk tweets about OptiDog");
  await engine.ingestSocialPost(
    "twitter", 
    "elonmusk", 
    "Just reviewed the new Optimus designs. We are adding a robot dog companion called OptiDog.", 
    55000 // High velocity
  );

  // 2. Simulate random crypto bro tweeting
  console.log("[2] Random KOL tweets about a cat");
  await engine.ingestSocialPost(
    "twitter", 
    "cryptobro99", 
    "I am bullish on any cat coins today. Popcat looks strong.", 
    150 // Low velocity
  );

  // 3. Let's see active narratives
  const active = await engine.getActiveNarratives();
  console.log(`\n[3] Active Narratives in Redis Window: ${active.length}`);
  active.forEach(a => console.log(`  - ${a.author}: [${a.keywords.join(", ")}] (Velocity: ${a.velocity})`));

  // 4. Test Narrative Distance on a newly sniped token
  console.log("\n[4] Rust Sniper detects: Ticker: OPTIDOG, Name: Optimus Dog");
  const optiMatch = await engine.calculateNarrativeDistance("Optimus Dog", "OPTIDOG");
  console.log(`  Distance: ${optiMatch.distance.toFixed(1)}`);
  if (optiMatch.match) {
    console.log(`  Match Reason: Triggered by ${optiMatch.match.author}'s tweet ${Math.round((Date.now() - optiMatch.match.timestamp)/1000)} seconds ago.`);
  }

  // 5. Test Narrative Distance on a generic token
  console.log("\n[5] Rust Sniper detects: Ticker: SHIBX, Name: ShibaX");
  const genericMatch = await engine.calculateNarrativeDistance("ShibaX", "SHIBX");
  console.log(`  Distance: ${genericMatch.distance.toFixed(1)} (100 = No relation)`);
  if (!genericMatch.match) {
    console.log(`  Match Reason: No active narrative correlation found in the sliding window.`);
  }

  process.exit(0);
}

run();
