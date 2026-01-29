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
  const logger = new Logger('EVM-to-MVM');
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info('Cross-Chain Transfer: Arbitrum -> Aptos (EVM to MVM)');
    logger.divider();

    // Configuration
    const sourceChain = KanaChainID.Arbitrum;
    const targetChain = KanaChainID.Aptos;
    const amount = '40000'; // 0.04 USDC (6 decimals)

    const userAddress = walletManager.getAddress(sourceChain);
    const recipientAddress = walletManager.getAddress(targetChain);

    logger.info(`Source Chain: Arbitrum (ID: ${sourceChain})`);
    logger.info(`Target Chain: Aptos (ID: ${targetChain})`);
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
    const transaction = quote.data.transaction;
    if (transaction.kind !== 'evm') {
      throw new Error(`Expected EVM transaction, got ${transaction.kind}`);
    }

    // Step 2: Send Approval (if needed)
    logger.step(2, 'Handling token approval');
    if (transaction.approval) {
      logger.info('Approval required - sending approval transaction...');
      const approvalTxHash = await walletManager.sendEVMTransaction(
        sourceChain,
        transaction.approval.data
      );
      logger.success(`Approval confirmed: ${approvalTxHash}`);
    } else {
      logger.info('No approval needed');
    }

    // Step 3: Execute main transaction
    logger.step(3, 'Executing cross-chain transaction');
    const txHash = await walletManager.sendEVMTransaction(
      sourceChain,
      transaction.execution.data
    );

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
