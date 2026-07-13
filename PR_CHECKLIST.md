# MannMate — Pre-PR QA Checklist

Test every section relevant to your change. Mark each item ✅ pass / ❌ fail / ⏭️ skip (not applicable).

---

## 1. Authentication

- [ ] Register a new account with email & password
- [ ] Login with email & password
- [ ] Login with Google OAuth
- [ ] Login with OTP (email)
- [ ] Forgot password → reset password flow
- [ ] Logout clears session and redirects to homepage
- [ ] Suspended/unverified account shows correct error message
- [ ] Role-based redirect works (user → user dashboard, listener → listener dashboard, therapist → therapist dashboard, admin → admin panel)

---

## 2. User Profile

- [ ] View profile page loads correctly
- [ ] Edit name, gender, DOB, city, language, bio and save
- [ ] Changes persist after page refresh

---

## 3. Wallet & Payments

- [ ] Wallet balance displays correctly on dashboard
- [ ] Click "Add Funds" → Razorpay popup opens
- [ ] Complete a test payment → balance updates immediately
- [ ] Failed/cancelled payment does not change balance
- [ ] Transaction history shows new entry after top-up
- [ ] Wallet deduction happens correctly after a paid session

---

## 4. Therapist Booking

- [ ] Browse therapists page loads and shows therapist cards
- [ ] Click therapist → profile page shows credentials, specialty, price
- [ ] View available time slots on therapist profile
- [ ] Book an appointment → success confirmation shown
- [ ] Booking deducts correct amount from wallet
- [ ] Booked appointment appears in user dashboard "Upcoming"
- [ ] Cancel appointment → refund credited to wallet
- [ ] Reschedule appointment → new slot saved correctly
- [ ] Email notification received for booking confirmation

---

## 5. Peer Listener (Anonymous Call)

- [ ] "Talk to a Listener" → matching screen shown
- [ ] Successfully connects to an available listener
- [ ] Call interface loads (audio controls visible)
- [ ] End call → call logged in history
- [ ] Wallet deducted for call duration
- [ ] If no listener available → correct "no listener" message shown

---

## 6. AI Chat / Voice (Serenity)

- [ ] Open AI text chat → conversation starts
- [ ] Send a message → AI responds
- [ ] Open AI voice call → voice agent connects
- [ ] End session → session saved

---

## 7. Session & Call History

- [ ] User dashboard "Recent Sessions" shows past calls and appointments
- [ ] Each entry shows correct date, duration, counterpart type
- [ ] Clicking a session shows correct details

---

## 8. Mood Tracker

- [ ] Log a mood for today (0–4 scale)
- [ ] Mood history graph/list displays correctly
- [ ] Cannot log duplicate mood for same day (or updates correctly)

---

## 9. Favorites

- [ ] Mark a listener as favorite
- [ ] Favorites list shows saved listener
- [ ] Remove from favorites → removed from list

---

## 10. Listener Dashboard

- [ ] Toggle online/offline status
- [ ] Call request arrives when a user connects
- [ ] Accept call → call room opens
- [ ] Decline call → user sees "listener unavailable"
- [ ] Call history shows completed calls

---

## 11. Therapist Dashboard

- [ ] View upcoming appointments
- [ ] Mark appointment as completed / cancelled
- [ ] Google Calendar sync — appointment appears in calendar
- [ ] Availability toggle works

---

## 12. Admin Panel

- [ ] View platform statistics
- [ ] Add / edit / delete a listener
- [ ] Set listener rate (cost per minute)
- [ ] Add / edit / delete a therapist
- [ ] View and action user reports (warn / suspend / dismiss)
- [ ] Suspend a user → user cannot login
- [ ] Unsuspend user → user can login again
- [ ] View session transcripts

---

## 13. Reporting

- [ ] Report a user from call/chat → reason dropdown works
- [ ] Submission shows success message
- [ ] Report appears in admin panel

---

## 14. General UI / Navigation

- [ ] Homepage loads without errors
- [ ] All navbar links navigate to correct pages
- [ ] No broken images or missing assets
- [ ] Pages are responsive on mobile viewport (375px width)
- [ ] No console errors on page load (check browser DevTools)
- [ ] Toast/alert messages appear for success and error actions

---

## 15. Security Basics

- [ ] Unauthenticated user cannot access dashboard pages (redirected to login)
- [ ] User cannot access admin routes
- [ ] User cannot access another user's profile/appointments by guessing IDs

---

## Sign-off

| Name | Date | Branch tested | Notes |
|------|------|---------------|-------|
|      |      |               |       |
|      |      |               |       |
