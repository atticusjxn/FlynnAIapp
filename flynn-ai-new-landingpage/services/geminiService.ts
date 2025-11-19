import { GoogleGenAI, Chat, Modality } from "@google/genai";
import { ChatMessage } from "../types";

let chatSession: Chat | null = null;

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in environment variables.");
  }
  return new GoogleGenAI({ apiKey: apiKey || 'dummy_key_for_build' });
};

export const initializeChat = async (): Promise<string> => {
  const ai = getAiClient();
  
  try {
    chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are Flynn, an advanced AI receptionist for "Premier Plumbing & Gas". 
        You are professional, concise, and friendly. 
        Your goal is to answer the phone, get the customer's name, their issue, and their location.
        Keep your responses short (under 25 words) and conversational, like a real human receptionist via text.
        Do not use markdown formatting.`,
        temperature: 0.7,
      },
    });
    
    return "Hi! You've reached Premier Plumbing. I'm Flynn, the AI assistant. How can I help you today?";
  } catch (error) {
    console.error("Failed to initialize chat", error);
    return "Connection error. Please try again later.";
  }
};

export const sendMessageToFlynn = async (message: string): Promise<string> => {
  if (!chatSession) {
     await initializeChat();
  }

  if (!chatSession) {
    return "I'm having trouble connecting right now. Please try again.";
  }

  try {
    const response = await chatSession.sendMessage({ message });
    return response.text || "I didn't catch that.";
  } catch (error) {
    console.error("Error sending message to Flynn:", error);
    return "Sorry, I'm having a bit of trouble hearing you. Could you repeat that?";
  }
};

export const generateClientImage = async (profession: string): Promise<string | null> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A realistic, candid photo of a ${profession} smiling and looking at their smartphone in their typical workplace. Natural lighting, authentic professional atmosphere, high resolution photography.`,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE], 
      },
    });
    
    // Extract image from response
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part && part.inlineData) {
      const base64ImageBytes: string = part.inlineData.data;
      return `data:image/png;base64,${base64ImageBytes}`;
    }
    return null;
  } catch (error) {
    console.error("Failed to generate image", error);
    return null;
  }
};