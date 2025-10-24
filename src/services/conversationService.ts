import { supabase } from './supabase';

export interface ConversationResponse {
  question: string;
  answer: string;
  confidence: number;
  timestamp: string;
}

export interface ConversationState {
  id: string;
  call_sid: string;
  user_id: string;
  from_number: string;
  to_number: string;
  current_step: number;
  total_steps: number;
  questions: string[];
  responses: ConversationResponse[];
  voice_id: string | null;
  greeting: string | null;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * Fetch conversation state by CallSid
 */
export const getConversationByCallSid = async (
  callSid: string,
): Promise<ConversationState | null> => {
  const { data, error } = await supabase
    .from('conversation_states')
    .select('*')
    .eq('call_sid', callSid)
    .single();

  if (error) {
    console.error('[ConversationService] Failed to fetch conversation:', error);
    return null;
  }

  return data;
};

/**
 * Format conversation for display
 */
export const formatConversationTranscript = (
  conversation: ConversationState,
): string => {
  if (!conversation.responses || conversation.responses.length === 0) {
    return 'No conversation data available.';
  }

  let transcript = `Greeting: ${conversation.greeting || 'Default greeting'}\n\n`;

  conversation.responses.forEach((response, index) => {
    const question = conversation.questions[index] || 'Question not recorded';
    transcript += `Q: ${question}\n`;
    transcript += `A: ${response.answer}\n`;
    if (response.confidence) {
      transcript += `   (Confidence: ${(response.confidence * 100).toFixed(1)}%)\n`;
    }
    transcript += '\n';
  });

  return transcript;
};
