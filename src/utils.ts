import { keccak256, toBytes } from "viem";

// Function selector = first 4 bytes of keccak256(signature)
// Signature for addr(bytes32 node) = 0x3b3b57de
// Signature for name(bytes32 node) = 0x691f3431
export function selector(signature: string): `0x${string}` {
  const hash = keccak256(toBytes(signature));
  return ("0x" + hash.slice(2, 10)) as `0x${string}`;
}

export function assertEqual<T>(a: T, b: T, msg?: string): asserts a is T {
  if (a !== b) {
    throw new Error(msg ?? `Assertion failed: ${a} !== ${b}`);
  }
}
