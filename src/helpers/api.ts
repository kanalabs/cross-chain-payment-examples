import axios, { AxiosInstance } from 'axios';
import { API_CONFIG, POLLING_CONFIG } from './config';
import { QuoteParams, QuoteResponse, StatusParams, StatusResponse } from './types';
import { Logger } from './logger';


export class CrossChainAPIClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_CONFIG.API_KEY,
      },
    });
    this.logger = new Logger('APIClient');
  }

  async getQuote(params: QuoteParams): Promise<QuoteResponse> {
    try {
      this.logger.info('Fetching quote...');

      const queryParams = new URLSearchParams({
        userAddress: params.userAddress,
        amount: params.amount,
        sourceChainId: params.sourceChainId.toString(),
        targetChainId: params.targetChainId.toString(),
        sourceTokenAddress: params.sourceTokenAddress,
        targetTokenAddress: params.targetTokenAddress,
        recipientAddress: params.recipientAddress,
      });

      const response = await this.client.get<QuoteResponse>(
        `${API_CONFIG.QUOTE_ENDPOINT}?${queryParams.toString()}`
      );

      this.logger.success('Quote fetched successfully');
      this.logger.info(`Request ID: ${response.data.data.requestId}`);
      this.logger.info(`Amount In: ${response.data.data.amounts.amountInFormatted} ${response.data.data.tokens.sourceSymbol}`);
      this.logger.info(`Amount Out: ${response.data.data.amounts.amountOutFormatted} ${response.data.data.tokens.targetSymbol}`);
      this.logger.info(`Total Fees: $${response.data.data.fees.totalUsd}`);

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to fetch quote:', error.response?.data || error.message);
      throw error;
    }
  }

async getStatus(params: StatusParams): Promise<StatusResponse> {
  try {
    const queryParams: any = {
      requestId: params.requestId,
      txHash: params.txHash,
      userAddress: params.userAddress,
      recipientAddress: params.recipientAddress,
      amount: params.amount,
      sourceChainId: params.sourceChainId.toString(),
      targetChainId: params.targetChainId.toString(),
      targetTokenAddress: params.targetTokenAddress,
      authSignature: params.authSignature
    };

    const aptosKey = (params as any).authPublicKey;
    if (aptosKey) {
      queryParams.authPublicKey = aptosKey;
    }

    const response = await this.client.get<StatusResponse>(
      API_CONFIG.STATUS_ENDPOINT, 
      { params: queryParams }
    );

    return response.data;
  } catch (error: any) {
    this.logger.error('Failed to fetch status:', error.response?.data || error.message);
    throw error;
  }
}

  async pollStatus(params: StatusParams): Promise<StatusResponse> {
    let attempt = 0;

    this.logger.info('Starting status polling...');

    while (attempt < POLLING_CONFIG.MAX_ATTEMPTS) {
      try {
        const status = await this.getStatus(params);

        // Log current status
        this.logger.info(`Status: ${status.data.status} (Attempt ${attempt + 1}/${POLLING_CONFIG.MAX_ATTEMPTS})`);

        // Log step details
        status.data.steps.forEach((step, index) => {
          const statusEmoji =
            step.status === 'COMPLETED' ? '✅' :
            step.status === 'IN_PROGRESS' ? '🔄' :
            step.status === 'FAILED' ? '❌' : '⏳';
          this.logger.info(`  ${statusEmoji} Step ${index + 1}: ${step.name} - ${step.status}`);
        });

        // Check for completion
        if (status.data.status === 'COMPLETED') {
          this.logger.success('Transaction completed successfully!');
          return status;
        }

        // Check for failure
        if (status.data.status === 'FAILED') {
          this.logger.error('Transaction failed!');
          throw new Error(`Transaction failed: ${status.message}`);
        }

        // Calculate dynamic polling interval
        const interval = this.getPollingInterval(attempt);
        this.logger.info(`Waiting ${interval / 1000}s before next poll...`);
        await this.sleep(interval);

        attempt++;
      } catch (error: any) {
        if (error.message?.includes('Transaction failed')) {
          throw error;
        }

        // Retry on network errors
        this.logger.warn(`Polling error (attempt ${attempt + 1}), retrying...`);
        await this.sleep(5000);
        attempt++;
      }
    }

    throw new Error('Polling timeout - transaction status unknown');
  }

  private getPollingInterval(attempt: number): number {
    if (attempt < 10) return POLLING_CONFIG.INITIAL_DELAY; // First 30 seconds: 3s
    if (attempt < 40) return 5000; // Next 2.5 minutes: 5s
    return POLLING_CONFIG.MAX_DELAY; // After that: 10s
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
