# Cross-Chain Payment API Examples

This directory contains chain-specific examples for using the Xyra Payment API to perform cross-chain token transfers.

## Overview

The examples demonstrate how to:
1. Fetch cross-chain quotes
2. Execute cross-chain transactions
3. Poll transaction status until completion

Each example is organized by chain combination (e.g., EVM-to-EVM, EVM-to-MVM, etc.) and uses common helper utilities for API calls and wallet management.

## Directory Structure

```
cross-chain-examples/
├── helpers/              # Common utilities
│   ├── types.ts         # TypeScript type definitions
│   ├── config.ts        # Configuration and constants
│   ├── logger.ts        # Logging utility
│   ├── api.ts           # API client for quote and status endpoints
│   ├── wallet.ts        # Wallet management utilities
│   └── index.ts         # Helper exports
├── evm-to-evm.ts        # EVM to EVM example (Arbitrum -> Avalanche)
├── evm-to-mvm.ts        # EVM to MVM example (Arbitrum -> Aptos)
├── evm-to-svm.ts        # EVM to SVM example (Arbitrum -> Solana)
├── mvm-to-evm.ts        # MVM to EVM example (Aptos -> Avalanche)
├── mvm-to-svm.ts        # MVM to SVM example (Aptos -> Solana)
├── svm-to-evm.ts        # SVM to EVM example (Solana -> Avalanche)
├── svm-to-mvm.ts        # SVM to MVM example (Solana -> Aptos)
└── README.md            # This file
```

## Chain Types

- **EVM (Ethereum Virtual Machine):** Arbitrum, Avalanche, Ethereum, Polygon, Base, etc.
- **MVM (Move Virtual Machine):** Aptos, Sui
- **SVM (Solana Virtual Machine):** Solana

## Prerequisites

1. Node.js v16 or higher
2. TypeScript
3. Required environment variables (see Configuration section)

## Configuration

Create a `.env` file in the project root with the following variables:

```bash
# API Configuration
INTERNAL_API_URL=https://ag.kanalabs.io
API_KEY=your_api_key_here

# RPC Endpoints
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
AVALANCHE_RPC=https://api.avax.network/ext/bc/C/rpc
ETHEREUM_RPC=https://eth.llamarpc.com
POLYGON_RPC=https://polygon-rpc.com
SOLANA_RPC=https://api.mainnet-beta.solana.com
APTOS_RPC=https://fullnode.mainnet.aptoslabs.com/v1
BASE_RPC=https://mainnet.base.org

# Wallet Private Keys
EVM_MAIN_PRIVATE_KEY=0x...                    # EVM chains private key
SOLANA_PRIVATE_KEY=...                        # Solana wallet private key (base58)
APTOS_PRIVATE_KEY=...                         # Aptos wallet private key

# Public Addresses
APTOS_TARGET_PUBLIC_KEY=0x...                 # Aptos wallet address
SOLANA_PUBLIC_KEY=...                         # Solana wallet address
```
