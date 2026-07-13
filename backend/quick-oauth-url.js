/**
 * Quick OAuth URL Generator for Therapist
 * Just generates the OAuth link - complete authorization manually
 */

const { google } = require('googleapis');
const path = require('path');

// Load credentials
const credentialsPath = path.join(__dirname, 'google-credentials.json');
const credentials = require(credentialsPath);
const { client_id, client_secret, redirect_uris } = credentials.installed;

// Get therapist ID from command line
const therapistId = process.argv[2];

if (!therapistId) {
  console.log('\n❌ Usage: node quick-oauth-url.js <therapist-id>');
  console.log('   Example: node quick-oauth-url.js 65f1234abcd567890\n');
  process.exit(1);
}

// Generate OAuth URL
const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar'],
  prompt: 'consent',
  state: therapistId
});

console.log('\n📧 THERAPIST GOOGLE CALENDAR OAUTH\n');
console.log('============================================\n');
console.log('🔗 Send this URL to the therapist:\n');
console.log(authUrl);
console.log('\n============================================\n');
console.log('📋 Instructions for Therapist:\n');
console.log('1. Click the URL above');
console.log('2. Sign in with the Google account you want to use for sessions');
console.log('3. Grant Calendar access');
console.log('4. You\'ll be redirected to: http://localhost/?code=...&state=...');
console.log('5. Copy the FULL URL');
console.log('6. Send it back to admin to complete setup\n');

console.log('\n💡 After authorization, run this to complete:');
console.log(`   node complete-oauth.js "<full-redirect-url>" ${therapistId}\n`);
