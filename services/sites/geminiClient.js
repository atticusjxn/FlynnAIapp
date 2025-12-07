const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.0-pro';
const DEFAULT_VISION_MODEL = process.env.GEMINI_VISION_MODEL || DEFAULT_TEXT_MODEL;

let cachedClient = null;

const getClient = () => {
  if (cachedClient) return cachedClient;
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Set it in your environment to enable FlynnAI Sites generation.');
  }
  cachedClient = new GoogleGenerativeAI(apiKey);
  return cachedClient;
};

const toJson = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    const wrapped = new Error('Failed to parse JSON response from Gemini');
    wrapped.cause = error;
    wrapped.raw = text;
    throw wrapped;
  }
};

const runTextPrompt = async (prompt, { temperature = 0.6, maxOutputTokens = 1800, model } = {}) => {
  const genAI = getClient();
  const textModel = genAI.getGenerativeModel({ model: model || DEFAULT_TEXT_MODEL });
  const response = await textModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }]}],
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType: 'text/plain',
    },
  });

  return response?.response?.text?.() || '';
};

const runJsonPrompt = async (prompt, opts = {}) => {
  const genAI = getClient();
  const textModel = genAI.getGenerativeModel({ model: opts.model || DEFAULT_TEXT_MODEL });
  const response = await textModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }]}],
    generationConfig: {
      temperature: opts.temperature ?? 0.6,
      maxOutputTokens: opts.maxOutputTokens ?? 2000,
      responseMimeType: 'application/json',
    },
  });

  const body = response?.response?.text?.() || '{}';
  return toJson(body);
};

const downloadImageAsInlineData = async (url) => {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const mimeType = response.headers['content-type'] || 'image/jpeg';
  const base64 = Buffer.from(response.data).toString('base64');
  return { inlineData: { data: base64, mimeType } };
};

const runVisionJsonPrompt = async (prompt, imageUrl, { temperature = 0.4, maxOutputTokens = 600, model } = {}) => {
  const genAI = getClient();
  const visionModel = genAI.getGenerativeModel({ model: model || DEFAULT_VISION_MODEL });
  const imagePart = await downloadImageAsInlineData(imageUrl);

  const response = await visionModel.generateContent({
    contents: [{
      role: 'user',
      parts: [
        imagePart,
        { text: prompt },
      ],
    }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType: 'application/json',
    },
  });

  const body = response?.response?.text?.() || '{}';
  return toJson(body);
};

module.exports = {
  runTextPrompt,
  runJsonPrompt,
  runVisionJsonPrompt,
};
