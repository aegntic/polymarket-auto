import { Keypair } from '@solana/web3.js';
import fs from 'fs';

const keypair = Keypair.generate();
const secretKey = Array.from(keypair.secretKey);
fs.writeFileSync('.solana-deployer-keypair.json', JSON.stringify(secretKey));
console.log('Public Key:', keypair.publicKey.toString());
console.log('Keypair saved to .solana-deployer-keypair.json');
