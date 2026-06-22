import { useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Upload } from "lucide-react";
import type { iTunesTrack } from "../lib/itunes";

export type TurntableFinish = "walnut" | "black" | "aluminum";

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

const FINISH_STYLES: Record<TurntableFinish, React.CSSProperties> = {
  walnut: {
    background: "linear-gradient(135deg,#3d2a1a 0%,#5c3d24 30%,#3a2516 60%,#4a3020 100%)",
    borderColor: "rgba(255,200,100,.08)",
    boxShadow: "0 20px 60px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,200,100,.05)",
  },
  black: {
    background: "linear-gradient(145deg,#111 0%,#1c1c1c 40%,#0a0a0a 70%,#141414 100%)",
    borderColor: "rgba(255,255,255,.06)",
    boxShadow: "0 20px 60px rgba(0,0,0,.95),inset 0 1px 0 rgba(255,255,255,.04)",
  },
  aluminum: {
    background: "linear-gradient(145deg,#9a9a9a 0%,#c0c0c0 25%,#888 50%,#b8b8b8 75%,#909090 100%)",
    borderColor: "rgba(255,255,255,.25)",
    boxShadow: "0 20px 60px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.4)",
  },
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
  finish:          TurntableFinish;
  showParticles?:  boolean;
  customLabel?:    string | null;
  djName?:         string;
  onCustomLabel?:  (url: string) => void;
  onScratch?:      (rate: number) => void;
}

export default function Turntable({
  isPlaying, progress, currentTrack, isLoading, isFindingStream,
  accentColor: c, finish, showParticles = true, customLabel, djName,
  onCustomLabel, onScratch,
}: TurntableProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const labelInputRef  = useRef<HTMLInputElement>(null);
  const scratchStartX  = useRef<number | null>(null);
  const [tilt, setTilt]  = useState({ x: 0, y: 0 });
  const finishStyle = FINISH_STYLES[finish];
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
    const r = containerRef.current.getBoundingClientRect();
    setTilt({
      x: ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * 7,
      y: -((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 7,
    });
  }, []);

  /* DJ scratch */
  const handleScratchStart = (e: React.PointerEvent) => {
    scratchStartX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleScratchMove = (e: React.PointerEvent) => {
    if (scratchStartX.current === null || !onScratch) return;
    const dx = e.clientX - scratchStartX.current;
    onScratch(Math.min(2, Math.max(0.25, 1 + dx / 80)));
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

  return (
    <div ref={containerRef} className="relative select-none" style={{ perspective: "1200px" }}
      onMouseMove={handleMouseMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>

      <motion.div
        animate={{ rotateX: tilt.x, rotateY: tilt.y }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="relative w-[290px] h-[290px] md:w-[440px] md:h-[440px] rounded-xl border"
        style={{ ...finishStyle, transformStyle: "preserve-3d" }}>

        {/* Ambient inset glow */}
        <div className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: `inset 0 0 50px rgba(${c},.05)` }} />

        {/* Platter */}
        <div className="absolute top-1/2 left-[45%] -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] md:w-[390px] md:h-[390px] rounded-full border"
          style={{ background:"#0f0f0f", borderColor:"#252525", boxShadow:"0 10px 30px rgba(0,0,0,.9),inset 0 0 20px rgba(0,0,0,.6)" }}>

          {/* Vinyl record — 3D flip on track change */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTrack?.trackId ?? "empty"}
              initial={{ rotateY: -110, opacity: 0.15, scale: 0.88 }}
              animate={{ rotateY: 0, opacity: 1, scale: 1 }}
              exit={{ rotateY: 110, opacity: 0.15, scale: 0.88 }}
              transition={{ type: "spring", stiffness: 160, damping: 22 }}
              style={{ transformStyle: "preserve-3d", perspective: "800px" }}
              className="w-full h-full">

              <div className="w-full h-full rounded-full vinyl-grooves relative flex items-center justify-center spin-record"
                style={{ animationPlayState: isPlaying ? "running" : "paused" }}>

                {/* Genre tint overlay */}
                {genreTint && (
                  <div className="absolute inset-0 rounded-full pointer-events-none transition-all duration-1000"
                    style={{ background: genreTint, mixBlendMode: "overlay" }} />
                )}

                <div className="absolute inset-0 rounded-full vinyl-highlight pointer-events-none mix-blend-screen" />

                {/* Particles — sit above grooves, don't spin */}
                {showParticles && isPlaying && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ animation: "counter-spin 4s linear infinite" }}>
                    {PARTICLES.map(p => (
                      <circle key={p.id}
                        cx={`${p.cx}%`} cy={`${p.cy}%`} r={p.r}
                        fill={`rgba(255,255,255,${0.2 + Math.random() * 0.4})`}>
                        <animate attributeName="cx" values={`${p.cx}%;${p.cx + p.ox}%;${p.cx}%`} dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
                        <animate attributeName="cy" values={`${p.cy}%;${p.cy + p.oy}%;${p.cy}%`} dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.1;0.6;0.1" dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
                      </circle>
                    ))}
                  </svg>
                )}

                {/* Album art label — with DJ scratch */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`art-${customLabel ?? currentTrack?.trackId ?? "empty"}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
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

                    {/* Spindle hole */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 rounded-full z-10 pointer-events-none"
                      style={{ background:"#1a1a1a", border:"1px solid rgba(0,0,0,.6)", boxShadow:"inset 0 0 4px rgba(0,0,0,.9)" }} />
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

        {/* Tonearm */}
        <Tonearm isPlaying={isPlaying} progress={progress} accentColor={c} />

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

/* ── Tonearm ─────────────────────────────────────────────────────── */
function Tonearm({ isPlaying, progress, accentColor: c }: { isPlaying: boolean; progress: number; accentColor: string }) {
  const rotation = isPlaying ? 28 + progress * 0.15 : 3;
  return (
    <div className="absolute top-6 right-6 md:top-10 md:right-10 w-20 h-56 md:w-28 md:h-72 pointer-events-none z-10">
      <motion.div
        animate={{ rotate: rotation }}
        transition={{ type: "spring", stiffness: 35, damping: 14 }}
        className="relative w-full h-full"
        style={{ transformOrigin: "80% 15%" }}>
        <div className="absolute top-0 right-0 w-14 h-14 md:w-18 md:h-18 rounded-full border-4 flex items-center justify-center"
          style={{ background:"linear-gradient(135deg,#505050,#111)", borderColor:"#1a1a1a", boxShadow:"0 4px 14px rgba(0,0,0,.9)", width:52, height:52 }}>
          <div className="rounded-full border" style={{ width:34, height:34, background:"#191919", borderColor:"rgba(0,0,0,.4)", boxShadow:"inset 0 2px 6px rgba(0,0,0,.9)" }} />
        </div>
        <div className="absolute top-7 right-7 w-2 rounded-full"
          style={{ height:192, background:"linear-gradient(to right,#e8e8e8,#909090,#e8e8e8)", transform:"rotate(-20deg)", transformOrigin:"top center", boxShadow:"2px 6px 10px rgba(0,0,0,.6)", border:"1px solid rgba(255,255,255,.2)" }} />
        <div className="absolute bottom-6 left-4 md:bottom-4 md:left-6 w-5 h-10 md:w-7 md:h-14 rounded-sm"
          style={{ background:"#111", transform:"rotate(10deg)", boxShadow:"0 6px 16px rgba(0,0,0,.7)", border:"1px solid #333" }}>
          <div className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full transition-all duration-1000"
            style={{ background:`rgb(${c})`, boxShadow:`0 0 6px rgb(${c})` }} />
        </div>
      </motion.div>
    </div>
  );
}
