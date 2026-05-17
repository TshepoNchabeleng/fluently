import React, { useEffect, useRef, useState } from "react";
import { Mic, Video, VideoOff } from "lucide-react";

const ACCENT = "#2563EB";
const ACCENT_SOFT = "rgba(37, 99, 235, 0.1)";
const ACCENT_BORDER = "rgba(37, 99, 235, 0.35)";
const BG = "#EEF3FA";
const SURFACE = "#FFFFFF";
const SURFACE_ALT = "#F7FAFD";
const BORDER = "rgba(15, 23, 42, 0.08)";
const TEXT = "#0F172A";
const TEXT_MUTED = "rgba(15, 23, 42, 0.55)";
const TEXT_FAINT = "rgba(15, 23, 42, 0.4)";

export default function App() {
  // --- WebSocket & Device Tracking State Streams ---
  const [translationText, setTranslationText] = useState("Waiting for sign language translation input...");
  const [aslGloss, setAslGloss] = useState("[GLOSS] READY FOR SPEECH CAPTURE");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [systemLogs, setSystemLogs] = useState("Connecting to cloud gateway network loop...");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 1. Establish Secure Connection to your Render Instance Gateway
    const RENDER_URL = "fluently-backend.onrender.com";
    const socket = new WebSocket(`wss://${RENDER_URL}/ws/communication-bridge`);
    socketRef.current = socket;

    socket.onopen = () => {
      setSystemLogs("System Status: Connected | Cloud Orchestrator Synced");
      startVisionPipeline();
      startAudioPipeline();
    };

    socket.onerror = (err) => {
      console.error("WebSocket Error:", err);
      setSystemLogs("System Error: Failed to connect to Render server.");
    };

    // 2. Process Real-Time Incoming Events from Python
    socket.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);

        // Path A: Gemini Flash translated signs into English Text
        if (response.event === "translation") {
          setTranslationText(response.data.text);
          setSystemLogs(
            `System Status: Active | Tone: ${response.data.emotion.toUpperCase()} | Urgency: ${response.data.urgency}/10`
          );
        }

        // Path B: Speechmatics STT completed -> Converted to ASL Syntax via Gemini Pro
        if (response.event === "animate_avatar") {
          setAslGloss(response.data);
        }
      } catch (e) {
        console.error("Error parsing message frame: ", e);
      }
    };

    // --- 👁️ VISION PIPELINE: Capture Webcam for Gemini ---
    async function startVisionPipeline() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 480, height: 360, frameRate: { ideal: 15 } } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 320;
        canvas.height = 240;

        // Process frame tracking slices every 500ms
        const intervalId = setInterval(() => {
          if (socketRef.current?.readyState === WebSocket.OPEN && videoRef.current && ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const base64Frame = canvas.toDataURL("image/jpeg", 0.5).split(",")[1];
            
            socketRef.current.send(JSON.stringify({
              type: "video_frame",
              frame: base64Frame
            }));
          }
        }, 500);

        return () => clearInterval(intervalId);
      } catch (err) {
        console.error("Camera access error: ", err);
        setSystemLogs("System Warning: Camera permissions denied.");
      }
    }

    // --- 👂 AUDIO PIPELINE: Capture Mic for Speechmatics ---
    async function startAudioPipeline() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const buffer = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              buffer[i] = Math.min(1, Math.max(-1, inputData[i])) * 0x7FFF;
            }
            const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(buffer.buffer))));
            
            socketRef.current.send(JSON.stringify({
              type: "audio_chunk",
              audio: base64Audio
            }));
          }
        };
      } catch (err) {
        console.error("Microphone access error: ", err);
      }
    }

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div style={{ backgroundColor: BG, color: TEXT }} className="w-full min-h-screen flex flex-col">
      {/* Top Nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: BORDER, backgroundColor: SURFACE }}>
        <div style={{ fontFamily: "Inter, sans-serif", letterSpacing: "0.02em", color: ACCENT }} className="font-bold text-lg">
          Fluently
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}` }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
          <span style={{ color: ACCENT, fontSize: "11px", letterSpacing: "0.1em" }}>LIVE CONNECTED</span>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 p-4 md:p-6 flex-1">
        {/* LEFT PANEL: Deaf User View (Sees what is spoken as Sign Language via the Avatar) */}
        <section className="flex flex-col gap-4">
          <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: TEXT_MUTED }} className="px-1 font-bold">
            👁️ DEAF USER VIEW
          </div>

          <div className="rounded-2xl flex items-center justify-center relative overflow-hidden aspect-video shadow-sm" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
            <AvatarSVG />
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
              <span style={{ fontSize: "10px", letterSpacing: "0.1em", color: TEXT_MUTED }}>AI AVATAR · GENERATING GLOSS</span>
            </div>
          </div>

          {/* ASL Gloss Live Code Output Hook */}
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: SURFACE_ALT, border: `1px solid ${BORDER}`, fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, monospace", fontSize: "12px", color: ACCENT }}>
            <span style={{ color: TEXT_FAINT }} className="mr-2">›</span>
            {aslGloss}
          </div>

          {/* Spoken Language Translation Container */}
          <div className="rounded-2xl px-6 py-6 flex items-center flex-1 shadow-sm" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, minHeight: "180px" }}>
            <p style={{ fontFamily: "Inter, sans-serif", lineHeight: "1.4", color: TEXT }} className="text-xl md:text-2xl font-medium">
              {translationText}
            </p>
          </div>
        </section>

        {/* RIGHT PANEL: Blind User View (Feeds Local Webcam Frame to Gemini Flash) */}
        <section className="flex flex-col gap-4">
          <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: TEXT_MUTED }} className="px-1 font-bold">
            👂 BLIND USER VIEW
          </div>

          <div className="rounded-2xl relative overflow-hidden aspect-video shadow-sm bg-slate-900 flex items-center justify-center" style={{ border: `1px solid ${BORDER}` }}>
            {isCameraActive ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <VideoOff size={32} />
                <span className="text-xs font-mono tracking-wider">INITIALIZING WEBCAM STREAM...</span>
              </div>
            )}
            
            <div className="absolute top-4 left-4 flex items-center gap-2 z-10 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
              <span style={{ fontSize: "10px", letterSpacing: "0.1em", color: TEXT_MUTED }} className="font-bold">
                WEBCAM · STREAMING ACTIVE
              </span>
            </div>
          </div>

          <div className="rounded-lg px-4 py-3 flex items-center gap-3" style={{ backgroundColor: SURFACE_ALT, border: `1px solid ${BORDER}` }}>
            <Mic size={16} style={{ color: ACCENT }} />
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />
            <span style={{ fontSize: "13px", color: TEXT }}>
              Microphone active... feeding audio pipeline
            </span>
          </div>

          <div className="rounded-2xl px-4 flex items-center flex-1 shadow-sm" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, minHeight: "180px" }}>
            <Waveform />
          </div>
        </section>
      </main>

      <footer className="px-8 py-3 border-t" style={{ borderColor: BORDER, backgroundColor: SURFACE, color: TEXT_MUTED, fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, monospace", fontSize: "11px" }}>
        {systemLogs}
      </footer>
    </div>
  );
}

