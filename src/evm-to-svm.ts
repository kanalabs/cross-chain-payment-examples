import 'dotenv/config';
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
  const logger = new Logger('EVM-to-SVM');
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info('🚀 Starting Multi-Hop Test: Arbitrum (EVM) -> Solana (SVM)');
    logger.divider();

    // 1. Configuration
    const sourceChain = KanaChainID.Arbitrum;
    const targetChain = KanaChainID.Solana;
    const amount = '100000'; // 0.1 USDC (6 decimals)

    const userAddress = walletManager.getAddress(sourceChain);
    const recipientAddress = process.env.SOLANA_PUBLIC_KEY || walletManager.getAddress(targetChain);

    logger.info(`Route: Arbitrum (11) -> Solana (1)`);
    logger.info(`User Address: ${userAddress}`);
    logger.info(`Recipient Address: ${recipientAddress}`);

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
    };

    const quote = await apiClient.getQuote(quoteParams);
    const quoteData = quote.data;
    const txExecution = quoteData.transaction;

    if (txExecution.kind !== 'evm') {
      throw new Error(`Expected EVM transaction for source, got ${txExecution.kind}`);
    }

    logger.success(`Quote Received! ID: ${quoteData.requestId}`);

    // ---------------------------------------------------------
    // STEP 2: SIGN & SEND SOURCE TRANSACTION
    // ---------------------------------------------------------
    logger.step(2, 'Signing & Sending Source Transaction (Arbitrum)...');

    const txHash = await walletManager.sendEVMTransaction(
      sourceChain,
      {
        to: txExecution.execution.data.to,
        data: txExecution.execution.data.data,
        value: txExecution.execution.data.value,
        chainId: sourceChain,
      }
    );

    logger.success(`Source Transaction Confirmed! Hash: ${txHash}`);

    // ---------------------------------------------------------
    // STEP 3: SIGN AUTH MESSAGE
    // ---------------------------------------------------------
    logger.step(3, 'Signing Auth Message for status polling...');

    const wallet = walletManager.getEVMWallet(sourceChain);
    const authMessage = (quoteData as any).auth?.message;

    if (!authMessage) {
      throw new Error("Auth message missing in quote data.");
    }

    const signature = await wallet.signMessage(authMessage);
    logger.success('Auth Signature generated successfully');

    // ---------------------------------------------------------
    // STEP 4: POLL STATUS
    // ---------------------------------------------------------
    logger.step(4, 'Polling Multi-Hop Status...');

    const statusParams: StatusParams = {
      requestId: quoteData.requestId,
      txHash: txHash,
      userAddress: userAddress,
      recipientAddress: recipientAddress,
      amount: quoteData.amounts.amountOut, // Passing amountOut from quote
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      targetTokenAddress: USDC_TOKENS[targetChain].address,
      authSignature: signature, // Using the signature generated in Step 3
    };

    const finalStatus = await apiClient.pollStatus(statusParams);

    // ---------------------------------------------------------
    // FINISHED
    // ---------------------------------------------------------
    logger.divider();
    if (finalStatus.data.status === 'COMPLETED') {
      logger.success('🎉 SUCCESS! Bridge to Solana Completed.');
    } else {
      logger.error(`Transfer finished with status: ${finalStatus.data.status}`);
    }
    logger.info(`Final Tx Hash: ${finalStatus.data.txHash}`);
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