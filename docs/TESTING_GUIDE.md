# Flynn AI Production Testing Guide

## Test User Information

**Email:** 2704fmb@gmail.com
**Plan:** Business (Enterprise) - $149/month tier
**AI Call Allowance:** 350 calls per month
**Payment Status:** Pre-approved (no payment required for testing)

---

## Prerequisites

### For the Tester

1. **iOS Device** running iOS 13.0 or later (recommended: iOS 15+)
2. **Active mobile phone number** for receiving calls and SMS
3. **Access to carrier settings** (ability to configure call forwarding)
4. **Internet connection** (WiFi + cellular data)
5. **Apple ID** for TestFlight installation (if using TestFlight)

### For the Developer (You)

1. ✅ Test user created in Supabase with email `2704fmb@gmail.com`
2. ✅ Organization created with Business plan (enterprise tier)
3. ✅ User set to `onboarding_complete = false` to test full flow
4. ✅ Backend API endpoints deployed and functional
5. ✅ App built for production and distributed via TestFlight or direct download

---

## Setup Instructions for Test User

### Step 1: Install the Flynn AI App

#### Option A: TestFlight (Recommended)
1. Install TestFlight from the App Store (if not already installed)
2. Open the TestFlight invitation link sent to 2704fmb@gmail.com
3. Tap "Accept" to join the Flynn AI beta
4. Tap "Install" to download the app

#### Option B: Direct Installation (if applicable)
1. Download the .ipa file from the provided link
2. Install via Xcode or a mobile device management tool
3. Trust the developer certificate in Settings > General > VPN & Device Management

### Step 2: Create Account & Login

1. **Launch Flynn AI** from your home screen
2. **Tap "Sign Up"** or "Get Started"
3. **Sign in with Google** (recommended) OR **Enter email/password**:
   - Email: `2704fmb@gmail.com`
   - Password: `[PROVIDED SEPARATELY]`
4. **Verify your email** if prompted (check inbox/spam)
5. **Grant permissions** when requested:
   - Notifications (for call alerts and job updates)
   - Contacts (optional - for client management)

### Step 3: Complete Onboarding

You'll go through a 6-step onboarding process:

#### Step 0: Getting Started (Welcome Screen)
- Read the introduction to Flynn AI
- Understand what the app does: "Turn missed calls into booked jobs"
- Tap "Get Started"

**Expected Result:** ✅ Welcome message displayed, clear value proposition

#### Step 1: Business Type Selection
- Choose your business category:
  - Home & Property (plumbers, electricians, cleaners)
  - Personal & Beauty (salons, spas, barbers)
  - Automotive (mechanics, detailers)
  - Business & Professional (consultants, agencies)
  - Other
- Tap "Continue"

**Expected Result:** ✅ Business type saved, moves to next step

#### Step 2: Business Goals Selection
- Select your primary goals (multiple choice):
  - ✓ Track job progress
  - ✓ Book meetings
  - ✓ Schedule appointments
  - ✓ Manage clients
  - ✓ Automate confirmations
  - ✓ Capture leads
- Tap "Continue"

**Expected Result:** ✅ Goals saved, app customizes based on selections

#### Step 3: Provision Flynn Number 📞 (KEY TEST)
- **Enter your business mobile number** (the number clients currently call you on)
  - Example: `+1 555 123 4567` or `0412 345 678`
- App will auto-detect your carrier and country
- **Tap "Get My Flynn Number"**
- Wait for provisioning (20-30 seconds)
- You'll receive a new Flynn phone number (e.g., `+61 3 6358 8413`)

**Expected Result:**
- ✅ Your business number is validated
- ✅ Carrier detected automatically (e.g., "Verizon", "Telstra", "Vodafone")
- ✅ Flynn number provisioned successfully
- ✅ Confirmation alert showing your new number
- ✅ **NO PAYWALL** shown (Business plan already active)

**If Error Occurs:**
- ❌ "Subscribe to a concierge plan" → Your org plan wasn't set correctly
- ❌ "No phone numbers available" → Backend Twilio API issue
- ❌ Network error → Check backend API is running

#### Step 4: Call Forwarding Setup 📲 (KEY TEST)
- App shows carrier-specific call forwarding instructions
- **Follow the instructions to enable call forwarding:**

  **Example for US Carriers (Verizon/AT&T/T-Mobile):**
  1. Open Phone app
  2. Dial `*72` followed by your Flynn number: `*72+61363588413`
  3. Press call button
  4. Wait for confirmation beep
  5. Hang up

  **Example for Australian Carriers (Telstra/Optus/Vodafone):**
  1. Open Phone app
  2. Dial `**67*` followed by Flynn number and `#`: `**67*+61363588413#`
  3. Press call button
  4. Wait for confirmation
  5. Hang up

