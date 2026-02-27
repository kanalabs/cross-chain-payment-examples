export interface QuoteParams {
  userAddress: string;
  amount: string;
  sourceChainId: number;
  targetChainId: number;
  sourceTokenAddress: string;
  targetTokenAddress: string;
  recipientAddress: string;
}

interface BaseQuoteResponse {
  requestId: string;
  quoteId: string;
  integrator: 'relay' | 'kana-aggregator';
  chains: {
    source: number;
    target: number;
  };
  tokens: {
    sourceAddress: string;
    targetAddress: string;
    sourceSymbol: string;
    targetSymbol: string;
    sourceDecimals: number;
    targetDecimals: number;
  };
  amounts: {
    amountIn: string;
    amountOut: string;
    amountInFormatted: string;
    amountOutFormatted: string;
  };
  fees: {
    gas: string | null;
    relayer: string;
    currency: string;
    totalUsd: number | null;
  };
}

interface SolanaTransaction {
  kind: 'solana';
  execution: {
    description: string;
    data: {
      instruction: string;
    };
  };
}

interface AptosTransaction {
  kind: 'aptos-serialized';
  execution: {
    description: string;
    data: {
      raw_transaction: string;
    };
  };
}

interface EVMTransaction {
  kind: 'evm';
  approval: {
    description: string;
    data: {
      to: string;
      data: string;
      value: string;
      chainId: number;
      gasLimit?: string;
    };
  } | null;
  execution: {
    description: string;
    data: {
      to: string;
      data: string;
      value: string;
      chainId: number;
      gasLimit?: string;
    };
  };
}

type Transaction = SolanaTransaction | AptosTransaction | EVMTransaction;

export type QuoteData = BaseQuoteResponse & {
  transaction: Transaction;
};

export interface QuoteResponse {
  status: string;
  message: string;
  data: QuoteData;
}

export interface TransactionData {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface StatusParams {
  requestId: string;
  txHash: string;
  userAddress: string;
  recipientAddress: string;
  amount: string;
  sourceChainId: number;
  targetChainId: number;
  targetTokenAddress: string;
  authSignature: string;
  authPublicKey?: string; // Optional, only needed for certain chains like Aptos
}

export interface StatusResponse {
  success: boolean;
  message: string;
  data: {
    transactionId: string;
    txHash: string;
    sourceChain: string;
    targetChain: string;
    status: TransactionStatus;
    steps: TransactionStep[];
  };
}

export type TransactionStatus =
  | 'INITIATED'
  | 'PROCESSING_RELAY_POLL'
  | 'PROCESSING_CCTP_QUOTE'
  | 'PROCESSING_CCTP_PAYLOAD'
  | 'PROCESSING_RELAYER_CLAIM'
  | 'PROCESSING_RELAYER_POLL'
  | 'COMPLETED'
  | 'FAILED';

export interface TransactionStep {
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  description: string;
  txHash?: string;
}

export enum KanaChainID {
  Solana = 1,
  Aptos = 2,
  Polygon = 3,
  Ethereum = 6,
  Base = 7,
  Avalanche = 10,
  Arbitrum = 11,
}

export interface ChainConfig {
  chainId: KanaChainID;
  name: string;
  type: 'EVM' | 'SVM' | 'MVM';
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}