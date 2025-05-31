// This script simulates how the backend server loads environment variables
// (ONLY from .env file, no manual setting like our test scripts)

require('dotenv').config();

console.log('🔍 Backend Server Environment Test');
console.log('This simulates how your backend server loads FTSO config when the frontend calls it');
console.log('='.repeat(70));

console.log('\n📋 Environment Variables (from .env file only):');
console.log(`FTSO_PRICE_CONSUMER_ENABLED: ${process.env.FTSO_PRICE_CONSUMER_ENABLED}`);
console.log(`FTSO_PRICE_CONSUMER_ADDRESS: ${process.env.FTSO_PRICE_CONSUMER_ADDRESS}`);
console.log(`FLARE_RPC_URL: ${process.env.FLARE_RPC_URL}`);
console.log(`FLARE_CHAIN_ID: ${process.env.FLARE_CHAIN_ID}`);

// Load FTSO service AFTER dotenv (like the server does)
const ftsoService = require('./src/services/ftsoService');

console.log('\n🔧 FTSO Service Status (as server would see it):');
console.log(`Service Available: ${ftsoService.isAvailable()}`);
console.log(`Service Enabled: ${ftsoService.enabled}`);

if (!ftsoService.isAvailable()) {
  console.log('\n❌ This explains why frontend gets "mock-fallback" prices!');
  console.log('The backend server\'s FTSO service is disabled due to missing .env variables.');
} else {
  console.log('\n✅ FTSO service would work for frontend calls');
}

console.log('\n💡 Solution: Add FTSO variables to your backend .env file');
console.log('Then restart your backend server.'); 