- **Test forwarding:** Have someone call your business number, it should forward to Flynn
- Tap "I've Set Up Forwarding" when done

**Expected Result:**
- ✅ Clear, carrier-specific instructions displayed
- ✅ Instructions match your detected carrier
- ✅ Forwarding codes are correct for your region
- ✅ Test call successfully forwards to Flynn number

**How to Verify:**
1. Ask a friend to call your business number
2. Flynn should answer with your greeting
3. Check Flynn app for incoming call notification

#### Step 5: Receptionist Configuration 🤖 (KEY TEST)
- **Choose your greeting voice:**
  - Avery (Warm & Friendly)
  - Sloane (Expert Concierge)
  - Maya (High Energy)
  - Custom voice (record your own)
- **Edit greeting script** (optional):
  - Default: "Hi! Thanks for calling [Business Name]. I'm Flynn, your AI assistant..."
- **Configure intake questions:**
  - "What can we help you with today?"
  - "Where should we send the team?"
  - "When do you need the work done?"
  - "What's the best number to reach you?"
- **Choose receptionist mode:**
  - AI Only (Flynn handles all calls)
  - Hybrid Choice (caller can choose AI or human)
  - Voicemail Only (skip AI, just capture voicemail)
- **Enter brand website** (optional):
  - Allows Flynn to scrape brand voice and services
  - Example: `https://yourcompany.com`
- Tap "Continue"

**Expected Result:**
- ✅ Voice preview plays when selected
- ✅ Greeting script is editable and saves
- ✅ Intake questions can be customized
- ✅ Mode selection works (test each option)
- ✅ Website scraping starts (if URL provided)
- ✅ All settings saved successfully

#### Step 6: Onboarding Complete 🎉
- Summary of your setup
- Quick tips for using Flynn
- Tap "Go to Dashboard"

**Expected Result:**
- ✅ Onboarding marked as complete in database
- ✅ Organization status changed to 'active'
- ✅ User redirected to main app (Dashboard tab)

---

## Main App Testing

### Dashboard Tab 🏠
**What to Test:**
- Recent activity feed (voicemails, jobs, calls)
- Quick stats (pending jobs, completed this week, revenue)
- Shortcuts to common actions (Create Job, View Clients, Send Invoice)

**Expected Results:**
- ✅ Dashboard loads without errors
- ✅ Stats display correctly (may be zero initially)
- ✅ Recent activity shows placeholder or empty state
- ✅ All buttons/links are tappable and navigate correctly

**Test Actions:**
1. Tap "Create Job" → Should open job creation form
2. Scroll through recent activity
3. Check revenue stats (should show "$0.00" initially)
4. Pull to refresh → Should reload data

---

### Events Tab 📅 (Main Jobs Screen)
**What to Test:**
- List of jobs/events (empty initially)
- Job status filtering (Pending, In Progress, Completed, Cancelled)
- Job creation flow
- Job details modal
- Calendar sync

**Expected Results:**
- ✅ Empty state shows helpful message
- ✅ "+ Add Event" button visible
- ✅ Filters work correctly
- ✅ Calendar view toggles

**Test Actions:**
1. **Create a test job manually:**
   - Tap "+ Add Event"
   - Fill in client details:
     - Name: "John Smith"
     - Phone: "+1 555 123 4567"
   - Select service type: "Plumbing repair"
   - Add description: "Kitchen sink leaking"
   - Set date/time: Tomorrow at 10:00 AM
   - Add location: "123 Main St, San Francisco, CA"
   - Tap "Save"

2. **View job details:**
   - Tap on the created job
   - Modal should open with full details
   - Tap "Send Booking Link" (if status is pending)
   - SMS app should open with pre-filled message
   - Close modal

3. **Update job status:**
   - Long-press or swipe on job
   - Change status to "In Progress"
   - Verify status updates in list

4. **Test filters:**
   - Switch between Pending/In Progress/Completed
   - Job should appear/disappear based on status

---

### Receptionist Tab ✨ (KEY FEATURE TEST)
**What to Test:**
- Voicemail inbox
- Call transcription accuracy
- Job extraction from voicemails
- Approval workflow for responses
- Call history

**Expected Results:**
- ✅ Empty state initially
- ✅ New voicemail notifications appear
- ✅ Transcription is accurate (>80%)
- ✅ Job details extracted correctly
- ✅ Approval flow works smoothly

**Test Actions:**

