const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../../utils/logger');
const { AppError } = require('../../middleware/errorHandler');
const BlockscoutClient = require('../blockscoutClient');
const accountService = require('../accountService');
const journalEntryService = require('../journalEntryService');

class GeminiClient {
  constructor() {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }

  async chatResponse(message, context = {}) {
    try {
      logger.info('Processing chat message with Gemini AI', {
        messageLength: message.length,
        hasContext: Object.keys(context).length > 0,
      });

      // Check if user is asking to create a journal entry
      const isJournalEntryRequest = this.isJournalEntryRequest(message);
      logger.info('Journal entry request detected', { isJournalEntryRequest });

      let result;
      if (isJournalEntryRequest) {
        logger.info('Handling journal entry chat');
        result = await this.handleJournalEntryChat(message, context);
      } else {
        logger.info('Handling general chat');
        result = await this.handleGeneralChat(message, context);
      }

      logger.info('Chat response completed successfully', {
        hasResponse: !!result.response,
        hasJournalEntries: !!(result.journalEntries && result.journalEntries.length > 0),
        entriesCount: result.journalEntries ? result.journalEntries.length : 0,
      });

      return result;
    } catch (error) {
      logger.error('Error generating chat response with Gemini', {
        error: error.message,
        stack: error.stack,
        messagePreview: message.substring(0, 100),
      });

      // Instead of throwing, return a controlled error response
      return {
        response: 'I encountered an error while processing your request. Please try again.',
        thinking: `Error occurred: ${error.message}`,
        suggestions: ['Try rephrasing your request', 'Check if all required information is provided'],
        journalEntries: [],
        error: error.message,
      };
    }
  }

