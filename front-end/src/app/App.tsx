import React, { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, BookOpen, Sparkles, Volume2, Hand, Play, Square } from "lucide-react";

// ─── Theme ────────────────────────────────────────────────────────────────────
const ACCENT       = "#2563EB";
const ACCENT_SOFT  = "rgba(37, 99, 235, 0.08)";
const ACCENT_LIGHT = "#DBEAFE";
const BG           = "#F8FAFC";
const SURFACE      = "#FFFFFF";
const BORDER       = "rgba(15, 23, 42, 0.07)";
const TEXT         = "#0F172A";
const TEXT_MUTED   = "rgba(15, 23, 42, 0.50)";
const RED          = "#EF4444";

// ─── Sign Pose Type ───────────────────────────────────────────────────────────
interface SignPose {
  lx: number; ly: number;   // left hand x/y
  rx: number; ry: number;   // right hand x/y
  mouth: string;            // SVG path for mouth expression
}

// ─── Sign Library: 35+ ASL vocabulary poses ───────────────────────────────────
// Hand coordinate system: avatar is 280 wide, 340 tall.
// Neutral resting position: lx=80 ly=240 | rx=200 ry=240
const SIGN_LIBRARY: Record<string, SignPose> = {
  // --- Default / Greeting ---
  READY:      { lx: 80,  ly: 240, rx: 225, ry: 75,  mouth: "M 125 122 Q 140 136 155 122" },
  HELLO:      { lx: 80,  ly: 240, rx: 225, ry: 75,  mouth: "M 125 121 Q 140 137 155 121" },
  // --- Pronouns ---
  I:          { lx: 80,  ly: 240, rx: 140, ry: 165, mouth: "M 125 124 Q 140 131 155 124" },
  YOU:        { lx: 80,  ly: 240, rx: 215, ry: 142, mouth: "M 125 124 Q 140 131 155 124" },
  WE:         { lx: 110, ly: 185, rx: 175, ry: 165, mouth: "M 125 124 Q 140 131 155 124" },
  THEY:       { lx: 80,  ly: 240, rx: 220, ry: 155, mouth: "M 125 124 Q 140 131 155 124" },
  // --- Core Actions ---
  WANT:       { lx: 90,  ly: 170, rx: 190, ry: 170, mouth: "M 125 124 Q 140 131 155 124" },
  NEED:       { lx: 92,  ly: 175, rx: 195, ry: 172, mouth: "M 125 124 Q 140 131 155 124" },
  LIKE:       { lx: 80,  ly: 240, rx: 148, ry: 148, mouth: "M 125 122 Q 140 135 155 122" },
  LOVE:       { lx: 128, ly: 158, rx: 152, ry: 153, mouth: "M 125 120 Q 140 137 155 120" },
  HELP:       { lx: 115, ly: 190, rx: 155, ry: 178, mouth: "M 125 124 Q 140 131 155 124" },
  STOP:       { lx: 118, ly: 182, rx: 158, ry: 162, mouth: "M 125 124 Q 140 130 155 124" },
  GO:         { lx: 80,  ly: 240, rx: 218, ry: 138, mouth: "M 125 124 Q 140 131 155 124" },
  COME:       { lx: 120, ly: 165, rx: 160, ry: 158, mouth: "M 125 124 Q 140 131 155 124" },
  SEE:        { lx: 80,  ly: 240, rx: 155, ry: 90,  mouth: "M 125 123 Q 140 133 155 123" },
  WORK:       { lx: 105, ly: 185, rx: 175, ry: 175, mouth: "M 125 124 Q 140 131 155 124" },
  LEARN:      { lx: 80,  ly: 240, rx: 140, ry: 75,  mouth: "M 125 122 Q 140 135 155 122" },
  // --- Language & Knowledge ---
  SIGN:       { lx: 95,  ly: 160, rx: 185, ry: 160, mouth: "M 125 124 Q 140 131 155 124" },
  LANGUAGE:   { lx: 95,  ly: 175, rx: 185, ry: 175, mouth: "M 125 124 Q 140 131 155 124" },
  KNOW:       { lx: 80,  ly: 240, rx: 148, ry: 82,  mouth: "M 125 124 Q 140 131 155 124" },
  UNDERSTAND: { lx: 80,  ly: 240, rx: 148, ry: 85,  mouth: "M 125 123 Q 140 133 155 123" },
  // --- Responses ---
  YES:        { lx: 80,  ly: 240, rx: 158, ry: 112, mouth: "M 125 121 Q 140 136 155 121" },
  NO:         { lx: 80,  ly: 240, rx: 188, ry: 93,  mouth: "M 130 129 Q 140 121 150 129" },
  GOOD:       { lx: 80,  ly: 240, rx: 182, ry: 126, mouth: "M 125 120 Q 140 137 155 120" },
  BAD:        { lx: 80,  ly: 240, rx: 172, ry: 135, mouth: "M 131 129 Q 140 121 149 129" },
  PLEASE:     { lx: 80,  ly: 240, rx: 140, ry: 156, mouth: "M 125 122 Q 140 134 155 122" },
  THANK:      { lx: 80,  ly: 240, rx: 165, ry: 116, mouth: "M 125 122 Q 140 135 155 122" },
  MORE:       { lx: 105, ly: 178, rx: 175, ry: 178, mouth: "M 125 124 Q 140 131 155 124" },
  // --- Questions ---
  WHAT:       { lx: 90,  ly: 188, rx: 192, ry: 188, mouth: "M 128 126 Q 140 129 152 126" },
  WHERE:      { lx: 80,  ly: 240, rx: 172, ry: 106, mouth: "M 128 126 Q 140 129 152 126" },
  WHO:        { lx: 80,  ly: 240, rx: 145, ry: 102, mouth: "M 128 126 Q 140 129 152 126" },
  // --- Nouns / Vocabulary ---
  NAME:       { lx: 118, ly: 168, rx: 162, ry: 158, mouth: "M 125 124 Q 140 131 155 124" },
  HOME:       { lx: 80,  ly: 240, rx: 148, ry: 116, mouth: "M 125 122 Q 140 134 155 122" },
  SCHOOL:     { lx: 105, ly: 175, rx: 165, ry: 162, mouth: "M 125 123 Q 140 133 155 123" },
  FOOD:       { lx: 80,  ly: 240, rx: 145, ry: 125, mouth: "M 125 124 Q 140 131 155 124" },
  WATER:      { lx: 80,  ly: 240, rx: 150, ry: 130, mouth: "M 125 124 Q 140 131 155 124" },
  TODAY:      { lx: 100, ly: 198, rx: 182, ry: 198, mouth: "M 125 124 Q 140 131 155 124" },
  TOMORROW:   { lx: 80,  ly: 240, rx: 178, ry: 108, mouth: "M 125 124 Q 140 131 155 124" },
  TIME:       { lx: 98,  ly: 192, rx: 138, ry: 188, mouth: "M 125 124 Q 140 131 155 124" },
};