#### Test 1: Incoming Voicemail (Most Important!)
1. **Have someone leave a voicemail on your business number:**
   - Sample script: "Hi, this is John Smith calling from 555-123-4567. I need a plumber to fix a leaking kitchen sink at 123 Main Street tomorrow morning around 10 AM. It's pretty urgent. Thanks!"

2. **Check Flynn app (within 1-2 minutes):**
   - Voicemail should appear in Receptionist tab
   - Tap on voicemail card

3. **Review transcript:**
   - Should show accurate transcription of the call
   - Confidence score should be displayed (e.g., "92% confidence")
   - Tap play button to listen to audio recording

4. **Check extracted job details:**
   - Client Name: "John Smith" ✅
   - Client Phone: "+1 555 123 4567" ✅
   - Service Type: "Plumbing repair" ✅
   - Description: "Leaking kitchen sink" ✅
   - Scheduled Date: Tomorrow ✅
   - Scheduled Time: "10:00 AM" ✅
   - Location: "123 Main Street" ✅
   - Urgency: "High" ✅

5. **Review AI-drafted response:**
   - Should see suggested SMS/email reply
   - Example: "Hi John! Thanks for calling. We've got you scheduled for tomorrow at 10 AM for the kitchen sink leak at 123 Main St. Looking forward to helping you out!"
   - Tap "Edit" to modify response (optional)

6. **Approve and send:**
   - Tap "Approve & Send"
   - Confirm sending
   - Job should be created automatically
   - SMS should be sent to client

7. **Verify job creation:**
   - Go to Events tab
   - New job should appear with "Pending" status
   - Job details should match extracted information

#### Test 2: Manual Call Recording (Optional)
1. Tap "Record Test Call" (if available)
2. Record yourself describing a job
3. Stop recording
4. Verify processing and job extraction

#### Test 3: Call History
1. Tap "Call History" or "View All Calls"
2. Should see list of all processed calls
3. Tap on a call to see details
4. Verify audio playback works

---

### Clients Tab 👥
**What to Test:**
- Client list (empty initially)
- Client creation
- Client details
- Client history (jobs, invoices, calls)
- Search and filtering

**Expected Results:**
- ✅ Empty state shows helpful message
- ✅ Client creation works
- ✅ Client details are editable
- ✅ Job history shows associated jobs

**Test Actions:**
1. **Add a client manually:**
   - Tap "+ Add Client"
   - Name: "Jane Doe"
   - Phone: "+1 555 987 6543"
   - Email: "jane@example.com"
   - Address: "456 Oak Ave, Los Angeles, CA"
   - Tap "Save"

2. **View client details:**
   - Tap on client
   - View full profile
   - Check "Jobs" tab → should show associated jobs
   - Check "Invoices" tab → empty initially

3. **Search for client:**
   - Use search bar at top
   - Type "Jane"
   - Client should appear in results

---

### Money Tab 💰 (Quotes & Invoices)
**What to Test:**
- Quote creation
- Invoice creation
- Payment links (Stripe)
- Payment tracking
- Revenue stats

**Expected Results:**
- ✅ Quote/Invoice tabs switch correctly
- ✅ Creation forms work
- ✅ Stripe payment links generate
- ✅ Revenue stats display correctly

**Test Actions:**

#### Test 1: Create a Quote
1. Tap "Money" tab
2. Tap "+ Create Quote"
3. Fill in details:
   - Client: Select "John Smith" (from earlier test)
   - Title: "Kitchen Sink Repair"
   - Line items:
     - Description: "Fix leaking pipe"
     - Quantity: 1
     - Unit Price: $150
   - Add another line item:
     - Description: "Replace faucet washer"
     - Quantity: 2
     - Unit Price: $25
   - Tax rate: 10%
   - Due date: 7 days from now
   - Notes: "Parts and labor included"
4. Tap "Save Quote"

5. **Send quote:**
   - Tap on created quote
   - Tap "Send Quote"
   - Choose SMS or Email
   - Verify Stripe payment link is included
   - Send to client

#### Test 2: Create an Invoice
1. Tap "+ Create Invoice"
2. Fill in details (similar to quote)
3. Generate Stripe payment link
4. Send invoice
5. **Test payment (optional):**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - Complete payment
   - Verify invoice status updates to "Paid"

#### Test 3: View Revenue Stats
1. Check Dashboard → Revenue section
2. Should show:
   - Total Revenue (last 30 days)
   - Paid Invoices count
   - Pending amount
   - Overdue amount
3. Verify numbers match your test data

---

