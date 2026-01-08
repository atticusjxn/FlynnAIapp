/**
 * Audio Format Conversion Utilities
 *
 * Converts between different audio formats for Deepgram Voice Agent integration:
 * - React Native (Linear16 PCM, 16kHz) ↔ Twilio/Deepgram (μ-law, 8kHz)
 */

// μ-law encoding/decoding tables
const MULAW_BIAS = 0x84;
const MULAW_MAX = 0x1FFF;

/**
 * Linear16 to μ-law conversion
 * Compresses 16-bit linear PCM to 8-bit μ-law
 */
function linear16ToMulaw(sample) {
  // Get the sign
  let sign = (sample >> 8) & 0x80;

  // Get absolute value
  if (sign !== 0) {
    sample = -sample;
  }

  // Clip to max value
  if (sample > MULAW_MAX) {
    sample = MULAW_MAX;
  }

  // Add bias
  sample = sample + MULAW_BIAS;

  // Get exponent and mantissa
  let exponent = 7;
  let expMask = 0x4000;

  for (; exponent > 0; exponent--) {
    if ((sample & expMask) !== 0) {
      break;
    }
    expMask >>= 1;
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0F;
  const mulaw = ~(sign | (exponent << 4) | mantissa);

  return mulaw & 0xFF;
}

/**
 * μ-law to Linear16 conversion
 * Expands 8-bit μ-law to 16-bit linear PCM
 */
function mulawToLinear16(mulaw) {
  mulaw = ~mulaw;

  const sign = mulaw & 0x80;
  const exponent = (mulaw >> 4) & 0x07;
  const mantissa = mulaw & 0x0F;

  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  sample -= MULAW_BIAS;

  if (sign !== 0) {
    sample = -sample;
  }

  return sample;
}

/**
 * Convert Linear16 PCM buffer to μ-law buffer
 * @param {Buffer} linear16Buffer - Input buffer (16-bit PCM)
 * @returns {Buffer} μ-law encoded buffer (8-bit)
 */
function convertLinear16ToMulawBuffer(linear16Buffer) {
  // Ensure we have an even number of bytes for 16-bit samples
  const sampleCount = Math.floor(linear16Buffer.length / 2);
  const mulawBuffer = Buffer.alloc(sampleCount);

  for (let i = 0; i < linear16Buffer.length - 1; i += 2) {
    // Ensure we can read a 16-bit value
    if (i + 2 > linear16Buffer.length) {
      break;
    }
    // Read 16-bit little-endian sample
    const sample = linear16Buffer.readInt16LE(i);
    // Convert to μ-law
    const outputIndex = Math.floor(i / 2);
    if (outputIndex < mulawBuffer.length) {
      mulawBuffer[outputIndex] = linear16ToMulaw(sample);
    }
  }

  return mulawBuffer;
}

/**
 * Convert μ-law buffer to Linear16 PCM buffer
 * @param {Buffer} mulawBuffer - Input buffer (8-bit μ-law)
 * @returns {Buffer} Linear16 PCM buffer (16-bit)
 */
function convertMulawToLinear16Buffer(mulawBuffer) {
  const linear16Buffer = Buffer.alloc(mulawBuffer.length * 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    // Convert μ-law sample to linear16
    const sample = mulawToLinear16(mulawBuffer[i]);
    // Write 16-bit little-endian sample
    linear16Buffer.writeInt16LE(sample, i * 2);
  }

  return linear16Buffer;
}

/**
 * Resample audio from 16kHz to 8kHz (simple decimation)
 * For production use, consider using a proper resampler library
 * @param {Buffer} input16kHz - Input buffer at 16kHz
 * @returns {Buffer} Output buffer at 8kHz
 */
function resample16kTo8k(input16kHz) {
  // Simple decimation: keep every other sample
  // Each sample is 2 bytes (16-bit), so we need even-length buffers
  const inputSampleCount = Math.floor(input16kHz.length / 2);
  const outputSampleCount = Math.floor(inputSampleCount / 2);
  const output8kHz = Buffer.alloc(outputSampleCount * 2);

  for (let i = 0; i < inputSampleCount; i += 2) {
    // Read source sample (2 bytes per sample)
    const sourceOffset = i * 2;
    if (sourceOffset + 2 > input16kHz.length) {
      break;
    }
    const sample = input16kHz.readInt16LE(sourceOffset);
    
    // Write to output (every other sample)
    const outputOffset = Math.floor(i / 2) * 2;
    if (outputOffset + 2 <= output8kHz.length) {
      output8kHz.writeInt16LE(sample, outputOffset);
    }
  }

  return output8kHz;
}

/**
 * Resample audio from 8kHz to 16kHz (simple interpolation)
 * @param {Buffer} input8kHz - Input buffer at 8kHz
 * @returns {Buffer} Output buffer at 16kHz
 */
function resample8kTo16k(input8kHz) {
  // Simple interpolation: duplicate each sample
  // Each sample is 2 bytes (16-bit)
  const inputSampleCount = Math.floor(input8kHz.length / 2);
  const output16kHz = Buffer.alloc(inputSampleCount * 2 * 2);

  for (let i = 0; i < inputSampleCount; i++) {
    const inputOffset = i * 2;
    if (inputOffset + 2 > input8kHz.length) {
      break;
    }
    const sample = input8kHz.readInt16LE(inputOffset);
    
    // Write duplicate samples
    const outputOffset1 = i * 4;
    const outputOffset2 = i * 4 + 2;
    if (outputOffset1 + 2 <= output16kHz.length) {
      output16kHz.writeInt16LE(sample, outputOffset1);
    }
    if (outputOffset2 + 2 <= output16kHz.length) {
      output16kHz.writeInt16LE(sample, outputOffset2);
    }
  }

  return output16kHz;
}

/**
 * Convert React Native audio (Linear16 16kHz) to Deepgram format (μ-law 8kHz)
 * @param {Buffer|string} input - Linear16 buffer or base64 string
 * @returns {Buffer} μ-law 8kHz buffer ready for Deepgram
 */
function convertNativeToDeepgram(input) {
  // Handle base64 input
  let linear16Buffer;
  try {
    linear16Buffer = Buffer.isBuffer(input)
      ? input
      : Buffer.from(input, 'base64');
    
    // Validate buffer is not empty
    if (!linear16Buffer || linear16Buffer.length === 0) {
      console.warn('[AudioConverter] Empty input buffer');
      return Buffer.alloc(0);
    }
    
    // Ensure buffer has at least 2 bytes for a 16-bit sample
    if (linear16Buffer.length < 2) {
      console.warn('[AudioConverter] Input buffer too small:', linear16Buffer.length);
      return Buffer.alloc(0);
    }
  } catch (error) {
    console.error('[AudioConverter] Failed to create buffer:', error);
    return Buffer.alloc(0);
  }

  // Step 1: Resample from 16kHz to 8kHz
  const resampled8k = resample16kTo8k(linear16Buffer);
  
  // Validate resampled buffer
  if (!resampled8k || resampled8k.length === 0) {
    console.warn('[AudioConverter] Empty resampled buffer');
    return Buffer.alloc(0);
  }

  // Step 2: Convert to μ-law
  const mulawBuffer = convertLinear16ToMulawBuffer(resampled8k);

  return mulawBuffer;
}

/**
 * Convert Deepgram audio (μ-law 8kHz) to React Native format (Linear16 16kHz)
 * @param {Buffer|string} input - μ-law 8kHz buffer from Deepgram (or base64 string)
 * @returns {Buffer} Linear16 16kHz buffer for React Native playback
 */
function convertDeepgramToNative(input) {
  // Handle base64 input
  let mulawBuffer;
  try {
    mulawBuffer = Buffer.isBuffer(input)
      ? input
      : Buffer.from(input, 'base64');
    
    // Validate buffer is not empty
    if (!mulawBuffer || mulawBuffer.length === 0) {
      console.warn('[AudioConverter] Empty input buffer');
      return Buffer.alloc(0);
    }
  } catch (error) {
    console.error('[AudioConverter] Failed to create buffer:', error);
    return Buffer.alloc(0);
  }

  // Step 1: Convert from μ-law to Linear16
  const linear16_8k = convertMulawToLinear16Buffer(mulawBuffer);
  
  // Validate converted buffer
  if (!linear16_8k || linear16_8k.length === 0) {
    console.warn('[AudioConverter] Empty converted buffer');
    return Buffer.alloc(0);
  }

  // Step 2: Resample from 8kHz to 16kHz
  const linear16_16k = resample8kTo16k(linear16_8k);

  return linear16_16k;
}

/**
 * Calculate RMS (Root Mean Square) for audio amplitude visualization
 * Used for equalizer animations
 * @param {Buffer} audioBuffer - Linear16 PCM buffer
 * @returns {number} RMS value (0-1 normalized)
 */
function calculateRMS(audioBuffer) {
  let sum = 0;
  const sampleCount = audioBuffer.length / 2;

  for (let i = 0; i < audioBuffer.length; i += 2) {
    const sample = audioBuffer.readInt16LE(i);
    sum += sample * sample;
  }

  const rms = Math.sqrt(sum / sampleCount);
  // Normalize to 0-1 range (assuming max amplitude is 32767)
  return Math.min(rms / 32767, 1.0);
}

module.exports = {
  // Core conversion functions
  convertNativeToDeepgram,
  convertDeepgramToNative,

  // Low-level utilities
  convertLinear16ToMulawBuffer,
  convertMulawToLinear16Buffer,
  resample16kTo8k,
  resample8kTo16k,

  // Helpers
  calculateRMS,
};
