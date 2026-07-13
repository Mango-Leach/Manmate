<div align="center">

# StressReliefChat

**A full-featured mental health support platform with real-time chat, AI voice companions, therapist booking, and peer-to-peer calls.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#features) · [Architecture](#architecture) · [Quick Start](#quick-start) · [Configuration](#configuration) · [API Reference](#api-reference) · [Deployment](#deployment)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Third-Party Integrations](#third-party-integrations)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

StressReliefChat is a full-stack mental health support platform that connects users with trained listeners, therapists, and an AI voice companion. The platform supports real-time text chat with intelligent matchmaking, WebRTC peer-to-peer voice/video calls, therapist appointment booking with calendar integration, and an in-app wallet with Razorpay payments. It ships with a bilingual interface (English and Hindi) and a comprehensive admin panel for platform management.

---

## Features

### For Users (Clients)
- **Real-time Chat** — Matched instantly with available listeners via queue-based matchmaking
- **AI Voice Companion** — Voice conversations with *Serenity*, powered by Sarvam AI (STT + TTS + Chat)
- **Peer-to-Peer Calls** — WebRTC-based voice/video calls with listeners or other users
- **Therapist Appointments** — Browse therapist profiles, book sessions, and receive Google Calendar invites
- **In-App Wallet** — Top up via Razorpay, deductions per call minute, full transaction history
- **Mobile OTP Login** — Passwordless sign-in via SMS (Fast2SMS) or email OTP
- **Google Sign-In** — One-click authentication with Google OAuth 2.0
- **Bilingual Interface** — Full English and Hindi support with Devanagari fonts

### For Listeners
- **Dedicated Dashboard** — Manage availability, view call history, and track earnings
- **Real-time Matchmaking** — Automatic pairing with clients seeking support
- **Per-minute Rate Setting** — Individual pricing managed by admins

### For Therapists
- **Appointment Calendar** — Google Calendar sync for scheduling and availability
- **Session Management** — Accept, reschedule, and complete appointments
- **WhatsApp Reminders** — Automated appointment reminders via Meta Business API
- **Profile Management** — Ratings, specializations, and pricing

### For Admins
- **Listener & Therapist Management** — Full CRUD, bulk rate updates, activation/deactivation
- **Platform Analytics** — Session counts, revenue, active users with date-range filters
- **Settings Control** — Platform-wide configuration management

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, React 18, TypeScript 5.3 |
| **Styling** | Tailwind CSS 3.4, Framer Motion 12 |
| **Forms & Validation** | React Hook Form 7, Zod 4 |
| **Charts** | Recharts 3 |
| **Backend** | Node.js 18+, Express.js 4.18 |
| **Real-time** | Socket.IO 4.8 (chat, WebRTC signaling, matchmaking) |
| **Database** | MongoDB 7.0 (Atlas or local) |
| **Authentication** | JWT (7-day), Google OAuth 2.0 (Passport.js), OTP |
| **Payments** | Razorpay |
| **AI Voice** | Sarvam AI (saarika:v2.5 STT, bulbul:v2 TTS, sarvam-m chat) |
| **Email** | Nodemailer (Gmail SMTP) |
| **SMS / OTP** | Fast2SMS |
| **Notifications** | WhatsApp Business API (Meta), Email (Nodemailer) |
| **Calendar** | Google Calendar API (googleapis) |
| **Logging** | Winston + Daily Rotate |
| **Security** | Helmet, express-rate-limit, bcryptjs, Joi, express-validator |
| **Containerization** | Docker, Docker Compose |
| **Deployment** | Render (render.yaml) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Browser                       │
│              Next.js 14 (SSR / CSR / TypeScript)            │
│   Dashboard · Chat · Peer Call · AI Call · Admin Panel      │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTPS / WSS
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌─────────────────┐          ┌──────────────────────┐
│   REST API      │          │   Socket.IO Server   │
│  Express.js     │          │  (Real-time Layer)   │
│  Port 5000      │          │                      │
│                 │          │ ┌──────────────────┐ │
│ Auth / Users    │          │ │ Matchmaking Svc  │ │
│ Wallet          │          │ │ Chat Queue       │ │
│ Appointments    │          │ │ Call Queue       │ │
│ Therapists      │          │ │ Peer Queue       │ │
│ Admin           │          │ └──────────────────┘ │
│ Razorpay        │          │ ┌──────────────────┐ │
└────────┬────────┘          │ │ Signaling Server │ │
         │                   │ │ (WebRTC ICE/SDP) │ │
         ▼                   │ └──────────────────┘ │
