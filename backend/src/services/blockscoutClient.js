const axios = require('axios');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class BlockscoutClient {
  constructor() {
    this.baseURL = process.env.BLOCKSCOUT_BASE_URL || 'https://eth.blockscout.com';
    this.apiKey = process.env.BLOCKSCOUT_API_KEY;
    this.client = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });

    this.initialized = true;
  }

  async getTransactionInfo(txid) {
    this.initialize();

    try {
      logger.info(`Fetching transaction info for txid: ${txid}`);

      const response = await this.client.get('/api', {
        params: {
          module: 'transaction',
          action: 'gettxinfo',
          txhash: txid,
        },
      });

      if (response.data.status !== '1') {
        throw new AppError(`Transaction not found: ${txid}`, 404);
      }

      const txData = response.data.result;
      const normalizedTx = this.normalizeTransactionData(txData);

      // Check if this is a token transfer and enhance with token data
      if (this.isTokenTransfer(normalizedTx)) {
        logger.info(`Detected token transfer, fetching token details for ${txid}`);
        const tokenData = await this.getTokenTransferDetails(txid, normalizedTx.from);
        if (tokenData) {
          normalizedTx.tokenTransfer = tokenData;
          normalizedTx.type = 'token_transfer';
        }
      } else if (parseFloat(normalizedTx.value) > 0) {
        normalizedTx.type = 'eth_transfer';
      } else {
        normalizedTx.type = 'contract_interaction';
      }

      return normalizedTx;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Error fetching transaction info', {
        txid,
        error: error.message,
        response: error.response?.data,
      });

      throw new AppError('Failed to fetch transaction data', 500);
    }
  }

  isTokenTransfer(txData) {
    return (
      txData.value === '0' && 
      txData.input && 
      txData.input.length > 10 &&
      txData.input.startsWith('0xa9059cbb') // ERC-20 transfer function signature
    );
  }

  async getTokenTransferDetails(txHash, fromAddress) {
    try {
      // Get token transfers for the sender address around the transaction block
      const response = await this.client.get('/api', {
        params: {
          module: 'account',
          action: 'tokentx',
          address: fromAddress,
          sort: 'desc',
        },
      });

      if (response.data.status !== '1') {
        return null;
      }

      // Find the specific transaction
      const tokenTransfer = response.data.result.find(
        transfer => transfer.hash.toLowerCase() === txHash.toLowerCase()
      );

      if (tokenTransfer) {
        return this.normalizeTokenTransfer(tokenTransfer);
      }

      return null;
    } catch (error) {
      logger.warn('Failed to fetch token transfer details', {
        txHash,
        fromAddress,
        error: error.message,
      });
      return null;
    }
  }

  async getTokenTransfers(address, startBlock = 0, endBlock = 'latest') {
    this.initialize();

    try {
      logger.info(`Fetching token transfers for address: ${address}`);

      const response = await this.client.get('/api', {
        params: {
          module: 'account',
          action: 'tokentx',
          address,
          startblock: startBlock,
          endblock: endBlock,
          sort: 'desc',
        },
      });

      if (response.data.status !== '1') {
        return [];
      }

      return response.data.result.map(transfer => this.normalizeTokenTransfer(transfer));
    } catch (error) {
      logger.error('Error fetching token transfers', {
        address,
        error: error.message,
        response: error.response?.data,
      });

      throw new AppError('Failed to fetch token transfers', 500);
    }
  }

  normalizeTransactionData(txData) {
    return {
      hash: txData.hash,
      from: txData.from,
      to: txData.to,
      value: txData.value,
      gasUsed: txData.gasUsed,
      gasPrice: txData.gasPrice,
      blockNumber: txData.blockNumber,
      timestamp: new Date(parseInt(txData.timeStamp) * 1000),
      status: txData.success ? 'success' : 'failed',
      input: txData.input,
      nonce: txData.nonce,
      transactionIndex: txData.transactionIndex,
      confirmations: txData.confirmations,
      logs: txData.logs,
    };
  }

  normalizeTokenTransfer(transfer) {
    const decimals = parseInt(transfer.tokenDecimal) || 18;
    const rawAmount = transfer.value;
    const actualAmount = parseFloat(rawAmount) / Math.pow(10, decimals);

    return {
      hash: transfer.hash,
      from: transfer.from,
      to: transfer.to,
      value: rawAmount,
      actualAmount: actualAmount,
      tokenName: transfer.tokenName,
      tokenSymbol: transfer.tokenSymbol,
      tokenDecimal: decimals,
      contractAddress: transfer.contractAddress,
      blockNumber: transfer.blockNumber,
      timestamp: new Date(parseInt(transfer.timeStamp) * 1000),
      gasUsed: transfer.gasUsed,
      gasPrice: transfer.gasPrice,
    };
  }

  async getAccountBalance(address) {
    this.initialize();

    try {
      logger.info(`Fetching account balance for address: ${address}`);

      const response = await this.client.get('/api', {
        params: {
          module: 'account',
          action: 'balance',
          address,
        },
      });

      if (response.data.status !== '1') {
        throw new AppError(`Failed to get balance for address: ${address}`, 404);
      }

      return {
        address,
        balance: response.data.result,
        balanceEth: (parseInt(response.data.result) / Math.pow(10, 18)).toString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Error fetching account balance', {
        address,
        error: error.message,
        response: error.response?.data,
      });

      throw new AppError('Failed to fetch account balance', 500);
    }
  }
}

module.exports = new BlockscoutClient();
