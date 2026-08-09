'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Wordmark } from '@/components/design/primitives';
import { getCurrentUser, getRoleDashboard } from '@/lib/api';

const LAST_UPDATED = 'July 6, 2026';
const EFFECTIVE_DATE = 'June 13, 2026';

const SECTIONS = [
  { id: 'introduction',       label: '1. Introduction' },
  { id: 'information-we-collect', label: '2. Information We Collect' },
  { id: 'how-we-use',         label: '3. How We Use Your Information' },
  { id: 'sharing',            label: '4. Sharing & Disclosure' },
  { id: 'p2p-privacy',        label: '5. P2P Session Privacy' },
  { id: 'ai-processing',      label: '6. AI & Automated Processing' },
  { id: 'payments',           label: '7. Payments & Financial Data' },
  { id: 'cookies',            label: '8. Cookies & Tracking' },
  { id: 'retention',          label: '9. Data Retention' },
  { id: 'your-rights',        label: '10. Your Rights' },
  { id: 'security',           label: '11. Data Security' },
  { id: 'children',           label: '12. Children\'s Privacy' },
  { id: 'third-party',        label: '13. Third-Party Services' },
  { id: 'transfers',          label: '14. International Transfers' },
  { id: 'changes',            label: '15. Changes to This Policy' },
  { id: 'contact',            label: '16. Contact Us' },
];

