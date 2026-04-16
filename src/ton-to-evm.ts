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
  const logger = new Logger('TON-to-EVM');
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info('🚀 Starting Multi-Hop Test: TON -> Polygon (EVM)');
    logger.divider();

    const sourceChain = KanaChainID.Ton;
    const targetChain = KanaChainID.Polygon;
    const amount = '100000'; // 10 USDT (6 decimals)

    const sourceToken = USDT_TOKENS[sourceChain];
    const targetToken = USDT_TOKENS[targetChain];

    if (!sourceToken || !targetToken) {
      throw new Error('USDT token configuration missing for TON -> Polygon');
    }

    const userAddress = await walletManager.getTonAddress();
    const recipientAddress =
      process.env.EVM_TARGET_PUBLIC_KEY ||
      process.env.EVM_SOURCE_PUBLIC_KEY ||
      walletManager.getAddress(targetChain);

    logger.info(`Route: TON (${sourceChain}) -> Polygon (${targetChain})`);
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

    if (txExecution.kind !== 'ton') {
      throw new Error(`Expected TON transaction for source, got ${txExecution.kind}`);
    }

    logger.success(`Quote Received! ID: ${quoteData.requestId}`);

    logger.step(2, 'Signing & Sending TON Transaction...');

    const txHash = await walletManager.sendTonTransaction(
      sourceChain,
      txExecution.execution.data,
    );

    logger.success(`TON Transaction Confirmed! Hash: ${txHash}`);

    logger.step(3, 'Signing Auth Message for status polling...');

    const authMessage = quoteData.auth?.message;
    if (!authMessage) {
      throw new Error('Auth message missing in quote data.');
    }

    const { signature, publicKey } = await walletManager.signTonMessage(authMessage);

    logger.success('TON Auth Signature generated');

    logger.step(4, 'Polling Multi-Hop Status (TON -> Polygon)...');

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
      logger.success('🎉 SUCCESS! Bridge to Polygon Completed.');
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