┌─────────────────┐          └──────────────────────┘
│   MongoDB 7.0   │
│                 │
│ users           │     ┌─────────────────────────────┐
│ appointments    │     │     External Services        │
│ therapists      │     │                             │
│ transactions    │     │  Razorpay (Payments)        │
│ callLogs        │     │  Google OAuth (Auth)         │
│ settings        │     │  Google Calendar (Appts)    │
│ otps            │     │  Sarvam AI (Voice/AI)       │
└─────────────────┘     │  Fast2SMS (Mobile OTP)      │
                        │  Gmail SMTP (Email)          │
                        │  WhatsApp API (Reminders)   │
                        └─────────────────────────────┘
```

### Real-time Communication Flow

```
Client ──[Socket.IO]──► Matchmaking Service ──► Listener/Peer
  │                                                   │
  └─────────── WebRTC Peer Connection ────────────────┘
               (via Signaling Server)
               ICE Candidates / SDP exchange
```

---

## Project Structure

```
StressReliefChat/
├── frontend/                          # Next.js 14 application
│   ├── app/                           # App Router pages
│   │   ├── page.tsx                   # Landing page
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── chat/page.tsx
│   │   ├── peer-call/page.tsx
│   │   ├── ai-call/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── listener-dashboard/page.tsx
│   │   ├── therapist-dashboard/page.tsx
│   │   ├── admin-dashboard/page.tsx
│   │   └── therapists/page.tsx
│   ├── components/
│   │   └── design/
│   │       ├── ChatSession.tsx        # Real-time chat UI
│   │       ├── PeerCall.tsx           # WebRTC call interface
│   │       ├── AICall.tsx             # Sarvam AI voice companion
│   │       ├── Dashboard.tsx          # Client dashboard
│   │       ├── AdminDashboard.tsx     # Admin panel
│   │       ├── TherapistDashboard.tsx # Therapist dashboard
│   │       └── Homepage.tsx           # Landing page
│   ├── public/
│   │   └── ai-config.json             # AI companion configuration
│   ├── .env.development
│   ├── .env.production
│   └── package.json
│
├── backend/                           # Express.js API server
│   ├── controllers/
│   │   ├── authController.js          # Auth (login, register, OTP)
│   │   ├── userController.js          # User profile & data
│   │   ├── walletController.js        # Wallet balance & transactions
│   │   ├── razorpayController.js      # Payment processing
│   │   ├── appointmentController.js   # Therapist appointments
│   │   ├── therapistController.js     # Therapist profiles
│   │   ├── adminController.js         # Admin operations & analytics
│   │   └── googleAuthController.js    # Google OAuth
│   ├── models/
│   │   ├── User.js                    # User schema (all roles)
│   │   ├── Appointment.js             # Appointment schema
│   │   ├── Therapist.js               # Therapist profile schema
│   │   └── OTP.js                     # OTP records
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── appointments.js
│   │   ├── therapists.js
│   │   └── admin.js
│   ├── services/
│   │   ├── MatchmakingService.js      # Queue-based user pairing
│   │   ├── SignalingServer.js         # WebRTC signaling
│   │   ├── emailService.js            # Nodemailer email sending
│   │   ├── googleCalendarService.js   # Google Calendar sync
│   │   ├── whatsappService.js         # WhatsApp Business API
│   │   ├── otpService.js              # OTP generation/verification
│   │   └── reminderScheduler.js       # node-cron appointment reminders
│   ├── middleware/
│   │   ├── auth.js                    # JWT verification + role fetch
│   │   ├── roleAuth.js                # RBAC (requireAdmin, requireTherapist)
│   │   ├── rateLimiter.js             # Per-route rate limits
│   │   ├── validator.js               # Input sanitization (XSS)
│   │   └── errorHandler.js            # Global error handling
│   ├── config/
│   │   └── db.js                      # MongoDB connection config
│   ├── .env                           # Environment variables
│   └── package.json
│
├── docker-compose.yml                 # Frontend + Backend + MongoDB
├── render.yaml                        # Render deployment config
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 7.0 (local) or a MongoDB Atlas connection string
- npm 9+ or yarn

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/StressReliefChat.git
cd StressReliefChat
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env` (see [Configuration](#configuration) for all variables):

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/stressrelief
JWT_SECRET=your_jwt_secret_here
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

Start the backend server:

```bash
npm start
# or for development with hot-reload:
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.development`:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
```

