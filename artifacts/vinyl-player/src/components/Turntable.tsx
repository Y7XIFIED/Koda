import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Upload } from "lucide-react";
import type { iTunesTrack } from "../lib/itunes";



/* ── Genre → vinyl tint ─────────────────────────────────────────── */
const GENRE_TINTS: Record<string, string> = {
  rock:         "rgba(160,20,20,0.18)",
  pop:          "rgba(200,40,140,0.15)",
  "hip-hop":    "rgba(200,160,10,0.15)",
  "hip hop":    "rgba(200,160,10,0.15)",
  rap:          "rgba(200,160,10,0.15)",
  jazz:         "rgba(10,40,180,0.15)",
  classical:    "rgba(90,10,180,0.15)",
  electronic:   "rgba(10,180,160,0.15)",
  dance:        "rgba(10,180,160,0.15)",
  country:      "rgba(160,90,10,0.15)",
  "r&b":        "rgba(180,10,80,0.15)",
  soul:         "rgba(160,10,80,0.15)",
  metal:        "rgba(80,80,100,0.25)",
  indie:        "rgba(40,160,60,0.15)",
  blues:        "rgba(10,60,160,0.18)",
  reggae:       "rgba(40,160,40,0.18)",
  folk:         "rgba(140,110,60,0.15)",
};


/* ── Static particles ────────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  cx: 20 + Math.random() * 60, cy: 20 + Math.random() * 60,
  r: 0.8 + Math.random() * 1.6,
  dur: 3 + Math.random() * 5,
  delay: Math.random() * 4,
  ox: (Math.random() - 0.5) * 12, oy: (Math.random() - 0.5) * 12,
}));

/* ── Props ───────────────────────────────────────────────────────── */
export interface TurntableProps {
  isPlaying:       boolean;
  progress:        number;
  currentTrack:    iTunesTrack | null;
  isLoading:       boolean;
  isFindingStream: boolean;
  accentColor:     string;

  showParticles?:  boolean;
  customLabel?:    string | null;
  djName?:         string;
  onCustomLabel?:  (url: string) => void;
  onScratch?:      (rate: number) => void;
  onSeek?:         (pct: number) => void;
  togglePlay?:     () => void;
}

