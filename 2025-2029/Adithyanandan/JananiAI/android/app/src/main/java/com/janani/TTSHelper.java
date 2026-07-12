package com.janani;

import android.content.Context;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import java.util.Locale;
import java.util.HashMap;
import java.util.Map;

public class TTSHelper implements TextToSpeech.OnInitListener {
    private TextToSpeech tts;
    private boolean isInitialized = false;
    private boolean isHindiAvailable = false;
    private Context context;
    private TextToSpeech.OnUtteranceProgressListener listener;

    public TTSHelper(Context context) {
        this.context = context;
        tts = new TextToSpeech(context, this);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            isInitialized = true;

            // Try to set Hindi locale
            int hindiResult = tts.setLanguage(new Locale("hi", "IN"));
            if (hindiResult == TextToSpeech.LANG_AVAILABLE) {
                isHindiAvailable = true;
                Log.d("TTSHelper", "Hindi TTS available");
            } else {
                // Fallback to English
                tts.setLanguage(Locale.ENGLISH);
                isHindiAvailable = false;
                Log.d("TTSHelper", "Hindi TTS not available, using English");
            }

            tts.setSpeechRate(0.85f);
            tts.setPitch(1.0f);
        } else {
            Log.e("TTSHelper", "TTS initialization failed");
        }
    }

    public void speakRiskCard(String riskLabel, String topReason) {
        if (!isInitialized) {
            Log.w("TTSHelper", "TTS not initialized yet");
            return;
        }

        String message;
        if ("HIGH".equals(riskLabel)) {
            message = "Khatra! Uchch jokhim. " + topReason;
        } else if ("MODERATE".equals(riskLabel)) {
            message = "Dhyan. Madhyam jokhim. " + topReason;
        } else {
            message = "Swasthya. Nich jokhim. Aap theek hain.";
        }

        speak(message);
    }

    public void speak(String text) {
        if (!isInitialized) {
            Log.w("TTSHelper", "TTS not initialized");
            return;
        }

        if (isHindiAvailable) {
            tts.setLanguage(new Locale("hi", "IN"));
        } else {
            tts.setLanguage(Locale.ENGLISH);
        }

        Map<String, String> params = new HashMap<>();
        params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "risk_card_utterance");

        if (listener != null) {
            tts.setOnUtteranceProgressListener(listener);
        }

        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "risk_card_utterance");
    }

    public void setOnUtteranceProgressListener(TextToSpeech.OnUtteranceProgressListener listener) {
        this.listener = listener;
    }

    public boolean isHindiAvailable() {
        return isHindiAvailable;
    }

    public boolean isInitialized() {
        return isInitialized;
    }

    public void shutdown() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
    }
}