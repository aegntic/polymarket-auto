import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';

async function checkBalance() {
  const secretKey = JSON.parse(fs.readFileSync('.solana-deployer-keypair.json', 'utf-8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log('PublicKey:', keypair.publicKey.toString());

  const connection = new Connection('http://localhost:8899', 'confirmed');
  try {
    const balance = await connection.getBalance(keypair.publicKey);
    console.log('Localhost Balance:', balance / LAMPORTS_PER_SOL, 'SOL');
  } catch (error) {
    console.error('Failed to get balance:', error.message);
  }
}
checkBalance();
