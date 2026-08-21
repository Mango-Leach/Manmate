'use client';

import React, { useState } from 'react';
import { BlogHeader as Header } from '@/components/design/BlogHeader';
import { Footer } from '@/components/layout/Footer';

// Define the FAQ type
type FAQ = {
  question: string;
  answer: React.ReactNode;
};

// FAQ Data: 15+ detailed Q&As
const faqs: FAQ[] = [
  {
    question: "What is MannMate and how does the platform work?",
    answer: "MannMate is a comprehensive mental health and emotional wellness platform designed to provide accessible support to everyone. We bridge the gap between clinical care and immediate emotional support by offering two main services: anonymous peer-to-peer chat and professional therapy sessions. If you are feeling stressed, lonely, or anxious, you can instantly connect with a trained Peer Listener in a safe, anonymous chat room to talk through your feelings. For more complex clinical needs, such as managing depression, trauma, or severe anxiety, our platform allows you to book sessions with licensed psychologists and therapists. Our goal is to ensure that no one has to struggle alone, regardless of their financial situation or location."
  },
  {
    question: "Is the peer support chat really 100% anonymous?",
    answer: "Yes, absolute anonymity is the cornerstone of our peer support service. When you join a chat as a user seeking support, you do not need to provide your real name, email address, phone number, or any other personally identifiable information to the listener. You are assigned a random avatar and nickname. Furthermore, our chat rooms are encrypted, and we do not permanently store your chat transcripts in a way that can be traced back to your identity. We believe that true vulnerability requires safety, and anonymity removes the fear of judgment or social stigma, allowing you to speak freely about your deepest struggles."
  },
  {
    question: "What is the difference between a Peer Listener and a Licensed Therapist?",
    answer: "This is a crucial distinction for your care. A Peer Listener is an empathetic, everyday individual who has undergone basic active listening and empathy training. They provide emotional support, validation, and a safe space to vent, often drawing on their own lived experiences. They do not diagnose conditions, provide medical advice, or offer clinical treatment. A Licensed Therapist, on the other hand, is a qualified mental health professional (such as a clinical psychologist or counselor) with advanced degrees and clinical training. They use evidence-based therapies (like CBT or DBT) to diagnose mental health disorders, uncover root causes of trauma, and create structured treatment plans for recovery."
  },
  {
    question: "How do I know if I need peer support or professional therapy?",
    answer: "Peer support is ideal for temporary stressors, emotional venting, loneliness, or when you just need someone to listen to you after a long, exhausting day. It is a great first step if you are nervous about mental health care. However, you should seek professional therapy if your symptoms are interfering with your daily functioning, sleep, or eating habits. If you are experiencing chronic depression, debilitating panic attacks, severe trauma, or thoughts of self-harm, peer support is not sufficient. In these cases, a licensed therapist is necessary to provide the clinical interventions required for healing and safety."
  },
  {
    question: "Are the peer listeners trained to handle mental health crises?",
    answer: "No, Peer Listeners are explicitly trained not to handle acute mental health crises. While they are trained in active listening, empathy, and providing a comforting presence, they are not medical professionals. If a user expresses thoughts of suicide, self-harm, or harm to others, our platform protocols require the listener to immediately refer the user to emergency services and crisis hotlines. MannMate is a supportive space for emotional wellness, but it is not a suicide prevention hotline or an emergency medical service. If you are in immediate danger, please contact your local emergency number or a dedicated crisis helpline."
  },
  {
    question: "Can I request a specific peer listener or therapist?",
    answer: "For our anonymous peer support chat, the matching process is automated to ensure you get connected as quickly as possible, usually within minutes. You cannot request a specific listener by name, as this protects the anonymity and boundaries of our volunteers. However, for professional therapy, you have complete control over your choice. You can browse our directory of licensed therapists, filter them by their specialties (such as anxiety, couples counseling, or grief), read their detailed profiles, and select the professional who best aligns with your cultural background, language preferences, and clinical needs."
  },
  {
    question: "Is MannMate available 24/7?",
    answer: "Our anonymous peer support chat is designed to be accessible 24 hours a day, 7 days a week. Because our community of listeners spans across different time zones, there is almost always someone available to lend a listening ear, whether it is late at night when anxiety peaks or during a stressful workday afternoon. Professional therapy sessions, however, must be scheduled in advance according to the individual therapist's working hours and availability calendar. You can view their available slots and book a time that works best for you."
  },
  {
    question: "How much does it cost to use MannMate?",
    answer: "We are deeply committed to making emotional support accessible. Therefore, our anonymous peer-to-peer listening service is completely free to use. You can connect with a listener and talk for as long as you need without any hidden fees or paywalls. Our professional therapy services, which involve licensed clinical psychologists, are paid. The cost per session varies depending on the therapist's qualifications and experience. We strive to keep these rates affordable and transparent, with all pricing clearly displayed on the therapist's booking page before you commit to a session."
  },
  {
    question: "What kind of topics can I discuss in the anonymous chat?",
    answer: "You can discuss almost any emotional or psychological challenge you are facing. Common topics include workplace stress, academic pressure, relationship conflicts, breakups, family issues, feelings of loneliness, impostor syndrome, or mild anxiety and sadness. Many users also come simply to share good news when they have no one else to tell! The only exceptions are explicit discussions of active self-harm, violence, illegal activities, or explicit sexual content, which violate our community guidelines and are not appropriate for our peer support environment."
  },
  {
    question: "How does MannMate protect my data and privacy?",
    answer: "Data privacy is a top priority at MannMate. All communications on our platform, whether in the anonymous peer chat or during a video therapy session, are protected by industry-standard encryption protocols. We do not sell your personal data to third-party advertisers. For therapy clients, any clinical notes taken by your therapist are stored in secure, HIPAA-compliant (or equivalent regional standard) environments. We adhere to strict data minimization principles, meaning we only collect the information absolutely necessary to provide you with a safe and functional service."
  },
  {
    question: "Can I become a Peer Listener on MannMate? What is the process?",
    answer: "Yes! Our platform is built on the compassion of community volunteers, and we are always looking for empathetic individuals to join us. To become a Peer Listener, you must apply through our website. If accepted, you will undergo a mandatory training program that covers active listening techniques, empathy building, boundary setting, and crisis referral protocols. Once you complete the training and pass a brief assessment, you will be onboarded as a listener. It is a highly rewarding way to give back to society and develop your own emotional intelligence."
  },
  {
    question: "What should I do if I am experiencing a mental health emergency?",
    answer: "If you are experiencing a mental health emergency — such as active suicidal thoughts, plans to harm yourself or others, or a severe psychological break — you must seek immediate professional help. MannMate is not equipped to handle acute crises. Please immediately call your national emergency number (such as 911 in the US or 112 in India), go to the nearest hospital emergency room, or contact a dedicated suicide prevention hotline (such as Aasra or Kiran in India). Your life is valuable, and trained emergency responders are available to keep you safe."
  },
  {
    question: "Is therapy on MannMate available in Hindi and other regional languages?",
    answer: "Absolutely. We recognize that therapy is most effective when conducted in a language where you feel completely comfortable expressing your deepest emotions. In India, there is a massive gap in accessible mental health care in regional languages. That is why MannMate actively recruits therapists who are fluent in Hindi, English, and various other regional languages. When browsing our therapist directory, you can easily filter professionals based on the languages they speak, ensuring that cultural nuances and emotional subtleties are fully understood during your sessions."
  },
  {
    question: "How do the video therapy sessions work technically?",
    answer: "Our video therapy sessions are conducted entirely within the MannMate platform, utilizing secure, encrypted WebRTC technology. You do not need to download any external applications like Zoom or Skype. At the scheduled time of your appointment, you simply log into your MannMate account, navigate to your dashboard, and click the 'Join Session' button. The video interface will open directly in your web browser. We recommend using a stable internet connection, a quiet and private room, and a laptop or desktop computer for the best therapeutic experience."
  },
  {
    question: "What if I am not comfortable sharing my real name with a therapist?",
    answer: "While our peer chat is fully anonymous, professional therapy requires a different legal and ethical framework. Licensed therapists are bound by strict professional ethics and regulatory laws, which generally require them to know the identity of their clients for safety, legal, and crisis management reasons. Therefore, you must provide accurate personal information when registering for clinical therapy. However, this information is strictly confidential. Therapists are legally bound by confidentiality and cannot disclose your identity or the contents of your sessions to anyone, except in rare legal emergencies (like imminent risk to life)."
  },
  {
    question: "How can I delete my account or personal data from MannMate?",
    answer: "You have complete control over your data. If you wish to delete your account, you can do so by navigating to the 'Account Settings' page on your dashboard and selecting 'Delete Account.' This action is irreversible. For peer support users, this will instantly remove your account credentials. For users who have engaged in professional therapy, please note that while your active user account will be deleted, clinical regulations may legally require therapists to securely retain basic clinical records for a mandated period (often several years) before they can be permanently destroyed."
  }
];

