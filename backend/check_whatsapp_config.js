const axios = require('axios');
require('dotenv').config(); // Load .env from current directory

const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const currentPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

async function checkConfiguration() {
  console.log('--- WhatsApp API Configuration Check ---');
  console.log(`API Version: ${apiVersion}`);
  console.log(`Business Account ID: ${businessAccountId}`);
  console.log(`Current Phone Number ID: ${currentPhoneNumberId}`);

  if (!accessToken) {
    console.error('❌ Error: WHATSAPP_ACCESS_TOKEN is missing in .env');
    return;
  }

  const baseUrl = `https://graph.facebook.com/${apiVersion}`;

  // 1. Check Business Account and Phone Numbers
  console.log('\n1. Fetching Phone Numbers for Business Account...');
  try {
    const response = await axios.get(`${baseUrl}/${businessAccountId}/phone_numbers`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const phoneNumbers = response.data.data;
    if (phoneNumbers && phoneNumbers.length > 0) {
      console.log(`✅ Found ${phoneNumbers.length} phone number(s):`);
      phoneNumbers.forEach(pn => {
        const match = pn.id === currentPhoneNumberId ? ' (MATCHES CURRENT ENV)' : '';
        console.log(`   - ID: ${pn.id}, Number: ${pn.display_phone_number}, Verified Name: ${pn.verified_name}${match}`);
      });
    } else {
      console.warn('⚠️ No phone numbers found for this Business Account.');
    }

  } catch (error) {
    console.error('❌ Failed to fetch phone numbers:', error.response ? error.response.data : error.message);
  }

  // 2. Check the specific Phone Number ID (if different from list or just to verify)
  if (currentPhoneNumberId) {
    console.log(`\n2. Verifying Current Phone Number ID (${currentPhoneNumberId})...`);
    try {
      const response = await axios.get(`${baseUrl}/${currentPhoneNumberId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      console.log(`✅ Phone Number ID is valid. Display Name: ${response.data.display_phone_number}`);
    } catch (error) {
      console.error(`❌ Failed to verify Phone Number ID ${currentPhoneNumberId}:`);
      console.error(JSON.stringify(error.response ? error.response.data : error.message, null, 2));
    }
  }
}

checkConfiguration();
