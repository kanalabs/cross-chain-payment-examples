import "dotenv/config";
import {
  KanaChainID,
  USDC_TOKENS,
  Logger,
  CrossChainAPIClient,
  WalletManager,
  QuoteParams,
  StatusParams,
} from "./helpers";

async function main() {
  const logger = new Logger("EVM-to-MVM");
  const apiClient = new CrossChainAPIClient();
  const walletManager = new WalletManager();

  try {
    logger.divider();
    logger.info("🚀 Starting Multi-Hop Test: Arbitrum (EVM) -> Aptos (MVM)");
    logger.divider();

    // 1. Configuration
    const sourceChain = KanaChainID.Arbitrum;
    const targetChain = KanaChainID.Aptos;
    const amount = "100000"; // 0.1 USDC (6 decimals)

    const userAddress = walletManager.getAddress(sourceChain);
    const recipientAddress =
      process.env.APTOS_TARGET_PUBLIC_KEY ||
      walletManager.getAddress(targetChain);

    logger.info(`Route: Arbitrum (11) -> Aptos (2)`);
    logger.info(`Source User: ${userAddress}`);
    logger.info(`Target Recipient: ${recipientAddress}`);

    // ---------------------------------------------------------
    // STEP 1: GET QUOTE
    // ---------------------------------------------------------
    logger.step(1, "Fetching cross-chain quote...");

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

    if (txExecution.kind !== "evm") {
      throw new Error(
        `Expected EVM transaction for source, got ${txExecution.kind}`,
      );
    }

    logger.success(`Quote Received! RequestID: ${quoteData.requestId}`);

    // ---------------------------------------------------------
    // STEP 2: SIGN & SEND SOURCE TRANSACTION (Arbitrum)
    // ---------------------------------------------------------
    logger.step(2, "Signing & Sending Source Transaction (Arbitrum)...");

    await walletManager.sendApprovalIfNeeded(
      sourceChain,
      txExecution.approval?.data || null,
    );

    const txHash = await walletManager.sendEVMTransaction(
      sourceChain,
      txExecution.execution.data,
    );

    logger.success(`Source Transaction Confirmed! Hash: ${txHash}`);

    // ---------------------------------------------------------
    // STEP 3: SIGN AUTH MESSAGE
    // ---------------------------------------------------------
    logger.step(3, "Signing Auth Message for status polling...");

    const wallet = walletManager.getEVMWallet(sourceChain);
    const authMessage = (quoteData as any).auth?.message;

    if (!authMessage) {
      throw new Error(
        "Auth message not found in quote data. This is required for multi-hop.",
      );
    }

    const signature = await wallet.signMessage(authMessage);
    logger.success("Auth Signature generated");

    // ---------------------------------------------------------
    // STEP 4: POLL STATUS
    // ---------------------------------------------------------
    logger.step(4, "Polling Multi-Hop Status (Arbitrum -> [Avax] -> Aptos)...");

    const statusParams: StatusParams = {
      requestId: quoteData.requestId,
      txHash: txHash,
      userAddress: userAddress,
      recipientAddress: recipientAddress,
      amount: quoteData.amounts.amountOut, // Use amountOut from quote for polling
      sourceChainId: sourceChain,
      targetChainId: targetChain,
      targetTokenAddress: USDC_TOKENS[targetChain].address,
      authSignature: signature, // Include the signature we just generated
    };

    const finalStatus = await apiClient.pollStatus(statusParams);

    // ---------------------------------------------------------
    // FINISHED
    // ---------------------------------------------------------
    logger.divider();
    if (finalStatus.data.status === "COMPLETED") {
      logger.success("🎉 MULTI-HOP SUCCESS! Funds delivered to Aptos.");
    } else {
      logger.error(`Transfer finished with status: ${finalStatus.data.status}`);
    }
    logger.info(`Aptos Tx Hash: ${finalStatus.data.txHash}`);
    logger.divider();
  } catch (error: any) {
    logger.error("Test Execution Failed:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

main();
