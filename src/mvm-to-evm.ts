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
  const logger = new Logger('MVM-to-EVM');
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info('🚀 Starting Multi-Hop Test: Aptos (MVM) -> Arbitrum (EVM)');
    logger.divider();

    // 1. Configuration
    const sourceChain = KanaChainID.Aptos;
    const targetChain = KanaChainID.Arbitrum;
    const amount = '10000000'; // 0.1 APT (8 decimals) as per ref file

    const userAddress = walletManager.getAddress(sourceChain);
    const recipientAddress = process.env.EVM_SOURCE_PUBLIC_KEY || walletManager.getAddress(targetChain);

    logger.info(`Source: Aptos | Target: Arbitrum`);
    logger.info(`User: ${userAddress}`);
    logger.info(`Recipient: ${recipientAddress}`);

    // ---------------------------------------------------------
    // STEP 1: GET QUOTE
    // ---------------------------------------------------------
    logger.step(1, 'Fetching cross-chain quote...');

    const quoteParams: QuoteParams = {
      userAddress,
      amount,
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      sourceTokenAddress: '0x1::aptos_coin::AptosCoin', // APT Native
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
    logger.step(2, 'Processing Aptos Transaction...');
    let txHash: string;

    if (txExecution.kind === 'aptos-serialized') {
        txHash = await walletManager.sendAptosSerializedTransaction(
            sourceChain, 
            txExecution.execution.data.raw_transaction
        );
    } else {
        throw new Error(`Unexpected transaction kind: ${txExecution.kind}`);
    }

    // ---------------------------------------------------------
    // STEP 3: SIGN AUTH MESSAGE
    // ---------------------------------------------------------
    logger.step(3, 'Signing Auth Message for status polling...');

    const account = walletManager.getAptosAccount();
    const authMessage = (quoteData as any).auth?.message;
    
    if (!authMessage) throw new Error("Auth message missing in quote");

    const messageBytes = new TextEncoder().encode(authMessage);
    const signed = account.sign(messageBytes);
    const signature = signed.toString(); // Hex string
    const publicKey = account.publicKey.toString();


    logger.success('Aptos Auth Signature generated');

    // ---------------------------------------------------------
    // STEP 4: POLL STATUS
    // ---------------------------------------------------------
    logger.step(4, 'Polling Status...');

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
      authPublicKey: publicKey, 
    } as any; 

    const finalStatus = await apiClient.pollStatus(statusParams);

    // ---------------------------------------------------------
    // FINISHED
    // ---------------------------------------------------------
    logger.divider();
    if (finalStatus.data.status === 'COMPLETED') {
      logger.success('🎉 SUCCESS! Bridge Completed.');
    } else {
      logger.error(`Failed with status: ${finalStatus.data.status}`);
    }
    logger.divider();

  } catch (error: any) {
    logger.error('Cross-chain transfer failed:');
    console.error(error.message);
    process.exit(1);
  }
}

main();