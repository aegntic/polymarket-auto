import { Connection, PublicKey } from "@solana/web3.js";
import { ethers } from "ethers";

// ERC20 minimal ABI for getting supply, decimals, and creator (via first tx if possible, or just default)
const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export async function fetchSolanaTokenInfo(
  address: string,
  rpcUrl: string = "https://api.mainnet-beta.solana.com",
) {
  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const pubkey = new PublicKey(address);

    // Get token supply & decimals
    const supplyInfo = await connection.getTokenSupply(pubkey);

    // Get creator by looking at the earliest signatures
    let creator_address = "";
    try {
      const sigs = await connection.getSignaturesForAddress(pubkey, {
        limit: 1000,
      });
      if (sigs.length > 0) {
        // The last signature in the array is the oldest one we fetched
        const oldestSig = sigs[sigs.length - 1].signature;
        const tx = await connection.getParsedTransaction(oldestSig, {
          maxSupportedTransactionVersion: 0,
        });
        if (tx && tx.transaction.message.accountKeys.length > 0) {
          const keys = tx.transaction.message.accountKeys;
          if (keys.length > 0) {
            // The fee payer is typically the creator/deployer
            creator_address = keys[0]?.pubkey.toString() || "";
          }
        }
      }
    } catch (e) {
      console.log(
        "Could not fetch Solana creator for",
        address,
        (e as Error).message,
      );
    }

    return {
      supply: supplyInfo.value.uiAmountString || supplyInfo.value.amount,
      decimals: supplyInfo.value.decimals,
      creator_address,
    };
  } catch (error) {
    console.error(
      `Error fetching Solana token info for ${address}:`,
      (error as Error).message,
    );
    return { supply: "0", decimals: 9, creator_address: "" };
  }
}

export async function fetchEvmTokenInfo(address: string, rpcUrl: string) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(address, ERC20_ABI, provider);

    const [supply, decimals] = await Promise.all([
      contract.totalSupply().catch(() => 0n),
      contract.decimals().catch(() => 18n),
    ]);

    // Formatting supply using decimals
    const formattedSupply = ethers.formatUnits(supply, Number(decimals));

    // Creator address on EVM is harder to get via standard RPC without a block explorer API or indexing the creation block.
    // For now, we leave it empty, but returning supply and decimals is a big improvement.

    return {
      supply: formattedSupply.toString(),
      decimals: Number(decimals),
      creator_address: "",
    };
  } catch (error) {
    console.error(
      `Error fetching EVM token info for ${address}:`,
      (error as Error).message,
    );
    return { supply: "0", decimals: 18, creator_address: "" };
  }
}
