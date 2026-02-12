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
  const logger = new Logger('MVM-to-SVM');
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info('🚀 Starting Multi-Hop Test: Aptos (MVM) -> Solana (SVM)');
    logger.divider();

    // 1. Configuration
    const sourceChain = KanaChainID.Aptos;
    const targetChain = KanaChainID.Solana;
    const amount = '100000'; // 0.1 USDC (6 decimals)

    const userAddress = walletManager.getAddress(sourceChain);
    const recipientAddress = process.env.SOLANA_PUBLIC_KEY || walletManager.getAddress(targetChain);

    logger.info(`Route: Aptos (2) -> Solana (1)`);
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
    };

    const quote = await apiClient.getQuote(quoteParams);
    const quoteData = quote.data;
    const txExecution = quoteData.transaction;

    logger.success(`Quote Received! ID: ${quoteData.requestId}`);

    // ---------------------------------------------------------
    // STEP 2: EXECUTE APTOS TRANSACTION
    // ---------------------------------------------------------
    logger.step(2, 'Processing Aptos Serialized Transaction...');
    let txHash: string;

    if (txExecution.kind === 'aptos-serialized') {
      txHash = await walletManager.sendAptosSerializedTransaction(
        sourceChain,
        txExecution.execution.data.raw_transaction
      );
    } else {
      throw new Error(`Unexpected transaction kind: ${txExecution.kind}. Expected 'aptos-serialized'.`);
    }

    logger.success(`Aptos Transaction Confirmed: ${txHash}`);

    // ---------------------------------------------------------
    // STEP 3: SIGN AUTH MESSAGE
    // ---------------------------------------------------------
    logger.step(3, 'Signing Auth Message for status polling...');

    const account = walletManager.getAptosAccount();
    const authMessage = (quoteData as any).auth?.message;

    if (!authMessage) throw new Error("Auth message missing in quote data");

    const messageBytes = new TextEncoder().encode(authMessage);
    const signed = account.sign(messageBytes);
    
    const signature = signed.toString(); // Hex string
    const publicKey = account.publicKey.toString(); // Hex string

    logger.success('Aptos Auth Signature and Public Key generated');

    // ---------------------------------------------------------
    // STEP 4: POLL STATUS
    // ---------------------------------------------------------
    logger.step(4, 'Polling Multi-Hop Status (Aptos -> Solana)...');

    const statusParams: StatusParams = {
      requestId: quoteData.requestId,
      txHash: txHash,
      userAddress: userAddress,
      recipientAddress: recipientAddress,
      amount: quoteData.amounts.amountOut,
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      targetTokenAddress: USDC_TOKENS[targetChain].address,
      authSignature: signature,
      authPublicKey: publicKey, // Critical for Aptos source verification
    } as any;

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
    logger.divider();

  } catch (error: any) {
    logger.error('Test Execution Failed:');
    console.error(error.message);
    process.exit(1);
  }
}

main();