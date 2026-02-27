import { ethers } from 'ethers';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import {
  Aptos,
  AptosConfig,
  Deserializer,
  Ed25519Account,
  Ed25519PrivateKey,
  Network,
  PrivateKey,
  PrivateKeyVariants,
  RawTransaction,
  SimpleTransaction,
} from '@aptos-labs/ts-sdk';
import bs58 from 'bs58';
import { CHAIN_CONFIGS, WALLET_CONFIG } from './config';
import { TransactionData, KanaChainID } from './types';
import { Logger } from './logger';


export class WalletManager {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('WalletManager');
  }


  getEVMWallet(chainId: KanaChainID): ethers.Wallet {
    const chainConfig = CHAIN_CONFIGS[chainId];

    if (!chainConfig || chainConfig.type !== 'EVM') {
      throw new Error(`Chain ${chainId} is not an EVM chain`);
    }

    if (!WALLET_CONFIG.EVM_PRIVATE_KEY) {
      throw new Error('EVM_MAIN_PRIVATE_KEY not found in environment variables');
    }

    const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpcUrl);
    const wallet = new ethers.Wallet(WALLET_CONFIG.EVM_PRIVATE_KEY, provider);

    return wallet;
  }
  async _increaseGasLimit(originalGasLimit: number): Promise<number> {
    const increasePercentage = 0.1;
    const increaseAmount = originalGasLimit * increasePercentage;
    const increasedGasLimit = Math.ceil(originalGasLimit + increaseAmount);
    return increasedGasLimit;
  }
  
  async sendEVMTransaction(
    chainId: KanaChainID,
    txData: TransactionData
  ): Promise<string> {
    try {
      const wallet = this.getEVMWallet(chainId);

      // Build transaction
      const tx = {
        to: txData.to,
        data: txData.data,
        value: txData.value || '0',
        gasLimit: txData.gasLimit ? ethers.BigNumber.from(txData.gasLimit) : undefined,
        maxFeePerGas: txData.maxFeePerGas ? ethers.BigNumber.from(txData.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas ? ethers.BigNumber.from(txData.maxPriorityFeePerGas) : undefined,
      };

      this.logger.info(
        `Sending tx on ${CHAIN_CONFIGS[chainId].name} (gas: ${tx.gasLimit?.toString() || 'default'})...`
      );

      // Send transaction
      const txResponse = await wallet.sendTransaction({
        ...tx,
        gasLimit: tx.gasLimit || undefined,
      });

      this.logger.info(`✓ Sent: ${txResponse.hash}`);

      // Wait for confirmation
      const receipt = await txResponse.wait();

      this.logger.success(
        `✓ Confirmed in block ${receipt.blockNumber} (used ${receipt.gasUsed.toString()} gas)`
      );

      return txResponse.hash;
    } catch (error: any) {
      this.logger.error(`Transaction failed: ${error.message}`);
      throw error;
    }
  }

  private increaseGasLimit(
    gasLimit: ethers.BigNumber,
    percentage: number
  ): ethers.BigNumber {
    const increase = gasLimit.mul(Math.floor(percentage * 100)).div(100);
    return gasLimit.add(increase);
  }

  async sendApprovalIfNeeded(
    chainId: KanaChainID,
    approvalTx: TransactionData | null
  ): Promise<void> {
    if (!approvalTx) {
      this.logger.info('No approval needed');
      return;
    }

    this.logger.info('Sending token approval...');
    await this.sendEVMTransaction(chainId, approvalTx);
    this.logger.success('Approval confirmed');

    // Wait a bit for the approval to propagate
    await this.sleep(3000);
  }


  getSolanaKeypair(): Keypair {
    if (!WALLET_CONFIG.SOLANA_PRIVATE_KEY) {
      throw new Error('SOLANA_PRIVATE_KEY not found in environment variables');
    }

    return Keypair.fromSecretKey(bs58.decode(WALLET_CONFIG.SOLANA_PRIVATE_KEY));
  }


  getSolanaConnection(chainId: KanaChainID): Connection {
    const chainConfig = CHAIN_CONFIGS[chainId];

    if (!chainConfig || chainConfig.type !== 'SVM') {
      throw new Error(`Chain ${chainId} is not a Solana chain`);
    }

    return new Connection(chainConfig.rpcUrl, { commitment: 'confirmed' });
  }

async sendSolanaTransaction(chainId: KanaChainID, base64Tx: string): Promise<string> {
  try {
    this.logger.info(`Sending transaction on ${CHAIN_CONFIGS[chainId].name}...`);

    const connection = this.getSolanaConnection(chainId);
    const signer = this.getSolanaKeypair();

    // 1. Deserialize the versioned transaction
    const tx = VersionedTransaction.deserialize(Buffer.from(base64Tx, 'base64'));

    // 2. Sign the transaction
    tx.sign([signer]);

    // 3. Send the transaction
    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    this.logger.info(`Transaction sent: ${sig}`);
    this.logger.info('Waiting for confirmation (polling)...');

    // 4. MANUAL POLLING
    let confirmed = false;
    const timeout = 60000; // 60 seconds
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const { value: statuses } = await connection.getSignatureStatuses([sig]);
      const status = statuses[0];

      if (status) {
        if (status.err) {
          throw new Error(`Solana transaction failed: ${JSON.stringify(status.err)}`);
        }
        // 'confirmed' or 'finalized' are usually enough for the bridge to proceed
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          confirmed = true;
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Poll every 2s
    }

    if (!confirmed) {
      throw new Error('Transaction confirmation timeout');
    }

    this.logger.success(`Transaction confirmed!`);
    return sig;
  } catch (error: any) {
    this.logger.error('Failed to send Solana transaction:', error.message);
    throw error;
  }
}

  getAptosAccount(): Ed25519Account {
    if (!WALLET_CONFIG.APTOS_PRIVATE_KEY) {
      throw new Error('APTOS_PRIVATE_KEY not found in environment variables');
    }

    return new Ed25519Account({
      privateKey: new Ed25519PrivateKey(
        PrivateKey.formatPrivateKey(WALLET_CONFIG.APTOS_PRIVATE_KEY, PrivateKeyVariants.Ed25519)
      ),
    });
  }


  getAptosClient(chainId: KanaChainID): Aptos {
    const chainConfig = CHAIN_CONFIGS[chainId];

    if (!chainConfig || chainConfig.type !== 'MVM') {
      throw new Error(`Chain ${chainId} is not an Aptos chain`);
    }

    return new Aptos(
      new AptosConfig({
        network: Network.MAINNET,
        fullnode: chainConfig.rpcUrl,
      })
    );
  }


  async sendAptosTransaction(
    chainId: KanaChainID,
    payload: {
      function: string;
      type_arguments: string[];
      arguments: any[];
    }
  ): Promise<string> {
    try {
      this.logger.info(`Sending transaction on ${CHAIN_CONFIGS[chainId].name}...`);

      const aptos = this.getAptosClient(chainId);
      const signer = this.getAptosAccount();
      // Build the transaction
      const tx = await aptos.transaction.build.simple({
        sender: signer.accountAddress.toString(),
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.type_arguments,
          functionArguments: payload.arguments,
        },
        options: {
          gasUnitPrice: 100,
          maxGasAmount: 4000,
        },
      });

      this.logger.info('Signing and submitting transaction...');

      // Sign and submit the transaction
      const res = await aptos.signAndSubmitTransaction({
        signer,
        transaction: tx,
      });

      this.logger.info(`Transaction sent: ${res.hash}`);
      this.logger.info('Waiting for confirmation...');

      // Wait for transaction confirmation
      await aptos.waitForTransaction({
        transactionHash: res.hash,
        options: { checkSuccess: true },
      });

      this.logger.success(`Transaction confirmed!`);

      return res.hash;
    } catch (error: any) {
      this.logger.error('Failed to send Aptos transaction:', error.message);
      throw error;
    }
  }

  async sendAptosSerializedTransaction(chainId: KanaChainID, rawTxHex: string): Promise<string> {
    try {
        const aptos = this.getAptosClient(chainId);
        const account = this.getAptosAccount();

        // 1. Convert Hex to Bytes
        const txBytes = new Uint8Array(Buffer.from(rawTxHex, 'hex'));
        
        // 2. Deserialize into a RawTransaction object
        const deserializer = new Deserializer(txBytes);
        const rawTxn = RawTransaction.deserialize(deserializer);

        // 3. Wrap in SimpleTransaction
        const transaction = new SimpleTransaction(rawTxn);

        this.logger.info(`Submitting Serialized Transaction...`);

        // 4. Sign and Submit
        const committedTx = await aptos.signAndSubmitTransaction({
            signer: account,
            transaction: transaction,
        });

        // 5. Wait for confirmation
        await aptos.waitForTransaction({ transactionHash: committedTx.hash });
        
        this.logger.success(`Aptos Transaction Confirmed: ${committedTx.hash}`);
        return committedTx.hash;
    } catch (error: any) {
        this.logger.error(`Aptos Serialized Tx Failed: ${error.message}`);
        throw error;
    }
}


  getAddress(chainId: KanaChainID): string {
    const chainConfig = CHAIN_CONFIGS[chainId];

    if (!chainConfig) {
      throw new Error(`Chain ${chainId} not found in configuration`);
    }

    switch (chainConfig.type) {
      case 'EVM':
        const wallet = this.getEVMWallet(chainId);
        return wallet.address;

      case 'SVM':
        const solanaKeypair = this.getSolanaKeypair();
        return solanaKeypair.publicKey.toString();

      case 'MVM':
        const aptosAccount = this.getAptosAccount();
        return aptosAccount.accountAddress.toString();

      default:
        throw new Error(`Unsupported chain type: ${chainConfig.type}`);
    }
  }


  async getBalance(chainId: KanaChainID): Promise<string> {
    const chainConfig = CHAIN_CONFIGS[chainId];

    if (!chainConfig) {
      throw new Error(`Chain ${chainId} not found in configuration`);
    }

    switch (chainConfig.type) {
      case 'EVM':
        const wallet = this.getEVMWallet(chainId);
        const balance = await wallet.getBalance();
        return ethers.utils.formatEther(balance);

      case 'SVM':
        const connection = this.getSolanaConnection(chainId);
        const keypair = this.getSolanaKeypair();
        const solBalance = await connection.getBalance(keypair.publicKey);
        return (solBalance / 1e9).toString(); // Convert lamports to SOL

      case 'MVM':
        const aptos = this.getAptosClient(chainId);
        const account = this.getAptosAccount();
        const resources = await aptos.getAccountResources({
          accountAddress: account.accountAddress,
        });
        // Find APT coin resource
        const coinResource = resources.find(
          (r: any) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
        );
        if (coinResource && coinResource.data) {
          const coin = coinResource.data as { coin: { value: string } };
          return (parseInt(coin.coin.value) / 1e8).toString(); // Convert octas to APT
        }
        return '0';

      default:
        throw new Error(`Unsupported chain type: ${chainConfig.type}`);
    }
  }


  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