### Settings Tab ⚙️
**What to Test:**
- Business profile editing
- Receptionist settings
- Call settings
- Booking page setup
- Integrations
- Account management

**Expected Results:**
- ✅ All settings load correctly
- ✅ Changes save successfully
- ✅ Navigation works

**Test Actions:**

#### Test 1: Business Profile
1. Tap "Business Profile"
2. Edit details:
   - Business name
   - Website URL
   - Services offered
   - Operating hours
   - Location/address
3. Tap "Save"
4. Go back and verify changes persisted

#### Test 2: Receptionist Settings
1. Tap "Receptionist Settings"
2. Change voice:
   - Switch from Avery to Sloane
   - Preview voice
3. Edit greeting script
4. Modify intake questions
5. Change mode (AI Only → Hybrid)
6. Save changes
7. **Verify:** Next call uses new settings

#### Test 3: Call Settings
1. Tap "Call Settings"
2. View your Flynn number
3. View forwarding instructions
4. Test "Disable Forwarding" (if available)
5. Re-enable forwarding

#### Test 4: Booking Page Setup
1. Tap "Booking Page"
2. Configure booking page:
   - Set business hours per day
   - Set slot duration (30/60/90 min)
   - Set buffer time between bookings
   - Customize booking page slug: `flynnbooking.com/your-business`
3. Activate booking page
4. Copy booking link
5. Open link in browser → verify booking page loads

#### Test 5: Integrations
1. Tap "Integrations"
2. View available integrations:
   - Google Calendar
   - MYOB
   - QuickBooks
   - Xero
   - Jobber
3. Try connecting one (optional)
4. Check connection status

#### Test 6: Subscription & Billing
1. Tap "Subscription"
2. Verify plan shows "Business" ($149/month)
3. Check call usage: "0 / 350 calls used"
4. **Should NOT see upgrade prompts** (already on highest tier)

---

## End-to-End Workflow Test (Complete Flow)

This test combines all features to simulate a real user journey:

### Scenario: Plumber Receives and Processes a Call

1. **Setup:**
   - Ensure call forwarding is active
   - Business number: Your actual mobile
   - Flynn number: Provisioned during onboarding

2. **Incoming Call:**
   - Have a friend call your business number
   - Flynn answers with your greeting
   - Caller leaves voicemail: "Hi, I'm Sarah Johnson at 555-0199. I need someone to fix a burst pipe in my basement at 789 Pine Street. It's flooding! Can you come today? Any time this afternoon works."

3. **Flynn Processing (Automated):**
   - Call recorded
   - Transcription generated (1-2 minutes)
   - Job details extracted via AI
   - Response drafted

4. **Review in App:**
   - Open Flynn AI → Receptionist tab
   - New voicemail notification appears
   - Tap voicemail card
   - Review transcript
   - Check extracted details:
     - Name: Sarah Johnson ✅
     - Phone: 555-0199 ✅
     - Service: Pipe repair ✅
     - Location: 789 Pine Street ✅
     - Urgency: High (flooding!) ✅
     - Time: This afternoon ✅
   - Review AI response:
     - "Hi Sarah! We understand the urgency. We can get someone out to 789 Pine St this afternoon. Our plumber will arrive between 2-4 PM. Stay safe!"

5. **Approve & Send:**
   - Edit response if needed
   - Tap "Approve & Send"
   - SMS sent to Sarah

6. **Job Created:**
   - Go to Events tab
   - New job appears: "Pipe Repair - Sarah Johnson"
   - Status: Pending
   - Date: Today
   - Time: 2:00 PM - 4:00 PM

7. **Update Job:**
   - Tap job → change status to "In Progress"
   - Arrive at location → change to "Completed"

8. **Create Invoice:**
   - From job details, tap "Create Invoice"
   - Pre-filled with job details
   - Add line items:
     - Pipe repair labor: $200
     - Materials (pipe sections): $50
   - Tax: 10%
   - Total: $275
   - Save and send invoice

9. **Payment:**
   - Sarah receives invoice with Stripe link
   - Pays via Stripe (use test card if testing)
   - Invoice status updates to "Paid"
   - Job status updates to "Complete"

10. **Follow-up:**
    - Flynn automatically sends thank-you SMS (if configured)
    - Client added to Clients list
    - Revenue stats updated on Dashboard

**Expected Result:**
✅ **Complete workflow from call → voicemail → job creation → invoicing → payment** works smoothly without errors.

---

## Testing Checklist

Use this checklist to track your testing progress:

