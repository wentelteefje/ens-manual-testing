import { normalize, namehash, packetToBytes } from "viem/ens";
import {
  BaseError,
  decodeErrorResult,
  encodeFunctionData,
  decodeFunctionResult,
  toHex,
} from "viem";
import { publicClient, debugClient } from "./client";
import { selector, assertEqual } from "./utils";
import { registryAbi, resolverAbi, offchainResolverAbi, addrAbi } from "./abi";

// THE Registry address
const registryAddr = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

/**
 * Forward resolution: ENS name → address
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
 * Reverse resolution: address → ENS name
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

/**
 * Manual Offchain CCIP Read example
 * https://docs.ens.domains/resolvers/ccip-read#offchain-subname-example
 */
async function resolveEnsNameCCIP() {
  const name = "offchaindemo.eth";
  const normalized = normalize(name);
  const node = namehash(normalized);

  // DNS-encode the name (ENSIP-10)
  const nameBytes = toHex(packetToBytes(normalized));

  // ABI-encode the underlying query: addr(bytes32 node)
  const data = encodeFunctionData({
    abi: addrAbi,
    functionName: "addr",
    args: [node],
  });

  const offchainResolver: `0x${string}` =
    "0x35b920d4329C5797727Af8b15358b43509e5E237";

  const addr = await manualCCIPResolve(offchainResolver, nameBytes, data);

  return addr;
}

async function manualCCIPResolve(
  offchainResolver: `0x${string}`,
  nameBytes: `0x${string}`,
  data: `0x${string}`
) {
  try {
    // This will REVERT with OffchainLookup
    await debugClient.readContract({
      address: offchainResolver,
      abi: offchainResolverAbi,
      functionName: "resolve",
      args: [nameBytes, data],
    });

    throw new Error("Unexpected: resolve() did not revert with OffchainLookup");
  } catch (error: unknown) {
    if (!(error instanceof BaseError)) throw error;

    const errAny = error as any;
    const cause = errAny.cause ?? errAny;

    const revertData = cause?.data;
    if (!revertData) {
      console.error("No revert data found on error", cause);
      throw error;
    }

    // const decoded = decodeErrorResult({
    //   abi: offchainResolverAbi,
    //   data: revertData,
    // });
    // let decoded: any;
    let decoded = revertData; // already decoded object

    if (decoded.errorName !== "OffchainLookup") {
      console.error("Unexpected error:", decoded.errorName, decoded.args);
      throw error;
    }

    const [sender, urls, callData, callbackFn, extraData] = decoded.args as [
      `0x${string}`, // sender (resolver)
      string[], // urls
      `0x${string}`, // callData
      `0x${string}`, // callbackFunction
      `0x${string}` // extraData
    ];

    console.log("OffchainLookup sender:", sender);
    console.log("OffchainLookup url template:", urls[0]);

    // continue with HTTP call + callback:
    return await completeCCIPRead(sender, urls[0], callData, extraData);
  }
}

async function completeCCIPRead(
  sender: `0x${string}`,
  urlTemplate: string,
  callData: `0x${string}`,
  extraData: `0x${string}`
) {
  // 1) Construct the URL
  const url = urlTemplate
    .replace("{sender}", sender)
    .replace("{data}", callData);

  console.log("Gateway URL:", url);

  // 2) Call the gateway (GET)
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gateway HTTP error: ${res.status}`);
  }

  const json = (await res.json()) as { data: `0x${string}` };

  // `json.data` is the ABI-encoded `response` for resolveWithProof
  const responseBytes = json.data;

  // 3) Call back into the resolver: resolveWithProof(response, extraData)
  const resultBytes = await publicClient.readContract({
    address: sender,
    abi: offchainResolverAbi,
    functionName: "resolveWithProof",
    args: [responseBytes, extraData],
  });

  // 4) Decode final bytes as the return value of the original function (addr(bytes32))
  const finalAddress = decodeFunctionResult({
    abi: addrAbi,
    functionName: "addr",
    data: resultBytes,
  });

  return finalAddress;
}

async function main() {
  // Forward resolution
  const addr = await resolveEnsName("nick.eth");
  console.log("Forward (nick.eth →):", addr);
  // reverse resolution (only if we got an address)
  if (addr) {
    const reverseName = await resolveAddressToEns(addr);
    console.log("Reverse (addr →):", reverseName);
  }

  // Offchain Resolution using CCIP Read (manual implementation compared to viem)
  console.log("Offchain Resolution Test");
  const viem_offchain_address = await publicClient.getEnsAddress({
    name: "offchaindemo.eth",
  });
  console.log("Viem CCIP resolved address:", viem_offchain_address);

  const manual_offchain_addr = await resolveEnsNameCCIP();
  console.log("Manual CCIP resolved address:", manual_offchain_addr);

  if (viem_offchain_address) {
    assertEqual(
      viem_offchain_address.toLowerCase(),
      manual_offchain_addr.toLowerCase()
    );
  }
}

main().catch(console.error);
