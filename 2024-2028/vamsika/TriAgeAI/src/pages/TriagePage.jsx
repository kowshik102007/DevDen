import { useState, useRef } from 'react';
import { useTriage } from '../context/TriageContext';
import { analyzeTriageText, analyzeTriageImage, getHospitalRecommendation } from '../services/geminiService';
import { Mic, MicOff, Camera, Upload, Send, Sparkles, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

export default function TriagePage() {
  const { addPatient, hospitals } = useTriage();
  const [mode, setMode] = useState('text'); // text | voice | photo
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('unknown');
  const [saved, setSaved] = useState(false);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Voice recording — uses Web Speech API directly
  const startRecording = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    try {
      // Request mic permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // Release immediately, we just needed permission

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      let finalTranscript = '';
      
      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setDescription(finalTranscript.trim() + (interim ? ' ' + interim : ''));
      };
      
      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        if (e.error === 'not-allowed') {
          alert('Microphone permission denied. Please allow microphone access.');
        }
      };

      recognition.onend = () => {
        // If still recording, restart (Chrome stops after silence)
        if (isRecording && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch(e) {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      setDescription(''); // Clear previous text
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Could not access microphone. Please check permissions in your browser settings.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
    }
  };

  // Photo handling
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      // Extract base64 data (remove the data:image/...;base64, prefix)
      setImageBase64(ev.target.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  // Run AI analysis
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setAiResult(null);
    setSaved(false);

    try {
      let result;
      if (mode === 'photo' && imageBase64) {
        result = await analyzeTriageImage(imageBase64, imageMime);
      } else if (description.trim()) {
        result = await analyzeTriageText(description);
      } else {
        alert('Please provide a description or image to analyze.');
        setIsAnalyzing(false);
        return;
      }
      setAiResult(result);
    } catch (err) {
      console.error('Analysis failed:', err);
      setAiResult({ error: true, message: 'Analysis failed. Please try again.' });
    }
    setIsAnalyzing(false);
  };

  // Save patient
  const savePatient = async () => {
    if (!aiResult || aiResult.error) return;

    const hospitalRec = await getHospitalRecommendation(aiResult, hospitals);
    const hospital = hospitals.find(h => h.id === hospitalRec.recommendedHospitalId);

    addPatient({
      name: patientName || 'Unknown',
      age: patientAge || 'Unknown',
      gender: patientGender,
      description: description,
      severity: aiResult.severity,
      severityLabel: aiResult.severityLabel,
      confidence: aiResult.confidence,
      assessment: aiResult.assessment,
      injuryType: aiResult.injuryType,
      priorityScore: aiResult.priorityScore,
      needsSurgery: aiResult.needsSurgery,
      needsBlood: aiResult.needsBlood,
      recommendedSpecialty: aiResult.recommendedSpecialty,
      recommendedActions: aiResult.recommendedActions,
      assignedHospital: hospital?.name || 'Pending',
      hospitalRouting: hospitalRec.reasoning,
      inputMode: mode,
    });

    setSaved(true);
    // Reset after brief delay
    setTimeout(() => {
      setDescription('');
      setAiResult(null);
      setImagePreview(null);
      setImageBase64(null);
      setPatientName('');
      setPatientAge('');
      setPatientGender('unknown');
      setSaved(false);
    }, 2000);
  };

  const severityColors = {
    red: { bg: 'var(--severity-red-bg)', color: 'var(--severity-red)', label: '🔴 IMMEDIATE — Life Threatening' },
    yellow: { bg: 'var(--severity-yellow-bg)', color: 'var(--severity-yellow)', label: '🟡 DELAYED — Serious but Stable' },
    green: { bg: 'var(--severity-green-bg)', color: 'var(--severity-green)', label: '🟢 MINOR — Walking Wounded' },
    black: { bg: 'var(--severity-black-bg)', color: 'var(--severity-black)', label: '⚫ DECEASED — No Signs of Life' },
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" id="triage-title">AI-Powered Triage</h1>
          <p className="page-subtitle">Describe or photograph injuries — Gemini AI will classify severity</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Input Section */}
        <div className="card">
          {/* Mode tabs */}
          <div className="tabs">
            <button className={`tab ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')} id="tab-text">
              ✍️ Text
            </button>
            <button className={`tab ${mode === 'voice' ? 'active' : ''}`} onClick={() => setMode('voice')} id="tab-voice">
              🎙️ Voice
            </button>
            <button className={`tab ${mode === 'photo' ? 'active' : ''}`} onClick={() => setMode('photo')} id="tab-photo">
              📸 Photo
            </button>
          </div>

          {/* Patient Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="Patient name" value={patientName} onChange={e => setPatientName(e.target.value)} id="patient-name" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Age</label>
              <input className="form-input" placeholder="Age" value={patientAge} onChange={e => setPatientAge(e.target.value)} id="patient-age" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Gender</label>
              <select className="form-select" value={patientGender} onChange={e => setPatientGender(e.target.value)} id="patient-gender">
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Text Mode */}
          {mode === 'text' && (
            <div className="form-group">
              <label className="form-label">Injury Description</label>
              <textarea
                className="form-textarea"
                placeholder="Describe the patient's injuries, condition, consciousness level, visible wounds, breathing status..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={6}
                id="injury-description"
              />
            </div>
          )}

          {/* Voice Mode */}
          {mode === 'voice' && (
            <div className="voice-recorder">
              <button
                className={`record-btn ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                id="record-btn"
              >
                {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
              </button>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>
                {isRecording ? (
                  <span style={{ color: 'var(--severity-red)', fontWeight: 600 }}>
                    ● Recording... Click to stop
                  </span>
                ) : 'Click to start voice description'}
              </div>
              {description && (
                <div style={{ width: '100%' }}>
                  <label className="form-label">Transcription</label>
                  <textarea
                    className="form-textarea"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>
              )}
            </div>
          )}

          {/* Photo Mode */}
          {mode === 'photo' && (
            <div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {!imagePreview ? (
                <div className="upload-area" onClick={() => fileInputRef.current?.click()} id="photo-upload">
                  <div className="upload-icon">📸</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                    Upload Injury Photo
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Click to upload or take a photo • Gemini Vision will analyze
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <img src={imagePreview} alt="Injury" className="preview-image" />
                  <div style={{ marginTop: 12 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => { setImagePreview(null); setImageBase64(null); }}>
                      Remove & Re-upload
                    </button>
                  </div>
                </div>
              )}
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Additional Notes (Optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Any additional context about the patient..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Analyze button */}
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            onClick={runAnalysis}
            disabled={isAnalyzing}
            id="analyze-btn"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={18} className="spinner" style={{ border: 'none', animation: 'spin 0.8s linear infinite' }} />
                Gemini is analyzing...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Analyze with Gemini AI
              </>
            )}
          </button>
        </div>

        {/* AI Result Section */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--accent-cyan)" />
            AI Assessment
          </h2>

          {isAnalyzing && (
            <div className="ai-thinking">
              <div className="spinner"></div>
              <div>
                Gemini is analyzing patient data
                <span className="dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            </div>
          )}

          {!aiResult && !isAnalyzing && (
            <div className="empty-state">
              <div className="empty-state-icon">🤖</div>
              <div className="empty-state-text">Awaiting Input</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Provide injury details via text, voice, or photo and click "Analyze with Gemini AI"
              </div>
            </div>
          )}

          {aiResult && !aiResult.error && (
            <div className="fade-in">
              {/* Severity Banner */}
              <div style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                background: severityColors[aiResult.severity]?.bg,
                border: `1px solid ${severityColors[aiResult.severity]?.color}40`,
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: severityColors[aiResult.severity]?.color }}>
                  {severityColors[aiResult.severity]?.label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Confidence: {Math.round((aiResult.confidence || 0) * 100)}% • Priority Score: {aiResult.priorityScore}/10
                </div>
              </div>

              {/* Assessment */}
              <div className="ai-result">
                <div className="ai-result-header">
                  <Sparkles size={14} /> Medical Assessment
                </div>
                <div className="ai-result-content">{aiResult.assessment}</div>
              </div>

              {/* Injury & Specialty */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div className="ai-result" style={{ marginTop: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                    Injury Type
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{aiResult.injuryType}</div>
                </div>
                <div className="ai-result" style={{ marginTop: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                    Recommended Specialty
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{aiResult.recommendedSpecialty}</div>
                </div>
              </div>

              {/* Flags */}
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                {aiResult.needsSurgery && (
                  <span className="badge badge-red">🔪 Surgery Required</span>
                )}
                {aiResult.needsBlood && (
                  <span className="badge badge-red">🩸 Blood Transfusion</span>
                )}
              </div>

              {/* Recommended Actions */}
              {aiResult.recommendedActions?.length > 0 && (
                <div className="ai-result" style={{ marginTop: 12 }}>
                  <div className="ai-result-header">
                    <AlertTriangle size={14} /> Recommended Actions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {aiResult.recommendedActions.map((action, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--accent-blue)', fontWeight: 700, minWidth: 20 }}>{i + 1}.</span>
                        {action}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save button */}
              <button
                className={`btn ${saved ? 'btn-outline' : 'btn-primary'} btn-lg`}
                style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}
                onClick={savePatient}
                disabled={saved}
                id="save-patient-btn"
              >
                {saved ? (
                  <>
                    <CheckCircle size={18} /> Patient Saved & Routed
                  </>
                ) : (
                  <>
                    <Send size={18} /> Save Patient & Route to Hospital
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