Start the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Docker Compose (All-in-One)

```bash
# From the project root
docker-compose up --build
```

This starts:
- **Frontend** → http://localhost:3000
- **Backend** → http://localhost:5000
- **MongoDB** → mongodb://localhost:27017

---

## Configuration

### Backend Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `5000`) |
| `NODE_ENV` | Yes | `development` or `production` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret key for JWT signing (min 32 chars) |
| `FRONTEND_URL` | Yes | Frontend origin for CORS |
| `BACKEND_URL` | Yes | Backend base URL |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth 2.0 Client Secret |
| `SMTP_HOST` | Yes | SMTP host (e.g., `smtp.gmail.com`) |
| `SMTP_PORT` | Yes | SMTP port (e.g., `587`) |
| `SMTP_USER` | Yes | SMTP username / Gmail address |
| `SMTP_PASSWORD` | Yes | SMTP password or Gmail App Password |
| `RAZORPAY_KEY_ID` | Yes | Razorpay API Key ID |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay API Key Secret |
| `FAST2SMS_API_KEY` | Yes | Fast2SMS API key for mobile OTP |
| `WHATSAPP_API_VERSION` | No | Meta API version (e.g., `v18.0`) |
| `WHATSAPP_PHONE_NUMBER_ID` | No | Meta WhatsApp phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | No | Meta WhatsApp permanent access token |

### Frontend Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Yes | Frontend base URL |
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes | Google OAuth Client ID (public) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes | Razorpay key (public, test or live) |
| `SARVAM_API_KEY` | Yes | Sarvam AI API key (server-side only) |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth secret (server-side only) |

### AI Companion Configuration (`frontend/public/ai-config.json`)

```json
{
  "companionName": "Serenity",
  "voice": {
    "speaker": "anushka",
    "language": "hi-IN",
    "pitch": 0,
    "pace": 1
  },
  "ttsModel": "bulbul:v2",
  "sttModel": "saarika:v2.5",
  "chatModel": "sarvam-m",
  "behavior": {
    "vadThreshold": 16,
    "silenceMs": 600,
    "minSpeechMs": 200,
    "maxTokens": 150,
    "temperature": 0.8
  }
}
```

---

## API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new user | — |
| `POST` | `/api/auth/login` | Login with email + password | — |
| `POST` | `/api/auth/send-otp` | Send email OTP | — |
| `POST` | `/api/auth/verify-otp` | Verify email OTP | — |
| `POST` | `/api/auth/send-mobile-otp` | Send SMS OTP (Fast2SMS) | — |
| `GET` | `/api/auth/google` | Initiate Google OAuth | — |
| `GET` | `/api/auth/google/callback` | Google OAuth callback | — |
| `POST` | `/api/auth/forgot-password` | Trigger password reset OTP | — |
| `POST` | `/api/auth/reset-password` | Reset password with OTP | — |

### Users & Wallet

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/users/:email` | Get user profile | JWT |
| `PUT` | `/api/users/:email` | Update user profile | JWT |
| `GET` | `/api/users/:email/wallet` | Get wallet balance | JWT |
| `PUT` | `/api/users/:email/wallet` | Update wallet balance | JWT |
| `POST` | `/api/users/razorpay/create-order` | Create Razorpay order | JWT |
| `POST` | `/api/users/razorpay/verify` | Verify Razorpay payment | JWT |

### Therapists & Appointments

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/therapists` | List all therapists | JWT |
| `GET` | `/api/therapists/:id` | Get therapist profile | JWT |
| `GET` | `/api/appointments` | Get user's appointments | JWT |
| `POST` | `/api/appointments` | Book an appointment | JWT |
| `PUT` | `/api/appointments/:id` | Reschedule / update | JWT |
| `DELETE` | `/api/appointments/:id` | Cancel appointment | JWT |

