import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Search, X, Loader2, ExternalLink } from "lucide-react";
import type { iTunesTrack } from "./lib/itunes";
import { searchMusic } from "./lib/itunes";
import { useAudioPlayer } from "./hooks/useAudioPlayer";

/* ─── Helpers ──────────────────────────────────────────────────────── */
function formatTime(s: number): string {
  if (!s || !isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function ytSearchUrl(track: iTunesTrack) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(track.artistName + " " + track.trackName)}`;
}

/* ─── App ───────────────────────────────────────────────────────────── */
export default function App() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<iTunesTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<iTunesTrack | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isPlaying, progress, currentTime, duration,
    volume, isLoading, loadAndPlay, togglePlay, seek, changeVolume, setOnEnded,
  } = useAudioPlayer();

  /* Keep stable ref for auto-advance */
  const searchResultsRef = useRef<iTunesTrack[]>([]);
  const currentIdxRef = useRef(0);
  useEffect(() => { searchResultsRef.current = searchResults; }, [searchResults]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  /* Auto-advance when a track ends */
  useEffect(() => {
    setOnEnded(() => {
      const results = searchResultsRef.current;
      const idx = currentIdxRef.current;
      if (idx < results.length - 1) {
        const next = results[idx + 1];
        setCurrentTrack(next);
        setCurrentIdx(idx + 1);
        currentIdxRef.current = idx + 1;
        loadAndPlay(next.previewUrl);
      }
    });
  }, [setOnEnded, loadAndPlay]);

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

  /* ── Select a track ── */
  const handleSelectTrack = useCallback((track: iTunesTrack, idx: number) => {
    setCurrentTrack(track);
    setCurrentIdx(idx);
    currentIdxRef.current = idx;
    loadAndPlay(track.previewUrl);
  }, [loadAndPlay]);

  const handlePrev = () => {
    if (currentIdx > 0 && searchResults.length > 0) {
      handleSelectTrack(searchResults[currentIdx - 1], currentIdx - 1);
    }
  };

  const handleNext = () => {
    if (currentIdx < searchResults.length - 1) {
      handleSelectTrack(searchResults[currentIdx + 1], currentIdx + 1);
    }
  };

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-4 md:p-8 font-sans overflow-hidden relative">

      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px]"
          style={{ background: "rgba(212,168,83,0.06)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[32rem] h-[32rem] rounded-full blur-[150px]"
          style={{ background: "rgba(100,50,10,0.07)" }} />
      </div>

      {/* ── Header + Search ── */}
      <div className="relative z-10 flex items-center gap-4 mb-8 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(212,168,83,.8),rgba(212,168,83,.3))", boxShadow: "0 0 12px rgba(212,168,83,.4)" }}>
            <div className="w-2 h-2 rounded-full bg-background" />
          </div>
          <span className="font-serif text-xl tracking-[0.25em] uppercase hidden sm:block"
            style={{ color: "rgba(212,168,83,.9)" }}>Vinyl</span>
        </div>

        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              data-testid="input-search"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search any song or artist..."
              className="w-full bg-card border border-border rounded-full pl-9 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          <button data-testid="button-search" type="submit" disabled={isSearching}
            className="metallic-button px-5 py-2.5 rounded-full text-sm font-medium text-primary hover:text-amber-300 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : "Search"}
          </button>
        </form>
      </div>

      {/* ── Main layout ── */}
      <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center"
        style={{ paddingBottom: "13rem" }}>

        {/* ── Left: Info + Controls ── */}
        <div className="col-span-1 lg:col-span-5 flex flex-col gap-8">

          {/* Empty state */}
          {!currentTrack && (
            <div className="text-center lg:text-left space-y-4 py-12">
              <p className="text-6xl font-serif" style={{ color: "rgba(212,168,83,.15)" }}>♫</p>
              <p className="text-sm text-muted-foreground">Search for any song above to start playing</p>
              <p className="text-xs" style={{ color: "rgba(212,168,83,.3)" }}>
                Previews via iTunes · Full songs open on YouTube
              </p>
            </div>
          )}

          {/* Track info */}
          {currentTrack && (
            <div className="space-y-1.5 text-center lg:text-left">
              <motion.p key={`${currentTrack.trackId}-lbl`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-xs uppercase tracking-[0.3em] font-semibold"
                style={{ color: "rgba(212,168,83,.7)" }}>
                Now Playing
              </motion.p>
              <motion.h1 key={`${currentTrack.trackId}-ttl`}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="font-serif text-4xl md:text-5xl font-semibold leading-tight glow-text">
                {currentTrack.trackName}
              </motion.h1>
              <motion.p key={`${currentTrack.trackId}-art`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-lg text-muted-foreground font-serif italic">
                {currentTrack.artistName}
              </motion.p>
              <motion.p key={`${currentTrack.trackId}-alb`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-sm" style={{ color: "rgba(212,168,83,.35)" }}>
                {currentTrack.collectionName}
              </motion.p>
              <motion.a
                key={`${currentTrack.trackId}-yt`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                href={ytSearchUrl(currentTrack)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs mt-2 hover:text-primary transition-colors"
                style={{ color: "rgba(212,168,83,.45)" }}>
                <ExternalLink size={11} />
                Full song on YouTube
              </motion.a>
            </div>
          )}

          {/* Progress + Controls */}
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
                      background: "linear-gradient(to right, rgba(212,168,83,.5), rgb(212,168,83))"
                    }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ boxShadow: "0 0 8px rgba(212,168,83,.8)" }} />
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
                    style={{ color: "rgba(212,168,83,.8)" }}>
                    <SkipBack size={20} fill="currentColor" />
                  </button>
                  <button data-testid="button-play-pause" onClick={togglePlay}
                    className="w-16 h-16 rounded-full metallic-button flex items-center justify-center transition-colors"
                    style={{ color: "rgb(212,168,83)", boxShadow: "0 0 15px rgba(212,168,83,.15)" }}>
                    {isLoading
                      ? <Loader2 size={24} className="animate-spin" />
                      : isPlaying
                        ? <Pause size={24} fill="currentColor" />
                        : <Play size={24} fill="currentColor" className="ml-1" />}
                  </button>
                  <button data-testid="button-next" onClick={handleNext}
                    disabled={currentIdx >= searchResults.length - 1}
                    className="w-12 h-12 rounded-full metallic-button flex items-center justify-center transition-colors disabled:opacity-30"
                    style={{ color: "rgba(212,168,83,.8)" }}>
                    <SkipForward size={20} fill="currentColor" />
                  </button>
                </div>
                <VolumeKnob volume={volume} onChange={changeVolume} />
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Turntable ── */}
        <div className="col-span-1 lg:col-span-7 flex justify-center">
          <div className="relative w-[300px] h-[300px] md:w-[460px] md:h-[460px] plinth-texture rounded-xl border border-white/5 shadow-2xl"
            style={{ padding: "2rem 2rem 2rem 2rem", transform: "perspective(1000px) rotateX(12deg) rotateY(-5deg) rotateZ(2deg)" }}>

            {/* Platter */}
            <div className="absolute top-1/2 left-[45%] -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] md:w-[400px] md:h-[400px] rounded-full border"
              style={{ background: "#111", borderColor: "#222", boxShadow: "0 10px 20px rgba(0,0,0,.8), inset 0 0 10px rgba(0,0,0,.5)" }}>

              {/* Vinyl record */}
              <div className="w-full h-full rounded-full vinyl-grooves relative flex items-center justify-center spin-record"
                style={{ animationPlayState: isPlaying ? "running" : "paused" }}>
                <div className="absolute inset-0 rounded-full vinyl-highlight pointer-events-none mix-blend-screen" />

                {/* Label / album art */}
                <div className="w-[95px] h-[95px] md:w-[130px] md:h-[130px] rounded-full overflow-hidden relative shrink-0"
                  style={{ boxShadow: "inset 0 0 10px rgba(0,0,0,.5)", background: "#222" }}>
                  {currentTrack?.artworkUrl ? (
                    <img src={currentTrack.artworkUrl} alt={currentTrack.collectionName}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,rgba(212,168,83,.2),rgba(212,168,83,.05))" }}>
                      <span className="text-2xl font-serif" style={{ color: "rgba(212,168,83,.2)" }}>V</span>
                    </div>
                  )}
                  {/* Spindle hole */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 rounded-full z-10"
                    style={{ background: "#1a1a1a", border: "1px solid rgba(0,0,0,.5)", boxShadow: "inset 0 0 4px rgba(0,0,0,.8)" }} />
                </div>

                {isLoading && (
                  <div className="absolute inset-0 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,.4)" }}>
                    <Loader2 size={32} className="animate-spin" style={{ color: "rgb(212,168,83)" }} />
                  </div>
                )}
              </div>
            </div>

            <Tonearm isPlaying={isPlaying} progress={progress} />
          </div>
        </div>
      </div>

      {/* ── Bottom shelf ── */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-5 pt-12 z-20"
        style={{ background: "linear-gradient(to top, #000 0%, rgba(0,0,0,.9) 50%, transparent 100%)" }}>
        <div className="max-w-6xl mx-auto">
          {isSearching ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 size={14} className="animate-spin text-primary" />
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Searching…</p>
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-semibold">
                {searchResults.length} tracks — click to play
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar">
                {searchResults.map((track, idx) => (
                  <button key={track.trackId} data-testid={`card-track-${track.trackId}`}
                    onClick={() => handleSelectTrack(track, idx)}
                    className={`snap-start shrink-0 text-left transition-transform duration-300 ${
                      currentTrack?.trackId === track.trackId ? "-translate-y-4" : "hover:-translate-y-2"
                    }`}>
                    <div className="w-28 h-28 md:w-32 md:h-32 rounded-sm relative overflow-hidden bg-card"
                      style={{ boxShadow: "5px 5px 15px rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.08)" }}>
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

                      {/* Playing indicator */}
                      {currentTrack?.trackId === track.trackId && isPlaying && (
                        <div className="absolute top-1.5 right-1.5 flex gap-px items-end" style={{ height: 14 }}>
                          {[40, 80, 55, 90, 65].map((h, i) => (
                            <div key={i} className="w-px rounded-full playing-bar"
                              style={{ background: "rgb(212,168,83)", height: `${h}%`, animationDelay: `${i * 0.12}s` }} />
                          ))}
                        </div>
                      )}
                      {currentTrack?.trackId === track.trackId && (
                        <div className="absolute inset-0 rounded-sm pointer-events-none"
                          style={{ border: "1.5px solid rgba(212,168,83,.5)" }} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs uppercase tracking-widest font-semibold py-1"
              style={{ color: "rgba(212,168,83,.2)" }}>
              Search above to fill your collection
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Volume Knob ───────────────────────────────────────────────────── */
function VolumeKnob({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const angle = -135 + volume * 270;

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
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 rounded-full"
            style={{ background: "rgb(212,168,83)", boxShadow: "0 0 5px rgba(212,168,83,.5)" }} />
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Vol</span>
    </div>
  );
}

/* ─── Tonearm ───────────────────────────────────────────────────────── */
function Tonearm({ isPlaying, progress }: { isPlaying: boolean; progress: number }) {
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
          <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full"
            style={{ background: "#cc0000", boxShadow: "0 0 5px red" }} />
        </div>
      </motion.div>
    </div>
  );
}