// ─── Educational Categories ───────────────────────────────────────────────────
const CATEGORIES: Record<string, string[]> = {
  "Greetings":  ["HELLO", "GOOD", "PLEASE", "THANK", "LOVE", "YES", "NO"],
  "Pronouns":   ["I", "YOU", "WE", "THEY"],
  "Actions":    ["WANT", "NEED", "LEARN", "HELP", "STOP", "GO", "COME", "SEE", "WORK", "SIGN", "LIKE"],
  "Knowledge":  ["KNOW", "UNDERSTAND", "LEARN", "SIGN", "LANGUAGE"],
  "Questions":  ["WHAT", "WHERE", "WHO", "TIME"],
  "Vocabulary": ["NAME", "HOME", "SCHOOL", "FOOD", "WATER", "TODAY", "TOMORROW", "MORE"],
};

const DEFAULT_POSE: SignPose = { lx: 80, ly: 240, rx: 200, ry: 240, mouth: "M 125 125 Q 140 131 155 125" };
function getPose(token: string): SignPose {
  return SIGN_LIBRARY[token.toUpperCase()] ?? DEFAULT_POSE;
}

const MS_PER_TOKEN = 850; // milliseconds each sign is held before advancing

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]             = useState<"translator" | "studio">("translator");
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState("Click 'Start Listening' and speak to translate to ASL...");
  const [aslGloss, setAslGloss]     = useState("");           // full gloss sentence
  const [tokenList, setTokenList]   = useState<string[]>(["READY"]);
  const [tokenIndex, setTokenIndex] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0);
  // Studio state
  const [studioCategory, setStudioCategory] = useState("Greetings");
  const [studioSign, setStudioSign]         = useState("HELLO");
  const [practiceActive, setPracticeActive] = useState(false);

  const socketRef       = useRef<WebSocket | null>(null);
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const animTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const practiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── WebSocket connection ────────────────────────────────────────────────────
  useEffect(() => {
    const BACKEND = "fluently-backend-dsft.onrender.com";
    const socket  = new WebSocket(`wss://${BACKEND}/ws/communication-bridge`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "transcription") {
          setSpokenText(msg.data.text);
        }
        if (msg.event === "animate_avatar") {
          const gloss = (msg.data as string).trim().toUpperCase();
          setAslGloss(gloss);
          const tokens = gloss.split(/\s+/).filter(Boolean);
          setTokenList(tokens.length ? tokens : ["READY"]);
          setTokenIndex(0);
        }
      } catch { /* ignore malformed frames */ }
    };

    return () => socket.close();
  }, []);

  // ── Token-by-token animation ────────────────────────────────────────────────
  useEffect(() => {
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    if (!tokenList.length) return;
    setTokenIndex(0);

    let idx = 0;
    animTimerRef.current = setInterval(() => {
      idx++;
      if (idx < tokenList.length) {
        setTokenIndex(idx);
      } else {
        clearInterval(animTimerRef.current!);
      }
    }, MS_PER_TOKEN);

    return () => { if (animTimerRef.current) clearInterval(animTimerRef.current); };
  }, [tokenList]);

  // ── Studio practice mode: auto-cycle through category signs ────────────────
  useEffect(() => {
    if (practiceTimerRef.current) clearInterval(practiceTimerRef.current);
    if (!practiceActive) return;

    const signs = CATEGORIES[studioCategory] ?? [];
    let i = 0;
    setStudioSign(signs[0]);
    practiceTimerRef.current = setInterval(() => {
      i = (i + 1) % signs.length;
      setStudioSign(signs[i]);
    }, 1400);

    return () => { if (practiceTimerRef.current) clearInterval(practiceTimerRef.current); };
  }, [practiceActive, studioCategory]);

  // ── Mic recording ──────────────────────────────────────────────────────────
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
      setAudioVolume(0);
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsRecording(true);

      // NOTE: ScriptProcessorNode is deprecated but widely supported.
      // Migrate to AudioWorklet when targeting bleeding-edge browsers only.
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(ctx.destination);

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const trackVol = () => {
        if (ctx.state === "closed") return;
        analyser.getByteFrequencyData(freqData);
        const avg = freqData.reduce((s, v) => s + v, 0) / freqData.length;
        setAudioVolume(avg / 120);
        requestAnimationFrame(trackVol);
      };
      trackVol();

      processor.onaudioprocess = (e) => {
        if (socketRef.current?.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        // Convert float32 -> int16 (pcm_s16le) to match Speechmatics encoding setting.
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, input[i] * 32767));
        }
        const b64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
        socketRef.current.send(JSON.stringify({ type: "audio_chunk", audio: b64 }));
      };
    } catch (err) {
      console.error("Mic access failed:", err);
    }
  }, [isRecording]);

  const activeToken   = tokenList[tokenIndex] ?? "READY";
  const activePose    = getPose(view === "studio" ? studioSign : activeToken);
  const displaySign   = view === "studio" ? studioSign : activeToken;

  return (
    <div style={{ backgroundColor: BG, color: TEXT, fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}
      className="w-full min-h-screen flex flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: ACCENT }}>F</div>
          <span className="font-bold text-xl tracking-tight">
            Fluently
            <span className="text-xs font-normal text-blue-600 px-2 py-0.5 rounded-full bg-blue-50 ml-2 border border-blue-100">
              Sign Studio
            </span>
          </span>
        </div>

        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setView("translator")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === "translator"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles size={15} /> Real-Time Translator
          </button>
          <button
            onClick={() => { setView("studio"); setPracticeActive(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === "studio"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen size={15} /> Learning Studio
          </button>
        </nav>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 flex-1 max-w-7xl w-full mx-auto">

        {/* Left: Avatar Panel — shared across both views */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border shadow-sm flex flex-col items-center justify-center relative"
            style={{ borderColor: BORDER, minHeight: 460 }}>

            {/* Status badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {view === "studio" ? "Sign Preview" : "ASL Avatar"}
              </span>
            </div>

            <SignAvatar pose={activePose} />

            {/* Token progress row — only shown in translator view */}
            {view === "translator" && tokenList.length > 0 && (
              <div className="w-full px-6 pb-2">
                <div className="flex flex-wrap gap-2 justify-center">
                  {tokenList.map((tok, i) => (
                    <span key={i} className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide transition-all duration-300 ${
                      i === tokenIndex
                        ? "bg-blue-600 text-white scale-110 shadow-md"
                        : i < tokenIndex
                        ? "bg-slate-200 text-slate-400"
                        : "bg-blue-50 text-blue-400 border border-blue-100"
                    }`}>{tok}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Active sign label */}
            <div className="w-full mx-4 mb-4 px-4">
              <div className="bg-slate-950 text-slate-200 px-5 py-3 rounded-xl font-mono text-center text-sm shadow-inner">
                <span className="text-blue-400 font-bold mr-2">SIGNING ›</span> {displaySign}
              </div>
            </div>
          </div>
        </section>

        {/* Right: Translator Controls OR Learning Studio */}
        <section className="lg:col-span-5 flex flex-col gap-5">

          {view === "translator" ? (
            <>
              {/* Voice Capture Card */}
              <div className="bg-white rounded-2xl border p-6 shadow-sm flex flex-col gap-4" style={{ borderColor: BORDER }}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Volume2 size={14} className="text-blue-600" /> Voice Capture
                </h3>

                <button
                  onClick={toggleRecording}
                  className={`w-full py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 shadow-sm text-sm ${
                    isRecording
                      ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                  {isRecording ? "Stop Translation Session" : "Start Listening & Translate"}
                </button>

                <div className="h-20 bg-slate-50 rounded-xl border border-slate-100 px-4 flex items-center justify-center">
                  <Waveform volume={audioVolume} />
                </div>
              </div>

              {/* Transcript Card */}
              <div className="bg-white rounded-2xl border p-6 shadow-sm flex-1 flex flex-col gap-3" style={{ borderColor: BORDER }}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">English Transcript</h3>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex-1 min-h-28">
                  <p className="text-base text-slate-700 font-medium leading-relaxed">{spokenText}</p>
                </div>
                {aslGloss && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">ASL Gloss Output</p>
                    <p className="text-sm text-blue-800 font-mono font-semibold">{aslGloss}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            // ── Learning Studio ────────────────────────────────────────────
            <>
              {/* Category selector */}
              <div className="bg-white rounded-2xl border p-5 shadow-sm" style={{ borderColor: BORDER }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Hand size={14} className="text-blue-600" /> Sign Dictionary
                  </h3>
                  {/* Practice mode toggle */}
                  <button
                    onClick={() => setPracticeActive(p => !p)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      practiceActive
                        ? "bg-red-50 text-red-600 border border-red-200"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {practiceActive ? <><Square size={12}/> Stop</> : <><Play size={12}/> Practice Mode</>}
                  </button>
                </div>

                {/* Category tabs */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.keys(CATEGORIES).map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setStudioCategory(cat); setPracticeActive(false); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        studioCategory === cat
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                    >{cat}</button>
                  ))}
                </div>

                {/* Sign cards grid */}
                <div className="grid grid-cols-3 gap-2">
                  {(CATEGORIES[studioCategory] ?? []).map(sign => (
                    <button
                      key={sign}
                      onClick={() => { setStudioSign(sign); setPracticeActive(false); }}
                      className={`rounded-xl p-3 text-center transition-all border font-bold text-sm ${
                        studioSign === sign
                          ? "bg-blue-600 text-white border-blue-600 shadow-md scale-105"
                          : "bg-slate-50 text-slate-700 border-slate-100 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      <span className="block text-lg mb-0.5">🤟</span>
                      {sign}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sign info card */}
              <div className="bg-white rounded-2xl border p-5 shadow-sm flex-1" style={{ borderColor: BORDER }}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Currently Viewing</h3>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-2xl font-black text-blue-700 tracking-tight mb-1">{studioSign}</p>
                  <p className="text-xs text-blue-500 font-medium">
                    {SIGN_LIBRARY[studioSign]
                      ? "Sign mapped — avatar is performing this gesture."
                      : "Sign not yet in library — showing neutral pose."}
                  </p>
                </div>
                <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                  Click any sign card above to animate the avatar. Use <strong>Practice Mode</strong> to auto-cycle through 
                  all signs in this category and build muscle memory for recognition.
                </p>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

// ─── SVG Avatar ───────────────────────────────────────────────────────────────
function SignAvatar({ pose }: { pose: SignPose }) {
  const { lx, ly, rx, ry, mouth } = pose;

  return (
    <svg
      width="300" height="320"
      viewBox="0 0 280 340"
      fill="none"
      style={{ transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    >
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <radialGradient id="skin" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#FDDCCA" />
          <stop offset="100%" stopColor="#F4A97A" />
        </radialGradient>
      </defs>

      {/* Ambient halo */}
      <circle cx="140" cy="108" r="88"
        fill="rgba(37,99,235,0.03)"
        stroke="#2563EB" strokeOpacity="0.12" strokeWidth="1.5" />

      {/* Head */}
      <ellipse cx="140" cy="100" rx="44" ry="53"
        fill="url(#skin)" stroke="#E8A070" strokeWidth="1.5" />

      {/* Eyes */}
      <circle cx="124" cy="94" r="4" fill="#1E293B" />
      <circle cx="156" cy="94" r="4" fill="#1E293B" />
      <circle cx="126" cy="92" r="1.5" fill="white" />
      <circle cx="158" cy="92" r="1.5" fill="white" />

      {/* Mouth — animated via pose */}
      <path d={mouth} stroke="#5B3A29" strokeWidth="2.5" fill="none"
        style={{ transition: "d 0.3s ease" }} />

      {/* Body */}
      <path d="M 72 212 Q 72 192 92 187 L 188 187 Q 208 192 208 212 L 218 340 L 62 340 Z"
        fill="url(#body)" />

      {/* Neck */}
      <rect x="122" y="148" width="36" height="42" rx="6" fill="#F4A97A" />

      {/* Left arm */}
      <path
        d={`M 82 206 Q 62 192 ${lx} ${ly}`}
        stroke="#3B82F6" strokeWidth="20" strokeLinecap="round"
        style={{ transition: "d 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
      {/* Left hand */}
      <circle cx={lx} cy={ly} r="13" fill="url(#skin)" stroke="#E8A070" strokeWidth="1.5"
        style={{ transition: "cx 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), cy 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />

      {/* Right arm */}
      <path
        d={`M 198 206 Q 218 192 ${rx} ${ry}`}
        stroke="#3B82F6" strokeWidth="20" strokeLinecap="round"
        style={{ transition: "d 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
      {/* Right hand */}
      <circle cx={rx} cy={ry} r="13" fill="url(#skin)" stroke="#E8A070" strokeWidth="1.5"
        style={{ transition: "cx 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), cy 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
    </svg>
  );
}

// ─── Live Waveform ────────────────────────────────────────────────────────────
function Waveform({ volume }: { volume: number }) {
  return (
    <div className="w-full flex items-center gap-[2px]" style={{ height: 56 }}>
      {Array.from({ length: 48 }, (_, i) => {
        const x   = i / 48;
        const env = Math.sin(x * Math.PI);
        const osc = Math.sin(x * Math.PI * 9 + Date.now() / 300) * 0.3 + 0.7;
        const h   = Math.max(0.06, volume * osc * env);
        return (
          <div key={i} className="flex-1 rounded-full transition-all duration-75"
            style={{
              height:          `${h * 100}%`,
              minHeight:       3,
              backgroundColor: volume > 0.02 ? ACCENT : "#E2E8F0",
            }} />
        );
      })}
    </div>
  );
}