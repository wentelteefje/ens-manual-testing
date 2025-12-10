// Minimal ABI for registry calls
export const registryAbi = [
  {
    type: "function",
    name: "recordExists",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
] as const;

// Minimal ABI for resolver calls
export const resolverAbi = [
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
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "string" }],
  },
] as const;

// Offchain Resolution
export const offchainResolverAbi = [
  {
    type: "function",
    name: "resolve",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "result", type: "bytes" }],
  },
  {
    type: "function",
    name: "resolveWithProof",
    stateMutability: "view",
    inputs: [
      { name: "response", type: "bytes" },
      { name: "extraData", type: "bytes" },
    ],
    outputs: [{ name: "result", type: "bytes" }],
  },
  {
    // CCIP Read error type
    type: "error",
    name: "OffchainLookup",
    inputs: [
      { name: "sender", type: "address" },
      { name: "urls", type: "string[]" },
      { name: "callData", type: "bytes" },
      { name: "callbackFunction", type: "bytes4" },
      { name: "extraData", type: "bytes" },
    ],
  },
] as const;

export const addrAbi = [
  {
    type: "function",
    name: "addr",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "result", type: "address" }],
  },
] as const;
