const { google } = require('googleapis');
const readline = require('readline');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CREDENTIALS_PATH = path.join(__dirname, 'google-credentials.json');

async function getToken() {
  const credentials = require(CREDENTIALS_PATH);
  const { client_id, client_secret, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('\n========================================');
  console.log('📋 GOOGLE CALENDAR API AUTHORIZATION');
  console.log('========================================\n');
  console.log('STEP 1: Open this URL in your browser:\n');
  console.log('👉 ' + authUrl + '\n');
  console.log('STEP 2: Sign in with the Google account that will create calendar events');
  console.log('        (Recommend using the main account: theteradhakrishna@gmail.com)\n');
  console.log('STEP 3: Click "Allow" to grant calendar permissions\n');
  console.log('STEP 4: You will be redirected to a page that says "This site can\'t be reached"');
  console.log('        or "localhost refused to connect" - THIS IS NORMAL!\n');
  console.log('STEP 5: Copy the FULL URL from your browser address bar');
  console.log('        It will look like:');
  console.log('        http://localhost/?code=4/0AcvDMr...[long code]...&scope=https://...\n');
  console.log('========================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Paste the full redirect URL here: ', async (redirectUrl) => {
    rl.close();

    try {
      // Extract code from URL
      const url = new URL(redirectUrl.trim());
      const code = url.searchParams.get('code');

      if (!code) {
        console.error('\n❌ ERROR: No authorization code found in URL');
        console.error('Make sure you copied the FULL URL from the browser\n');
        return;
      }

      console.log('\n⏳ Exchanging authorization code for tokens...\n');

      const { tokens } = await oAuth2Client.getToken(code);

      console.log('========================================');
      console.log('✅ SUCCESS! Token generated!');
      console.log('========================================\n');
      console.log('Add this line to your backend/.env file:\n');
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\n========================================');
      console.log('⚠️  IMPORTANT: Keep this token SECURE!');
      console.log('   Never commit it to Git or share publicly');
      console.log('========================================\n');

    } catch (error) {
      console.error('\n❌ ERROR getting tokens:', error.message);
      console.error('\nPossible issues:');
      console.error('1. Invalid URL format - make sure you copied the FULL URL');
      console.error('2. Authorization code expired - run the script again');
      console.error('3. Redirect URI mismatch - check Google Cloud Console settings\n');
    }
  });
}

console.log('\n🚀 Starting Google Calendar Authorization Flow...\n');
getToken().catch(console.error);