### Setup & Onboarding
- [ ] App installs successfully
- [ ] Login works (Google OAuth or email/password)
- [ ] Business type selection saves
- [ ] Business goals selection saves
- [ ] Flynn number provisioning works (no paywall shown)
- [ ] Call forwarding instructions are clear and correct
- [ ] Receptionist configuration saves
- [ ] Onboarding completes successfully

### Core Features
- [ ] Dashboard loads without errors
- [ ] Manual job creation works
- [ ] Job details modal opens and displays correctly
- [ ] Job status updates work
- [ ] Client creation works
- [ ] Client list displays correctly

### Receptionist (Most Critical)
- [ ] Voicemail capture works
- [ ] Transcription is accurate (>80%)
- [ ] Job extraction is correct
- [ ] AI response is appropriate
- [ ] Approval and sending works
- [ ] Job is auto-created from voicemail
- [ ] Call history shows all calls

### Money Features
- [ ] Quote creation works
- [ ] Invoice creation works
- [ ] Stripe payment links generate
- [ ] Payment status updates correctly
- [ ] Revenue stats display accurately

### Settings
- [ ] Business profile edits save
- [ ] Receptionist settings changes persist
- [ ] Booking page setup works
- [ ] Booking link loads in browser
- [ ] Integration connection status displays

### Performance & UX
- [ ] App launches quickly (<3 seconds)
- [ ] Navigation is smooth (no lag)
- [ ] No crashes or freezes
- [ ] Loading indicators appear appropriately
- [ ] Error messages are helpful
- [ ] Pull-to-refresh works on all lists

---

## Known Issues & Limitations

### Current Limitations:
1. **Backend API Required:** All Twilio and AI operations now proxy through backend. Ensure backend is deployed and accessible.
2. **Twilio Costs:** Real phone numbers cost ~$1-2/month. Test user's number will incur this cost.
3. **Transcription Delay:** Voicemail processing takes 1-2 minutes (dependent on Deepgram/Whisper API)
4. **Test Cards Only:** If using Stripe test mode, only test cards work (4242 4242 4242 4242)

### Known Bugs (If Any):
- [ ] None currently documented (you'll discover these during testing!)

---

## Reporting Issues

When you find a bug or issue, please report it with:

1. **Title:** Brief description (e.g., "App crashes when creating invoice")
2. **Steps to Reproduce:**
   - Step 1: Open Money tab
   - Step 2: Tap "+ Create Invoice"
   - Step 3: Fill in client name
   - Step 4: Tap "Save"
   - Result: App crashes
3. **Expected Behavior:** "Invoice should be saved and appear in list"
4. **Actual Behavior:** "App crashed and returned to home screen"
5. **Screenshots:** (if applicable)
6. **Device Info:**
   - Model: iPhone 13 Pro
   - iOS Version: 16.5
   - App Version: 1.0.0 (from Settings > About)
7. **Additional Context:** Any other relevant details

**Where to Report:**
- Email: atticus@flynnai.com
- GitHub Issues: (if applicable)
- Slack channel: #testing (if applicable)

---

## Success Criteria

The test is considered successful if:

✅ **All critical features work:**
- Call forwarding setup completes
- Voicemail capture and transcription work
- Job extraction is accurate (>80%)
- Job creation from voicemails works
- Invoice/quote creation and payment links work

✅ **No blocking bugs:**
- No crashes
- No data loss
- No authentication issues

✅ **Performance is acceptable:**
- App loads in <3 seconds
- Navigation is smooth
- Voicemail processing completes in <3 minutes

✅ **UX is clear:**
- Instructions are easy to follow
- Error messages are helpful
- No confusing workflows

---

## Next Steps After Testing

1. **Tester provides feedback** (bugs, suggestions, UX issues)
2. **Developer reviews feedback** and prioritizes fixes
3. **Critical bugs are fixed** immediately
4. **Nice-to-have improvements** added to backlog
5. **Re-test critical fixes** with tester
6. **Prepare for production launch** once all issues resolved

---

## Support During Testing

If you get stuck or have questions:

1. **Check this guide** for instructions
2. **Try restarting the app** (force quit and reopen)
3. **Check your internet connection** (WiFi and cellular data)
4. **Verify call forwarding is active** (test by calling your business number)
5. **Contact the developer:**
   - Email: atticus@flynnai.com
   - Phone: [Provided separately]
   - Available: Mon-Fri 9am-6pm PST

---

## Thank You!

Your testing is critical to making Flynn AI production-ready. We appreciate your time and detailed feedback!

🎉 **Ready to turn missed calls into booked jobs!**

---

**Document Version:** 1.0
**Last Updated:** January 22, 2025
**Maintained By:** Flynn AI Development Team
