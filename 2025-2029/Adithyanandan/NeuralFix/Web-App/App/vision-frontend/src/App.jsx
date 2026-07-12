import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

/* ── Animated Background Grid ── */
function GridBackground() {
    return (
        <div className="grid-bg" aria-hidden="true">
            <div className="grid-overlay" />
            <div className="glow-orb glow-1" />
            <div className="glow-orb glow-2" />
            <div className="glow-orb glow-3" />
        </div>
    )
}

/* ── Scanning animation during analysis ── */
function ScanLine() {
    return <div className="scan-line" />
}

/* ── Animated LED indicator ── */
function LEDIndicator({ color, blinking }) {
    const colorMap = {
        green: '#22c55e', red: '#ef4444', amber: '#f59e0b',
        off: '#334155', blinking: '#6c63ff',
    }
    const c = colorMap[color] ?? '#334155'
    return (
        <span className="led" style={{
            background: c,
            boxShadow: color === 'off' ? 'none' : `0 0 10px ${c}, 0 0 20px ${c}44`,
            animation: blinking ? 'led-blink 1s step-start infinite' : 'none',
        }} />
    )
}

/* ── Confidence Bar ── */
function ConfidenceBar({ value }) {
    const pct = Math.round((value ?? 0) * 100)
    const color = pct > 70 ? '#22c55e' : pct > 40 ? '#f59e0b' : '#ef4444'
    return (
        <div className="confidence-wrap">
            <div className="confidence-label">
                <span>Confidence</span>
                <span style={{ color }}>{pct}%</span>
            </div>
            <div className="confidence-track">
                <div
                    className="confidence-fill"
                    style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}88` }}
                />
            </div>
        </div>
    )
}

/* ── Result Panel ── */
function ResultPanel({ data, visible }) {
    if (!data) return null
    return (
        <div className={`result-panel ${visible ? 'panel-enter' : ''}`}>
            <div className="panel-header">
                <div>
                    <div className="panel-tag">Analysis Complete</div>
                    <h2 className="panel-title">Equipment Diagnostics</h2>
                </div>
                <ConfidenceBar value={data.confidence} />
            </div>

            {data.error && <div className="error-banner">⚠️ Raw output shown — JSON parse failed</div>}

            <div className="grid-2">
                <InfoCard label="Device Type" value={data.device_type ?? '—'} icon="🖥️" delay="0ms" />
                <InfoCard label="Brand / Model" value={data.brand_model ?? 'Unknown'} icon="🏷️" delay="60ms" />
            </div>

            {data.overall_assessment && (
                <div className="assessment-card stagger-card" style={{ '--delay': '120ms' }}>
                    <span className="card-tag">🔍 Overall Assessment</span>
                    <p className="assessment-text">{data.overall_assessment}</p>
                </div>
            )}

            {data.led_states?.length > 0 && (
                <div className="section stagger-card" style={{ '--delay': '180ms' }}>
                    <span className="section-label">LED States</span>
                    <div className="led-list">
                        {data.led_states.map((led, i) => (
                            <div key={i} className="led-item" style={{ animationDelay: `${i * 40}ms` }}>
                                <LEDIndicator color={led.color} blinking={led.blinking} />
                                <span className="led-label">{led.label}</span>
                                <span className="led-color-chip" data-color={led.color}>{led.color}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {data.unplugged_ports?.length > 0 && (
                <div className="section stagger-card" style={{ '--delay': '240ms' }}>
                    <span className="section-label">Unplugged Ports</span>
                    <div className="tag-list">
                        {data.unplugged_ports.map((p, i) => (
                            <span key={i} className="tag tag-red">{p}</span>
                        ))}
                    </div>
                </div>
            )}

            {data.visible_damage && (
                <div className="damage-card stagger-card" style={{ '--delay': '300ms' }}>
                    <span className="card-tag">⚠️ Visible Damage</span>
                    <p className="damage-text">{data.visible_damage}</p>
                </div>
            )}

            {data.detailed_fix_summary && (
                <div className="fix-summary-section stagger-card" style={{ '--delay': '360ms' }}>
                    <span className="card-tag fix-tag">🛠️ How to Fix This</span>
                    <div className="markdown-body">
                        <ReactMarkdown>{data.detailed_fix_summary}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    )
}

function InfoCard({ label, value, icon, delay }) {
    return (
        <div className="info-card stagger-card" style={{ '--delay': delay }}>
            <span className="info-icon">{icon}</span>
            <span className="info-label">{label}</span>
            <span className="info-value">{value}</span>
        </div>
    )
}

/* ── Chat Bot ── */
function ChatBot({ visionContext, hasResult }) {
    const welcomeMsg = hasResult
        ? 'Equipment analyzed! Ask me anything about the hardware, LED states, or how to fix the issues found.'
        : '👋 Hi! I\'m your NetFix Technical Assistant. Upload a photo of your router, switch, or modem and I\'ll guide you through diagnosing and fixing any issues. You can also ask me general networking questions right now!'
    const [messages, setMessages] = useState([
        { role: 'assistant', content: welcomeMsg }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const chatEndRef = useRef(null)

    // Update greeting when analysis result arrives
    useEffect(() => {
        if (hasResult && messages.length === 1 && messages[0].role === 'assistant') {
            setMessages([{ role: 'assistant', content: 'Equipment analyzed! Ask me anything about the hardware, LED states, or how to fix the issues found.' }])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasResult])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    async function sendMessage(e) {
        e.preventDefault()
        if (!input.trim() || loading) return
        const userMsg = { role: 'user', content: input.trim() }
        const next = [...messages, userMsg]
        setMessages(next)
        setInput('')
        setLoading(true)
        try {
            const res = await fetch('/vision/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: next.map(m => ({ role: m.role, content: m.content })),
                    vision_context: visionContext ?? {}
                })
            })
            if (!res.ok) throw new Error('API Error')
            const data = await res.json()
            setMessages([...next, { role: 'assistant', content: data.reply }])
        } catch {
            setMessages([...next, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="chat-container panel-enter">
            <div className="chat-header">
                <div className="chat-avatar">🤖</div>
                <div>
                    <div className="chat-title">Technical Assistant</div>
                    <div className="chat-sub">Powered by Llama 3.1 · Groq</div>
                </div>
                <div className="chat-status-dot" />
            </div>
            <div className="chat-messages">
                {messages.map((m, i) => (
                    <div key={i} className={`chat-bubble ${m.role}`} style={{ animationDelay: `${i * 30}ms` }}>
                        {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                    </div>
                ))}
                {loading && (
                    <div className="chat-bubble assistant typing">
                        <span className="dot" /><span className="dot" /><span className="dot" />
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendMessage} className="chat-input-area">
                <input
                    type="text"
                    placeholder="Ask about your equipment..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={loading}
                    autoComplete="off"
                />
                <button type="submit" disabled={!input.trim() || loading} className="send-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </form>
        </div>
    )
}

/* ── Main App ── */
export default function App() {
    const [image, setImage] = useState(null)
    const [preview, setPreview] = useState(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [dragging, setDragging] = useState(false)
    const [analysisStage, setAnalysisStage] = useState('')
    const inputRef = useRef()

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return
        setImage(file)
        setPreview(URL.createObjectURL(file))
        setResult(null)
        setError(null)
    }

    const onDrop = useCallback((e) => {
        e.preventDefault()
        setDragging(false)
        handleFile(e.dataTransfer.files[0])
    }, [])

    async function analyse() {
        if (!image) return
        setLoading(true)
        setResult(null)
        setError(null)
        setAnalysisStage('🦙 Scanning with LLaVA vision model...')

        try {
            const form = new FormData()
            form.append('file', image)

            // Fake stage updates while waiting
            const stages = [
                '🦙 Scanning with LLaVA vision model...',
                '📡 Detecting device & LED states...',
                '⚡ Generating fix guide with Groq...',
                '✅ Wrapping up the analysis...'
            ]
            let stageIdx = 0
            const timer = setInterval(() => {
                stageIdx = (stageIdx + 1) % stages.length
                setAnalysisStage(stages[stageIdx])
            }, 2000)

            const res = await fetch('/vision/analyse', { method: 'POST', body: form })
            clearInterval(timer)

            if (!res.ok) throw new Error(`Server error: ${res.status} ${res.statusText}`)
            const json = await res.json()
            setResult(json)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
            setAnalysisStage('')
        }
    }

    return (
        <div className="app">
            <GridBackground />

            {/* Header */}
            <header className="header">
                <div className="header-inner">
                    <div className="logo">
                        <div className="logo-icon-wrap">
                            <span className="logo-icon">🔭</span>
                            <div className="logo-pulse" />
                        </div>
                        <div>
                            <span className="logo-text">NetFix <strong>Vision</strong></span>
                            <span className="logo-version">v2.0</span>
                        </div>
                    </div>
                    <nav className="header-nav">
                        <span className="nav-pill">🟢 Backend Online</span>
                        <span className="nav-pill dim">LLaVA + Groq</span>
                    </nav>
                </div>
            </header>

            <main className="main">
                {/* Hero */}
                <div className="hero">
                    <div className="hero-badge">AI-Powered Diagnostics</div>
                    <h1 className="hero-title">
                        Diagnose Network<br />
                        <span className="gradient-text">Equipment Instantly</span>
                    </h1>
                    <p className="hero-subtitle">
                        Drop a photo of your device. Our hybrid AI pipeline will analyze the hardware and generate a detailed fix guide in seconds.
                    </p>
                </div>

                {/* Upload Zone */}
                <div
                    className={`upload-zone ${dragging ? 'dragging' : ''} ${preview ? 'has-preview' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => !preview && inputRef.current.click()}
                >
                    {loading && <ScanLine />}
                    <input
                        ref={inputRef} type="file" accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => handleFile(e.target.files[0])}
                    />
                    {preview ? (
                        <div className="preview-container">
                            <img src={preview} alt="Preview" className="preview-img" />
                            {loading && <div className="scan-overlay"><div className="scan-beam" /></div>}
                            <button className="change-btn" onClick={e => { e.stopPropagation(); inputRef.current.click() }}>
                                Change Image
                            </button>
                        </div>
                    ) : (
                        <div className="upload-placeholder">
                            <div className="upload-icon-wrap">
                                <div className="upload-icon">📷</div>
                                <div className="upload-icon-ring" />
                            </div>
                            <p className="upload-title">Drop your equipment photo here</p>
                            <p className="upload-sub">Supports JPG, PNG, WEBP · Routers, Switches, Modems</p>
                            <div className="upload-hint">or <span className="upload-link">click to browse</span></div>
                        </div>
                    )}
                </div>

                {/* Analyse Button */}
                <button
                    className={`analyse-btn ${loading ? 'loading' : ''} ${image ? 'ready' : ''}`}
                    onClick={analyse}
                    disabled={!image || loading}
                >
                    {loading ? (
                        <div className="btn-loading">
                            <div className="btn-spinner" />
                            <span>{analysisStage}</span>
                        </div>
                    ) : (
                        <div className="btn-content">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            Analyse Equipment
                        </div>
                    )}
                </button>

                {error && (
                    <div className="error-card">
                        <span className="error-icon">⚠️</span>
                        <div>
                            <strong>Analysis Failed</strong>
                            <p>{error}</p>
                        </div>
                    </div>
                )}

                {/* Results */}
                <ResultPanel data={result} visible={!!result} />

                {/* Chatbot — always visible to guide the user */}
                <ChatBot visionContext={result ?? {}} hasResult={!!result && !result.error} />
            </main>

            <footer className="footer">
                <span>NetFix Vision · Built with LLaVA + Groq + React</span>
            </footer>
        </div>
    )
}