  isJournalEntryRequest(message) {
    const journalKeywords = [
      'create journal entry',
      'journal entry for',
      'make journal entry',
      'record transaction',
      'book transaction',
      'accounting entry',
      'debit credit',
      'journal for',
      'record',
      'book',
    ];

    const lowerMessage = message.toLowerCase();
    return journalKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  async handleJournalEntryChat(message, context) {
    try {
      logger.info('Starting handleJournalEntryChat', { messageLength: message.length });
      
      // Extract transaction details from the message
      const transactionDetails = this.extractTransactionDetails(message);
      logger.info('Transaction details extracted', { transactionDetails });

      if (transactionDetails.hasTransactionHash) {
        // Fetch real transaction data and create entries
        try {
          logger.info('Fetching transaction data from Blockscout', {
            txHash: transactionDetails.transactionHash,
          });

          const transactionData = await BlockscoutClient.getTransactionInfo(transactionDetails.transactionHash);
          
          // Use the real transaction data to create journal entries
          const journalEntries = await this.analyzeTransaction(transactionData, transactionDetails.description);

          // Save using universal service if user context is available
          let savedEntries = null;
          if (context.user?.id) {
            try {
              const result = await journalEntryService.saveJournalEntriesWithTransaction(
                journalEntries, 
                transactionData, 
                context.user.id, 
                {
                  ...transactionDetails,
                  transactionDate: transactionData.timestamp ? new Date(transactionData.timestamp * 1000) : new Date(),
                  source: 'blockchain_analysis'
                }
              );
              savedEntries = result.entries;
              
              logger.info('Journal entries saved via universal service', {
                txHash: transactionDetails.transactionHash,
                userId: context.user.id,
                entriesCount: savedEntries.length,
              });
            } catch (saveError) {
              logger.warn('Failed to save journal entries via universal service', {
                txHash: transactionDetails.transactionHash,
                error: saveError.message,
              });
            }
          }

          const baseResponse = `I've analyzed the blockchain transaction and created the following journal entries:\n\n${this.formatJournalEntriesForChat(journalEntries)}`;
          const saveStatus = savedEntries 
            ? `\n\n✅ These entries have been automatically saved to your accounting system.`
            : context.user?.id 
              ? `\n\n⚠️ Note: I couldn't automatically save these entries. You may need to save them manually.`
              : `\n\n💡 To automatically save entries, please log in to your account.`;

          return {
            response: baseResponse + saveStatus,
            thinking: `I fetched the transaction data from the blockchain for ${transactionDetails.transactionHash} and analyzed it to create IFRS-compliant journal entries. The transaction shows: From ${transactionData.from} to ${transactionData.to}, value: ${parseFloat(transactionData.value) / Math.pow(10, 18)} ETH, status: ${transactionData.status}.${savedEntries ? ' Entries were saved to the database via universal service.' : ''}`,
            suggestions: [
              'Review the journal entries for accuracy',
              'Verify the account classifications match your chart of accounts',
              'Consider any additional entries for fees or taxes',
              ...(savedEntries ? ['View saved entries in your journal'] : ['Save these entries to your accounting system']),
            ],
            journalEntries: savedEntries || journalEntries, // Return saved entries or original ones
          };
        } catch (blockchainError) {
          logger.warn('Failed to fetch blockchain data', {
            txHash: transactionDetails.transactionHash,
            error: blockchainError.message,
          });

          return {
            response: `I couldn't fetch the transaction data for ${transactionDetails.transactionHash}. This might be because:\n\n• The transaction hash is invalid\n• The transaction is on a different network\n• The blockchain service is temporarily unavailable\n\nPlease verify the transaction hash and try again, or provide the transaction details manually.`,
            thinking: `Attempted to fetch transaction data for ${transactionDetails.transactionHash} but failed with error: ${blockchainError.message}. This could be due to an invalid hash, wrong network, or service unavailability.`,
            suggestions: [
              'Double-check the transaction hash',
              'Verify you\'re on the correct blockchain network',
              'Try again in a few minutes if the transaction is very recent',
              'Provide transaction details manually if the hash lookup fails',
            ],
          };
        }
      } else {
        // General journal entry guidance without specific transaction
        logger.info('No transaction hash found, handling as general journal entry guidance');
        return await this.handleGeneralJournalEntryGuidance(message, context);
      }
    } catch (error) {
      logger.error('Error in handleJournalEntryChat', { 
        error: error.message,
        stack: error.stack,
        messagePreview: message.substring(0, 100),
      });
      
      // Return a fallback response instead of throwing
      return {
        response: 'I encountered an error while processing your journal entry request. Let me try a different approach.',
        thinking: `Error in journal entry processing: ${error.message}`,
        suggestions: ['Try rephrasing your request', 'Provide more specific details about the transaction'],
        journalEntries: [],
      };
    }
  }

  async handleGeneralJournalEntryGuidance(message, context) {
    try {
      logger.info('Starting handleGeneralJournalEntryGuidance', { messageLength: message.length });
      
      // Get the current chart of accounts for consistent account usage
      const chartOfAccounts = await this.getFormattedChartOfAccounts();
      logger.info('Chart of accounts loaded', { chartLength: chartOfAccounts.length });
      
      // Extract transaction details to get dates and other info
      const transactionDetails = this.extractTransactionDetails(message);
      logger.info('Extracted transaction details from journal entry guidance', { 
        hasDate: !!transactionDetails.extractedDate,
        extractedDate: transactionDetails.extractedDate?.toISOString(),
        amount: transactionDetails.amount,
        currency: transactionDetails.currency
      });
      
      const systemPrompt = `You are an expert cryptocurrency accounting assistant. You MUST use the provided chart of accounts.

CRITICAL RULES:
- ALWAYS use EXACT account names from the provided chart of accounts
- For investments/capital: Use "Share Capital" as credit account
- For crypto assets: Use "Digital Assets - [Currency]" as debit account
- Extract EXACT amount and currency from user message
- ANALYZE MESSAGE FOR TRANSACTION DATES and include them in JSON

TRANSACTION DATE ANALYSIS:
- Look for phrases like "invoice date", "dated", "on [date]", "transaction from [date]"
- Identify specific dates in formats: "May 25 2025", "2025-05-25", "25th May 2025" 
- If you find a transaction date, include "transactionDate" field in JSON (YYYY-MM-DD format)
- If no specific date mentioned, use current date

REQUIRED RESPONSE FORMAT:
1. One sentence explanation
2. Clean JSON array (NO markdown, NO comments) with transactionDate if found
3. Confirmation message

EXAMPLE WITH DATE:
Recording accrued expense for hotel booking dated May 25 2025.

[{"accountDebit":"Travel and Entertainment","accountCredit":"Accounts Payable","amount":188,"currency":"EUR","narrative":"Hotel booking expense from DeTrip, invoice date May 25 2025","transactionDate":"2025-05-25","confidence":0.95,"ifrsReference":"IAS 1"}]

Journal entry saved successfully with transaction date May 25, 2025.

EXAMPLE WITHOUT DATE:
Recording your 999 USDC investment as equity financing.

[{"accountDebit":"Digital Assets - USDC","accountCredit":"Share Capital","amount":999,"currency":"USDC","narrative":"Capital contribution of 999 USDC","confidence":0.95,"ifrsReference":"IAS 32"}]

Journal entry saved successfully.

IMPORTANT:
- NO \`\`\`json blocks
- NO // comments  
- Extract exact numbers from user message
- Use proper account names only
- ALWAYS analyze for transaction dates`;

      const userPrompt = this.buildChatPromptWithAccounts(message, context, chartOfAccounts);
      logger.info('Prompts prepared, calling Gemini API');

    const result = await this.model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);

    const response = await result.response;
    const text = response.text();

      logger.info('AI response received for journal entry guidance', {
        responseLength: text.length,
        responsePreview: text.substring(0, 300),
      });

      // Extract JSON journal entries from the response
      let structuredEntries = [];
      try {
        logger.info('Attempting to parse journal entries from AI response');
        structuredEntries = this.parseJournalEntries(text);
        logger.info('Journal entries parsed successfully', { entriesCount: structuredEntries.length });
      } catch (parseError) {
        logger.warn('Failed to parse journal entries from AI response', { 
          error: parseError.message,
          responsePreview: text.substring(0, 200),
        });
      }

      // Validate accounts if entries were found
      let validatedEntries = [];
      if (structuredEntries.length > 0) {
        try {
          logger.info('Validating and correcting accounts');
          validatedEntries = await this.validateAndCorrectAccounts(structuredEntries);
          
          // Apply extracted date if AI didn't include transactionDate but we found one
          if (transactionDetails.extractedDate) {
            validatedEntries = validatedEntries.map(entry => {
              // If AI didn't set transactionDate, use our extracted date
              if (!entry.transactionDate) {
                entry.transactionDate = transactionDetails.extractedDate;
                logger.info('Applied extracted date to entry without AI-provided date', {
                  transactionDate: transactionDetails.extractedDate.toISOString()
                });
              }
              return entry;
            });
          }
          
          logger.info('Account validation completed', { validatedCount: validatedEntries.length });
        } catch (validationError) {
          logger.error('Account validation failed', { error: validationError.message });
          // Use original entries if validation fails
          validatedEntries = structuredEntries;
        }
      }

      // If we successfully created journal entries but the AI response contains apology text,
      // override it with a proper response
      let finalResponse = text.trim();
      if (validatedEntries.length > 0 && 
          (text.toLowerCase().includes('apologize') || 
           text.toLowerCase().includes('trouble') || 
           text.toLowerCase().includes('sorry'))) {
        
        logger.info('Overriding apology response with success message', {
          entriesCount: validatedEntries.length,
        });
        
        const entry = validatedEntries[0];
        finalResponse = `Recording your ${entry.amount} ${entry.currency} investment as equity financing.

[${JSON.stringify(validatedEntries)}]

Journal entry created successfully and will be saved to your accounting system.`;
      }

      logger.info('handleGeneralJournalEntryGuidance completed successfully', {
        hasResponse: !!finalResponse,
        entriesCount: validatedEntries.length,
      });

    return {
        response: finalResponse,
      thinking: this.extractThinking(text),
      suggestions: this.extractSuggestions(text),
        journalEntries: validatedEntries, // These will be saved by the chat route
      };
    } catch (error) {
      logger.error('Error in handleGeneralJournalEntryGuidance', {
        error: error.message,
        stack: error.stack,
        messagePreview: message.substring(0, 100),
      });
      
      // Return a fallback response instead of throwing
      return {
        response: 'I encountered an error while creating your journal entry. However, I can help you manually. Please provide the transaction amount, currency, and type (investment, purchase, etc.).',
        thinking: `Error in journal entry guidance: ${error.message}`,
        suggestions: ['Provide transaction details step by step', 'Try a simpler format like "I invested X USDC"'],
        journalEntries: [],
      };
    }
  }

