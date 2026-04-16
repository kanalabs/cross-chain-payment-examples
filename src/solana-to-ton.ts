import 'dotenv/config';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
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
  const logger = new Logger('Solana-to-TON');
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info('🚀 Starting Multi-Hop Test: Solana -> TON');
    logger.divider();

    const sourceChain = KanaChainID.Solana;
    const targetChain = KanaChainID.Ton;
    const amount = '100000'; // 10 USDT (6 decimals)

    const sourceToken = USDT_TOKENS[sourceChain];
    const targetToken = USDT_TOKENS[targetChain];

    if (!sourceToken || !targetToken) {
      throw new Error('USDT token configuration missing for Solana -> TON');
    }

    const userAddress = walletManager.getAddress(sourceChain);
    const recipientAddress = process.env.TON_RECIPIENT || await walletManager.getTonAddress();

    logger.info(`Route: Solana (${sourceChain}) -> TON (${targetChain})`);
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

    if (txExecution.kind !== 'solana') {
      throw new Error(`Expected Solana transaction for source, got ${txExecution.kind}`);
    }

    logger.success(`Quote Received! ID: ${quoteData.requestId}`);

    logger.step(2, 'Signing & Sending Solana Transaction...');

    const txHash = await walletManager.sendSolanaTransaction(
      sourceChain,
      txExecution.execution.data.instruction,
    );

    logger.success(`Solana Transaction Confirmed! Signature: ${txHash}`);

    logger.step(3, 'Signing Auth Message for status polling...');

    const authMessage = quoteData.auth?.message;
    if (!authMessage) {
      throw new Error('Auth message missing in quote data.');
    }

    const solanaKeypair = walletManager.getSolanaKeypair();
    const messageBytes = new TextEncoder().encode(authMessage);
    const signedMessage = nacl.sign.detached(messageBytes, solanaKeypair.secretKey);
    const authSignature = bs58.encode(signedMessage);

    logger.success('Solana Auth Signature generated');

    logger.step(4, 'Polling Multi-Hop Status (Solana -> TON)...');

    const statusParams: StatusParams = {
      requestId: quoteData.requestId,
      txHash,
      userAddress,
      recipientAddress,
      amount: quoteData.amounts.amountOut,
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      targetTokenAddress: targetToken.address,
      authSignature,
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
