import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../config/env';

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

const getOpenAIClient = (): OpenAI => {
  if (!openai) {
    if (!OPENAI_API_KEY) {
      throw new Error('Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.');
    }
    openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
  }
  return openai;
};

export interface ExtractedJobData {
  clientName: string;
  phone: string;
  date: string;
  time: string;
  location?: string;
  serviceType?: string;
  notes?: string;
  confidence: number; // 0-1 score
}

class OpenAIService {
  private getJobExtractionPrompt(businessType?: string): string {
    const businessContext = businessType
      ? `This is for a ${businessType.replace(/_/g, ' ')} service business.`
      : 'This appears to be for a service business.';

    const serviceTypeGuidance = businessType
      ? this.getServiceTypeGuidance(businessType)
      : 'The service type should be descriptive and specific (e.g., "Leaky faucet repair", "Haircut and color").';

    return `
You are an AI assistant that extracts job/appointment details from screenshot images of text conversations, emails, or messages.

${businessContext}

Please analyze the image and extract the following information in JSON format:
{
  "clientName": "Full name of the client/customer",
  "phone": "Phone number in standard format",
  "date": "Date in format like 'Dec 15' or 'Tomorrow' or actual date",
  "time": "Time in format like '2:00 PM' or '14:00'",
  "location": "Full address or location description",
  "serviceType": "Type of service needed",
  "notes": "Additional details about the job or special requirements",
  "confidence": 0.95
}

Guidelines:
- If information is not clearly visible or mentioned, use null for that field
- For dates like "tomorrow", "next week", etc., keep the original text
- Include all relevant details in the notes field
- Confidence should be 0.0-1.0 based on how clear the information is
- phone numbers should include country code if visible
- ${serviceTypeGuidance}

Respond only with valid JSON, no additional text.
    `.trim();
  }

  private getServiceTypeGuidance(businessType: string): string {
    const serviceExamples: Record<string, string> = {
      home_property: 'Examples: "Leaky faucet repair", "House cleaning - 3 bedrooms", "HVAC maintenance"',
      personal_beauty: 'Examples: "Haircut and color", "Deep tissue massage - 90min", "Manicure and pedicure"',
      automotive: 'Examples: "Oil change and tire rotation", "Brake pad replacement", "Engine diagnostic"',
      business_professional: 'Examples: "Tax consultation", "Website design project", "Legal contract review"',
      moving_delivery: 'Examples: "2-bedroom apartment move", "Furniture delivery and assembly", "Office relocation"',
      other: 'The service type should be descriptive and specific',
    };

    return serviceExamples[businessType] || serviceExamples.other;
  }

  async extractJobFromImage(imageBase64: string, businessType?: string): Promise<ExtractedJobData> {
    try {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: this.getJobExtractionPrompt(businessType)
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1, // Low temperature for consistent extraction
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const extractedData: ExtractedJobData = JSON.parse(content);
      
      // Validate required fields
      if (!extractedData.clientName && !extractedData.phone) {
        throw new Error('Could not extract essential job information');
      }

      return extractedData;
    } catch (error) {
      console.error('OpenAI extraction error:', error);
      
      // Return default structure with low confidence on error
      return {
        clientName: '',
        phone: '',
        date: '',
        time: '',
        location: '',
        serviceType: '',
        notes: 'Failed to extract information from image. Please enter details manually.',
        confidence: 0.0
      };
    }
  }

  async enhanceJobData(partialData: Partial<ExtractedJobData>, context?: string): Promise<ExtractedJobData> {
    try {
      const prompt = `
Given this partial job information:
${JSON.stringify(partialData, null, 2)}

${context ? `Additional context: ${context}` : ''}

Please fill in missing information and improve the data quality. Respond with complete JSON:
{
  "clientName": "string",
  "phone": "string",
  "date": "string",
  "time": "string",
  "location": "string",
  "serviceType": "string",
  "notes": "string",
  "confidence": 0.95
}

If information cannot be reasonably inferred, use empty strings. Do not make up information.
      `;

      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('OpenAI enhancement error:', error);
      
      // Return the partial data with defaults
      return {
        clientName: partialData.clientName || '',
        phone: partialData.phone || '',
        date: partialData.date || '',
        time: partialData.time || '',
        location: partialData.location || '',
        serviceType: partialData.serviceType || '',
        notes: partialData.notes || '',
        confidence: partialData.confidence || 0.5
      };
    }
  }
}

export const openAIService = new OpenAIService();
export default openAIService;