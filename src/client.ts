import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(), // uses default public RPC
});

// For manual CCIP Read
export const debugClient = createPublicClient({
  chain: mainnet,
  transport: http(),
  ccipRead: false, // disable automatic CCIP Read handling
});
