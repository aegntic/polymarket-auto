import { Connection, PublicKey } from "@solana/web3.js";
import { ethers } from "ethers";

// H4: Singleton connection pool for RPC providers
const solanaConnections = new Map<string, Connection>();
const evmProviders = new Map<string, ethers.JsonRpcProvider>();

function getSolanaConnection(rpcUrl: string): Connection {
  if (!solanaConnections.has(rpcUrl)) {
    solanaConnections.set(rpcUrl, new Connection(rpcUrl, "confirmed"));
  }
  return solanaConnections.get(rpcUrl)!;
}

function getEvmProvider(rpcUrl: string): ethers.JsonRpcProvider {
  if (!evmProviders.has(rpcUrl)) {
    evmProviders.set(rpcUrl, new ethers.JsonRpcProvider(rpcUrl));
  }
  return evmProviders.get(rpcUrl)!;
}

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
    const connection = getSolanaConnection(rpcUrl);
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
        const oldestSig = sigs[sigs.length - 1].signature;
        const tx = await connection.getParsedTransaction(oldestSig, {
          maxSupportedTransactionVersion: 0,
        });
        if (tx && tx.transaction.message.accountKeys.length > 0) {
          const keys = tx.transaction.message.accountKeys;
          if (keys.length > 0) {
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
    const provider = getEvmProvider(rpcUrl);
    const contract = new ethers.Contract(address, ERC20_ABI, provider);

    const [supply, decimals] = await Promise.all([
      contract.totalSupply().catch(() => 0n),
      contract.decimals().catch(() => 18n),
    ]);

    const formattedSupply = ethers.formatUnits(supply, Number(decimals));

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