  async handleGeneralChat(message, context) {
    // Get the current chart of accounts for consistent account usage
    const chartOfAccounts = await this.getFormattedChartOfAccounts();
    
    // Extract transaction details to get dates and other info
    const transactionDetails = this.extractTransactionDetails(message);
    logger.info('Extracted transaction details from general chat', { 
      hasDate: !!transactionDetails.extractedDate,
      extractedDate: transactionDetails.extractedDate?.toISOString(),
      amount: transactionDetails.amount,
      currency: transactionDetails.currency
    });
    
    const systemPrompt = `You are an expert cryptocurrency accounting assistant with access to a comprehensive chart of accounts.

ACCOUNT SELECTION RULES:
1. FIRST: Try to use EXACT account names from the provided chart of accounts
2. IF NO EXACT MATCH: You can suggest logical IFRS-compliant account names
3. The system will automatically CREATE missing accounts with proper categorization

ACCOUNT CREATION EXAMPLES:
- "Operating Expenses" → Will create under Operating Expenses (5000s) category
- "Accounts Payable" → Will create under Current Liabilities (2000s) category  
- "Professional Services Revenue" → Will create under Revenue (4000s) category

TRANSACTION DATE ANALYSIS:
- ANALYZE user message for transaction dates (invoice date, transaction date, etc.)
- Look for phrases like "invoice date", "dated", "on [date]", "received on [date]"
- Identify dates in formats: "May 25 2025", "2025-05-25", "25th May 2025"
- If you find a transaction date, include "transactionDate" field in JSON (YYYY-MM-DD format)
- If no specific date mentioned, do NOT include transactionDate (system will use current date)

RESPONSE FORMAT:
1. Brief explanation of the transaction
2. Clean JSON array (NO markdown, NO comments) with transactionDate if found
3. Success confirmation

EXAMPLE WITH DATE:
Recording accrued expense for unpaid hotel booking dated May 25 2025.

[{"accountDebit":"Travel and Entertainment","accountCredit":"Accounts Payable","amount":188,"currency":"EUR","narrative":"Accrued expense for hotel bookings from DeTrip, invoice date May 25 2025","transactionDate":"2025-05-25","confidence":0.95,"ifrsReference":"IAS 1"}]

Journal entry will be saved with transaction date May 25, 2025.

EXAMPLE WITHOUT DATE:
Recording accrued expense for unpaid hotel booking.

[{"accountDebit":"Travel and Entertainment","accountCredit":"Accounts Payable","amount":199,"currency":"USDC","narrative":"Accrued expense for hotel bookings from DeTrip (Travel Labs BV)","confidence":0.95,"ifrsReference":"IAS 1"}]

Journal entry will be saved with automatic account creation as needed.

CRITICAL RULES:
- Use LOGICAL account names (the system will create them if needed)
- NO backticks or code blocks
- Extract exact amounts from user messages
- Ensure proper double-entry accounting (debits = credits)
- ALWAYS analyze for transaction dates and include in JSON if found`;

    const userPrompt = this.buildChatPromptWithAccounts(message, context, chartOfAccounts);

    const result = await this.model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);