### Admin

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/admin/listeners` | List all listeners | Admin JWT |
| `POST` | `/api/admin/listeners` | Add a listener | Admin JWT |
| `PUT` | `/api/admin/listeners/:id` | Update listener | Admin JWT |
| `DELETE` | `/api/admin/listeners/:id` | Remove listener | Admin JWT |
| `PUT` | `/api/admin/listeners/bulk-rate` | Bulk rate update | Admin JWT |
| `GET` | `/api/admin/stats` | Platform analytics | Admin JWT |
| `GET` | `/api/admin/settings` | Get platform settings | Admin JWT |
| `PUT` | `/api/admin/settings` | Update settings | Admin JWT |

### Rate Limits

| Endpoint Group | Limit |
|---|---|
| Login | 5 requests / 15 minutes |
| OTP send | 3 requests / 15 minutes |
| Register | 3 requests / hour |

---

## Deployment

### Render (render.yaml)

The project includes a `render.yaml` for one-click deployment on [Render](https://render.com):

```bash
# Push to your GitHub repo, connect it on Render, and use render.yaml
```

Render services defined:
- **Backend** — Node.js web service, `npm start`, port 5000
- **Frontend** — Static/Node.js Next.js service, port 3000

Set all required environment variables in the Render dashboard under each service's **Environment** tab.

### Docker Compose (Production)

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

Services:
| Service | Port | Description |
|---|---|---|
| `frontend` | 3000 | Next.js standalone server |
| `backend` | 5000 | Express.js API + Socket.IO |
| `mongodb` | 27017 | MongoDB 7.0 (internal volume) |

### Manual Production Build

**Backend:**
```bash
cd backend
NODE_ENV=production npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm start
```

---

## Third-Party Integrations

### Google OAuth 2.0
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Google+ API** and **Google Calendar API**
3. Create OAuth 2.0 credentials (Web application)
4. Add `http://localhost:5000/api/auth/google/callback` to Authorized Redirect URIs
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### Razorpay (Payments)
1. Sign up at [Razorpay](https://razorpay.com/)
2. Retrieve **Key ID** and **Key Secret** from the dashboard
3. Use `rzp_test_*` keys for development, `rzp_live_*` for production
4. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`

### Sarvam AI (Voice Companion)
1. Sign up at [Sarvam AI](https://www.sarvam.ai/)
2. Generate an API key
3. Set `SARVAM_API_KEY` in `frontend/.env.production`
4. Models used: `saarika:v2.5` (STT), `bulbul:v2` (TTS), `sarvam-m` (chat)

### Fast2SMS (Mobile OTP)
1. Sign up at [Fast2SMS](https://www.fast2sms.com/)
2. Generate an API key from the dashboard
3. Set `FAST2SMS_API_KEY`

### WhatsApp Business API (Reminders)
1. Set up a [Meta Developer](https://developers.facebook.com/) account
2. Create a WhatsApp Business app
3. Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and `WHATSAPP_API_VERSION`

### Gmail SMTP (Email)
1. Enable 2-factor authentication on your Gmail account
2. Generate an **App Password** under Google Account → Security
3. Set `SMTP_USER` (Gmail address) and `SMTP_PASSWORD` (app password)

---

## Security

| Mechanism | Implementation |
|---|---|
| **Password hashing** | bcryptjs (salt rounds: 12) |
| **JWT tokens** | 7-day expiry, HS256 signing |
| **HTTP headers** | Helmet.js (CSP, HSTS, X-Frame-Options, X-Content-Type) |
| **Rate limiting** | express-rate-limit per-endpoint |
| **Input sanitization** | xss, express-validator, Joi |
| **CORS** | Strict origin whitelist in production |
| **Account lockout** | 5 failed login attempts → 15-minute lockout |
| **OTP expiry** | Short-lived OTP records, auto-expired via MongoDB TTL |
| **Role-based access** | JWT middleware + `requireAdmin` / `requireTherapist` guards |

> **Never commit `.env` files.** All secrets must be set as environment variables in your deployment platform.

---

## User Roles

| Role | Capabilities |
|---|---|
| `client` | Chat, calls, AI companion, appointments, wallet |
| `listener` | Accept chat/call requests, view earnings |
| `therapist` | Manage appointments, calendar sync, profile |
| `admin` | Full platform management, analytics, settings |

A user's role is set at registration and stored in MongoDB. Admins can promote or modify roles via the admin dashboard.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please follow the existing code style. Run `npm run lint` in both `frontend/` and `backend/` before submitting.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built with care for mental health support.

</div>
