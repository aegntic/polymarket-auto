// Script to generate a new wallet (Polygon mainnet)
import { generateMnemonic, mnemonicToAccount, english } from 'viem/accounts'

// Generate 12-word mnemonic (128 bits of entropy = 12 words)
const mnemonic = generateMnemonic(english, 128)

// Create account from mnemonic
const account = mnemonicToAccount(mnemonic)

console.log('=== NEW POLYGON WALLET ===')
console.log('')
console.log('12-Word Seed Phrase:')
console.log(mnemonic)
console.log('')
console.log('Wallet Address (for deposits):')
console.log(account.address)
console.log('')
console.log('⚠️  SAVE THE SEED PHRASE SECURELY — it controls the wallet!')
console.log('⚠️  Send POL (Matic) to this address for gas (~$5 worth)')
console.log('⚠️  Send USDC (Polygon) to this address for trading (~$25+ worth)')
console.log('')
console.log('What to do next:')
console.log('1. Save the 12 words securely (password manager, paper wallet)')
console.log('2. Send POL for gas (0.5-1 POL is plenty)')
console.log('3. Send USDC for trading (start with $25-50)')
console.log('4. Connect this wallet in the app via RainbowKit')
console.log('')
console.log('Seed words count:', mnemonic.split(' ').length)
console.log('Address format: 0x + 40 hex chars')
