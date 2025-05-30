const axios = require('axios');
const logger = require('../../utils/logger');
const { AppError } = require('../../middleware/errorHandler');

class DeepSeekClient {
  constructor() {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required');
    }

    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.baseURL = 'https://api.deepseek.com/v1';
    this.model = 'deepseek-chat';
  }

  async verifyJournalEntry(journalEntry, originalTransaction) {
    try {
      logger.info('Verifying journal entry with DeepSeek AI', {
        entryId: journalEntry.id || 'new',
        debitAccount: journalEntry.accountDebit,
        creditAccount: journalEntry.accountCredit,
      });

      const prompt = this.buildVerificationPrompt(journalEntry, originalTransaction);

      const response = await this.makeAPICall([
        {
          role: 'system',
          content: 'You are an expert accounting AI that verifies IFRS-compliant journal entries for cryptocurrency transactions. Provide detailed analysis and suggestions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      const verification = this.parseVerificationResponse(response);

      logger.info('Journal entry verification completed', {
        entryId: journalEntry.id || 'new',
        isValid: verification.isValid,
        confidence: verification.confidence,
      });

      return verification;
    } catch (error) {
      logger.error('Error verifying journal entry with DeepSeek', {
        entryId: journalEntry.id || 'new',
        error: error.message,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('Failed to verify journal entry with AI', 500);
    }
  }

  async chatResponse(message, context = {}) {
    try {
      logger.info('Processing chat message with DeepSeek AI', {
        messageLength: message.length,
        hasContext: Object.keys(context).length > 0,
      });

      const systemPrompt = this.buildChatSystemPrompt();
      const userPrompt = this.buildChatPrompt(message, context);

      const response = await this.makeAPICall([
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ]);

      logger.info('Chat response generated successfully');

      return {
        response: response.trim(),
        thinking: this.extractThinking(response),
        suggestions: this.extractSuggestions(response),
      };
    } catch (error) {
      logger.error('Error generating chat response with DeepSeek', {
        error: error.message,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('Failed to generate chat response', 500);
    }
  }

  buildVerificationPrompt(journalEntry, originalTransaction) {
    return `
Please verify this journal entry for a cryptocurrency transaction:

JOURNAL ENTRY:
- Debit Account: ${journalEntry.accountDebit || journalEntry.debit_account}
- Credit Account: ${journalEntry.accountCredit || journalEntry.credit_account}
- Amount: ${journalEntry.amount}
- Currency: ${journalEntry.currency}
- Description: ${journalEntry.description || journalEntry.narrative}
- Date: ${journalEntry.entryDate || journalEntry.entry_date}

ORIGINAL TRANSACTION:
${originalTransaction ? JSON.stringify(originalTransaction, null, 2) : 'No transaction data provided'}

Please analyze:
1. IFRS compliance
2. Double-entry accuracy
3. Account classification correctness
4. Amount accuracy
5. Any potential issues or improvements

Respond in JSON format:
{
  "isValid": boolean,
  "confidence": number (0-1),
  "issues": ["list of issues found"],
  "suggestions": ["list of improvement suggestions"],
  "reasoning": "detailed explanation of your analysis",
  "ifrsCompliance": "assessment of IFRS compliance"
}
`;
  }

  buildChatSystemPrompt() {
    return `You are an expert AI assistant specializing in cryptocurrency accounting and IFRS-compliant bookkeeping. You help users with:

1. Creating journal entries for crypto transactions
2. Explaining accounting principles
3. IFRS compliance guidance
4. Transaction analysis
5. Financial reporting for digital assets

Always:
- Show your thinking process step by step
- Provide practical, actionable advice
- Reference relevant IFRS standards when applicable
- Ask clarifying questions when needed
- Suggest specific journal entries when appropriate

Format your responses with clear sections:
- **Thinking**: Your analysis process
- **Answer**: Your main response
- **Suggestions**: Actionable next steps (if applicable)`;
  }

  buildChatPrompt(message, context) {
    let prompt = `User message: ${message}`;

    if (context.user) {
      prompt += `\n\nUser context: ${context.user.email}`;
    }

    if (context.recentEntries && context.recentEntries.length > 0) {
      prompt += `\n\nRecent journal entries:\n${JSON.stringify(context.recentEntries, null, 2)}`;
    }

    if (context.currentTransaction) {
      prompt += `\n\nCurrent transaction being discussed:\n${JSON.stringify(context.currentTransaction, null, 2)}`;
    }

    return prompt;
  }

  async makeAPICall(messages) {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        },
      );

      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        throw new Error('Invalid response from DeepSeek API');
      }

      return response.data.choices[0].message.content;
    } catch (error) {
      if (error.response) {
        logger.error('DeepSeek API error', {
          status: error.response.status,
          data: error.response.data,
        });
        throw new AppError(`DeepSeek API error: ${error.response.data.error?.message || 'Unknown error'}`, 500);
      } else if (error.request) {
        logger.error('DeepSeek API network error', { error: error.message });
        throw new AppError('Failed to connect to DeepSeek API', 500);
      } else {
        logger.error('DeepSeek API request error', { error: error.message });
        throw new AppError('Failed to make request to DeepSeek API', 500);
      }
    }
  }

  parseVerificationResponse(responseText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON found, create a structured response
      return {
        isValid: responseText.toLowerCase().includes('valid') && !responseText.toLowerCase().includes('invalid'),
        confidence: 0.7,
        issues: [],
        suggestions: [],
        reasoning: responseText,
        ifrsCompliance: 'Analysis provided in reasoning',
      };
    } catch (error) {
      logger.warn('Failed to parse verification response as JSON', {
        response: responseText,
        error: error.message,
      });

      return {
        isValid: true,
        confidence: 0.5,
        issues: ['Could not parse verification response'],
        suggestions: ['Manual review recommended'],
        reasoning: responseText,
        ifrsCompliance: 'Manual review required',
      };
    }
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
        .map(line => line.replace(/^[-*]\s*/, '').trim());
    }
    return [];
  }
}

module.exports = DeepSeekClient;
