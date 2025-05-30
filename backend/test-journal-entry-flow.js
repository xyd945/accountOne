require('dotenv').config();
const GeminiClient = require('./src/services/aiClients/geminiClient');

async function testJournalEntryFlow() {
  console.log('🧪 Testing Complete Journal Entry Flow...\n');

  const geminiClient = new GeminiClient();

  // Test 1: Valid transaction hash
  console.log('📝 Test 1: Valid Transaction Hash');
  console.log('='.repeat(50));
  
  try {
    const validTxMessage = 'Create journal entry for 0x5956713fe3dd60ee36de2e71dddf031ecd1e5538742f80dea2c6bd2da2c4d8bb it\'s payment I received for consulting services';
    
    const context = {
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
      },
    };

    console.log('Message:', validTxMessage);
    console.log('Context:', JSON.stringify(context, null, 2));
    console.log('\nProcessing...\n');

    const response = await geminiClient.chatResponse(validTxMessage, context);
    
    console.log('✅ Response received:');
    console.log('Response:', response.response);
    console.log('\nThinking:', response.thinking);
    console.log('\nSuggestions:', response.suggestions);
    
  } catch (error) {
    console.log('❌ Test 1 failed:', error.message);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Test 2: Invalid transaction hash
  console.log('📝 Test 2: Invalid Transaction Hash');
  console.log('='.repeat(50));
  
  try {
    const invalidTxMessage = 'Create journal entry for 0x273f7a3c18b14541c878ef4efbb48251dbfa62d49c03e66bdefa15c06fd14ba5 it\'s payment I received for renting out apartment';
    
    console.log('Message:', invalidTxMessage);
    console.log('\nProcessing...\n');

    const response = await geminiClient.chatResponse(invalidTxMessage, {});
    
    console.log('✅ Response received:');
    console.log('Response:', response.response);
    console.log('\nThinking:', response.thinking);
    console.log('\nSuggestions:', response.suggestions);
    
  } catch (error) {
    console.log('❌ Test 2 failed:', error.message);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Test 3: General journal entry request
  console.log('📝 Test 3: General Journal Entry Request');
  console.log('='.repeat(50));
  
  try {
    const generalMessage = 'Create a journal entry for buying 1 ETH for $3000';
    
    console.log('Message:', generalMessage);
    console.log('\nProcessing...\n');

    const response = await geminiClient.chatResponse(generalMessage, {});
    
    console.log('✅ Response received:');
    console.log('Response:', response.response);
    console.log('\nThinking:', response.thinking);
    console.log('\nSuggestions:', response.suggestions);
    
    if (response.journalEntries && response.journalEntries.length > 0) {
      console.log('\nExtracted Journal Entries:');
      console.log(JSON.stringify(response.journalEntries, null, 2));
    }
    
  } catch (error) {
    console.log('❌ Test 3 failed:', error.message);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Test 4: Non-journal entry chat
  console.log('📝 Test 4: Non-Journal Entry Chat');
  console.log('='.repeat(50));
  
  try {
    const chatMessage = 'What are the IFRS standards for cryptocurrency accounting?';
    
    console.log('Message:', chatMessage);
    console.log('\nProcessing...\n');

    const response = await geminiClient.chatResponse(chatMessage, {});
    
    console.log('✅ Response received:');
    console.log('Response:', response.response.substring(0, 200) + '...');
    console.log('\nThinking:', response.thinking);
    console.log('\nSuggestions:', response.suggestions);
    
  } catch (error) {
    console.log('❌ Test 4 failed:', error.message);
  }

  console.log('\n📋 Test Summary:');
  console.log('1. Valid transaction hash - should fetch real data and create entries');
  console.log('2. Invalid transaction hash - should provide helpful error message');
  console.log('3. General journal entry - should create structured entries');
  console.log('4. Non-journal chat - should provide accounting guidance');
}

testJournalEntryFlow().catch(console.error); 