# FlynnAI

A React Native app for tradespeople and small businesses to automatically capture job details from screenshots and phone calls, create calendar events, and send client confirmations.

## Features

- **Job Management**: Track jobs from initial contact to completion
- **Smart Capture**: Extract job details from screenshots using OCR
- **Phone Call Integration**: Record and transcribe phone calls
- **Calendar Integration**: Automatic calendar event creation
- **Client Management**: Store client details and communication history
- **Confirmations**: Automated client confirmation emails/SMS
- **Dashboard**: Real-time overview of jobs, events, and stats

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **UI Components**: React Native Paper, React Native Elements
- **Calendar**: React Native Calendars
- **Navigation**: React Navigation
- **State Management**: React Context API
- **Authentication**: Supabase Auth with email/OTP

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- Expo Go app on your phone for testing

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd FlynnAI
```

2. Install dependencies:
```bash
npm install
```

3. Environment setup:
- The `.env` file is already configured with Supabase credentials
- Project URL: `https://zvfeafmmtfplzpnocyjw.supabase.co`

### Running the App

1. Start the development server:
```bash
npm start
```

2. Run on iOS:
```bash
npm run ios
```

3. Run on Android:
```bash
npm run android
```

4. Run on Web:
```bash
npm run web
```

## Database Schema

The app uses the following main tables:

- **users**: Business owner profiles
- **clients**: Customer information
- **jobs**: Job/project records
- **calendar_events**: Scheduled appointments
- **screenshots**: Captured images with OCR data
- **phone_calls**: Call logs and transcriptions
- **confirmations**: Communication records
- **services**: Service types and pricing
- **job_attachments**: Photos, documents, quotes

## Project Structure

```
FlynnAI/
├── src/
│   ├── screens/         # App screens
│   ├── components/      # Reusable UI components
│   ├── services/        # API and Supabase integration
│   ├── navigation/      # Navigation configuration
│   ├── context/         # React Context providers
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Helper functions
│   └── types/           # TypeScript definitions
├── assets/              # Images, fonts
├── app.json            # Expo configuration
└── .env                # Environment variables
```

## Key Features Implementation

### Authentication
- Email/password authentication with OTP support
- Automatic user profile creation on signup
- Session persistence using AsyncStorage
- Server APIs verify Supabase Auth JWTs (see below)

#### API Authentication
- All `/jobs` and `/telephony/calls` routes expect `Authorization: Bearer <jwt>` signed with `SUPABASE_JWT_SECRET`.
- When `NODE_ENV=development` and no bearer token is present, the server accepts legacy `x-user-id` headers for local testing only.
- Configure the backend with:
  - `SUPABASE_JWT_SECRET` – copy from the Supabase project settings (`Settings → API → JWT Secret`).
- Example curl (JWT):
  ```bash
  curl http://localhost:3000/jobs \
    -H "Authorization: Bearer <your_supabase_jwt>"
  ```
- Example curl (development fallback):
  ```bash
  NODE_ENV=development curl http://localhost:3000/jobs \
    -H "x-user-id: 00000000-0000-0000-0000-000000000001"
  ```

### Screenshot Capture
- Uses `expo-camera` and `expo-image-picker`
- OCR text extraction (to be implemented)
- Automatic job detail parsing

### Calendar Integration
- Visual calendar with `react-native-calendars`
- Event creation and management
- Reminder notifications

### Dashboard
- Real-time statistics
- Upcoming events
- Recent jobs
- Pull-to-refresh functionality

## Development Notes

- Row Level Security (RLS) is enabled on all tables
- All user data is isolated by user_id
- TypeScript types are generated from Supabase schema
- The app uses Expo SDK 54 with React Native 0.81.x
- Push notifications rely on Expo's `expo-notifications` module and device-specific tokens stored in `notification_tokens`

### Push Notifications

When a job is created, the backend records the event and attempts to notify the job owner on every registered device.

**Database**
- `notification_tokens` stores per-user device tokens with strict RLS (`user_id = auth.uid()`).
- Tokens are unique per device (`token` is unique) and indexed by `user_id` for efficient lookups.

**Environment variables**
- `FCM_SERVER_KEY` – Firebase Cloud Messaging server key for Android devices.
- `APNS_KEY_ID` – Apple Push Notification key identifier.
- `APNS_TEAM_ID` – Apple Developer Team ID.
- `APNS_PRIVATE_KEY` – Contents of your `.p8` key (use `\n` escapes for newlines).
- `APNS_BUNDLE_ID` – iOS bundle identifier used for APNs topics (defaults to `com.flynnai.app`).
- `APNS_HOST` *(optional)* – Override (`https://api.sandbox.push.apple.com` vs production).

**Registering a device token**
```bash
curl -X POST "http://localhost:3000/me/notifications/token" \\
  -H "Authorization: Bearer <SUPABASE_JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{"platform":"ios","token":"<device-token>"}'
```

**Triggering a notification for a job**
```bash
curl -X POST "http://localhost:3000/jobs/<job-id>/notify" \\
  -H "Authorization: Bearer <SUPABASE_JWT>"
```

Both endpoints return success/failure details; the notify endpoint reports the number of device sends attempted and delivered.

## Next Steps

- Implement OCR functionality for screenshot text extraction
- Add phone call recording and transcription
- Add client confirmation email/SMS sending
- Integrate with external calendar services (Google, Apple)
- Add invoice generation and payment tracking

## Support

For issues or questions, please contact the development team.
