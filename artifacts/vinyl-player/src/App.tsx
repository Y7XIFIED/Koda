import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Search, X, Loader2, Music } from "lucide-react";
import type { iTunesTrack } from "./lib/itunes";
import { searchMusic } from "./lib/itunes";
import { useAudioPlayer } from "./hooks/useAudioPlayer";

/* ─── Types ─────────────────────────────────────────────────────── */
interface StreamInfo {
  videoId: string;
  title: string;
  channelName: string;
  durationSeconds: number;
}

/* ─── Helpers ───────────────────────────────────────────────────── */
function formatTime(s: number): string {
  if (!s || !isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

async function findYouTubeStream(track: iTunesTrack): Promise<StreamInfo | null> {
  const q = encodeURIComponent(`${track.artistName} ${track.trackName}`);
  try {
    const r = await fetch(`/api/songs/find?q=${q}`);
    if (!r.ok) return null;
    return await r.json() as StreamInfo;
  } catch {
    return null;
  }
}

/* Extract dominant color from album artwork via canvas */
async function extractAccentColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 60;
        canvas.height = 60;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve("212,168,83"); return; }
        ctx.drawImage(img, 0, 0, 60, 60);
        const data = ctx.getImageData(0, 0, 60, 60).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          const brightness = (pr + pg + pb) / 3;
          if (brightness > 25 && brightness < 230) {
            r += pr; g += pg; b += pb; n++;
          }
        }
        if (!n) { resolve("212,168,83"); return; }
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
        const max = Math.max(r, g, b);
        if (max > 0 && max < 200) {
          const boost = 200 / max;
          r = Math.min(255, Math.round(r * boost));
          g = Math.min(255, Math.round(g * boost));
          b = Math.min(255, Math.round(b * boost));
        }
        resolve(`${r},${g},${b}`);
      } catch {
        resolve("212,168,83");
      }
    };
    img.onerror = () => resolve("212,168,83");
    img.src = imageUrl;
  });
}

