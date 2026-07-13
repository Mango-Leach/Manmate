const { connectDB } = require('./config/database');
const Therapist = require('./models/Therapist');
const emailService = require('./services/emailService');
const { generateOAuthUrl } = require('./controllers/calendarOAuthController');

async function resendWelcomeEmail(therapistEmail) {
  try {
    await connectDB();

    const therapist = await Therapist.findByEmail(therapistEmail);
    if (!therapist) {
      console.error(`❌ Therapist not found: ${therapistEmail}`);
      process.exit(1);
    }

    const therapistId = therapist._id.toString();
    const oauthUrl = generateOAuthUrl(therapistId);

    console.log(`📧 Sending welcome email to: ${therapist.email}`);
    console.log(`👤 Therapist: ${therapist.name}`);
    console.log(`🔗 OAuth URL: ${oauthUrl}\n`);

    await emailService.sendTherapistWelcome({
      therapistEmail: therapist.email,
      therapistName: therapist.name,
      therapistId: therapistId,
      oauthUrl: oauthUrl
    });

    console.log('✅ Welcome email sent successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Therapist checks their email');
    console.log('2. Clicks "Connect Google Calendar" button');
    console.log('3. Authorizes with their Google account');
    console.log('4. Done! Future appointments will use their calendar\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const therapistEmail = process.argv[2];
if (!therapistEmail) {
  console.error('Usage: node resend-welcome-email.js <therapist-email>');
  process.exit(1);
}

resendWelcomeEmail(therapistEmail);