export default function PrivacyPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [activeSection, setActiveSection] = useState('introduction');

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const dashboardPath = user ? getRoleDashboard(user.role) : '/';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(245,241,232,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line)', padding: '0 clamp(16px, 4vw, 48px)', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={40} />
          <Wordmark size={18} />
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {user
            ? <button onClick={() => router.push(dashboardPath)} style={navBtnStyle}>Dashboard</button>
            : <>
                <button onClick={() => router.push('/auth/login')} style={navBtnStyle}>Sign in</button>
                <button onClick={() => router.push('/auth/register')} style={{ ...navBtnStyle, background: 'var(--sage)', color: '#FBF8F0', border: 'none' }}>Get started</button>
              </>
          }
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #3A5246 0%, var(--sage) 60%, var(--sage-2) 100%)',
        padding: '72px 48px 56px', textAlign: 'center', color: '#F5F1E8',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', opacity: 0.7, fontWeight: 600, marginBottom: 16 }}>Legal</div>
        <h1 className="serif" style={{ fontSize: 52, fontWeight: 400, margin: '0 0 16px', letterSpacing: -0.02, lineHeight: 1.1 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 16, opacity: 0.8, maxWidth: 560, margin: '0 auto 28px', lineHeight: 1.6 }}>
          Your privacy matters deeply to us. This policy explains exactly what data we collect, why we collect it, and how you stay in control of your information on मनmate.
        </p>
        <div style={{ display: 'inline-flex', gap: 24, fontSize: 13, opacity: 0.7 }}>
          <span>Last updated: {LAST_UPDATED}</span>
          <span>·</span>
          <span>Effective: {EFFECTIVE_DATE}</span>
        </div>
      </div>

      {/* Body — two-column layout */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 32px 100px', display: 'flex', gap: 48, alignItems: 'flex-start' }}>

        {/* Sticky sidebar TOC */}
        <aside style={{
          width: 260, flexShrink: 0, position: 'sticky', top: 84,
          maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
          display: 'none',
        }} className="privacy-toc">
          <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, marginBottom: 14 }}>Contents</div>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => scrollTo(s.id)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: activeSection === s.id ? 'var(--lavender-soft)' : 'none',
              border: 'none', borderLeft: `2px solid ${activeSection === s.id ? 'var(--lavender)' : 'transparent'}`,
              padding: '7px 14px', borderRadius: '0 8px 8px 0',
              color: activeSection === s.id ? 'var(--lavender)' : 'var(--muted)',
              fontSize: 12.5, fontWeight: activeSection === s.id ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s', marginBottom: 1,
              lineHeight: 1.4,
            }}>
              {s.label}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <article style={{ flex: 1, minWidth: 0 }}>

          <Section id="introduction" title="1. Introduction">
            <P>
              <Strong>मनmate</Strong> ("we", "our", "us", or "the Platform") is a mental-health support platform operated by MannMate Technologies Private Limited, a company incorporated under the laws of India. We are committed to protecting the privacy and confidentiality of every person who uses our services.
            </P>
            <P>
              This Privacy Policy ("Policy") describes how we collect, use, store, share, and protect your personal information when you access or use the मनmate website, mobile applications, APIs, and all associated services (collectively, the "Services"). It also describes the choices available to you regarding your personal data.
            </P>
            <P>
              By creating an account or using any part of the Platform, you agree to the collection and use of information in accordance with this Policy. This Policy is incorporated into and forms part of our <a href="/terms" style={linkStyle}>Terms & Conditions</a>.
            </P>
            <Note>
              Mental health data is among the most sensitive personal information. We treat it with the highest level of care and apply strict controls on how it is handled, accessed, and processed.
            </Note>
          </Section>

          <Section id="information-we-collect" title="2. Information We Collect" highlight>
            <P>We collect information in the following categories depending on how you interact with the Platform:</P>

            <SubHeading>2.1 Account & Registration Data</SubHeading>
            <P>When you create an account, we collect:</P>
            <BulletList items={[
              'Full name (or display name for Listeners)',
              'Email address',
              'Password (stored as a secure one-way hash — we never store your plaintext password)',
              'Date of birth (for age verification)',
              'Role selection: Client, Listener, or Therapist',
              'Profile picture (optional)',
              'Language preference',
            ]} />

            <SubHeading>2.2 Therapist Verification Data</SubHeading>
            <P>If you register as a Therapist, we additionally collect:</P>
            <BulletList items={[
              'Professional licence number and issuing council (e.g., RCI, NIMHANS)',
              'Qualifications and specialisations',
              'Government-issued identity document (for verification)',
              'Bank account or UPI details (for fee disbursement)',
              'A brief professional bio displayed on your public profile',
            ]} />

            <SubHeading>2.3 Usage & Session Data</SubHeading>
            <P>We automatically collect information about how you use the Platform, including:</P>
            <BulletList items={[
              'Session timestamps, durations, and connection quality metrics',
              'Features accessed, pages visited, and navigation paths',
              'Device type, operating system, browser version, and screen resolution',
              'IP address and approximate geographic location (city/region level)',
              'Referral source (how you found us)',
              'Error logs and crash reports',
            ]} />

            <SubHeading>2.4 Call & Communication Data</SubHeading>
            <P>For P2P peer listening and therapist video sessions:</P>
            <BulletList items={[
              'Call logs: start time, end time, duration, and session type (text/audio/video)',
              'Connection metadata: call ID, peer IDs, signalling events',
              'Mood ratings or check-in responses submitted before or after a session',
              'Post-session feedback and ratings you voluntarily provide',
              'Text messages sent within the Platform\'s in-session chat (if applicable)',
            ]} />
            <Note>Audio and video content of P2P peer sessions is transmitted peer-to-peer over WebRTC and is not recorded or stored on our servers by default. See Section 5 for full details.</Note>

            <SubHeading>2.5 Appointment & Calendar Data</SubHeading>
            <P>When you book a therapist appointment:</P>
            <BulletList items={[
              'Appointment date, time, and duration',
              'Therapist selected and service type',
              'Google Calendar event data (if you connect your Google account)',
              'Google Meet link details for video appointments',
              'Notes you provide in the booking form (e.g., presenting concerns)',
            ]} />

            <SubHeading>2.6 Payment & Financial Data</SubHeading>
            <P>We collect transaction-related information through our payment processor (Razorpay):</P>
            <BulletList items={[
              'Wallet top-up amounts and transaction IDs',
              'Therapist session fee deductions and refund records',
              'Payment method type (UPI, card, net banking) — we do not store full card numbers',
              'Razorpay order and payment IDs',
              'Transaction status and timestamps',
            ]} />

            <SubHeading>2.7 Google OAuth Data</SubHeading>
            <P>If you sign in with Google or connect your Google account for Calendar integration, we receive:</P>
            <BulletList items={[
              'Your Google account email address and display name',
              'Google profile picture URL',
              'Google OAuth access and refresh tokens (stored securely, used only for Calendar/Meet integration)',
              'Calendar event creation and read permissions (only when you grant them)',
            ]} />
          </Section>

          <Section id="how-we-use" title="3. How We Use Your Information">
            <P>We use the information we collect for the following purposes, each of which has a corresponding lawful basis under applicable data protection law:</P>

            <SubHeading>3.1 Providing and Operating the Services</SubHeading>
            <BulletList items={[
              'Creating and managing your account',
              'Matching you with available Listeners during P2P sessions',
              'Processing therapist bookings, scheduling, and Google Meet link generation',
              'Managing your Wallet balance, processing payments, and issuing refunds',
              'Delivering in-app notifications, reminders, and session summaries',
            ]} />

            <SubHeading>3.2 Safety, Quality, and Trust</SubHeading>
            <BulletList items={[
              'Detecting and preventing fraudulent activity, abuse, and Terms violations',
              'Monitoring platform integrity and connection quality metrics',
              'Reviewing post-session reports or flagged content for safety purposes',
              'Training and auditing our Listener and Therapist quality assurance processes',
            ]} />

            <SubHeading>3.3 Personalisation & Product Improvement</SubHeading>
            <BulletList items={[
              'Improving our matching algorithm based on session quality signals',
              'Personalising your dashboard and content recommendations',
              'Analysing usage patterns to identify and fix bugs or improve features',
              'Conducting internal research to improve mental health support outcomes',
            ]} />

            <SubHeading>3.4 Communication</SubHeading>
            <BulletList items={[
              'Sending transactional emails (booking confirmations, receipts, password resets)',
              'Sending platform announcements and critical policy updates',
              'Sending optional product newsletters (you may unsubscribe at any time)',
              'Responding to your support queries and feedback',
            ]} />

            <SubHeading>3.5 Legal & Compliance</SubHeading>
            <BulletList items={[
              'Complying with applicable Indian laws, regulations, and court orders',
              'Enforcing our Terms & Conditions and Community Guidelines',
              'Responding to legal process or government requests as required by law',
              'Protecting the rights, property, and safety of our users and staff',
            ]} />
          </Section>

          <Section id="sharing" title="4. Sharing & Disclosure">
            <P>We do not sell your personal data. We do not share your personal data with third parties for their own marketing purposes. We may share information only in the following limited circumstances:</P>

            <SubHeading>4.1 Service Providers</SubHeading>
            <P>We engage trusted third-party companies to process data on our behalf. These processors are contractually bound to handle data only as instructed by us:</P>
            <BulletList items={[
              'Razorpay India Pvt. Ltd. — payment processing and fraud detection',
              'Google LLC — Calendar and Meet integration (only when you opt in)',
              'Sarvam AI — AI-powered voice and language processing features (see Section 6)',
              'MongoDB Atlas (MongoDB, Inc.) — cloud database hosting',
              'Vercel Inc. — frontend hosting and edge delivery',
              'Email delivery providers — transactional email dispatch',
            ]} />

            <SubHeading>4.2 Therapist Profiles</SubHeading>
            <P>If you are a verified Therapist, your name, professional bio, qualifications, specialisations, and availability are displayed publicly on the Platform so Clients can make informed booking decisions.</P>

            <SubHeading>4.3 Legal Requirements</SubHeading>
            <P>We may disclose your information if required to do so by law or in good-faith belief that such disclosure is necessary to: (a) comply with a legal obligation, court order, or government request; (b) protect and defend our legal rights; (c) prevent or investigate possible wrongdoing in connection with the Platform; or (d) protect the personal safety of users of the Platform or the public.</P>

            <SubHeading>4.4 Emergency Situations</SubHeading>
            <P>Where we believe in good faith that a user may be at imminent risk of harm to themselves or others, we may disclose relevant information to emergency services or appropriate authorities, even without your consent, as permitted under applicable Indian law including the Mental Healthcare Act, 2017.</P>

            <SubHeading>4.5 Business Transfers</SubHeading>
            <P>If MannMate Technologies Private Limited undergoes a merger, acquisition, or sale of all or substantially all its assets, your personal data may be transferred as part of that transaction. We will notify you via email and/or a prominent notice on the Platform at least 30 days before your data becomes subject to a different privacy policy.</P>
          </Section>

          <Section id="p2p-privacy" title="5. P2P Session Privacy" highlight>
            <P>This section specifically addresses the privacy of real-time Person-to-Person peer listening sessions on the Platform. <Strong>Please read this section carefully — it describes how audio and session data is handled during live calls.</Strong></P>

            <SubHeading>5.1 WebRTC Architecture</SubHeading>
            <P>Peer listening sessions use WebRTC (Web Real-Time Communication) technology. Audio streams are transmitted directly between your device and your Listener's device via an encrypted peer-to-peer channel. <Strong>Your audio during a P2P session does not pass through our servers.</Strong> Our servers are only used for signalling (establishing the connection) and do not receive or record your audio content.</P>

            <SubHeading>5.2 What We Do and Do Not Record</SubHeading>
            <BulletList items={[
              'We DO record: session metadata (start/end time, duration, connection quality, session ID)',
              'We DO record: mood check-ins and ratings you submit before or after a session',
              'We DO record: post-session feedback and any written reports you or your Listener file',
              'We do NOT record: the audio content of your P2P peer listening session',
              'We do NOT store: your Listener\'s identity in a way that allows re-identification outside the session',
            ]} />

            <SubHeading>5.3 Session Monitoring</SubHeading>
            <P>Our Listener Code of Conduct requires Listeners to flag sessions involving crisis situations, policy violations, or safeguarding concerns through the in-app reporting tool. Such flags are reviewed by our Trust & Safety team. The flag itself and any written context are stored; audio is not.</P>

            <SubHeading>5.4 Anonymity</SubHeading>
            <P>Listeners see only your display name (not your real name, email, or account details) during a session. Similarly, you see only the Listener's display name. MannMate strongly advises you not to voluntarily share personally identifying information during a session. Any information you choose to share verbally during a session is shared at your own discretion and risk.</P>

            <SubHeading>5.5 Therapist Video Sessions</SubHeading>
            <P>Video consultations with licensed Therapists are conducted over Google Meet. Google's privacy policy applies to the content of Google Meet sessions. MannMate facilitates the booking and link generation but does not access or store the video or audio content of therapist consultations.</P>
          </Section>

          <Section id="ai-processing" title="6. AI & Automated Processing">
            <SubHeading>6.1 Sarvam AI Integration</SubHeading>
            <P>The Platform integrates Sarvam AI's language models to power certain features, including multilingual support, mood analysis prompts, and conversational guidance features. When these features are active, anonymised or pseudonymised conversation or input data may be processed by Sarvam AI's systems. This data is processed under a data processing agreement that requires Sarvam AI to handle data securely and only for the purposes we specify.</P>

            <SubHeading>6.2 What Is Processed</SubHeading>
            <BulletList items={[
              'Text prompts or inputs you submit to AI-powered features',
              'Mood descriptions or check-in responses for personalised suggestions',
              'Language preference signals for localisation',
            ]} />

            <SubHeading>6.3 What Is Not Used for AI Training</SubHeading>
            <P>Audio or video content from P2P sessions or therapist consultations is never used to train AI models. Text-based interactions with our AI features may be used in anonymised, aggregated form to improve model quality, only where you have provided explicit consent or where such use is permitted under applicable law.</P>

            <SubHeading>6.4 Automated Decision-Making</SubHeading>
            <P>Our matching algorithm for P2P sessions uses automated processing to pair Clients with available Listeners. This processing is based on queue position, availability, and platform-defined compatibility signals. No sensitive personal data (such as your mental health disclosures) is used in the matching algorithm. You have the right to request a manual review of any automated decision that significantly affects you.</P>
          </Section>

          <Section id="payments" title="7. Payments & Financial Data">
            <SubHeading>7.1 Payment Processor</SubHeading>
            <P>All payment transactions on the Platform are processed by <Strong>Razorpay India Pvt. Ltd.</Strong>, a PCI-DSS compliant payment service provider. When you make a payment, you interact directly with Razorpay's secure checkout interface. MannMate does not store your full card number, CVV, UPI PIN, or net banking credentials.</P>

            <SubHeading>7.2 What We Store</SubHeading>
            <BulletList items={[
              'Razorpay Order ID and Payment ID (for transaction reconciliation)',
              'Amount, currency, and timestamp of each transaction',
              'Payment method type (UPI, card, net banking) without sensitive identifiers',
              'Wallet balance and transaction history within the Platform',
              'Refund records and associated session details',
            ]} />

            <SubHeading>7.3 Wallet Data</SubHeading>
            <P>Your in-platform Wallet balance is associated with your account and reflected in real time. All credits, deductions, and refunds are logged in your transaction history, which you can view at any time from your Dashboard.</P>

            <SubHeading>7.4 Retention of Financial Records</SubHeading>
            <P>We retain financial transaction records for a minimum of <Strong>7 years</Strong> from the date of transaction to comply with applicable Indian accounting and tax laws (including the Income Tax Act, 1961 and GST regulations), even if you delete your account.</P>
          </Section>

          <Section id="cookies" title="8. Cookies & Tracking">
            <SubHeading>8.1 What We Use</SubHeading>
            <P>We use the following types of cookies and local storage mechanisms:</P>
            <BulletList items={[
              'Essential cookies: required for authentication, session management, and security (e.g., JWT token storage in localStorage)',
              'Functional cookies: remember your preferences such as theme, language, and display settings',
              'Analytics cookies: anonymised usage statistics to understand how users interact with the Platform (e.g., page views, feature usage)',
              'Advertising cookies: the main Platform (mannmate.com) does not display ads. On our public blog (blogs.mannmate.com), Google AdSense may use cookies to serve and measure ads and, where permitted, to personalise the ads you see based on your visits to this and other websites',
            ]} />

            <SubHeading>8.2 Authentication Tokens</SubHeading>
            <P>We store your authentication token (JWT) in your browser's localStorage. This is necessary to keep you signed in between sessions. The token is cryptographically signed and expires after 30 days of inactivity. You can remove it by signing out or clearing your browser data.</P>

            <SubHeading>8.3 Managing Cookies</SubHeading>
            <P>You can control cookie behaviour through your browser settings. Disabling essential cookies will prevent you from signing in or using authenticated features. We do not respond to "Do Not Track" browser signals at this time.</P>

            <SubHeading>8.4 Google AdSense & Third-Party Advertising Disclosures</SubHeading>
            <P>Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to our website or other websites on the Internet.</P>
            <P>Google's use of advertising cookies enables it and its partners to serve advertisements to our users based on their visit to our site and/or other sites on the Internet.</P>
            <P>Users may opt out of personalized advertising at any time by visiting <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" style={linkStyle}>Google Ads Settings</a>. Alternatively, users can opt out of a third-party vendor's use of cookies for personalized advertising by visiting <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer" style={linkStyle}>www.aboutads.info</a>.</P>
          </Section>

          <Section id="retention" title="9. Data Retention">
            <P>We retain personal data for no longer than is necessary for the purposes for which it was collected, or as required by law:</P>
            <BulletList items={[
              'Account data: retained for the lifetime of your account plus 90 days after deletion request',
              'Session metadata (call logs, timestamps, durations): retained for 2 years',
              'Mood check-ins and ratings: retained for 2 years or until you request deletion',
              'Appointment records: retained for 5 years (medical records obligation under Indian law)',
              'Financial transaction records: retained for 7 years (tax and accounting obligations)',
              'Therapist verification documents: retained for 3 years after the therapist\'s account is closed',
              'Safety flags and incident reports: retained for 5 years',
              'IP address logs: retained for 90 days for security and fraud prevention',
            ]} />
            <P>After retention periods expire, data is securely deleted or anonymised so it can no longer be linked to you.</P>
          </Section>

          <Section id="your-rights" title="10. Your Rights" highlight>
            <P>Under applicable Indian data protection law (including the Digital Personal Data Protection Act, 2023) and general privacy principles, you have the following rights with respect to your personal data:</P>

            <SubHeading>10.1 Right to Access</SubHeading>
            <P>You have the right to request a copy of the personal data we hold about you. We will provide this within <Strong>30 days</Strong> of a verified request.</P>

            <SubHeading>10.2 Right to Correction</SubHeading>
            <P>You have the right to request correction of inaccurate or incomplete personal data. You can update most account information directly from your Dashboard settings.</P>

            <SubHeading>10.3 Right to Erasure</SubHeading>
            <P>You may request deletion of your personal data and account. We will process this within 30 days, subject to legal retention obligations (e.g., financial records, safety incident logs). Deleted data cannot be recovered.</P>

            <SubHeading>10.4 Right to Withdraw Consent</SubHeading>
            <P>Where we rely on your consent to process personal data (e.g., for optional AI features or marketing emails), you may withdraw that consent at any time. Withdrawal does not affect the lawfulness of processing before the withdrawal.</P>

            <SubHeading>10.5 Right to Data Portability</SubHeading>
            <P>You may request an export of your personal data in a machine-readable format (JSON or CSV). This includes your account information, session history, and mood log data.</P>

            <SubHeading>10.6 Right to Object</SubHeading>
            <P>You may object to processing of your personal data for certain purposes, including direct marketing. We will cease that processing unless we have compelling legitimate grounds that override your interests.</P>

            <SubHeading>10.7 How to Exercise Your Rights</SubHeading>
            <P>To exercise any of these rights, email us at <a href="mailto:business.mannmate@gmail.com" style={linkStyle}>business.mannmate@gmail.com</a> with the subject line "Data Rights Request". We may need to verify your identity before processing the request. There is no fee for making a request unless it is manifestly unfounded or excessive, in which case we may charge a reasonable fee or refuse.</P>
          </Section>

          <Section id="security" title="11. Data Security">
            <SubHeading>11.1 Technical Safeguards</SubHeading>
            <BulletList items={[
              'All data transmitted between your browser and our servers is encrypted using TLS 1.2 or higher (HTTPS)',
              'P2P audio sessions use DTLS-SRTP encryption via WebRTC',
              'Passwords are hashed using bcrypt with a per-user salt — we never see your plaintext password',
              'Authentication tokens (JWT) are signed with RS256 and have short expiry windows',
              'Database access is restricted to authorised services via IP allowlists and credential rotation',
              'Sensitive fields (OAuth tokens, payment tokens) are encrypted at rest using AES-256',
            ]} />

            <SubHeading>11.2 Organisational Safeguards</SubHeading>
            <BulletList items={[
              'Access to personal data is restricted to team members with a documented need',
              'All team members with data access are bound by confidentiality obligations',
              'We conduct regular reviews of access permissions and data handling practices',
              'Security incidents are logged and reviewed as part of our incident response process',
            ]} />

            <SubHeading>11.3 Breach Notification</SubHeading>
            <P>In the event of a data breach that poses a risk to your rights and freedoms, we will notify affected users and relevant authorities within 72 hours of becoming aware of the breach, as required by applicable law. The notification will include the nature of the breach, data affected, likely consequences, and steps we are taking to mitigate harm.</P>
          </Section>

          <Section id="children" title="12. Children's Privacy">
            <P>The Platform is intended for users aged 18 and above. We do not knowingly collect personal data from children under the age of 13. Users aged 13–17 may access the Platform only for general informational purposes and only with verifiable parental or guardian consent.</P>
            <P>If we become aware that we have inadvertently collected personal data from a child under 13 without appropriate parental consent, we will take prompt steps to delete that data. If you believe a child under 13 has created an account on our Platform, please contact us at <a href="mailto:business.mannmate@gmail.com" style={linkStyle}>business.mannmate@gmail.com</a>.</P>
          </Section>

          <Section id="third-party" title="13. Third-Party Services">
            <P>The Platform integrates with the following third-party services. Each has its own privacy policy, which we encourage you to review:</P>
            <BulletList items={[
              'Google LLC (OAuth, Calendar, Meet) — policies.google.com/privacy',
              'Google AdSense (Advertising on our blog at blogs.mannmate.com) — policies.google.com/technologies/ads',
              'Razorpay India Pvt. Ltd. (Payments) — razorpay.com/privacy',
              'Sarvam AI (AI language processing) — sarvam.ai/privacy',
              'MongoDB Atlas (Database hosting) — mongodb.com/legal/privacy-policy',
              'Vercel Inc. (Frontend hosting) — vercel.com/legal/privacy-policy',
            ]} />
            <P>Our inclusion of a link to a third-party service does not constitute an endorsement of that service's privacy practices. We are not responsible for the privacy or security practices of third-party services.</P>
          </Section>

          <Section id="transfers" title="14. International Data Transfers">
            <P>MannMate is incorporated and operates primarily in India. Your personal data is stored and processed primarily on servers located in India (MongoDB Atlas — Mumbai region).</P>
            <P>Some of our service providers may process data outside India (e.g., Vercel's edge network, Sarvam AI infrastructure). Where data is transferred outside India, we ensure appropriate safeguards are in place, including: (a) contractual data processing agreements; (b) the recipient country offering an equivalent level of data protection; or (c) other legally recognised transfer mechanisms.</P>
          </Section>

          <Section id="changes" title="15. Changes to This Policy">
            <P>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make material changes, we will:</P>
            <BulletList items={[
              'Post the updated Policy on this page with a revised "Last updated" date',
              'Send an email notification to your registered email address',
              'Display a prominent in-app banner for at least 14 days',
            ]} />
            <P>Your continued use of the Platform after the effective date of any changes constitutes acceptance of the revised Policy. If you do not agree to the revised Policy, you must stop using the Platform and may request deletion of your account.</P>
            <Note>We recommend reviewing this Policy periodically. Material changes will always be communicated by email — make sure your registered email address is current.</Note>
          </Section>

          <Section id="contact" title="16. Contact Us">
            <P>If you have any questions, concerns, or complaints about this Privacy Policy or our data practices, please contact our Privacy team:</P>
            <div style={{
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 16, padding: '24px 28px', marginTop: 16,
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Privacy Officer</div>
              <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7 }}>MannMate Technologies Private Limited</div>
              <div style={{ marginTop: 12 }}>
                <a href="mailto:business.mannmate@gmail.com" style={{ ...linkStyle, fontSize: 14 }}>business.mannmate@gmail.com</a>
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-2)' }}>
                Response time: within 30 days of a verified request
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, marginBottom: 4 }}>REGISTERED ADDRESS</div>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>
                MannMate Technologies Private Limited<br />
                Bengaluru, Karnataka — 560001<br />
                India
              </div>
            </div>
          </Section>

          {/* Footer note */}
          <div style={{
            marginTop: 48, paddingTop: 32, borderTop: '1px solid var(--line)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
              MannMate Technologies Private Limited · Bengaluru, India<br />
              Last updated {LAST_UPDATED} · Effective {EFFECTIVE_DATE}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
              <a href="/terms" style={{ ...linkStyle, fontSize: 13 }}>Terms & Conditions</a>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>·</span>
              <a href="/community-guidelines" style={{ ...linkStyle, fontSize: 13 }}>Community Guidelines</a>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>·</span>
              <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Return home</button>
            </div>
          </div>

        </article>
      </div>

      {/* TOC visibility: show on large screens */}
      <style>{`
        @media (min-width: 1024px) { .privacy-toc { display: block !important; } }
        .privacy-toc::-webkit-scrollbar { width: 4px; }
        .privacy-toc::-webkit-scrollbar-track { background: transparent; }
        .privacy-toc::-webkit-scrollbar-thumb { background: var(--line); border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ id, title, children, highlight = false }: {
  id: string; title: string; children: React.ReactNode; highlight?: boolean;
}) {
  return (
    <section id={id} style={{
      marginBottom: 56, scrollMarginTop: 96,
      ...(highlight ? {
        background: 'var(--lavender-soft)',
        border: '1px solid rgba(107,91,149,0.18)',
        borderRadius: 20, padding: '28px 32px',
      } : {}),
    }}>
      <h2 className="serif" style={{
        fontSize: 26, fontWeight: 400, color: 'var(--ink)', margin: '0 0 20px',
        letterSpacing: -0.01, paddingBottom: 14,
        borderBottom: highlight ? 'none' : '1px solid var(--line)',
      }}>
        {title}
        {highlight && (
          <span style={{
            marginLeft: 12, fontSize: 11, fontFamily: 'Geist, sans-serif',
            letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600, fontStyle: 'normal',
            color: 'var(--lavender)', verticalAlign: 'middle',
            background: 'rgba(107,91,149,0.12)', padding: '3px 10px', borderRadius: 999,
          }}>Key terms</span>
        )}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.75, margin: '0 0 14px' }}>{children}</p>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{children}</strong>;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '22px 0 8px', letterSpacing: -0.01 }}>{children}</h3>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: '8px 0 16px', paddingLeft: 0, listStyle: 'none' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 9, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: '50%', background: 'var(--lavender)', display: 'block' }} />
          <span style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--sage-soft)', border: '1px solid var(--sage-soft)',
      borderLeft: '3px solid var(--sage)', borderRadius: '0 10px 10px 0',
      padding: '12px 16px', margin: '16px 0',
      fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65,
    }}>
      <strong style={{ color: 'var(--sage)', marginRight: 6 }}>Note:</strong>{children}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--sage)', textDecoration: 'underline', textDecorationColor: 'transparent',
};
