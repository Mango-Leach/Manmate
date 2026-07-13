'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Wordmark } from '@/components/design/primitives';
import { getCurrentUser, getRoleDashboard } from '@/lib/api';

const LAST_UPDATED = 'April 22, 2026';
const EFFECTIVE_DATE = 'April 22, 2026';

const SECTIONS = [
  { id: 'introduction',       label: '1. Introduction' },
  { id: 'definitions',        label: '2. Definitions' },
  { id: 'acceptance',         label: '3. Acceptance of Terms' },
  { id: 'eligibility',        label: '4. Eligibility' },
  { id: 'p2p',                label: '5. Person-to-Person Connections' },
  { id: 'listener-rules',     label: '6. Listener Conduct' },
  { id: 'user-rules',         label: '7. User Conduct' },
  { id: 'therapist',          label: '8. Therapist Services' },
  { id: 'accounts',           label: '9. Accounts & Registration' },
  { id: 'privacy',            label: '10. Privacy & Data' },
  { id: 'recordings',         label: '11. Recordings & AI Training' },
  { id: 'payments',           label: '12. Payments & Wallet' },
  { id: 'prohibited',         label: '13. Prohibited Content' },
  { id: 'disclaimer',         label: '14. Medical Disclaimer' },
  { id: 'ip',                 label: '15. Intellectual Property' },
  { id: 'liability',          label: '16. Limitation of Liability' },
  { id: 'indemnification',    label: '17. Indemnification' },
  { id: 'termination',        label: '18. Termination' },
  { id: 'governing-law',      label: '19. Governing Law' },
  { id: 'changes',            label: '20. Changes to These Terms' },
  { id: 'contact',            label: '21. Contact Us' },
];