// Reusable Accordion Item Component
const AccordionItem = ({ faq, isOpen, onClick }: { faq: FAQ, isOpen: boolean, onClick: () => void }) => {
  return (
    <div style={{
      borderBottom: '1px solid var(--line, #E5DFC9)',
      padding: '24px 0',
    }}>
      <button 
        onClick={onClick}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--ink, #2C3531)',
          fontSize: '18px',
          fontWeight: 600,
          fontFamily: 'inherit',
          transition: 'color 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand, #2E5C54)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ink, #2C3531)'}
      >
        <span style={{ paddingRight: '24px', lineHeight: 1.4 }}>{faq.question}</span>
        <span style={{ 
          fontSize: '24px', 
          color: 'var(--brand, #2E5C54)',
          transform: isOpen ? 'rotate(45deg)' : 'rotate(0)',
          transition: 'transform 0.3s ease',
          display: 'inline-block'
        }}>
          +
        </span>
      </button>
      
      <div style={{
        maxHeight: isOpen ? '1000px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.4s ease, opacity 0.4s ease',
        opacity: isOpen ? 1 : 0,
      }}>
        <div style={{
          paddingTop: '16px',
          color: 'var(--ink-2, #4A5650)',
          fontSize: '16px',
          lineHeight: 1.7,
        }}>
          {faq.answer}
        </div>
      </div>
    </div>
  );
};

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg, #F9F8F4)' }}>
      <Header />
      
      <main style={{ flex: 1, padding: '80px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h1 style={{ 
              fontSize: 'clamp(32px, 5vw, 48px)', 
              color: 'var(--ink, #2C3531)',
              marginBottom: '16px',
              fontWeight: 700,
              letterSpacing: '-0.02em'
            }}>
              Frequently Asked Questions
            </h1>
            <p style={{ 
              fontSize: '18px', 
              color: 'var(--ink-2, #4A5650)',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: 1.6
            }}>
              Everything you need to know about MannMate, our peer support system, and professional therapy services. Can&apos;t find the answer you&apos;re looking for? Feel free to contact us.
            </p>
          </div>

          <div style={{
            background: 'var(--card, #FFFFFF)',
            borderRadius: '24px',
            padding: 'clamp(24px, 5vw, 48px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)'
          }}>
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                faq={faq} 
                isOpen={openIndex === index} 
                onClick={() => handleToggle(index)} 
              />
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '64px' }}>
            <h3 style={{ fontSize: '24px', color: 'var(--ink, #2C3531)', marginBottom: '16px' }}>
              Still have questions?
            </h3>
            <p style={{ color: 'var(--ink-2, #4A5650)', marginBottom: '24px' }}>
              Our support team is here to help you with any other inquiries.
            </p>
            <a href="/contact" style={{
              display: 'inline-block',
              backgroundColor: 'var(--brand, #2E5C54)',
              color: 'white',
              padding: '14px 32px',
              borderRadius: '100px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '16px',
              transition: 'background-color 0.2s'
            }}>
              Contact Support
            </a>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
