import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, BookOpen, Sparkles, Volume2 } from "lucide-react";

// Theme Configuration
const ACCENT = "#2563EB";
const ACCENT_SOFT = "rgba(37, 99, 235, 0.08)";
const ACCENT_BORDER = "rgba(37, 99, 235, 0.3)";
const BG = "#F8FAFC";
const SURFACE = "#FFFFFF";
const BORDER = "rgba(15, 23, 42, 0.06)";
const TEXT = "#0F172A";
const TEXT_MUTED = "rgba(15, 23, 42, 0.55)";

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState("Click 'Start Listening' and speak to translate to ASL...");
  const [aslGloss, setAslGloss] = useState("READY");
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [currentLesson, setCurrentLesson] = useState("Conversational Basics");

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Connect to backend websocket loop
  useEffect(() => {
    const RENDER_URL = "fluently-backend-dsft.onrender.com";
    const socket = new WebSocket(`wss://${RENDER_URL}/ws/communication-bridge`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        // Catch spoken transcription text
        if (response.event === "transcription") {
          setSpokenText(response.data.text);
        }
        # Catch generated ASL gloss tokens to animate the avatar
        if (response.event === "animate_avatar") {
          setAslGloss(response.data.toUpperCase().trim());
        }
      } catch (e) {
        console.error("Error parsing socket payload:", e);
      }
    };

    return () => socket.close();
  }, []);

  // Handle Interactive Recording State Toggle
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop pipeline
      streamRef.current?.getTracks().forEach(track => track.stop());
      audioContextRef.current?.close();
      setAudioVolume(0);
      setIsRecording(false);
    } else {
      // Start pipeline
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        setIsRecording(true);

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioContext;
        
        const source = audioContext.createMediaStreamSource(stream);
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        source.connect(analyzer);
        analyzer.connect(processor);
        processor.connect(audioContext.destination);

        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        
        // Dynamically update equalizer bars based on real mic volume input
        const trackVolume = () => {
          if (audioContext.state === "closed") return;
          analyzer.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          setAudioVolume(sum / dataArray.length / 120); // Normalize level scale
          requestAnimationFrame(trackVolume);
        };
        trackVolume();

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
        console.error("Microphone hardware mapping failed:", err);
      }
    }
  };

  return (
    <div style={{ backgroundColor: BG, color: TEXT }} className="w-full min-h-screen flex flex-col font-sans">
      {/* Platform Navigation Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b bg-white" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: ACCENT }}>F</div>
          <span className="font-bold text-xl tracking-tight">Fluently <span className="text-xs font-normal text-blue-600 px-2 py-0.5 rounded-full bg-blue-50 ml-1 border border-blue-100">Sign Studio</span></span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <button className="flex items-center gap-2 text-blue-600"><Sparkles size={16}/> Real-Time Translator</button>
          <button className="flex items-center gap-2 hover:text-slate-900"><BookOpen size={16}/> Dictionary & Lessons</button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 flex-1 max-w-7xl w-full mx-auto">
        
        {/* Left Side: Dynamic Sign Language Avatar Window (7 Columns) */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border p-4 shadow-sm flex flex-col items-center justify-center relative min-h-[440px]" style={{ borderColor: BORDER }}>
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
              <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">ASL Avatar Output</span>
            </div>
            
            {/* Interactive SVG Avatar Hooked to Gloss Parsing Engine */}
            <SignAvatar activeSign={aslGloss} />

            {/* Live Subtitle HUD Overlay inside the Avatar view */}
            <div className="w-full mt-4 bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-center text-sm shadow-inner">
              <span className="text-blue-400 font-bold mr-2">CURRENT SIGN ASL ›</span> {aslGloss}
            </div>
          </div>
        </section>

        {/* Right Side: Translation Inputs & Audio Equalizer (5 Columns) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Interactive Equalizer Box */}
          <div className="bg-white rounded-2xl border p-6 shadow-sm flex flex-col gap-4" style={{ borderColor: BORDER }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Volume2 size={16} className="text-blue-600"/> Voice Capture Input
            </h3>

            {/* Audio Recording Toggle Button */}
            <button 
              onClick={toggleRecording}
              className={`w-full py-4 px-6 rounded-xl font-medium transition-all flex items-center justify-center gap-3 shadow-sm ${
                isRecording 
                  ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" 
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
              }`}
            >
              {isRecording ? <MicOff size={20}/> : <Mic size={20}/>}
              {isRecording ? "Stop Translation Session" : "Start Listening & Translate"}
            </button>

            {/* Interactive Equalizer Bars */}
            <div className="h-20 bg-slate-50 rounded-xl border border-slate-100 px-4 flex items-center justify-center">
              <InteractiveWaveform currentVolume={audioVolume} />
            </div>
          </div>

          {/* Real-time Text Translation Output Area */}
          <div className="bg-white rounded-2xl border p-6 shadow-sm flex-1 flex flex-col gap-3" style={{ borderColor: BORDER }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">English Transcript</h3>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex-1 min-h-[120px]">
              <p className="text-lg text-slate-700 font-medium leading-relaxed">{spokenText}</p>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}

// --- DYNAMIC INTERACTIVE SIGNING AVATAR ENGINE ---
function SignAvatar({ activeSign }: { activeSign: string }) {
  const isHello = activeSign.includes("HELLO") || activeSign.includes("READY");
  const isWant = activeSign.includes("WANT") || activeSign.includes("APPLE");
  const isLearn = activeSign.includes("LEARN") || activeSign.includes("SIGN");

  let leftHandY = 220, leftHandX = 70;
  let rightHandY = 220, rightHandX = 210;
  let mouthPath = "M 125 125 Q 140 131 155 125"; // Neutral state expression

  if (isHello) {
    rightHandY = 90; rightHandX = 230; // Elevated right arm for a native salute wave gesture
    mouthPath = "M 125 123 Q 140 135 155 123"; // Smiling face expression
  } else if (isWant) {
    leftHandY = 170; leftHandX = 95; rightHandY = 170; rightHandX = 185; // Arms extended outward chest-high
  } else if (isLearn) {
    leftHandY = 140; leftHandX = 110; rightHandY = 110; rightHandX = 140; // Hands brought inward close together near the head
    mouthPath = "M 125 124 Q 140 133 155 124";
  }

  return (
    <svg width="320" height="340" viewBox="0 0 280 340" fill="none" className="transition-all duration-300 ease-in-out">
      <defs>
        <linearGradient id="avatarBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <radialGradient id="avatarSkin" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#FEE2E2" /><stop offset="100%" stopColor="#FCA5A5" />
        </radialGradient>
      </defs>
      {/* Background Frame Component Halo ring */}
      <circle cx="140" cy="110" r="90" fill="rgba(37,99,235,0.03)" stroke="#2563EB" strokeOpacity="0.1" strokeWidth="2" />
      
      {/* Head & Features */}
      <ellipse cx="140" cy="100" rx="45" ry="55" fill="url(#avatarSkin)" stroke="#F87171" strokeWidth="2" />
      <circle cx="125" cy="95" r="3.5" fill="#1E293B" /><circle cx="155" cy="95" r="3.5" fill="#1E293B" />
      <path d={mouthPath} stroke="#1E293B" strokeWidth="2" fill="none" className="transition-all duration-200" />
      
      {/* Torso Base Body Structure */}
      <path d="M 70 210 Q 70 190 90 185 L 190 185 Q 210 190 210 210 L 220 340 L 60 340 Z" fill="url(#avatarBody)" />
      
      {/* Left Arm Limb & Signing Hand Node */}
      <path d={`M 80 205 Q 60 190 ${leftHandX} ${leftHandY}`} stroke="#3B82F6" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300" />
      <circle cx={leftHandX} cy={leftHandY} r="12" fill="url(#avatarSkin)" stroke="#F87171" strokeWidth="1.5" className="transition-all duration-300" />

      {/* Right Arm Limb & Signing Hand Node */}
      <path d={`M 200 205 Q 220 190 ${rightHandX} ${rightHandY}`} stroke="#3B82F6" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300" />
      <circle cx={rightHandX} cy={rightHandY} r="12" fill="url(#avatarSkin)" stroke="#F87171" strokeWidth="1.5" className="transition-all duration-300" />
    </svg>
  );
}

// --- NON-BLOCKING LIVE MICROPHONE AUDIO WAVEFORM INDICATOR ---
function InteractiveWaveform({ currentVolume }: { currentVolume: number }) {
  return (
    <div className="w-full flex items-center justify-between gap-[2px]" style={{ height: "60px" }}>
      {Array.from({ length: 50 }, (_, i) => {
        const normX = i / 50;
        const envelope = Math.sin(normX * Math.PI);
        const noise = Math.sin(normX * Math.PI * 10) * 0.3 + 0.7;
        const heightMultiplier = Math.max(0.08, currentVolume * noise * envelope);

        return (
          <div
            key={i}
            className="flex-1 rounded-full transition-all duration-75"
            style={{
              height: `${heightMultiplier * 100}%`,
              backgroundColor: currentVolume > 0.02 ? ACCENT : "#E2E8F0",
              minHeight: "4px"
            }}
          />
        );
      })}
    </div>
  );
}