// --- KEEP STATIC VISUAL SVG GRAPHICS & GENERATED ARRAYS STABLE OUTSIDE RE-RENDERS ---
function AvatarSVG() {
  return (
    <svg width="280" height="340" viewBox="0 0 280 340" fill="none">
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DBE7F8" />
          <stop offset="100%" stopColor="#B7CDEB" />
        </linearGradient>
        <radialGradient id="headGrad" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#E8F0FB" />
          <stop offset="100%" stopColor="#B7CDEB" />
        </radialGradient>
      </defs>
      <circle cx="140" cy="100" r="95" fill={ACCENT_SOFT} />
      <circle cx="140" cy="100" r="90" fill="none" stroke={ACCENT} strokeOpacity="0.25" strokeWidth="1.5" />
      <ellipse cx="140" cy="100" rx="55" ry="65" fill="url(#headGrad)" />
      <circle cx="120" cy="95" r="4" fill={ACCENT} />
      <circle cx="160" cy="95" r="4" fill={ACCENT} />
      <path d="M 125 125 Q 140 132 155 125" stroke={ACCENT} strokeOpacity="0.7" strokeWidth="1.5" fill="none" />
      <rect x="125" y="160" width="30" height="25" fill="url(#bodyGrad)" />
      <path d="M 80 200 Q 80 185 95 182 L 185 182 Q 200 185 200 200 L 200 340 L 80 340 Z" fill="url(#bodyGrad)" />
      <path d="M 85 200 Q 60 195 50 160 Q 45 140 55 120 L 70 125 Q 65 145 70 160 Q 80 185 95 195 Z" fill="url(#bodyGrad)" />
      <ellipse cx="55" cy="115" rx="14" ry="18" fill="#C9DCF1" />
      <path d="M 50 105 L 50 90 M 55 102 L 55 85 M 60 103 L 60 88" stroke="#94B3D6" strokeWidth="3" strokeLinecap="round" />
      <path d="M 195 200 Q 220 195 230 160 Q 235 140 225 120 L 210 125 Q 215 145 210 160 Q 200 185 185 195 Z" fill="url(#bodyGrad)" />
      <ellipse cx="225" cy="115" rx="14" ry="18" fill="#C9DCF1" />
      <path d="M 220 105 L 220 90 M 225 102 L 225 85 M 230 103 L 230 88" stroke="#94B3D6" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="125" cy="80" rx="12" ry="18" fill="white" opacity="0.5" />
    </svg>
  );
}

function Waveform() {
  const bars = Array.from({ length: 72 }, (_, i) => {
    const t = i / 72;
    const base = Math.sin(t * Math.PI * 6) * 0.5 + 0.5;
    const noise = Math.sin(t * Math.PI * 23) * 0.3;
    const env = Math.sin(t * Math.PI);
    return Math.max(0.08, Math.abs((base + noise) * env));
  });
  return (
    <div className="w-full flex items-center justify-between gap-[3px]" style={{ height: "120px" }}>
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-full animate-pulse"
          style={{
            height: `${h * 100}%`,
            background: `linear-gradient(180deg, ${ACCENT} 0%, rgba(37,99,235,0.35) 100%)`,
            boxShadow: `0 0 6px rgba(37,99,235,0.4)`,
            animationDelay: `${i * 35}ms`,
            animationDuration: "1400ms",
            minHeight: "4px",
          }}
        />
      ))}
    </div>
  );
}