    const response = await result.response;
    const text = response.text();

    logger.info('AI response received for general chat', {
      responseLength: text.length,
      responsePreview: text.substring(0, 300),
    });

    // Try to extract JSON journal entries from the response (same as transaction analysis)
    let extractedEntries = [];
    try {
      extractedEntries = this.parseJournalEntries(text);
    } catch (error) {
      logger.warn('No JSON journal entries found in general chat response', { error: error.message });
    }
    
    // Validate accounts if entries were found
    let validatedEntries = [];
    if (extractedEntries.length > 0) {
      validatedEntries = await this.validateAndCorrectAccounts(extractedEntries);
      
      // Add extracted transaction date to entries
      if (transactionDetails.extractedDate) {
        validatedEntries = validatedEntries.map(entry => {
          // If AI didn't set transactionDate, use our extracted date
          if (!entry.transactionDate) {
            entry.transactionDate = transactionDetails.extractedDate;
            logger.info('Applied extracted date to entry without AI-provided date', {
              transactionDate: transactionDetails.extractedDate.toISOString()
            });
          }
          
          // Also add to metadata for tracking
          return {
            ...entry,
            metadata: {
              ...entry.metadata,
              extractedFromMessage: true,
              originalMessage: message,
              extractedDate: transactionDetails.extractedDate.toISOString()
            }
          };
        });
        
        logger.info('Added extracted transaction date to journal entries', {
          entriesCount: validatedEntries.length,
          transactionDate: transactionDetails.extractedDate.toISOString()
        });
      }
    }

    // If we successfully created journal entries but the AI response contains apology text,
    // override it with a proper response
    let finalResponse = text.trim();
    if (validatedEntries.length > 0 && 
        (text.toLowerCase().includes('apologize') || 
         text.toLowerCase().includes('trouble') || 
         text.toLowerCase().includes('sorry'))) {
      
      logger.info('Overriding apology response with success message in general chat', {
        entriesCount: validatedEntries.length,
      });
      
      const entry = validatedEntries[0];
      finalResponse = `Recording your ${entry.amount} ${entry.currency} investment as equity financing.

[${JSON.stringify(validatedEntries)}]

Journal entry created successfully and will be saved to your accounting system.`;
    }