export default function Turntable({
  isPlaying, progress, currentTrack, isLoading, isFindingStream,
  accentColor: c, showParticles = true, customLabel, djName,
  onCustomLabel, onScratch, onSeek, togglePlay,
}: TurntableProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const labelInputRef  = useRef<HTMLInputElement>(null);
  const scratchStartX  = useRef<number | null>(null);
  const [tilt, setTilt]  = useState({ x: 0, y: 0 });
  const busy = isLoading || isFindingStream;

  /* Vinyl tint from genre */
  const genreTint = useMemo(() => {
    const g = (currentTrack?.genre ?? "").toLowerCase();
    for (const [key, val] of Object.entries(GENRE_TINTS)) {
      if (g.includes(key)) return val;
    }
    return null;
  }, [currentTrack?.genre]);

  /* Parallax tilt */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    if (!isPlaying) {
      setTilt({ x: 0, y: 0 });
      return;
    }
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    setTilt({ x: -y * 20, y: x * 20 });
  }, [isPlaying]);

  /* Manual scratch (skip 1s forward/back) */
  const handleScratchStart = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    scratchStartX.current = e.clientX;
  };
  const handleScratchMove = (e: React.PointerEvent) => {
    if (scratchStartX.current === null) return;
    const delta = e.clientX - scratchStartX.current;
    if (Math.abs(delta) > 20) {
      onScratch?.(delta > 0 ? 1 : -1);
      scratchStartX.current = e.clientX;
    }
  };
  const handleScratchEnd = (e: React.PointerEvent) => {
    scratchStartX.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    onScratch?.(1);
  };

  /* Custom label upload */
  const handleLabelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target?.result) onCustomLabel?.(ev.target.result as string); };
    reader.readAsDataURL(file);
  };

  /* Mechanical CD Eject Sound */
  const playMechanicalSound = useCallback((isGoingIn: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      if (isGoingIn) {
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.4);
      }
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.value = 800;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.03, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start();
    } catch {}
  }, []);

  const [prevIsPlaying, setPrevIsPlaying] = useState(isPlaying);
  
  useEffect(() => {
    if (isPlaying !== prevIsPlaying) {
      playMechanicalSound(isPlaying);
      setPrevIsPlaying(isPlaying);
      if (!isPlaying) setTilt({ x: 0, y: 0 }); // snap back to 0 when paused
    }
  }, [isPlaying, prevIsPlaying, playMechanicalSound]);

  return (
    <div ref={containerRef} className="relative select-none" style={{ perspective: "1200px" }}
      onMouseMove={handleMouseMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>

      <motion.div
        animate={{ rotateX: tilt.x, rotateY: tilt.y }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="relative w-[290px] h-[290px] md:w-[440px] md:h-[440px]"
        style={{ transformStyle: "preserve-3d" }}>

        {/* Platter with Strobe Dots (Spins, stays in place) */}
        <div className="absolute top-1/2 left-[45%] -translate-x-1/2 -translate-y-1/2 w-[270px] h-[270px] md:w-[420px] md:h-[420px] rounded-full strobe-platter flex items-center justify-center spin-record" style={{ animationPlayState: isPlaying ? "running" : "paused" }}>
          <div className="w-[250px] h-[250px] md:w-[390px] md:h-[390px] rounded-full strobe-platter-inner relative flex items-center justify-center" />
        </div>

        {/* Record Container - Slides independently, spins inside */}
        <motion.div
          className="absolute top-1/2 left-[45%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          animate={{ 
            scale: isPlaying ? 1 : 0.85, 
            x: isPlaying ? 0 : -140,
            y: isPlaying ? 0 : 140 
          }}
          transition={{ type: "spring", stiffness: 100, damping: 16 }}>
          
          <div className="flex items-center justify-center spin-record" style={{ animationPlayState: isPlaying ? "running" : "paused" }}>
            {/* Vinyl record — 3D flip on track change */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTrack?.trackId ?? "empty"}
                initial={{ rotateY: -110, opacity: 0.15, scale: 0.88 }}
                animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                exit={{ rotateY: 110, opacity: 0.15, scale: 0.88 }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
                style={{ transformStyle: "preserve-3d", perspective: "800px" }}
                className="w-[245px] h-[245px] md:w-[380px] md:h-[380px]">

                <div className="w-full h-full rounded-full vinyl-grooves relative flex items-center justify-center">

                {/* Strobe Dots SVG */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="-150 -150 300 300">
                  {Array.from({ length: 72 }).map((_, i) => (
                    <rect key={`strobe-${i}`} x="-1.5" y="-149" width="3" height="6" fill="rgba(255,255,255,0.12)" transform={`rotate(${i * 5})`} />
                  ))}
                </svg>

                {/* The grooved vinyl lines */}
                {genreTint && (
                  <div className="absolute inset-0 rounded-full pointer-events-none transition-all duration-1000"
                    style={{ background: genreTint, mixBlendMode: "overlay" }} />
                )}

                <div className="absolute inset-0 rounded-full vinyl-highlight pointer-events-none mix-blend-screen" />

                {/* Album art label — with DJ scratch */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`art-${customLabel ?? currentTrack?.trackId ?? "empty"}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.5 }}
                    className="w-[90px] h-[90px] md:w-[125px] md:h-[125px] rounded-full overflow-hidden relative cursor-pointer group"
                    style={{ boxShadow:`inset 0 0 10px rgba(0,0,0,.6),0 0 25px rgba(${c},.25)`, background:"#222", border:`2px solid rgba(${c},.35)` }}
                    onPointerDown={handleScratchStart}
                    onPointerMove={handleScratchMove}
                    onPointerUp={handleScratchEnd}>
                    {(customLabel ?? currentTrack?.artworkUrl) ? (
                      <img src={customLabel ?? currentTrack!.artworkUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background:`linear-gradient(135deg,rgba(${c},.2),rgba(${c},.05))` }}>
                        <span className="text-2xl font-serif" style={{ color:`rgba(${c},.2)` }}>V</span>
                      </div>
                    )}

                    {/* Upload label overlay */}
                    {onCustomLabel && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        style={{ background:"rgba(0,0,0,.6)" }}>
                        <button onClick={e => { e.stopPropagation(); labelInputRef.current?.click(); }}
                          className="p-1" style={{ color:`rgba(${c},.9)` }}>
                          <Upload size={14} />
                        </button>
                      </div>
                    )}
                    <input ref={labelInputRef} type="file" accept="image/*" className="hidden" onChange={handleLabelUpload} />


                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 rounded-full z-10 pointer-events-none"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        backdropFilter: "blur(20px)",
                        borderColor: "rgba(255,255,255,0.1)",
                        boxShadow: "0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 0 20px rgba(255,255,255,0.02)",
                        borderWidth: "1px"
                      }} />
                  </motion.div>
                </AnimatePresence>

                {/* Loading overlay */}
                {busy && (
                  <div className="absolute inset-0 rounded-full flex items-center justify-center z-20"
                    style={{ background:"rgba(0,0,0,.55)" }}>
                    <div className="text-center space-y-2">
                      <Loader2 size={28} className="animate-spin mx-auto" style={{ color:`rgb(${c})` }} />
                      {isFindingStream && (
                        <p className="text-[10px] uppercase tracking-widest" style={{ color:`rgba(${c},.8)` }}>Finding…</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
          </div>
        </motion.div>

        {/* Tonearm */}
        <Tonearm isPlaying={isPlaying} progress={progress} accentColor={c} onSeek={onSeek} togglePlay={togglePlay} />

        {/* DJ name on plinth */}
        {djName && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-[9px] uppercase tracking-[0.3em] font-semibold"
              style={{ color:`rgba(${c},.35)` }}>{djName}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ── Tonearm (Skeuomorphic) ──────────────────────────────────────── */
function Tonearm({ isPlaying, progress, accentColor: c, onSeek, togglePlay }: { isPlaying: boolean; progress: number; accentColor: string; onSeek?: (p:number)=>void; togglePlay?: ()=>void; }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragRot, setDragRot] = useState(0);

  // Realistic easing for arm drop and lift
  const baseRotation = isPlaying ? 28 + progress * 0.15 : 0;
  const rotation = isDragging ? dragRot : baseRotation;

  return (
    <div className="absolute top-6 right-6 md:top-10 md:right-10 w-24 h-64 md:w-32 md:h-80 z-10" style={{ filter: "drop-shadow(15px 25px 25px rgba(0,0,0,0.6))" }}>
      <motion.div
        animate={{ rotate: rotation }}
        transition={{ type: "spring", stiffness: 40, damping: 18 }}
        className={`relative w-full h-full ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ transformOrigin: "75% 15%" }}
        onPanStart={() => {
          setIsDragging(true);
          setDragRot(rotation);
        }}
        onPan={(e, info) => {
          // Adjust rotation based on drag delta X
          let newRot = dragRot + info.delta.x * 0.3;
          newRot = Math.max(0, Math.min(newRot, 43)); // 0=rest, 28=start, 43=end
          setDragRot(newRot);
        }}
        onPanEnd={() => {
          setIsDragging(false);
          if (dragRot < 15) {
            // Dragged off record -> Stop/Pause
            if (isPlaying) togglePlay?.();
          } else {
            // Dragged onto record -> Seek
            let pct = ((dragRot - 28) / 15) * 100;
            pct = Math.max(0, Math.min(pct, 100));
            onSeek?.(pct);
            if (!isPlaying) togglePlay?.();
          }
        }}
        onTap={() => {
          if (isPlaying) {
            togglePlay?.();
          } else {
            onSeek?.(0);
            togglePlay?.();
          }
        }}>
        
        {/* Counterweight */}
        <div className="absolute -top-4 right-2 md:-top-6 md:right-4 w-12 h-8 md:w-16 md:h-10 rounded-sm pointer-events-none"
          style={{ background: "linear-gradient(to bottom, #d0d0d0, #555, #d0d0d0)", border: "1px solid #333", boxShadow: "inset 0 0 5px rgba(0,0,0,0.8)" }} />

        {/* Pivot Base */}
        <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 rounded-full border-[6px] pointer-events-none"
          style={{ background:"radial-gradient(circle at center, #111, #333)", borderColor:"#222", boxShadow:"inset 0 4px 10px rgba(0,0,0,.9), 0 4px 10px rgba(0,0,0,.8)" }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full"
            style={{ background: "linear-gradient(135deg, #eee, #888)", boxShadow: "0 2px 5px rgba(0,0,0,0.8)" }} />
        </div>

        {/* Tubular S-Arm */}
        <svg className="absolute top-8 right-6 w-16 h-48 md:w-20 md:h-64 overflow-visible pointer-events-none" viewBox="0 0 100 300" preserveAspectRatio="none">
          <path d="M 80 0 C 80 150, 20 150, 20 300" fill="none" stroke="url(#chrome)" strokeWidth="12" strokeLinecap="round" />
          <defs>
            <linearGradient id="chrome" x1="0" y1="0" x2={Math.max(0.5, 1 - dragRot/100)} y2={dragRot/50}>
              <stop offset="0%" stopColor="#777" />
              <stop offset={`${30 + dragRot/2}%`} stopColor="#fff" />
              <stop offset={`${60 + dragRot/2}%`} stopColor="#fff" />
              <stop offset="100%" stopColor="#333" />
            </linearGradient>
          </defs>
        </svg>

        {/* Headshell & Stylus */}
        <div className="absolute bottom-2 left-1 md:-bottom-2 md:left-2 w-8 h-14 md:w-10 md:h-16 rounded-sm pointer-events-none"
          style={{ background:"linear-gradient(145deg, #222, #000)", transform:"rotate(15deg)", boxShadow:"0 6px 16px rgba(0,0,0,.9)", border:"1px solid #444", borderTop: "3px solid silver" }}>
          
          <div className="absolute bottom-2 right-1 w-2 h-2 rounded-full transition-all duration-1000"
            style={{ background:`rgb(${c})`, boxShadow:`0 0 8px 2px rgb(${c})` }} />
            
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-6" style={{ background: "linear-gradient(to right, #aaa, #eee, #aaa)" }} />
        </div>
      </motion.div>
    </div>
  );
}
