import { normalize, namehash } from "viem/ens";
import { publicClient } from "./client";
import { selector } from "./erc165_helpers";
import { registryAbi, resolverAbi } from "./abi";

// THE Registry address
const registryAddr = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

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
    args: [selector("addr(bytes32)")],
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
 * Manual implementation of viem's getEnsName({ address })
 */
async function resolveAddressToEns(address: string) {
  // Construct .addr.reverse string
  const hexWithout0x = address.toLowerCase().slice(2); // drop "0x"
  const reverseName = `${hexWithout0x}.addr.reverse`;

  const node = namehash(reverseName);

  // 1) Check if reverse record exists for address
  const recordExists = await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: "recordExists",
    args: [node],
  });

  // Exit if reverse lookup record doesn't exist
  if (!recordExists) {
    console.log("No reverse record set for", address);
    return null;
  }

  // 2) Obtain reverse resolver from registry
  const resolver = await publicClient.readContract({
    address: registryAddr,
    abi: registryAbi,
    functionName: "resolver",
    args: [node],
  });

  // Look into smart contracts to see if this can even happen for reverse records
  if (!resolver) {
    console.log("No resolver set for", address);
    return null;
  }

  // DefaultReverseResolver doesn't implement `supportsInterface`; so no check here

  // 3) Call name(bytes32 node)
  const name = await publicClient.readContract({
    address: resolver,
    abi: resolverAbi,
    functionName: "name",
    args: [node],
  });

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
