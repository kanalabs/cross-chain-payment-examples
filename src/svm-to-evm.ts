import {
  KanaChainID,
  USDC_TOKENS,
  Logger,
  CrossChainAPIClient,
  WalletManager,
  QuoteParams,
  StatusParams,
} from './helpers';

async function main() {
  const logger = new Logger('SVM-to-EVM');
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info('Cross-Chain Transfer: Solana -> Arbitrum (SVM to EVM)');
    logger.divider();

    // Configuration
    const sourceChain = KanaChainID.Solana;
    const targetChain = KanaChainID.Arbitrum;
    const amount = '40000'; // 0.04 USDC (6 decimals)

    const userAddress = walletManager.getAddress(sourceChain);
    const recipientAddress = walletManager.getAddress(targetChain);

    logger.info(`Source Chain: Solana (ID: ${sourceChain})`);
    logger.info(`Target Chain: Arbitrum (ID: ${targetChain})`);
    logger.info(`User Address: ${userAddress}`);
    logger.info(`Amount: 0.04 USDC`);

    // Step 1: Get Quote
    logger.step(1, 'Fetching cross-chain quote');

    const quoteParams: QuoteParams = {
      userAddress,
      amount,
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      sourceTokenAddress: USDC_TOKENS[sourceChain].address,
      targetTokenAddress: USDC_TOKENS[targetChain].address,
      recipientAddress,
    };

    const quote = await apiClient.getQuote(quoteParams);
    // Validate transaction type
    const transaction = quote.data.transaction;
    if (transaction.kind !== 'solana') {
      throw new Error(`Expected Solana transaction, got ${transaction.kind}`);
    }

    // Step 2: Execute Solana transaction
    logger.step(2, 'Executing cross-chain transaction on Solana');
    const txHash = await walletManager.sendSolanaTransaction(sourceChain, transaction.execution.data.instruction);

    logger.success(`Transaction sent: ${txHash}`);

    // Step 4: Poll status
    logger.step(4, 'Polling transaction status');

    const statusParams: StatusParams = {
      requestId: quote.data.requestId,
      txHash,
      userAddress,
      recipientAddress,
      amount,
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      targetTokenAddress: USDC_TOKENS[targetChain].address,
    };

    const finalStatus = await apiClient.pollStatus(statusParams);

    // Success
    logger.divider();
    logger.success('Cross-chain transfer completed successfully!');
    logger.info(`Transaction ID: ${finalStatus.data.transactionId}`);
    logger.info(`Transaction Hash: ${finalStatus.data.txHash}`);
    logger.info(`Final Status: ${finalStatus.data.status}`);
    logger.divider();
  } catch (error: any) {
    logger.error('Cross-chain transfer failed:', error.message);
    process.exit(1);
  }
}

// Run the example
main();