export default function TermsPage() {
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
        background: 'linear-gradient(135deg, var(--sage) 0%, var(--sage-2) 100%)',
        padding: '72px 48px 56px', textAlign: 'center', color: '#F5F1E8',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', opacity: 0.7, fontWeight: 600, marginBottom: 16 }}>Legal</div>
        <h1 className="serif" style={{ fontSize: 52, fontWeight: 400, margin: '0 0 16px', letterSpacing: -0.02, lineHeight: 1.1 }}>
          Terms &amp; Conditions
        </h1>
        <p style={{ fontSize: 16, opacity: 0.8, maxWidth: 540, margin: '0 auto 28px', lineHeight: 1.6 }}>
          These terms govern your use of मनmate, including all person-to-person peer listening sessions, therapist consultations, and platform features.
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
          // Shown only on wide viewports — handled inline below via media query workaround
        }} className="terms-toc">
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
            <P>Welcome to <Strong>मनmate</Strong> ("we", "our", "the Platform", or "MannMate"), a mental-health support platform operated by MannMate Technologies Private Limited, a company incorporated under the laws of India. These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User", "you", or "your") and MannMate governing your access to and use of our website, mobile applications, APIs, and all associated services (collectively, the "Services").</P>
            <P>By accessing or using any part of the Platform, you confirm that you have read, understood, and agree to be bound by these Terms in their entirety. If you do not agree, you must immediately discontinue use of the Platform.</P>
            <P>These Terms should be read together with our <a href="/privacy" style={linkStyle}>Privacy Policy</a> and our <a href="/community-guidelines" style={linkStyle}>Community Guidelines</a>, which are incorporated into these Terms by reference.</P>
          </Section>

          <Section id="definitions" title="2. Definitions">
            <P>For the purposes of these Terms, the following definitions apply:</P>
            <TermDef term="Platform">"Platform" means the मनmate website, mobile applications, and all associated services and features operated by us.</TermDef>
            <TermDef term="User">"User" means any individual who accesses or uses the Platform, including Clients, Listeners, and Therapists.</TermDef>
            <TermDef term="Client">"Client" means a User who seeks emotional support, peer listening, or professional consultation through the Platform.</TermDef>
            <TermDef term="Listener">"Listener" means a trained volunteer User who provides peer emotional support to Clients through Person-to-Person sessions.</TermDef>
            <TermDef term="Therapist">"Therapist" means a licensed mental health professional who has been verified by us and offers professional consultation services on the Platform.</TermDef>
            <TermDef term="P2P Session">"P2P Session" or "Person-to-Person Session" means a real-time audio or text session between a Client and a Listener conducted over the Platform's encrypted WebRTC connection.</TermDef>
            <TermDef term="Content">"Content" means any audio, text, messages, data, or other material transmitted, uploaded, or made available through the Platform.</TermDef>
            <TermDef term="Wallet">"Wallet" means the in-platform credits balance associated with your account, usable for purchasing therapist consultation time.</TermDef>
            <TermDef term="Account">"Account" means your registered user profile on the Platform.</TermDef>
          </Section>

          <Section id="acceptance" title="3. Acceptance of Terms">
            <P>Your use of the Platform constitutes your unconditional acceptance of these Terms. These Terms apply to:</P>
            <BulletList items={[
              'All visitors to the MannMate website, whether or not they have created an Account.',
              'All registered Users, including Clients, Listeners, and Therapists.',
              'Any person who participates in a P2P Session or therapist consultation through the Platform.',
              'Any administrator or moderator of the Platform.',
            ]} />
            <P>If you are using the Platform on behalf of an organisation, you represent that you have the authority to bind that organisation to these Terms.</P>
            <Note>These Terms were last updated on {LAST_UPDATED} and are effective immediately for new users and within 14 days for existing users who were notified of the update. Continued use of the Platform after any change constitutes acceptance of the revised Terms.</Note>
          </Section>

          <Section id="eligibility" title="4. Eligibility">
            <P>Access to the Platform is subject to the following eligibility requirements:</P>
            <SubHeading>Age Requirement</SubHeading>
            <P>You must be at least <Strong>18 years of age</Strong> to create an Account or participate in any P2P Session or therapist consultation. Users between the ages of 13 and 17 may access the Platform solely for general informational purposes, and only with the explicit written consent of a parent or legal guardian. Such consent must be provided to us upon request. Users under the age of 13 are strictly prohibited from using the Platform.</P>
            <SubHeading>Legal Capacity</SubHeading>
            <P>You must have the legal capacity to enter into a binding contract under the laws of India (including the Indian Contract Act, 1872) and the laws of your jurisdiction of residence. Persons who have been declared legally incompetent by a court of competent jurisdiction may not use the Platform.</P>
            <SubHeading>Geographic Restrictions</SubHeading>
            <P>The Platform is primarily designed for users located in India. Access from other jurisdictions is permitted, but we make no representations that the Platform complies with the laws of jurisdictions outside India. If you access the Platform from outside India, you do so at your own risk and are solely responsible for compliance with local laws.</P>
            <SubHeading>Listener Eligibility</SubHeading>
            <P>In addition to the above, individuals who wish to register as Listeners must: (a) be at least 18 years of age; (b) complete our Listener orientation and training programme; (c) pass our identity verification process; (d) agree to the Listener-specific code of conduct; and (e) maintain the quality standards set out in our Community Guidelines.</P>
          </Section>

          <Section id="p2p" title="5. Person-to-Person (P2P) Peer Listening Connections" highlight>
            <P>This section specifically governs all real-time peer listening sessions conducted on the Platform between a Client and a Listener ("P2P Sessions"). <Strong>Please read this section carefully — it contains terms that are specific to person-to-person connections and are separate from other Platform services.</Strong></P>

            <SubHeading>5.1 Nature of the Connection</SubHeading>
            <P>P2P Sessions connect a Client directly with a volunteer Listener over an end-to-end encrypted WebRTC audio channel. These sessions are:</P>
            <BulletList items={[
              'Anonymous by design — Listeners see only your chosen display name, not your real name or personal details.',
              'Peer-to-peer in nature — Listeners are trained volunteers, not licensed mental health professionals.',
              'Not a substitute for professional therapy, psychiatric care, or crisis intervention.',
              'Not to be used in place of emergency services. If you are in immediate danger, call 112.',
              'Not legally privileged — communications are not subject to any therapist-client or doctor-patient privilege.',
            ]} />

            <SubHeading>5.2 Matching Process</SubHeading>
            <P>The Platform uses an automated matchmaking algorithm to pair waiting Clients with available Listeners based on queue order, availability, and platform-defined compatibility criteria. You acknowledge that:</P>
            <BulletList items={[
              'Matching is automated and does not guarantee a specific Listener or specialisation.',
              'Wait times may vary depending on Listener availability.',
              'A match may be terminated by the Platform if connection quality drops below acceptable thresholds.',
              'You may be re-queued if a matched Listener becomes unavailable during the connection setup phase.',
            ]} />

            <SubHeading>5.3 Anonymity and Display Names</SubHeading>
            <P>To protect your privacy, you are identified to your Listener only by a display name that you choose at registration or in your profile settings. This display name need not be your real name. You are advised not to reveal your real name, location, contact information, or any other identifying personal data during a P2P Session. MannMate is not responsible for any consequences arising from your voluntary disclosure of personal information during a session.</P>

            <SubHeading>5.4 Consent to Connect</SubHeading>
            <P>By clicking "Find a listener" and accepting the in-app consent prompt, you confirm that you:</P>
            <BulletList items={[
              'Are at least 18 years of age or have a parent/guardian\'s consent.',
              'Understand that Listeners are volunteers, not professionals.',
              'Will communicate respectfully and refrain from abusive language.',
              'Consent to the monitoring and recording of sessions for safety and quality purposes as described in Section 11.',
              'Acknowledge that this service is not a crisis or emergency service.',
              'Have read and agree to these Terms in their entirety.',
            ]} />

            <SubHeading>5.5 Session Duration and Limits</SubHeading>
            <P>P2P Sessions do not have a fixed duration, but the Platform reserves the right to set reasonable time limits to ensure fair access for all users. We may introduce session duration limits at any time with notice. Listeners may also independently choose to end a session at their sole discretion, particularly if they feel uncomfortable or believe the conversation is outside the scope of peer support.</P>

            <SubHeading>5.6 Automatic Call Termination</SubHeading>
            <P>The Platform or any Listener may terminate a P2P Session immediately and without notice if:</P>
            <BulletList items={[
              'Abusive, threatening, discriminatory, or harassing language is used.',
              'The User attempts to elicit sexual, violent, or otherwise prohibited content.',
              'The User appears to be in acute mental health crisis requiring emergency services.',
              'The User attempts to identify, contact, or arrange to meet the Listener outside the Platform.',
              'The User violates any provision of these Terms or the Community Guidelines.',
              'Technical conditions render the session unworkable.',
            ]} />

            <SubHeading>5.7 No Guarantee of Availability</SubHeading>
            <P>The availability of Listeners at any given time is not guaranteed. Listener availability depends on volunteer participation and cannot be contractually assured. MannMate does not guarantee that a Listener will be available when you request a P2P Session.</P>

            <SubHeading>5.8 Post-Session Rating and Feedback</SubHeading>
            <P>Following each P2P Session, you may be prompted to rate your experience. Ratings and feedback are used to maintain quality standards for the Listener community and to improve the Platform. Feedback must be honest, constructive, and free from personal attacks. Fraudulent or retaliatory feedback may result in account suspension.</P>

            <Note>P2P Sessions are peer support connections. They are not medical treatment, psychiatric care, counselling, or therapy. Do not use P2P Sessions as a substitute for professional mental health care.</Note>
          </Section>

          <Section id="listener-rules" title="6. Listener Conduct and Obligations">
            <P>Listeners are volunteer members of the MannMate community who agree to uphold the highest standards of empathy, safety, and professionalism. By registering as a Listener, you agree to all obligations in this section in addition to the general Terms.</P>

            <SubHeading>6.1 Scope of Support</SubHeading>
            <P>Listeners provide <Strong>active listening and emotional support only</Strong>. Listeners must not:</P>
            <BulletList items={[
              'Offer medical advice, diagnoses, prescriptions, or treatment recommendations.',
              'Claim to be a licensed therapist, counsellor, psychiatrist, or any other regulated mental health professional (unless separately verified as a Therapist on the Platform).',
              'Provide legal, financial, or any other professional advice.',
              'Encourage or facilitate any illegal activity.',
              'Form romantic or sexual relationships with Clients through the Platform.',
            ]} />

            <SubHeading>6.2 Mandatory Reporting</SubHeading>
            <P>If a Listener believes that a Client is in immediate danger of harming themselves or others, the Listener must: (a) encourage the Client to contact emergency services (112); (b) report the session to MannMate immediately through the in-app reporting mechanism; and (c) end the session if the Client's safety cannot be ensured through peer support alone.</P>

            <SubHeading>6.3 Confidentiality</SubHeading>
            <P>Listeners must maintain strict confidentiality regarding the content of all sessions. Disclosing, sharing, or recording session content outside the Platform without explicit consent is prohibited and may result in permanent account termination and potential civil or criminal liability.</P>

            <SubHeading>6.4 Self-Care and Withdrawal</SubHeading>
            <P>Listeners who experience vicarious trauma, burnout, or emotional exhaustion are encouraged to withdraw from active listening duties by going offline on the Platform. MannMate provides Listener support resources and is committed to the wellbeing of all volunteer Listeners.</P>
          </Section>

          <Section id="user-rules" title="7. User (Client) Conduct and Obligations">
            <P>All Users, including Clients seeking peer support, are bound by the following conduct standards throughout their use of the Platform.</P>

            <SubHeading>7.1 Respectful Communication</SubHeading>
            <P>You agree to communicate with all Platform participants — including Listeners, Therapists, and other Users — in a respectful and dignified manner at all times. The following conduct is strictly prohibited:</P>
            <BulletList items={[
              'Use of abusive, offensive, threatening, intimidating, or discriminatory language.',
              'Harassment, bullying, or stalking of any Platform participant.',
              'Making false statements or spreading misinformation about other Users.',
              'Impersonating any person or organisation, including MannMate staff.',
              'Any conduct that is designed to make another person feel unsafe, distressed, or unwelcome.',
            ]} />

            <SubHeading>7.2 Genuine Intent</SubHeading>
            <P>You must use the Platform in good faith and with genuine intent to seek or provide emotional support. The following misuses are prohibited:</P>
            <BulletList items={[
              'Using the Platform for entertainment, gaming the matchmaking system, or testing the service without genuine need.',
              'Connecting with Listeners and immediately disconnecting repeatedly (session trolling).',
              'Attempting to record sessions using third-party tools without consent.',
              'Using P2P Sessions to advertise products, services, or external platforms.',
            ]} />

            <SubHeading>7.3 Emergency Situations</SubHeading>
            <P>If you or someone you know is in immediate danger, please call <Strong>112 (India emergency services)</Strong> or iCall at <Strong>9152987821</Strong> immediately. MannMate is not equipped to handle acute psychiatric emergencies and does not provide crisis intervention services. Attempting to use the Platform in an emergency situation may delay your access to appropriate care.</P>
          </Section>

          <Section id="therapist" title="8. Therapist Services">
            <P>In addition to P2P peer listening sessions, the Platform connects verified licensed mental health professionals ("Therapists") with Clients for professional consultation. The following terms apply specifically to therapist services.</P>

            <SubHeading>8.1 Verification</SubHeading>
            <P>All Therapists listed on the Platform have undergone a verification process that includes: (a) confirmation of a valid licence issued by the Rehabilitation Council of India (RCI) or equivalent body; (b) background screening; and (c) profile review by MannMate staff. However, we cannot guarantee that a Therapist's licence is continuously in good standing and encourage you to independently verify credentials.</P>

            <SubHeading>8.2 Nature of Consultations</SubHeading>
            <P>Therapist consultations conducted through the Platform are professional mental health consultations. However, they are subject to limitations inherent in telemedicine, including but not limited to the inability to conduct physical examinations. Such consultations do not create an ongoing therapist-client relationship unless explicitly agreed between you and the Therapist.</P>

            <SubHeading>8.3 Fees and Booking</SubHeading>
            <P>Therapist consultations are billed against your Platform Wallet at rates set by individual Therapists. Session fees are displayed before booking confirmation. Cancellation and refund policies for therapist sessions are set out in Section 12.</P>

            <SubHeading>8.4 Independent Contractors</SubHeading>
            <P>Therapists on the Platform are independent contractors and are not employees or agents of MannMate. We do not supervise, direct, or control the professional content of therapist consultations. Any professional advice given by a Therapist is solely the Therapist's professional opinion and does not represent the views of MannMate.</P>
          </Section>

          <Section id="accounts" title="9. Accounts and Registration">
            <SubHeading>9.1 Account Creation</SubHeading>
            <P>To access the full features of the Platform, including P2P Sessions and therapist consultations, you must create an Account by providing accurate, current, and complete information during the registration process. You agree to maintain and promptly update your Account information.</P>

            <SubHeading>9.2 Account Security</SubHeading>
            <P>You are solely responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your Account. You agree to: (a) use a strong, unique password; (b) log out of shared devices; (c) immediately notify us at <a href="mailto:business.mannmate@gmail.com" style={linkStyle}>business.mannmate@gmail.com</a> if you suspect unauthorised access; and (d) not share your Account with any other person.</P>

            <SubHeading>9.3 One Account Per Person</SubHeading>
            <P>Each individual may maintain only one registered Account on the Platform. Creating multiple accounts to circumvent restrictions, bans, or other account-level decisions is prohibited and will result in permanent suspension of all associated accounts.</P>

            <SubHeading>9.4 Account Suspension and Termination</SubHeading>
            <P>We reserve the right to suspend or permanently terminate your Account at any time and without prior notice if we determine, at our sole discretion, that you have violated these Terms, the Community Guidelines, or applicable law. Upon termination, your right to access the Platform immediately ceases. We will retain and handle your data as described in our Privacy Policy.</P>
          </Section>

          <Section id="privacy" title="10. Privacy and Data Protection">
            <P>Your privacy is important to us. Our collection, use, and protection of your personal data is governed by our <a href="/privacy" style={linkStyle}>Privacy Policy</a>, which forms part of these Terms. Please review the Privacy Policy carefully.</P>

            <SubHeading>10.1 Data We Collect</SubHeading>
            <P>In the course of providing the Services, we collect: (a) registration information including name, email address, phone number, and display name; (b) usage data including session metadata such as duration and frequency; (c) device and connectivity information; (d) wallet and transaction records; and (e) audio or text session content, subject to your consent and as described in Section 11.</P>

            <SubHeading>10.2 Anonymous Identity</SubHeading>
            <P>The Platform is designed to protect your identity in P2P Sessions. Your Listener sees only your chosen display name. We do not share your real name, email address, phone number, or account details with any other User, including Listeners, without your explicit consent.</P>

            <SubHeading>10.3 Data Retention</SubHeading>
            <P>We retain your personal data for as long as your Account is active or as necessary to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements. Upon deletion of your Account, we will anonymise or delete your personal data within 90 days, except where retention is required by law.</P>

            <SubHeading>10.4 Data Localisation</SubHeading>
            <P>We store all personal data of Indian residents on servers located within India in compliance with applicable data localisation requirements under Indian law, including the Digital Personal Data Protection Act, 2023.</P>
          </Section>

          <Section id="recordings" title="11. Session Recordings and AI Training">
            <P>This section describes our practices with respect to the recording, monitoring, and use of P2P Session content for safety, quality, and AI model development purposes.</P>

            <SubHeading>11.1 Consent to Recording</SubHeading>
            <P>By accepting the in-app consent prompt before initiating a P2P Session, <Strong>you expressly consent to the monitoring, recording, transcription, and analysis of your session</Strong> for the purposes described in this section. If you do not consent to recording, you may not proceed with a P2P Session.</P>

            <SubHeading>11.2 Purposes of Recording</SubHeading>
            <P>Session recordings and transcriptions may be used for the following purposes:</P>
            <BulletList items={[
              'Safety monitoring — to detect and respond to situations where a User may be in danger.',
              'Quality assurance — to evaluate Listener performance and adherence to Community Guidelines.',
              'Dispute resolution — to investigate complaints about User conduct.',
              'Product improvement — to identify and fix technical issues with the session infrastructure.',
              'AI and machine learning training — to train, fine-tune, and evaluate AI models used within the Platform, including models that assist with matching, content moderation, and emotional tone detection. All data used for AI training is anonymised before use.',
            ]} />

            <SubHeading>11.3 Anonymisation</SubHeading>
            <P>All session recordings used for AI training and product improvement are anonymised. Personal identifiers including real names, email addresses, phone numbers, and other direct identifiers are removed before any session data is used for model training. However, indirect identifiers such as speech patterns may remain in anonymised data.</P>

            <SubHeading>11.4 Third-Party AI Processors</SubHeading>
            <P>We may share anonymised session data with third-party AI service providers for model training and evaluation purposes. Any such sharing is governed by data processing agreements that prohibit the third party from re-identifying the data or using it for any purpose other than those specified.</P>

            <SubHeading>11.5 Opt-Out</SubHeading>
            <P>You may opt out of the use of your session data for AI training purposes at any time by contacting us at <a href="mailto:business.mannmate@gmail.com" style={linkStyle}>business.mannmate@gmail.com</a>. Please note that opting out of AI training data use does not affect our ability to record sessions for safety and quality assurance purposes, which is a condition of using the P2P Session service.</P>
          </Section>

          <Section id="payments" title="12. Payments, Wallet, and Refunds">
            <SubHeading>12.1 Wallet Credits</SubHeading>
            <P>The Platform provides an in-app Wallet ("Wallet") that stores credits denominated in Indian Rupees (₹). Credits can be added to your Wallet using supported payment methods including UPI, credit/debit cards, and net banking. Credits are used to pay for therapist consultations and any other paid features introduced from time to time.</P>

            <SubHeading>12.2 P2P Sessions</SubHeading>
            <P>P2P peer listening sessions with volunteer Listeners are provided <Strong>free of charge</Strong> to Clients. No Wallet credits are consumed for P2P Sessions.</P>

            <SubHeading>12.3 Payment Processing</SubHeading>
            <P>Payments are processed by Razorpay (or such other payment gateway as we may designate from time to time). Payment processing is subject to Razorpay's own terms and conditions. We do not store your full payment card details on our servers.</P>

            <SubHeading>12.4 Cancellations and Refunds</SubHeading>
            <P>Cancellation and refund requests for therapist session bookings are subject to the following policy: (a) cancellations made more than 24 hours before the scheduled session are eligible for a full refund to Wallet; (b) cancellations made between 2 and 24 hours before the session are eligible for a 50% refund; (c) cancellations made less than 2 hours before the session are non-refundable; (d) in the event of a Therapist no-show, a full refund will be issued to your Wallet. Wallet credits are non-transferable and non-redeemable for cash, except as required by applicable law.</P>

            <SubHeading>12.5 Taxes</SubHeading>
            <P>All amounts shown on the Platform are inclusive of applicable Goods and Services Tax (GST) unless otherwise stated. You are responsible for all applicable taxes arising from your use of paid services on the Platform.</P>
          </Section>

          <Section id="prohibited" title="13. Prohibited Content and Conduct">
            <P>The following content and conduct are strictly prohibited on the Platform and will result in immediate session termination, account suspension, and/or referral to law enforcement authorities:</P>
            <BulletList items={[
              'Sexual or adult content of any kind, including solicitation, grooming, or explicit language.',
              'Violent content including descriptions, threats, or incitement of violence against any person.',
              'Content that promotes, facilitates, or glorifies self-harm or suicide. If you are struggling with thoughts of self-harm, please contact iCall at 9152987821.',
              'Hate speech based on religion, caste, gender, sexual orientation, disability, nationality, or any other protected characteristic.',
              'Illegal content including content that constitutes an offence under the Indian Penal Code (now the Bharatiya Nyaya Sanhita), the POCSO Act, the IT Act, or any other applicable law.',
              'Spam, commercial solicitation, pyramid schemes, or unauthorised advertising.',
              'Sharing of malware, phishing links, or any code designed to compromise device or network security.',
              'Any attempt to reverse-engineer, scrape, crawl, or extract data from the Platform without our written consent.',
              'Impersonation of MannMate staff, Therapists, or other Users.',
              'Any conduct intended to manipulate matchmaking queues, game the rating system, or otherwise disrupt Platform operations.',
            ]} />
          </Section>

          <Section id="disclaimer" title="14. Medical and Mental Health Disclaimer">
            <P><Strong>MannMate is not a medical service, a mental health clinic, or a crisis intervention service.</Strong> The Services, including P2P peer listening sessions and therapist consultations conducted through the Platform, do not constitute medical treatment and are not a substitute for in-person professional mental health care.</P>
            <P>Peer Listeners are trained volunteers, not licensed mental health professionals. Nothing said by a Listener during a P2P Session constitutes medical advice, diagnosis, or treatment. Even where a Therapist is involved, the limitations of telemedicine mean that the Platform cannot fully replicate the care provided in a clinical setting.</P>
            <P>If you are experiencing a mental health emergency, suicidal ideation, or are in immediate danger, please contact:</P>
            <div style={{
              background: 'rgba(178,107,92,0.08)', border: '1px solid rgba(178,107,92,0.2)',
              borderRadius: 14, padding: '20px 24px', margin: '16px 0',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--alert)', marginBottom: 10 }}>Emergency Resources — India</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: 'var(--ink)' }}>
                <span><Strong>Emergency Services:</Strong> 112</span>
                <span><Strong>iCall (Mental Health):</Strong> 9152987821</span>
                <span><Strong>Vandrevala Foundation:</Strong> 1860-2662-345 (24×7)</span>
                <span><Strong>NIMHANS:</Strong> 080-46110007</span>
              </div>
            </div>
          </Section>

          <Section id="ip" title="15. Intellectual Property">
            <SubHeading>15.1 Our Rights</SubHeading>
            <P>The Platform, including its design, code, text, graphics, logos, icons, audio, and the "MannMate" name and mark, are the exclusive intellectual property of MannMate Technologies Private Limited and are protected under the Copyright Act, 1957, the Trade Marks Act, 1999, and other applicable Indian and international intellectual property laws. You may not reproduce, distribute, modify, create derivative works of, or publicly display any part of the Platform without our express written consent.</P>

            <SubHeading>15.2 Your Content</SubHeading>
            <P>You retain ownership of any content you create on the Platform (such as profile information). However, by submitting content to the Platform, you grant us a worldwide, non-exclusive, royalty-free, sublicensable licence to use, reproduce, process, and display that content for the purposes of operating and improving the Platform, including for AI training as described in Section 11.</P>

            <SubHeading>15.3 Feedback</SubHeading>
            <P>If you submit ideas, suggestions, or feedback about the Platform, you grant us the right to use that feedback without restriction or compensation to you.</P>
          </Section>

          <Section id="liability" title="16. Limitation of Liability">
            <P>To the fullest extent permitted by applicable law, MannMate, its directors, officers, employees, agents, and partners shall not be liable for:</P>
            <BulletList items={[
              'Any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Platform.',
              'Any loss of data, revenue, profit, goodwill, or other intangible losses.',
              'Any conduct of Listeners, Therapists, or other Users, whether online or offline.',
              'Any technical failure, interruption, or error in the Platform including WebRTC connectivity failures.',
              'Any decisions made by you in reliance on information or support received through the Platform.',
              'Any outcomes related to mental health that arise from or are related to the use of the Platform.',
            ]} />
            <P>In no event shall our total aggregate liability to you for all claims arising under these Terms exceed the amount paid by you to MannMate in the six months preceding the claim, or ₹1,000 (whichever is greater).</P>
          </Section>

          <Section id="indemnification" title="17. Indemnification">
            <P>You agree to indemnify, defend, and hold harmless MannMate, its affiliates, officers, directors, employees, agents, and licensors from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising from or related to: (a) your use of the Platform; (b) your violation of these Terms; (c) your violation of any applicable law or third-party rights; or (d) any content you transmit through the Platform.</P>
          </Section>

          <Section id="termination" title="18. Termination">
            <SubHeading>18.1 Termination by You</SubHeading>
            <P>You may terminate your Account at any time by contacting us at <a href="mailto:business.mannmate@gmail.com" style={linkStyle}>business.mannmate@gmail.com</a>. Upon termination, your Wallet credits will be forfeited unless a refund is required by applicable law.</P>

            <SubHeading>18.2 Termination by Us</SubHeading>
            <P>We may suspend or terminate your Account at any time, with or without cause, and with or without notice. Grounds for termination include, without limitation: violation of these Terms, Community Guidelines, or applicable law; fraudulent or abusive behaviour; inactivity for more than 24 consecutive months; or our business decision to discontinue the Platform or a feature thereof.</P>

            <SubHeading>18.3 Effect of Termination</SubHeading>
            <P>Upon termination of your Account for any reason: (a) your right to use the Platform immediately ceases; (b) we may delete your Account data in accordance with our Privacy Policy; (c) provisions of these Terms that by their nature should survive termination shall survive, including Sections 10, 11, 15, 16, 17, and 19.</P>
          </Section>

          <Section id="governing-law" title="19. Governing Law and Dispute Resolution">
            <SubHeading>19.1 Governing Law</SubHeading>
            <P>These Terms and any dispute arising from your use of the Platform shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.</P>

            <SubHeading>19.2 Jurisdiction</SubHeading>
            <P>You irrevocably submit to the exclusive jurisdiction of the courts of Bengaluru, Karnataka, India for the resolution of any dispute arising from these Terms or the Platform. If you are a consumer resident of a different state, you retain the right to bring proceedings in the courts of your state of residence as required by applicable consumer protection law.</P>

            <SubHeading>19.3 Informal Resolution</SubHeading>
            <P>Before commencing any legal proceedings, you agree to first attempt to resolve any dispute informally by contacting us at <a href="mailto:business.mannmate@gmail.com" style={linkStyle}>business.mannmate@gmail.com</a>. We will endeavour to respond within 15 business days.</P>

            <SubHeading>19.4 Consumer Rights</SubHeading>
            <P>Nothing in these Terms limits any rights you may have as a consumer under the Consumer Protection Act, 2019 or other applicable Indian consumer protection legislation.</P>
          </Section>

          <Section id="changes" title="20. Changes to These Terms">
            <P>We reserve the right to modify these Terms at any time. Material changes will be communicated to you by: (a) a prominent notice within the Platform; (b) an email to your registered email address; or (c) a notification within the app. Non-material changes may be made without specific notification.</P>
            <P>Your continued use of the Platform after the effective date of any change constitutes your acceptance of the revised Terms. If you do not agree to any change, you must stop using the Platform and may request deletion of your Account.</P>
            <P>We maintain an archive of prior versions of these Terms, which is available upon request.</P>
          </Section>

          <Section id="contact" title="21. Contact Us">
            <P>If you have any questions, concerns, or complaints about these Terms or the Platform, please contact us:</P>
            <div style={{
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 14, padding: '24px 28px', marginTop: 8,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
            }}>
              {[
                { label: 'General support', value: 'business.mannmate@gmail.com' },
                { label: 'Privacy enquiries', value: 'business.mannmate@gmail.com' },
                { label: 'Legal matters', value: 'business.mannmate@gmail.com' },
                { label: 'Security reports', value: 'business.mannmate@gmail.com' },
              ].map(c => (
                <div key={c.label}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, marginBottom: 4 }}>{c.label.toUpperCase()}</div>
                  <a href={`mailto:${c.value}`} style={{ ...linkStyle, fontSize: 14 }}>{c.value}</a>
                </div>
              ))}
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
              <a href="/privacy" style={{ ...linkStyle, fontSize: 13 }}>Privacy Policy</a>
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
        @media (min-width: 1024px) { .terms-toc { display: block !important; } }
        .terms-toc::-webkit-scrollbar { width: 4px; }
        .terms-toc::-webkit-scrollbar-track { background: transparent; }
        .terms-toc::-webkit-scrollbar-thumb { background: var(--line); border-radius: 2px; }
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

function TermDef({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0, marginTop: 2, padding: '2px 10px', borderRadius: 999,
        background: 'var(--sage-soft)', color: 'var(--sage)',
        fontSize: 12, fontWeight: 600,
      }}>{term}</div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }}>{children}</div>
    </div>
  );
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
