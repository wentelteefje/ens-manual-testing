import { normalize, namehash } from "viem/ens";
import { publicClient } from "./client";

// THE Registry address
const registryAddr = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

// Minimal ABI for registry calls
const registryAbi = [
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
] as const;

// shared minimal ABI for resolver calls
const resolverAbi = [
  {
    type: "function",
    name: "supportsInterface",
    stateMutability: "pure",
    inputs: [{ name: "interfaceID", type: "bytes4" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "addr",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
] as const;

/**
 * Forward resolution: ENS name -> address
 * Manual implementation
 */
async function resolveEnsName(name: string) {
  const normalized = normalize(name);
  const node = namehash(normalized);

  // 1) Get resolver from ENS registry
  const resolver = await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: "resolver",
    args: [node],
  });

  if (!resolver) {
    console.log("No resolver set for", name);
    return null;
  }

  // 2) Check resolver supports addr(bytes32)
  const supportsAddr = await publicClient.readContract({
    address: resolver,
    abi: resolverAbi,
    functionName: "supportsInterface",
    args: ["0x3b3b57de"],
  });

  if (!supportsAddr) {
    console.log("Resolver does not support addr(bytes32) for", name);
    return null;
  }

  // 3) Call addr(bytes32 node)
  const address = await publicClient.readContract({
    address: resolver,
    abi: resolverAbi,
    functionName: "addr",
    args: [node],
  });

  return address;
}

/**
 * Reverse resolution: address -> ENS name
 * (for now: use viem’s built-in helper)
 */
async function resolveAddressToEns(address: `0x${string}`) {
  const name = await publicClient.getEnsName({ address });
  return name;
}

async function main() {
  // Forward resolution
  const addr = await resolveEnsName("nick.eth");

  console.log("Forward (nick.eth ->):", addr);

  // reverse resolution (only if we got an address)
  if (addr) {
    const reverseName = await resolveAddressToEns(addr);
    console.log("Reverse (addr ->):", reverseName);
  }
}

main().catch(console.error);
