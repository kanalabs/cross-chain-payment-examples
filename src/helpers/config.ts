import "dotenv/config";
import { ChainConfig, TokenConfig, KanaChainID } from './types';

export const API_CONFIG = {
  BASE_URL: process.env.INTERNAL_API_URL || 'https://ag.kanalabs.io',
  API_KEY: process.env.API_KEY || '',
  QUOTE_ENDPOINT: '/v2/cross-chain/quote',
  STATUS_ENDPOINT: '/v2/cross-chain/status',
};

export const CHAIN_GAS_CONFIG: Record<number, string> = {
  3:  '30000000000', // Polygon   (KanaChainID.Polygon = 3)    — 30 gwei
  6:  '3000000000',  // Ethereum  (KanaChainID.Ethereum = 6)   — 3 gwei
  7:  '10000000',     // Base      (KanaChainID.Base = 7)       — 0.01 gwei
  10: '25000000000', // Avalanche (KanaChainID.Avalanche = 10) — 25 gwei
  11: '500000000',   // Arbitrum  (KanaChainID.Arbitrum = 11)  — 0.5 gwei
};

export const POLLING_CONFIG = {
  INITIAL_DELAY: 3000, // 3 seconds
  MAX_DELAY: 10000, // 10 seconds
  MAX_ATTEMPTS: 200, // Maximum polling attempts
};

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  [KanaChainID.Solana]: {
    chainId: KanaChainID.Solana,
    name: 'Solana',
    type: 'SVM',
    rpcUrl: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
  },
  [KanaChainID.Aptos]: {
    chainId: KanaChainID.Aptos,
    name: 'Aptos',
    type: 'MVM',
    rpcUrl: process.env.APTOS_RPC || 'https://fullnode.mainnet.aptoslabs.com/v1',
    nativeCurrency: {
      name: 'Aptos',
      symbol: 'APT',
      decimals: 8,
    },
  },
  [KanaChainID.Polygon]: {
    chainId: KanaChainID.Polygon,
    name: 'Polygon',
    type: 'EVM',
    rpcUrl: process.env.POLYGON_RPC || 'https://polygon-rpc.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  [KanaChainID.Ethereum]: {
    chainId: KanaChainID.Ethereum,
    name: 'Ethereum',
    type: 'EVM',
    rpcUrl: process.env.ETHEREUM_RPC || 'https://eth.llamarpc.com',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  [KanaChainID.Arbitrum]: {
    chainId: KanaChainID.Arbitrum,
    name: 'Arbitrum',
    type: 'EVM',
    rpcUrl: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  [KanaChainID.Avalanche]: {
    chainId: KanaChainID.Avalanche,
    name: 'Avalanche',
    type: 'EVM',
    rpcUrl: process.env.AVALANCHE_RPC || 'https://api.avax.network/ext/bc/C/rpc',
    nativeCurrency: {
      name: 'Avalanche',
      symbol: 'AVAX',
      decimals: 18,
    },
  },
  [KanaChainID.Base]: {
    chainId: KanaChainID.Base,
    name: 'Base',
    type: 'EVM',
    rpcUrl: process.env.BASE_RPC || 'https://mainnet.base.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};


export const USDC_TOKENS: Record<number, TokenConfig> = {
  [KanaChainID.Solana]: {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  [KanaChainID.Aptos]: {
    address: '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  [KanaChainID.Polygon]: {
    address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  [KanaChainID.Ethereum]: {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  [KanaChainID.Arbitrum]: {
    address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  [KanaChainID.Avalanche]: {
    address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  [KanaChainID.Base]: {
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
};

export const WALLET_CONFIG = {
  EVM_PRIVATE_KEY: process.env.EVM_MAIN_PRIVATE_KEY || '',
  SOLANA_PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY || '',
  APTOS_PRIVATE_KEY: process.env.APTOS_PRIVATE_KEY || '',
};
