export const HACKATHON_TOKEN_ABI = [
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ATTESTATION_ABI = [
  {
    type: "function",
    name: "attest",
    inputs: [
      { name: "tokenAddress", type: "address" },
      { name: "assetType", type: "string" },
      { name: "riskScore", type: "uint256" },
      { name: "complianceStatus", type: "string" },
      { name: "metadata", type: "string" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAttestation",
    inputs: [{ name: "tokenAddress", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "issuer", type: "address" },
          { name: "tokenAddress", type: "address" },
          { name: "assetType", type: "string" },
          { name: "riskScore", type: "uint256" },
          { name: "complianceStatus", type: "string" },
          { name: "metadata", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AttestationCreated",
    inputs: [
      { name: "tokenAddress", type: "address", indexed: true },
      { name: "issuer", type: "address", indexed: true },
      { name: "riskScore", type: "uint256", indexed: false },
    ],
  },
] as const;

export const MARKETPLACE_ABI = [
  {
    type: "function",
    name: "list",
    inputs: [
      { name: "tokenAddress", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "pricePerUnit", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buy",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getListing",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "tokenAddress", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "pricePerUnit", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "listingCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Listed",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "tokenAddress", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "pricePerUnit", type: "uint256", indexed: false },
    ],
  },
] as const;

// Contract addresses - loaded from env or set at runtime
export const ADDRESSES = {
  deploymentProxyRegistry:
    (process.env.DEPLOYMENT_PROXY_REGISTRY ?? "0x75Da1758161588FD2ccbFd23AB87f373b0f73c8F") as `0x${string}`,
  hackathonToken: (process.env.TOKEN_ADDRESS ?? "") as `0x${string}`,
  attestation: (process.env.ATTESTATION_ADDRESS ?? "") as `0x${string}`,
  marketplace: (process.env.MARKETPLACE_ADDRESS ?? "") as `0x${string}`,
};
