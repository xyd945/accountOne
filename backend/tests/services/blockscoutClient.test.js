const axios = require('axios');
const blockscoutClient = require('../../src/services/blockscoutClient');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('BlockscoutClient', () => {
  let mockAxiosInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the client's initialization state
    blockscoutClient.initialized = false;
    blockscoutClient.client = null;
    
    // Create a mock axios instance
    mockAxiosInstance = {
      get: jest.fn()
    };
    
    // Mock axios.create to return our mock instance
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  describe('getTransactionInfo', () => {
    it('should fetch and normalize transaction data successfully', async () => {
      const mockResponse = {
        data: {
          status: '1',
          result: {
            hash: '0x123',
            from: '0xabc',
            to: '0xdef',
            value: '1000000000000000000',
            gasUsed: '21000',
            gasPrice: '20000000000',
            blockNumber: '12345',
            timeStamp: '1640995200',
            txreceipt_status: '1',
            input: '0x',
            nonce: '1',
            transactionIndex: '0',
            confirmations: '100'
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await blockscoutClient.getTransactionInfo('0x123');

      expect(result).toEqual({
        hash: '0x123',
        from: '0xabc',
        to: '0xdef',
        value: '1000000000000000000',
        gasUsed: '21000',
        gasPrice: '20000000000',
        blockNumber: '12345',
        timestamp: new Date(1640995200 * 1000),
        status: 'success',
        input: '0x',
        nonce: '1',
        transactionIndex: '0',
        confirmations: '100'
      });
    });

    it('should throw error when transaction not found', async () => {
      const mockResponse = {
        data: {
          status: '0',
          message: 'No transactions found'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      await expect(blockscoutClient.getTransactionInfo('0x123'))
        .rejects
        .toThrow('Transaction not found: 0x123');
    });
  });

  describe('getTokenTransfers', () => {
    it('should fetch and normalize token transfers', async () => {
      const mockResponse = {
        data: {
          status: '1',
          result: [
            {
              hash: '0x123',
              from: '0xabc',
              to: '0xdef',
              value: '1000000000000000000',
              tokenName: 'Test Token',
              tokenSymbol: 'TEST',
              tokenDecimal: '18',
              contractAddress: '0x456',
              blockNumber: '12345',
              timeStamp: '1640995200',
              gasUsed: '21000',
              gasPrice: '20000000000'
            }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await blockscoutClient.getTokenTransfers('0xabc');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hash: '0x123',
        from: '0xabc',
        to: '0xdef',
        value: '1000000000000000000',
        tokenName: 'Test Token',
        tokenSymbol: 'TEST',
        tokenDecimal: '18',
        contractAddress: '0x456',
        blockNumber: '12345',
        timestamp: new Date(1640995200 * 1000),
        gasUsed: '21000',
        gasPrice: '20000000000'
      });
    });

    it('should return empty array when no transfers found', async () => {
      const mockResponse = {
        data: {
          status: '0',
          message: 'No transactions found'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await blockscoutClient.getTokenTransfers('0xabc');
      expect(result).toEqual([]);
    });
  });

  describe('getAccountBalance', () => {
    it('should fetch account balance successfully', async () => {
      const mockResponse = {
        data: {
          status: '1',
          result: '1000000000000000000'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await blockscoutClient.getAccountBalance('0xabc');

      expect(result).toEqual({
        address: '0xabc',
        balance: '1000000000000000000',
        balanceEth: '1'
      });
    });
  });
}); 