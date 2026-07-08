/**
 * utils/tts.js
 *
 * WHY THIS FILE EXISTS:
 * ASHA workers may be low-literacy. This file wraps react-native-tts so any
 * screen can trigger a Hindi voice readout of the risk message with one call.
 * The readout uses the cached offline TTS engine so NO internet is needed.
 */

import Tts from 'react-native-tts';

// Set the language to Hindi once at module load.
// Falls back to English if Hindi voice pack is not installed on device.
Tts.setDefaultLanguage('hi-IN');
Tts.setDefaultRate(0.5);   // slower for clarity in noisy village environments
Tts.setDefaultPitch(1.0);

/**
 * speak(text, language)
 * Speaks the given string.
 * @param {string} text     - The text to speak
 * @param {string} language - 'hi-IN' | 'en-IN' (default: 'hi-IN')
 */
export const speak = async (text, language = 'hi-IN') => {
  try {
    await Tts.stop();                     // stop any in-progress speech first
    Tts.setDefaultLanguage(language);
    Tts.speak(text);
  } catch (e) {
    console.warn('TTS error:', e.message);
  }
};

/**
 * stop()
 * Stops ongoing speech — called when user navigates away from risk card.
 */
export const stopSpeech = () => {
  try { Tts.stop(); } catch (_) {}
};
