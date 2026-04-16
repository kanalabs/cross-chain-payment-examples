import 'dotenv/config';
import {
  CrossChainAPIClient,
  KanaChainID,
  Logger,
  QuoteParams,
  StatusParams,
  USDT_TOKENS,
  WalletManager,
} from './helpers';

async function main() {
  const logger = new Logger('EVM-to-TON');
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info('🚀 Starting Multi-Hop Test: Polygon (EVM) -> TON');
    logger.divider();

    const sourceChain = KanaChainID.Polygon;
    const targetChain = KanaChainID.Ton;
    const amount = '50000'; // 10 USDT (6 decimals)

    const sourceToken = USDT_TOKENS[sourceChain];
    const targetToken = USDT_TOKENS[targetChain];

    if (!sourceToken || !targetToken) {
      throw new Error('USDT token configuration missing for Polygon -> TON');
    }

    const userAddress = walletManager.getAddress(sourceChain);
    const recipientAddress = process.env.TON_RECIPIENT || await walletManager.getTonAddress();

    logger.info(`Route: Polygon (${sourceChain}) -> TON (${targetChain})`);
    logger.info(`Source User: ${userAddress}`);
    logger.info(`Target Recipient: ${recipientAddress}`);

    logger.step(1, 'Fetching cross-chain quote...');

    const quoteParams: QuoteParams = {
      userAddress,
      amount,
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      sourceTokenAddress: sourceToken.address,
      targetTokenAddress: targetToken.address,
      recipientAddress,
    };

    const quote = await apiClient.getQuote(quoteParams);
    const quoteData = quote.data;
    const txExecution = quoteData.transaction;

    if (txExecution.kind !== 'evm') {
      throw new Error(`Expected EVM transaction for source, got ${txExecution.kind}`);
    }

    logger.success(`Quote Received! ID: ${quoteData.requestId}`);

    logger.step(2, 'Signing & Sending Source Transaction (Polygon)...');

    await walletManager.sendApprovalIfNeeded(
      sourceChain,
      txExecution.approval?.data || null,
    );

    const txHash = await walletManager.sendEVMTransaction(
      sourceChain,
      txExecution.execution.data,
    );

    logger.success(`Source Transaction Confirmed! Hash: ${txHash}`);

    logger.step(3, 'Signing Auth Message for status polling...');

    const authMessage = quoteData.auth?.message;
    if (!authMessage) {
      throw new Error('Auth message missing in quote data.');
    }

    const wallet = walletManager.getEVMWallet(sourceChain);
    const signature = await wallet.signMessage(authMessage);

    logger.success('Auth Signature generated');

    logger.step(4, 'Polling Multi-Hop Status (Polygon -> TON)...');
    const statusParams: StatusParams = {
      requestId: quoteData.requestId,
      txHash,
      userAddress,
      recipientAddress,
      amount: quoteData.amounts.amountOut,
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      targetTokenAddress: targetToken.address,
      authSignature: signature,
    };

    const finalStatus = await apiClient.pollStatus(statusParams);

    logger.divider();
    if (finalStatus.data.status === 'COMPLETED') {
      logger.success('🎉 SUCCESS! Bridge to TON Completed.');
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
