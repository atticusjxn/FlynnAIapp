export interface VoiceOption {
  id: string;
  label: string;
  description?: string;
  tag?: string;
}

export interface FollowUpTemplate {
  id: string;
  label: string;
  description: string;
  questions: string[];
}

export const KOALA_ASSETS = {
  animation: require('../../assets/images/koala3s.gif'),
  static: require('../../assets/images/icon.png'),
};

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'koala_warm',
    label: 'Scott — Warm & Friendly',
    description: 'Balanced tone ideal for inbound service calls.',
    tag: 'Popular',
  },
  {
    id: 'koala_expert',
    label: 'Lily — Expert Concierge',
    description: 'Calm, confident delivery for premium services.',
  },
  {
    id: 'koala_hype',
    label: 'Kate — High Energy',
    description: 'Upbeat tone that keeps callers engaged.',
  },
  {
    id: 'custom_voice',
    label: 'Record Your Own',
    description: 'Clone your voice so it sounds like you answering.',
  },
];

export const DEFAULT_VOICE_ID = VOICE_OPTIONS[0].id;

export const FOLLOW_UP_TEMPLATES: FollowUpTemplate[] = [
  {
    id: 'general',
    label: 'General service',
    description: 'Works for most customer service teams.',
    questions: [
      'What can we help you with today?',
      'Where should we send the team or service pro?',
      'When do you need this completed?',
      'What is the best number or email to reach you?',
    ],
  },
  {
    id: 'trades',
    label: 'Trades & repairs',
    description: 'Tailored for electricians, plumbers, and contractors.',
    questions: [
      'What project or repair do you need help with?',
      'How urgent is the request?',
      'What time would you like the work handled?',
      'Where is the job located and are there access instructions?',
    ],
  },
  {
    id: 'events',
    label: 'Events & venues',
    description: 'Great for planners, venues, and hospitality teams.',
    questions: [
      'What type of event are you planning?',
      'When is the event and how flexible is the date?',
      'How many guests are you expecting?',
      'Is there anything special we should prepare for?',
    ],
  },
];

export const DEFAULT_FOLLOW_UP_QUESTIONS = FOLLOW_UP_TEMPLATES[0].questions;

export const matchTemplateId = (questions: string[]): string => {
  const normalized = questions.map(question => question.trim()).filter(Boolean);
  const match = FOLLOW_UP_TEMPLATES.find(template => {
    if (template.questions.length !== normalized.length) {
      return false;
    }
    return template.questions.every((question, index) => question === normalized[index]);
  });
  return match?.id ?? 'custom';
};
