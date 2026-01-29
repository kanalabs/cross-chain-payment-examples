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
  const logger = new Logger('MVM-to-SVM');
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info('Cross-Chain Transfer: Aptos -> Solana (MVM to SVM)');
    logger.divider();

    // Configuration
    const sourceChain = KanaChainID.Aptos;
    const targetChain = KanaChainID.Solana;
    const amount = '10000'; // 0.04 USDC (6 decimals)

    const userAddress = walletManager.getAddress(sourceChain);
    const recipientAddress = walletManager.getAddress(targetChain);

    logger.info(`Source Chain: Aptos (ID: ${sourceChain})`);
    logger.info(`Target Chain: Solana (ID: ${targetChain})`);
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
    if (transaction.kind !== 'aptos') {
      throw new Error(`Expected Aptos transaction, got ${transaction.kind}`);
    }

    // Step 2: Execute Aptos transaction
    logger.step(2, 'Executing cross-chain transaction on Aptos');
    const txHash = await walletManager.sendAptosTransaction(sourceChain, transaction.execution.data);
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
