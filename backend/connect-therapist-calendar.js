/**
 * Helper script to connect a therapist's Google Calendar
 * Run this to get OAuth URL for any therapist
 */

const { google } = require('googleapis');
const path = require('path');
const readline = require('readline');
const Therapist = require('./models/Therapist');
const { connectDB } = require('./config/database');

// Load credentials
const credentialsPath = path.join(__dirname, 'google-credentials.json');
const credentials = require(credentialsPath);
const { client_id, client_secret, redirect_uris } = credentials.installed;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  try {
    console.log('\n🔗 Therapist Google Calendar Connection Tool\n');

    // Connect to database
    await connectDB();
    console.log('✅ Connected to database\n');

    // Get therapist email
    const therapistEmail = await question('Enter therapist email: ');

    const therapist = await Therapist.findByEmail(therapistEmail);
    if (!therapist) {
      console.log('❌ Therapist not found with email:', therapistEmail);
      process.exit(1);
    }

    console.log(`\n📋 Therapist: ${therapist.name}`);
    console.log(`   Email: ${therapist.email}`);
    console.log(`   Calendar Connected: ${therapist.googleCalendarConnected ? '✅ Yes' : '❌ No'}`);

    if (therapist.googleCalendarConnected) {
      console.log(`   Connected Email: ${therapist.googleCalendarEmail}`);
      const reconnect = await question('\nAlready connected! Reconnect? (yes/no): ');
      if (reconnect.toLowerCase() !== 'yes') {
        process.exit(0);
      }
    }

    // Generate OAuth URL
    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      prompt: 'consent',
      state: therapist._id.toString()
    });

    console.log('\n\n📌 STEP 1: Open this URL in browser:\n');
    console.log(authUrl);
    console.log('\n');

    console.log('📌 STEP 2: After authorizing, you\'ll be redirected to a URL like:');
    console.log('   http://localhost/?code=4/0A...&state=...\n');

    const redirectUrl = await question('📌 STEP 3: Paste the FULL redirect URL here: ');

    // Extract code from URL
    const url = new URL(redirectUrl.replace('localhost', 'localhost:3000')); // Fix URL parsing
    const code = url.searchParams.get('code');

    if (!code) {
      console.log('❌ No authorization code found in URL');
      process.exit(1);
    }

    console.log('\n🔄 Exchanging code for tokens...');

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      console.log('❌ Failed to get refresh token. Please try again.');
      process.exit(1);
    }

    // Get user info
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email;

    console.log(`✅ Successfully authorized with: ${googleEmail}`);

    // Update therapist in database
    await Therapist.update(therapist._id.toString(), {
      googleRefreshToken: refreshToken,
      googleCalendarConnected: true,
      googleCalendarEmail: googleEmail
    });

    console.log('\n✅ ✅ ✅ SUCCESS! ✅ ✅ ✅\n');
    console.log(`Therapist ${therapist.name} is now connected!`);
    console.log(`Future appointments will be created on ${googleEmail}'s calendar`);
    console.log(`${therapist.name} will be the meeting host!\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
