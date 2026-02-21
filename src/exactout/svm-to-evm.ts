import 'dotenv/config';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {
  KanaChainID,
  USDC_TOKENS,
  Logger,
  CrossChainAPIClient,
  WalletManager,
  QuoteParams,
  StatusParams,
} from '../helpers';

async function main() {
  const logger = new Logger('SVM-to-EVM');
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info('🚀 Starting Multi-Hop Test: Solana (SVM) -> Arbitrum (EVM)');
    logger.divider();

    // 1. Configuration
    const sourceChain = KanaChainID.Solana;
    const targetChain = KanaChainID.Arbitrum;
    const amount = '100000'; // 0.1 USDC (6 decimals)

    const userAddress = walletManager.getAddress(sourceChain);
    const recipientAddress = process.env.EVM_SOURCE_PUBLIC_KEY || walletManager.getAddress(targetChain);

    logger.info(`Route: Solana (1) -> Arbitrum (11)`);
    logger.info(`Source User: ${userAddress}`);
    logger.info(`Target Recipient: ${recipientAddress}`);

    // ---------------------------------------------------------
    // STEP 1: GET QUOTE
    // ---------------------------------------------------------
    logger.step(1, 'Fetching cross-chain quote...');

    const quoteParams: QuoteParams = {
      userAddress,
      amount,
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      sourceTokenAddress: USDC_TOKENS[sourceChain].address,
      targetTokenAddress: USDC_TOKENS[targetChain].address,
      recipientAddress,
      swapMode: 'ExactOut', // Specify ExactOut mode for the quote
    };

    const quote = await apiClient.getQuote(quoteParams);
    const quoteData = quote.data;
    const txData = quoteData.transaction;

    if (txData.kind !== 'solana') {
      throw new Error(`Expected 'solana' transaction kind, got ${txData.kind}`);
    }

    logger.success(`Quote Received! ID: ${quoteData.requestId}`);

    // ---------------------------------------------------------
    // STEP 2: SIGN & SEND SOLANA TRANSACTION
    // ---------------------------------------------------------
    logger.step(2, 'Signing & Sending Solana Transaction...');

    const txSignature = await walletManager.sendSolanaTransaction(
      sourceChain,
      txData.execution.data.instruction
    );

    logger.success(`Solana Transaction Confirmed! Signature: ${txSignature}`);

    // ---------------------------------------------------------
    // STEP 3: SIGN AUTH MESSAGE
    // ---------------------------------------------------------
    logger.step(3, 'Signing Auth Message for status polling...');

    const solanaKeypair = walletManager.getSolanaKeypair();
    const authMessage = (quoteData as any).auth?.message;

    if (!authMessage) {
      throw new Error("Auth message missing in quote data.");
    }

    const messageBytes = new TextEncoder().encode(authMessage);
    const signedMessage = nacl.sign.detached(messageBytes, solanaKeypair.secretKey);
    const authSignature = bs58.encode(signedMessage);

    logger.success('Solana Auth Signature generated');

    // ---------------------------------------------------------
    // STEP 4: POLL STATUS
    // ---------------------------------------------------------
    logger.step(4, 'Polling Multi-Hop Status (Solana -> Arbitrum)...');

    const statusParams: StatusParams = {
      requestId: quoteData.requestId,
      txHash: txSignature,
      userAddress: userAddress,
      recipientAddress: recipientAddress,
      amount: quoteData.amounts.amountOut, // Passing amountOut from quote
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      targetTokenAddress: USDC_TOKENS[targetChain].address,
      authSignature: authSignature,
    };

    const finalStatus = await apiClient.pollStatus(statusParams);

    // ---------------------------------------------------------
    // FINISHED
    // ---------------------------------------------------------
    logger.divider();
    if (finalStatus.data.status === 'COMPLETED') {
      logger.success('🎉 SUCCESS! Bridge to Arbitrum Completed.');
    } else {
      logger.error(`Transfer finished with status: ${finalStatus.data.status}`);
    }
    logger.divider();

  } catch (error: any) {
    logger.error('Test Execution Failed:');
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

main();