    return {
      response: finalResponse,
      thinking: this.extractThinking(text),
      suggestions: this.extractSuggestions(text),
      journalEntries: validatedEntries, // Include validated entries
    };
  }

  buildChatPrompt(message, context) {
    let prompt = `User message: ${message}`;

    if (context.user) {
      prompt += `\n\nUser context: ${context.user.email}`;
    }

    if (context.recentEntries && context.recentEntries.length > 0) {
      prompt += `\n\nRecent journal entries:\n${JSON.stringify(context.recentEntries, null, 2)}`;
    }

    if (context.recentMessages && context.recentMessages.length > 0) {
      prompt += `\n\nRecent conversation context:\n${context.recentMessages.map(msg => `${msg.type}: ${msg.content}`).join('\n')}`;
    }

    return prompt;
  }

  buildChatPromptWithAccounts(message, context, chartOfAccounts) {
    let prompt = `Chart of Accounts (MUST use these exact account names):
${chartOfAccounts}

User message: ${message}`;

    if (context.user) {
      prompt += `\n\nUser context: ${context.user.email}`;
    }

    if (context.recentEntries && context.recentEntries.length > 0) {
      prompt += `\n\nRecent journal entries:\n${JSON.stringify(context.recentEntries, null, 2)}`;
    }

    if (context.recentMessages && context.recentMessages.length > 0) {
      prompt += `\n\nRecent conversation context:\n${context.recentMessages.map(msg => `${msg.type}: ${msg.content}`).join('\n')}`;
    }

    return prompt;
  }

  extractTransactionDetails(message) {
    // Extract transaction hash (0x followed by 64 hex characters)
    const hashMatch = message.match(/0x[a-fA-F0-9]{64}/);

    // Extract amount and currency
    const amountMatch = message.match(/(\d+(?:\.\d+)?)\s*(ETH|BTC|USD|USDT|USDC|DAI|EUR|GBP)/i);

    // Extract dates - support various formats
    const datePatterns = [
      // May 25, 2025 / May 25 2025 (with trigger words)
      /(?:invoice date|date|dated|on|for)\s+(?:is\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      // 2025-05-25 / 25-05-2025 / 05/25/2025 (with trigger words)
      /(?:invoice date|date|dated|on|for)\s+(?:is\s+)?(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
      // 25th May 2025 / May 25th 2025 (with trigger words)
      /(?:invoice date|date|dated|on|for)\s+(?:is\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?\s+\d{4})/i,
      // Generic date patterns without trigger words
      /\b([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/i, // May 25th, 2025 or May 25, 2025
      /\b(\d{4}-\d{1,2}-\d{1,2})\b/i, // 2025-05-25
      /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/i, // 25/05/2025 or 25-05-2025
    ];

    let extractedDate = null;
    for (const pattern of datePatterns) {
      const dateMatch = message.match(pattern);
      if (dateMatch) {
        try {
          // Parse the extracted date
          const dateStr = dateMatch[1];
          const parsedDate = new Date(dateStr);
          
          // Validate the date
          if (!isNaN(parsedDate.getTime())) {
            extractedDate = parsedDate;
            logger.info('Extracted transaction date from message', { 
              original: dateStr, 
              parsed: parsedDate.toISOString() 
            });
            break;
          }
        } catch (error) {
          logger.warn('Failed to parse extracted date', { 
            dateStr: dateMatch[1], 
            error: error.message 
          });
        }
      }
    }

    // Extract description
    const descriptionMatch = message.match(/(?:for|payment|received|sent|bought|sold|staking|mining|trading)\s+(.+?)(?:\.|$|,)/i);

    return {
      hasTransactionHash: !!hashMatch,
      transactionHash: hashMatch ? hashMatch[0] : null,
      amount: amountMatch ? amountMatch[1] : null,
      currency: amountMatch ? amountMatch[2].toUpperCase() : null,
      extractedDate: extractedDate,
      description: descriptionMatch ? descriptionMatch[1] : message,
    };
  }

  formatJournalEntriesForChat(journalEntries) {
    return journalEntries.map((entry, index) =>
      `Entry ${index + 1}:
- Debit: ${entry.accountDebit} - ${entry.currency} ${entry.amount}
- Credit: ${entry.accountCredit} - ${entry.currency} ${entry.amount}
- Description: ${entry.description || entry.narrative || 'N/A'}
- Confidence: ${entry.confidence ? `${(entry.confidence * 100).toFixed(1)}%` : 'N/A'}`,
    ).join('\n\n');
  }

  extractThinking(response) {
    const thinkingMatch = response.match(/\*\*Thinking\*\*:?\s*(.*?)(?=\*\*|$)/is);
    return thinkingMatch ? thinkingMatch[1].trim() : null;
  }

  extractSuggestions(response) {
    const suggestionsMatch = response.match(/\*\*Suggestions\*\*:?\s*(.*?)(?=\*\*|$)/is);
    if (suggestionsMatch) {
      return suggestionsMatch[1]
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    return [];
  }

  async analyzeTransaction(blockchainData, description = '') {
    try {
      logger.info('Starting Gemini transaction analysis', {
        hash: blockchainData.hash,
        description,
      });

      // Get the current chart of accounts
      const chartOfAccounts = await this.getFormattedChartOfAccounts();

      // Load enhanced IFRS templates
      const ifrsTemplates = require('./enhancedIfrsTemplates.json');

      // Format token transfers data
      const tokenTransfersText = this.formatTokenTransfers(blockchainData.tokenTransfers || []);

      // Build the analysis prompt with chart of accounts
      const prompt = ifrsTemplates.transactionAnalysisPrompt
        .replace('{hash}', blockchainData.hash)
        .replace('{from}', blockchainData.from)
        .replace('{to}', blockchainData.to)
        .replace('{value}', parseFloat(blockchainData.value) / Math.pow(10, 18))
        .replace('{gasUsed}', blockchainData.gas_used || blockchainData.gasUsed)
        .replace('{gasPrice}', blockchainData.gas_price || blockchainData.gasPrice)
        .replace('{timestamp}', blockchainData.timestamp)
        .replace('{status}', blockchainData.status)
        .replace('{description}', description || 'No description provided')
        .replace('{tokenTransfers}', tokenTransfersText)
        .replace('{chartOfAccounts}', chartOfAccounts);

      const systemPrompt = ifrsTemplates.systemPrompt;

      const result = await this.model.generateContent([
        { text: systemPrompt },
        { text: prompt },
      ]);

      const response = await result.response;
      const responseText = response.text();

      logger.info('Received AI analysis response', {
        hash: blockchainData.hash,
        responseLength: responseText.length,
      });

      // Parse the JSON response
      const journalEntries = this.parseJournalEntries(responseText);

      // Validate accounts against chart of accounts
      const validatedEntries = await this.validateAndCorrectAccounts(journalEntries);

      return validatedEntries;
    } catch (error) {
      logger.error('Gemini analysis failed', {
        hash: blockchainData?.hash,
        error: error.message,
      });
        throw error;
      }
  }

  async getFormattedChartOfAccounts() {
    try {
      const accounts = await accountService.getChartOfAccounts();
      
      // Format accounts by category for AI prompt
      const accountsByCategory = accounts.reduce((acc, account) => {
        const categoryName = account.account_categories?.name || 'Other';
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(`${account.code} - ${account.name} (${account.account_type})`);
        return acc;
      }, {});

      // Format as text for AI prompt
      return Object.entries(accountsByCategory)
        .map(([category, accounts]) => 
          `${category}:\n${accounts.map(acc => `  • ${acc}`).join('\n')}`
        )
        .join('\n\n');
    } catch (error) {
      logger.error('Failed to get chart of accounts for AI', { error: error.message });
      // Return basic accounts as fallback
      return `Digital Assets:
  • 1801 - Digital Assets - Bitcoin (ASSET)
  • 1802 - Digital Assets - Ethereum (ASSET)
  • 1803 - Digital Assets - USDT (ASSET)
  • 1804 - Digital Assets - USDC (ASSET)
  • 1808 - Digital Assets - Other (ASSET)

Expenses:
  • 6001 - Transaction Fees (EXPENSE)
  • 6002 - Exchange Fees (EXPENSE)
  • 5001 - Salaries and Wages (EXPENSE)
  • 5003 - Software and Technology (EXPENSE)

Revenue:
  • 4001 - Trading Revenue (REVENUE)
  • 4002 - Staking Revenue (REVENUE)`;
    }
  }

  async validateAndCorrectAccounts(journalEntries) {
    const validatedEntries = [];

    for (const entry of journalEntries) {
      try {
        // Validate the account names against our chart of accounts
        const validation = await accountService.validateJournalEntry(
          entry.accountDebit,
          entry.accountCredit
        );

        let correctedEntry = { ...entry };
        let accountCreationSuggestions = [];

        // Handle debit account
        if (validation.debitAccount) {
          // Exact match found - use it
          correctedEntry.accountDebit = validation.debitAccount.name;
          logger.info('Found exact debit account match', {
            requested: entry.accountDebit,
            found: validation.debitAccount.name,
          });
        } else {
          // Account doesn't exist - suggest creation but keep original name
          logger.info('Debit account not found, suggesting creation', {
            requested: entry.accountDebit,
          });
          
          const suggestion = await accountService.suggestAccountCreation(
            entry.accountDebit, 
            'expense' // Assume debit is expense for business transactions
          );
          
          accountCreationSuggestions.push({
            type: 'debit',
            requestedName: entry.accountDebit,
            suggestion: suggestion,
          });

          // Keep the original account name for now
          correctedEntry.accountDebit = entry.accountDebit;
        }

        // Handle credit account
        if (validation.creditAccount) {
          // Exact match found - use it
          correctedEntry.accountCredit = validation.creditAccount.name;
          logger.info('Found exact credit account match', {
            requested: entry.accountCredit,
            found: validation.creditAccount.name,
          });
        } else {
          // Account doesn't exist - suggest creation but keep original name
          logger.info('Credit account not found, suggesting creation', {
            requested: entry.accountCredit,
          });
          
          const suggestion = await accountService.suggestAccountCreation(
            entry.accountCredit,
            'liability' // Assume credit is liability for unpaid expenses
          );
          
          accountCreationSuggestions.push({
            type: 'credit',
            requestedName: entry.accountCredit,
            suggestion: suggestion,
          });

          // Keep the original account name for now
          correctedEntry.accountCredit = entry.accountCredit;
        }

        // Add account creation suggestions to the entry
        if (accountCreationSuggestions.length > 0) {
          correctedEntry.accountCreationSuggestions = accountCreationSuggestions;
          correctedEntry.requiresAccountCreation = true;
          
          logger.info('Entry requires account creation', {
            debit: correctedEntry.accountDebit,
            credit: correctedEntry.accountCredit,
            suggestions: accountCreationSuggestions.length,
          });
        } else {
          correctedEntry.requiresAccountCreation = false;
        }

        validatedEntries.push(correctedEntry);
      } catch (error) {
        logger.error('Failed to validate account', {
          entry,
          error: error.message,
        });
        // Include the original entry if validation fails
        validatedEntries.push({
          ...entry,
          validationError: error.message,
        });
      }
    }

    return validatedEntries;
  }

  formatTokenTransfers(tokenTransfers) {
    if (!tokenTransfers || tokenTransfers.length === 0) {
      return 'No token transfers detected';
    }

    return tokenTransfers.map(transfer => {
      const amount = parseFloat(transfer.value) / Math.pow(10, transfer.token?.decimals || 18);
      return `• ${amount} ${transfer.token?.symbol || 'UNKNOWN'} (${transfer.token?.name || 'Unknown Token'}) from ${transfer.from} to ${transfer.to}`;
    }).join('\n');
  }

  parseJournalEntries(responseText) {
    try {
      let jsonText = responseText;
      logger.info('Parsing journal entries from AI response', {
        responseLength: responseText.length,
        preview: responseText.substring(0, 200),
      });

      // Remove all markdown code blocks
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Remove all comments (both // style and /* */ style)
      jsonText = jsonText.replace(/\/\*[\s\S]*?\*\//g, '');
      jsonText = jsonText.replace(/\/\/.*$/gm, '');

      let entries = [];

      // Strategy 1: Look for direct JSON array
      let jsonMatch = jsonText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      
      if (jsonMatch) {
        try {
          let entriesJson = jsonMatch[0];
          // Clean up JSON
          entriesJson = entriesJson.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
          entries = JSON.parse(entriesJson);
          logger.info('Successfully parsed direct JSON array', { entriesCount: entries.length });
        } catch (e) {
          logger.warn('Failed to parse direct JSON array', { error: e.message });
        }
      }

      // Strategy 2: Look for nested journalEntries object
      if (entries.length === 0) {
        const objectMatch = jsonText.match(/\{[\s\S]*?"journalEntries"[\s\S]*?\[[\s\S]*?\][\s\S]*?\}/);
        if (objectMatch) {
          try {
            let cleanJson = objectMatch[0];
            cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');
            const parsed = JSON.parse(cleanJson);
            if (parsed.journalEntries && Array.isArray(parsed.journalEntries)) {
              entries = parsed.journalEntries;
              logger.info('Successfully parsed nested journalEntries', { entriesCount: entries.length });
            }
          } catch (e) {
            logger.warn('Failed to parse nested journalEntries', { error: e.message });
          }
        }
      }

      // Strategy 3: Manual extraction if JSON parsing fails
      if (entries.length === 0) {
        logger.info('JSON parsing failed, attempting manual extraction');
        
        // Extract amount and currency from original response text
        const amountMatch = responseText.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(USDC|ETH|BTC|USD|USDT|DAI)/i);
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
        const currency = amountMatch ? amountMatch[2].toUpperCase() : 'USD';
        
        // Look for account mentions in the text
        let debitAccount = 'Digital Assets - Other';
        let creditAccount = 'Share Capital';
        
        // Check for specific currency mentions
        if (currency === 'USDC') {
          debitAccount = 'Digital Assets - USDC';
        } else if (currency === 'ETH') {
          debitAccount = 'Digital Assets - Ethereum';
        } else if (currency === 'BTC') {
          debitAccount = 'Digital Assets - Bitcoin';
        } else if (currency === 'USDT') {
          debitAccount = 'Digital Assets - USDT';
        }
        
        // Check for investment/capital keywords
        if (responseText.toLowerCase().includes('invest') || 
            responseText.toLowerCase().includes('capital') ||
            responseText.toLowerCase().includes('equity')) {
          creditAccount = 'Share Capital';
        }
        
        if (amount > 0) {
          entries = [{
            accountDebit: debitAccount,
            accountCredit: creditAccount,
            amount: amount,
            currency: currency,
            narrative: `Manual extraction: ${amount} ${currency} transaction`,
            confidence: 0.7,
            ifrsReference: 'IAS 32',
          }];
          logger.info('Successfully created manual entry', { amount, currency, debitAccount, creditAccount });
        }
      }

      // Validate and normalize the entries
      const validatedEntries = entries.map(entry => {
        const amount = parseFloat(entry.amount) || 0;
        
        let transactionDate = null;
        if (entry.transactionDate) {
          try {
            // Parse the AI-provided transaction date
            transactionDate = new Date(entry.transactionDate);
            if (isNaN(transactionDate.getTime())) {
              logger.warn('Invalid transaction date from AI', { date: entry.transactionDate });
              transactionDate = null;
            } else {
              logger.info('AI provided transaction date', { 
                original: entry.transactionDate, 
                parsed: transactionDate.toISOString() 
              });
            }
          } catch (error) {
            logger.warn('Failed to parse AI transaction date', { 
              date: entry.transactionDate, 
              error: error.message 
            });
            transactionDate = null;
          }
        }
        
        const normalizedEntry = {
          accountDebit: entry.accountDebit || entry.debit || 'Digital Assets - Other',
          accountCredit: entry.accountCredit || entry.credit || 'Share Capital',
          amount: amount,
          currency: entry.currency || 'USD',
          narrative: entry.narrative || entry.description || `Transaction of ${amount}`,
          confidence: entry.confidence || 0.8,
          ifrsReference: entry.ifrsReference || '',
        };
        
        // Only add transactionDate if it was successfully parsed
        if (transactionDate) {
          normalizedEntry.transactionDate = transactionDate;
        }
        
        return normalizedEntry;
      }).filter(entry => entry.amount > 0); // Only include entries with valid amounts

      logger.info('Journal entries parsing completed', {
        totalEntries: validatedEntries.length,
        entries: validatedEntries.map(e => ({
          debit: e.accountDebit,
          credit: e.accountCredit,
          amount: e.amount,
          currency: e.currency,
          hasTransactionDate: !!e.transactionDate,
          transactionDate: e.transactionDate?.toISOString()
        })),
      });

      return validatedEntries;
    } catch (error) {
      logger.error('Failed to parse journal entries from AI response', {
        error: error.message,
        responseText: responseText.substring(0, 500),
      });
      
      return [];
    }
  }
}

module.exports = GeminiClient;