/* ─── App ───────────────────────────────────────────────────────── */
export default function App() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<iTunesTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<iTunesTrack | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFindingStream, setIsFindingStream] = useState(false);
  const [accentColor, setAccentColor] = useState("212,168,83");
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isPlaying, progress, currentTime, duration,
    volume, isLoading, loadAndPlay, togglePlay, seek, changeVolume, setOnEnded,
  } = useAudioPlayer();

  const searchResultsRef = useRef<iTunesTrack[]>([]);
  const currentIdxRef = useRef(0);
  useEffect(() => { searchResultsRef.current = searchResults; }, [searchResults]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  /* ── Play a track: look up YouTube, then stream ── */
  const playTrack = useCallback(async (track: iTunesTrack, idx: number) => {
    setCurrentTrack(track);
    setCurrentIdx(idx);
    currentIdxRef.current = idx;
    setIsFindingStream(true);

    /* Extract accent color from artwork in parallel */
    if (track.artworkUrl) {
      extractAccentColor(track.artworkUrl).then(setAccentColor).catch(() => {});
    }

    const stream = await findYouTubeStream(track);
    setIsFindingStream(false);

    if (stream) {
      loadAndPlay(`/api/songs/audio?id=${stream.videoId}`);
    } else {
      /* Fallback: iTunes 30-second preview */
      loadAndPlay(track.previewUrl);
    }
  }, [loadAndPlay]);

  /* Auto-advance */
  useEffect(() => {
    setOnEnded(() => {
      const results = searchResultsRef.current;
      const idx = currentIdxRef.current;
      if (idx < results.length - 1) {
        playTrack(results[idx + 1], idx + 1);
      }
    });
  }, [setOnEnded, playTrack]);

  /* ── Search ── */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setIsSearching(true);
    try {
      const results = await searchMusic(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  const handlePrev = () => {
    if (currentIdx > 0) playTrack(searchResults[currentIdx - 1], currentIdx - 1);
  };
  const handleNext = () => {
    if (currentIdx < searchResults.length - 1) playTrack(searchResults[currentIdx + 1], currentIdx + 1);
  };

  const busy = isFindingStream || isLoading;

  /* ── Dynamic theme vars ── */
  const c = accentColor; // "r,g,b"

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-4 md:p-8 font-sans overflow-hidden relative">

      {/* Ambient glows — themed to accent color */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[140px] transition-all duration-1000"
          style={{ background: `rgba(${c},0.08)` }} />
        <div className="absolute bottom-1/4 right-1/4 w-[36rem] h-[36rem] rounded-full blur-[180px] transition-all duration-1000"
          style={{ background: `rgba(${c},0.05)` }} />
        <div className="absolute top-3/4 left-1/2 w-64 h-64 rounded-full blur-[100px] transition-all duration-1000"
          style={{ background: `rgba(${c},0.04)` }} />
      </div>

      {/* ── Header + Search ── */}
      <div className="relative z-10 flex items-center gap-4 mb-8 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-1000"
            style={{
              background: `linear-gradient(135deg,rgba(${c},.8),rgba(${c},.3))`,
              boxShadow: `0 0 12px rgba(${c},.4)`
            }}>
            <div className="w-2 h-2 rounded-full bg-background" />
          </div>
          <span className="font-serif text-xl tracking-[0.25em] uppercase hidden sm:block transition-all duration-1000"
            style={{ color: `rgba(${c},.9)` }}>Vinyl</span>
        </div>

        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input ref={inputRef} data-testid="input-search" type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search any song or artist…"
              className="w-full bg-card border border-border rounded-full pl-9 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-all"
              style={{ "--tw-ring-color": `rgba(${c},.4)` } as React.CSSProperties} />
            {query && (
              <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          <button data-testid="button-search" type="submit" disabled={isSearching}
            className="metallic-button px-5 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
            style={{ color: `rgba(${c},.9)` }}>
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : "Search"}
          </button>
        </form>
      </div>

      {/* ── Main layout ── */}
      <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center"
        style={{ paddingBottom: "13rem" }}>

        {/* ── Left: Info + Controls ── */}
        <div className="col-span-1 lg:col-span-5 flex flex-col gap-8">

          {!currentTrack && (
            <div className="text-center lg:text-left space-y-4 py-12">
              <p className="text-6xl font-serif" style={{ color: `rgba(${c},.15)` }}>♫</p>
              <p className="text-sm text-muted-foreground">Search for any song above to start playing</p>
              <p className="text-xs" style={{ color: `rgba(${c},.3)` }}>Full-length songs via YouTube Audio</p>
            </div>
          )}

          {currentTrack && (
            <div className="space-y-1.5 text-center lg:text-left">
              <motion.div key={`${currentTrack.trackId}-badge`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 justify-center lg:justify-start">
                <p className="text-xs uppercase tracking-[0.3em] font-semibold transition-all duration-1000"
                  style={{ color: `rgba(${c},.7)` }}>Now Playing</p>
                <AnimatePresence>
                  {isFindingStream ? (
                    <motion.span key="finding" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{ background: `rgba(${c},.15)`, color: `rgba(${c},.9)`, border: `1px solid rgba(${c},.2)` }}>
                      <Loader2 size={8} className="animate-spin" /> Finding stream…
                    </motion.span>
                  ) : (
                    <motion.span key="full" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{ background: `rgba(${c},.15)`, color: `rgba(${c},.9)`, border: `1px solid rgba(${c},.2)` }}>
                      <Music size={8} /> Full Song
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>

              <motion.h1 key={`${currentTrack.trackId}-ttl`}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="font-serif text-4xl md:text-5xl font-semibold leading-tight transition-all duration-1000"
                style={{ textShadow: `0 0 40px rgba(${c},.25)` }}>
                {currentTrack.trackName}
              </motion.h1>
              <motion.p key={`${currentTrack.trackId}-art`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-lg text-muted-foreground font-serif italic">
                {currentTrack.artistName}
              </motion.p>
              <motion.p key={`${currentTrack.trackId}-alb`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-sm transition-all duration-1000" style={{ color: `rgba(${c},.35)` }}>
                {currentTrack.collectionName}
              </motion.p>
            </div>
          )}

          {currentTrack && (
            <div className="flex flex-col gap-5 w-full max-w-sm mx-auto lg:mx-0">

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div data-testid="progress-bar"
                  className="h-1 rounded-full overflow-hidden border cursor-pointer relative group"
                  style={{ background: "rgba(0,0,0,.5)", borderColor: "rgba(255,255,255,.05)" }}
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    seek(((e.clientX - rect.left) / rect.width) * 100);
                  }}>
                  <div className="h-full rounded-full relative transition-all duration-500"
                    style={{
                      width: `${progress}%`,
                      background: `linear-gradient(to right, rgba(${c},.5), rgb(${c}))`
                    }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ boxShadow: `0 0 8px rgba(${c},.8)` }} />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-mono tracking-wider">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Transport controls */}
              <div className="flex items-center justify-between lg:justify-start lg:gap-8">
                <div className="flex items-center gap-4">
                  <button data-testid="button-prev" onClick={handlePrev}
                    disabled={currentIdx === 0}
                    className="w-12 h-12 rounded-full metallic-button flex items-center justify-center transition-colors disabled:opacity-30"
                    style={{ color: `rgba(${c},.8)` }}>
                    <SkipBack size={20} fill="currentColor" />
                  </button>
                  <button data-testid="button-play-pause" onClick={togglePlay}
                    className="w-16 h-16 rounded-full metallic-button flex items-center justify-center transition-all duration-300"
                    style={{ color: `rgb(${c})`, boxShadow: `0 0 20px rgba(${c},.2)` }}>
                    {busy
                      ? <Loader2 size={24} className="animate-spin" />
                      : isPlaying
                        ? <Pause size={24} fill="currentColor" />
                        : <Play size={24} fill="currentColor" className="ml-1" />}
                  </button>
                  <button data-testid="button-next" onClick={handleNext}
                    disabled={currentIdx >= searchResults.length - 1}
                    className="w-12 h-12 rounded-full metallic-button flex items-center justify-center transition-colors disabled:opacity-30"
                    style={{ color: `rgba(${c},.8)` }}>
                    <SkipForward size={20} fill="currentColor" />
                  </button>
                </div>
                <VolumeKnob volume={volume} onChange={changeVolume} accentColor={c} />
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Turntable ── */}
        <div className="col-span-1 lg:col-span-7 flex justify-center">
          <div className="relative w-[300px] h-[300px] md:w-[460px] md:h-[460px] plinth-texture rounded-xl border border-white/5 shadow-2xl"
            style={{ padding: "2rem", transform: "perspective(1000px) rotateX(12deg) rotateY(-5deg) rotateZ(2deg)" }}>

            {/* Platter glow */}
            <div className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-1000"
              style={{ boxShadow: `0 0 60px rgba(${c},.05) inset` }} />

            {/* Platter */}
            <div className="absolute top-1/2 left-[45%] -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] md:w-[400px] md:h-[400px] rounded-full border"
              style={{ background: "#111", borderColor: "#222", boxShadow: "0 10px 20px rgba(0,0,0,.8), inset 0 0 10px rgba(0,0,0,.5)" }}>

              {/* Vinyl record */}
              <div className="w-full h-full rounded-full vinyl-grooves relative flex items-center justify-center spin-record"
                style={{ animationPlayState: isPlaying ? "running" : "paused" }}>
                <div className="absolute inset-0 rounded-full vinyl-highlight pointer-events-none mix-blend-screen" />

                {/* Label / album art */}
                <div className="w-[95px] h-[95px] md:w-[130px] md:h-[130px] rounded-full overflow-hidden relative shrink-0 transition-all duration-1000"
                  style={{
                    boxShadow: `inset 0 0 10px rgba(0,0,0,.5), 0 0 20px rgba(${c},.2)`,
                    background: "#222",
                    border: `2px solid rgba(${c},.3)`
                  }}>
                  {currentTrack?.artworkUrl ? (
                    <img src={currentTrack.artworkUrl} alt={currentTrack.collectionName}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg,rgba(${c},.2),rgba(${c},.05))` }}>
                      <span className="text-2xl font-serif" style={{ color: `rgba(${c},.2)` }}>V</span>
                    </div>
                  )}
                  {/* Spindle hole */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 rounded-full z-10"
                    style={{ background: "#1a1a1a", border: "1px solid rgba(0,0,0,.5)", boxShadow: "inset 0 0 4px rgba(0,0,0,.8)" }} />
                </div>

                {busy && (
                  <div className="absolute inset-0 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,.5)" }}>
                    <div className="text-center space-y-2">
                      <Loader2 size={32} className="animate-spin mx-auto" style={{ color: `rgb(${c})` }} />
                      {isFindingStream && (
                        <p className="text-[10px] uppercase tracking-widest" style={{ color: `rgba(${c},.7)` }}>
                          Finding stream…
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Tonearm isPlaying={isPlaying} progress={progress} accentColor={c} />
          </div>
        </div>
      </div>

      {/* ── Bottom shelf ── */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-5 pt-12 z-20"
        style={{ background: "linear-gradient(to top, #000 0%, rgba(0,0,0,.9) 50%, transparent 100%)" }}>
        <div className="max-w-6xl mx-auto">
          {isSearching ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 size={14} className="animate-spin" style={{ color: `rgb(${c})` }} />
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Searching…</p>
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-semibold">
                {searchResults.length} tracks — click to play full song
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar">
                {searchResults.map((track, idx) => (
                  <button key={track.trackId} data-testid={`card-track-${track.trackId}`}
                    onClick={() => playTrack(track, idx)}
                    className={`snap-start shrink-0 text-left transition-transform duration-300 ${
                      currentTrack?.trackId === track.trackId ? "-translate-y-4" : "hover:-translate-y-2"
                    }`}>
                    <div className="w-28 h-28 md:w-32 md:h-32 rounded-sm relative overflow-hidden bg-card"
                      style={{
                        boxShadow: "5px 5px 15px rgba(0,0,0,.6)",
                        border: currentTrack?.trackId === track.trackId
                          ? `1.5px solid rgba(${c},.6)`
                          : "1px solid rgba(255,255,255,.08)"
                      }}>
                      {track.artworkUrl && (
                        <img src={track.artworkUrl} alt={track.collectionName} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0"
                        style={{ background: "linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.1) 60%,transparent 100%)" }} />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-[9px] truncate" style={{ color: "rgba(255,255,255,.45)" }}>
                          {track.artistName}
                        </p>
                        <p className="text-xs font-semibold text-white truncate leading-tight">
                          {track.trackName}
                        </p>
                      </div>
                      {currentTrack?.trackId === track.trackId && isPlaying && (
                        <div className="absolute top-1.5 right-1.5 flex gap-px items-end" style={{ height: 14 }}>
                          {[40, 80, 55, 90, 65].map((h, i) => (
                            <div key={i} className="w-px rounded-full playing-bar"
                              style={{ background: `rgb(${c})`, height: `${h}%`, animationDelay: `${i * 0.12}s` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs uppercase tracking-widest font-semibold py-1"
              style={{ color: `rgba(${c},.2)` }}>
              Search above to fill your collection
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Volume Knob ───────────────────────────────────────────────── */
function VolumeKnob({ volume, onChange, accentColor }: { volume: number; onChange: (v: number) => void; accentColor: string }) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const angle = -135 + volume * 270;
  const c = accentColor;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div ref={knobRef}
        className="w-12 h-12 rounded-full metallic-button relative cursor-ns-resize"
        onPointerDown={e => { setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerUp={e => { setDragging(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerMove={e => {
          if (!dragging || !knobRef.current) return;
          const r = knobRef.current.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          let a = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
          if (a > 180) a -= 360;
          a = Math.max(-135, Math.min(135, a));
          onChange(Math.min(1, Math.max(0, (a + 135) / 270)));
        }}>
        <div className="absolute inset-0 rounded-full" style={{ transform: `rotate(${angle}deg)` }}>
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 rounded-full transition-all duration-1000"
            style={{ background: `rgb(${c})`, boxShadow: `0 0 5px rgba(${c},.5)` }} />
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Vol</span>
    </div>
  );
}

/* ─── Tonearm ───────────────────────────────────────────────────── */
function Tonearm({ isPlaying, progress, accentColor }: { isPlaying: boolean; progress: number; accentColor: string }) {
  const rotation = isPlaying ? 28 + progress * 0.15 : 15;
  return (
    <div className="absolute top-8 right-8 md:top-12 md:right-12 w-24 h-64 md:w-32 md:h-80 pointer-events-none z-10">
      <motion.div animate={{ rotate: rotation }} transition={{ type: "spring", stiffness: 40, damping: 15 }}
        className="relative w-full h-full" style={{ transformOrigin: "80% 15%" }}>
        {/* Pivot */}
        <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 rounded-full border-4 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#444,#111)", borderColor: "#222", boxShadow: "0 4px 12px rgba(0,0,0,.8)" }}>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border"
            style={{ background: "#1a1a1a", borderColor: "rgba(0,0,0,.5)", boxShadow: "inset 0 2px 4px rgba(0,0,0,.8)" }} />
        </div>
        {/* Arm */}
        <div className="absolute top-8 right-8 w-2 h-48 md:w-3 md:h-64 rounded-full"
          style={{ background: "linear-gradient(to right,#e0e0e0,#888,#e0e0e0)", transform: "rotate(-20deg)", transformOrigin: "top center", boxShadow: "2px 10px 10px rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.2)" }} />
        {/* Headshell */}
        <div className="absolute bottom-4 left-6 md:bottom-2 md:left-8 w-6 h-12 md:w-8 md:h-16 rounded-sm"
          style={{ background: "#111", transform: "rotate(10deg)", boxShadow: "0 10px 15px rgba(0,0,0,.6)", border: "1px solid #333" }}>
          <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full transition-all duration-1000"
            style={{ background: `rgb(${accentColor})`, boxShadow: `0 0 5px rgb(${accentColor})` }} />
        </div>
      </motion.div>
    </div>
  );
}
