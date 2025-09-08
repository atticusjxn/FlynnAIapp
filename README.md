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
- The app uses Expo SDK 53 with React Native 0.79.6

## Next Steps

- Implement OCR functionality for screenshot text extraction
- Add phone call recording and transcription
- Implement push notifications for reminders
- Add client confirmation email/SMS sending
- Integrate with external calendar services (Google, Apple)
- Add invoice generation and payment tracking

## Support

For issues or questions, please contact the development team.