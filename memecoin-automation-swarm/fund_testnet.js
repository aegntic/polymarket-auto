import { Connection, Keypair, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';
import fs from 'fs';

async function fund() {
  const secretKey = JSON.parse(fs.readFileSync('.solana-deployer-keypair.json', 'utf-8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log('Funding PublicKey:', keypair.publicKey.toString());

  const connection = new Connection(clusterApiUrl('testnet'), 'confirmed');
  try {
    const signature = await connection.requestAirdrop(keypair.publicKey, 1 * LAMPORTS_PER_SOL);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
    console.log('Successfully funded 1 SOL on Testnet! Signature:', signature);
    const balance = await connection.getBalance(keypair.publicKey);
    console.log('New Balance:', balance / LAMPORTS_PER_SOL, 'SOL');
  } catch (error) {
    console.error('Failed to fund testnet:', error.message);
  }
}
fund();
