import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Search, X, Loader2, Music,
  Repeat, Repeat1, Volume2, VolumeX, Zap, AlarmClock,
  FileText, BookOpen, Info, Share2, ChevronLeft, TrendingUp, Clock,
} from "lucide-react";
import type { iTunesTrack } from "./lib/itunes";
import { searchMusic, getTopCharts, getArtistTracks, getSuggestions } from "./lib/itunes";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import Turntable, { type TurntableFinish } from "./components/Turntable";
import SidePanel, { type PanelType } from "./components/SidePanel";

/* ── Helpers ─────────────────────────────────────────────────────── */
function fmt(s: number) {
  if (!s || !isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
async function extractAccentColor(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const cv = document.createElement("canvas"); cv.width = cv.height = 60;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 60, 60);
        const d = ctx.getImageData(0, 0, 60, 60).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const bri = (d[i] + d[i+1] + d[i+2]) / 3;
          if (bri > 25 && bri < 230) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
        }
        if (!n) { resolve("212,168,83"); return; }
        r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n);
        const mx = Math.max(r,g,b);
        if (mx > 0 && mx < 200) { const boost = 200/mx; r=Math.min(255,Math.round(r*boost)); g=Math.min(255,Math.round(g*boost)); b=Math.min(255,Math.round(b*boost)); }
        resolve(`${r},${g},${b}`);
      } catch { resolve("212,168,83"); }
    };
    img.onerror = () => resolve("212,168,83");
    img.src = url;
  });
}
async function findStream(track: iTunesTrack): Promise<string | null> {
  try {
    const r = await fetch(`/api/songs/find?q=${encodeURIComponent(track.artistName + " " + track.trackName)}`);
    if (!r.ok) return null;
    const d = await r.json() as { videoId: string };
    return `/api/songs/audio?id=${d.videoId}`;
  } catch { return null; }
}

/* ── Finish definitions ──────────────────────────────────────────── */
const FINISHES: { id: TurntableFinish; label: string; swatch: string }[] = [
  { id: "walnut",   label: "Walnut",  swatch: "#5c3d24" },
  { id: "black",    label: "Black",   swatch: "#1c1c1c" },
  { id: "aluminum", label: "Alum.",   swatch: "#aaa"    },
];
const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
const SLEEP_OPTS = [15, 30, 60] as const;
type LoopMode = "off" | "one" | "all";
type TabId = "search" | "charts" | "history";

/* ═══════════════════════════════════════════════════════════════════ */
export default function App() {
  /* ── Playback ── */
  const {
    isPlaying, progress, currentTime, duration,
    volume, isLoading, isMuted, playbackRate,
    loadAndPlay, togglePlay, seek, seekBy,
    changeVolume, toggleMute, setPlaybackRate,
    setOnEnded, forceStop, audioRef,
  } = useAudioPlayer();

  /* ── State ── */
  const [query, setQuery]                   = useState("");
  const [searchResults, setSearchResults]   = useState<iTunesTrack[]>([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [currentTrack, setCurrentTrack]     = useState<iTunesTrack | null>(null);
  const [currentIdx, setCurrentIdx]         = useState(0);
  const [isFindingStream, setIsFindingStream] = useState(false);
  const [accentColor, setAccentColor]       = useState("212,168,83");

  const [loopMode, setLoopMode]             = useState<LoopMode>("off");
  const [activeTab, setActiveTab]           = useState<TabId>("search");
  const [chartsData, setChartsData]         = useState<iTunesTrack[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [recentlyPlayed, setRecentlyPlayed] = useState<iTunesTrack[]>(() => {
    try { return JSON.parse(localStorage.getItem("vinyl-history") ?? "[]"); } catch { return []; }
  });
  const [activeSidePanel, setActiveSidePanel] = useState<PanelType>(null);
  const [suggestions, setSuggestions]       = useState<iTunesTrack[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isArtistView, setIsArtistView]     = useState(false);
  const [artistTracks, setArtistTracks]     = useState<iTunesTrack[]>([]);
  const [artistName, setArtistName]         = useState("");
  const [isLoadingArtist, setIsLoadingArtist] = useState(false);
  const [turntableFinish, setTurntableFinish] = useState<TurntableFinish>("walnut");
  const [sleepMinutes, setSleepMinutes]     = useState<15 | 30 | 60 | null>(null);
  const [sleepSecsLeft, setSleepSecsLeft]   = useState(0);
  const [showSleepMenu, setShowSleepMenu]   = useState(false);
  const [showSpeedMenu, setShowSpeedMenu]   = useState(false);

  const inputRef            = useRef<HTMLInputElement>(null);
  const searchResultsRef    = useRef<iTunesTrack[]>([]);
  const currentIdxRef       = useRef(0);
  const currentTrackRef     = useRef<iTunesTrack | null>(null);
  const loopModeRef         = useRef<LoopMode>("off");

  useEffect(() => { searchResultsRef.current = searchResults; }, [searchResults]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { loopModeRef.current = loopMode; }, [loopMode]);

  const c = accentColor;
  const busy = isLoading || isFindingStream;

  /* ── Play a track (full song via API, fallback to iTunes preview) ── */
  const playTrack = useCallback(async (track: iTunesTrack, idx: number) => {
    setCurrentTrack(track);
    setCurrentIdx(idx);
    currentIdxRef.current = idx;
    setIsFindingStream(true);
    setActiveSidePanel(null);

    if (track.artworkUrl) extractAccentColor(track.artworkUrl).then(setAccentColor).catch(() => {});

    /* Add to history */
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => t.trackId !== track.trackId);
      const next = [track, ...filtered].slice(0, 25);
      try { localStorage.setItem("vinyl-history", JSON.stringify(next)); } catch {}
      return next;
    });

    const streamUrl = await findStream(track);
    setIsFindingStream(false);
    loadAndPlay(streamUrl ?? track.previewUrl);
  }, [loadAndPlay]);

  /* ── Loop + auto-advance ── */
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.loop = loopMode === "one";
  }, [loopMode, audioRef]);

  useEffect(() => {
    setOnEnded(() => {
      if (loopModeRef.current === "one") return;
      const results = searchResultsRef.current;
      const idx = currentIdxRef.current;
      if (loopModeRef.current === "all") {
        const next = (idx + 1) % results.length;
        playTrack(results[next], next);
      } else if (idx < results.length - 1) {
        playTrack(results[idx + 1], idx + 1);
      }
    });
  }, [setOnEnded, playTrack]);

  /* ── Sleep timer ── */
  useEffect(() => {
    if (!sleepMinutes) { setSleepSecsLeft(0); return; }
    let s = sleepMinutes * 60;
    setSleepSecsLeft(s);
    const id = setInterval(() => {
      s--;
      setSleepSecsLeft(s);
      if (s <= 0) { forceStop(); setSleepMinutes(null); clearInterval(id); }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepMinutes, forceStop]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.code) {
        case "Space":        e.preventDefault(); togglePlay(); break;
        case "ArrowLeft":    e.preventDefault(); seekBy(-5); break;
        case "ArrowRight":   e.preventDefault(); seekBy(5); break;
        case "ArrowUp":      e.preventDefault(); changeVolume(Math.min(1, volume + 0.05)); break;
        case "ArrowDown":    e.preventDefault(); changeVolume(Math.max(0, volume - 0.05)); break;
        case "KeyM":         toggleMute(); break;
        case "KeyL":         setLoopMode(m => m === "off" ? "one" : m === "one" ? "all" : "off"); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, changeVolume, volume, toggleMute]);

  /* ── Autocomplete ── */
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      getSuggestions(query).then(r => setSuggestions(r.slice(0, 6))).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  /* ── Charts (load on tab switch) ── */
  useEffect(() => {
    if (activeTab === "charts" && chartsData.length === 0 && !isLoadingCharts) {
      setIsLoadingCharts(true);
      getTopCharts().then(setChartsData).catch(() => {}).finally(() => setIsLoadingCharts(false));
    }
  }, [activeTab]);

  /* ── Search ── */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim(); if (!q) return;
    setIsSearching(true);
    setShowSuggestions(false);
    setIsArtistView(false);
    setActiveTab("search");
    try { setSearchResults(await searchMusic(q)); } catch { setSearchResults([]); }
    setIsSearching(false);
  };

  /* ── Artist view ── */
  const handleArtistClick = async (track: iTunesTrack) => {
    setIsArtistView(true);
    setIsLoadingArtist(true);
    setArtistName(track.artistName);
    setActiveTab("search");
    try {
      const tracks = track.artistId
        ? await getArtistTracks(track.artistId)
        : await searchMusic(track.artistName);
      setArtistTracks(tracks.length ? tracks : await searchMusic(track.artistName));
    } catch { setArtistTracks([]); }
    setIsLoadingArtist(false);
  };

  const handleSimilar = (track: iTunesTrack) => {
    const term = track.genre ? `${track.genre}` : track.artistName;
    setQuery(term);
    setIsArtistView(false);
    setActiveTab("search");
    setIsSearching(true);
    searchMusic(term).then(r => { setSearchResults(r); setIsSearching(false); }).catch(() => setIsSearching(false));
  };

  /* ── Displayed track list based on tab ── */
  const shelfTracks: iTunesTrack[] =
    isArtistView ? artistTracks :
    activeTab === "charts" ? chartsData :
    activeTab === "history" ? recentlyPlayed :
    searchResults;

  const handleNext = () => { const s = shelfTracks; if (currentIdx < s.length-1) playTrack(s[currentIdx+1], currentIdx+1); };
  const handlePrev = () => { if (currentIdx > 0) playTrack(shelfTracks[currentIdx-1], currentIdx-1); };

  const togglePanel = (p: PanelType) => setActiveSidePanel(ap => ap === p ? null : p);

  /* ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-4 md:p-8 font-sans overflow-hidden relative"
      onClick={() => { setShowSuggestions(false); setShowSleepMenu(false); setShowSpeedMenu(false); }}>

      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[140px] transition-all duration-1000"
          style={{ background: `rgba(${c},.08)` }} />
        <div className="absolute bottom-1/4 right-1/4 w-[36rem] h-[36rem] rounded-full blur-[180px] transition-all duration-1000"
          style={{ background: `rgba(${c},.05)` }} />
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 flex items-center gap-4 mb-6 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-1000"
            style={{ background: `linear-gradient(135deg,rgba(${c},.8),rgba(${c},.3))`, boxShadow: `0 0 12px rgba(${c},.4)` }}>
            <div className="w-2 h-2 rounded-full bg-background" />
          </div>
          <span className="font-serif text-xl tracking-[0.25em] uppercase hidden sm:block transition-all duration-1000"
            style={{ color: `rgba(${c},.9)` }}>Vinyl</span>
        </div>

        {/* Search bar with autocomplete */}
        <form onSubmit={handleSearch} className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input ref={inputRef} data-testid="input-search" type="text" value={query}
              onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search any song or artist…"
              className="w-full bg-card border border-border rounded-full pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all"
              style={{ "--tw-ring-color": `rgba(${c},.4)` } as React.CSSProperties} />
            {query && <button type="button" onClick={() => { setQuery(""); setSuggestions([]); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><X size={14} /></button>}
            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
                  className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50 border"
                  style={{ background: "rgba(12,10,8,.97)", borderColor: `rgba(${c},.2)`, boxShadow: `0 8px 32px rgba(0,0,0,.7)` }}>
                  {suggestions.map((s, i) => (
                    <button key={i} type="button"
                      onClick={() => { setQuery(`${s.trackName} ${s.artistName}`); setShowSuggestions(false); handleSearch({ preventDefault: () => {} } as React.FormEvent); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                      <img src={s.artworkUrl} alt="" className="w-8 h-8 rounded shrink-0 object-cover" />
                      <div className="overflow-hidden">
                        <p className="text-sm truncate">{s.trackName}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.artistName}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button data-testid="button-search" type="submit" disabled={isSearching}
            className="metallic-button px-5 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
            style={{ color: `rgba(${c},.9)` }}>
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : "Search"}
          </button>
        </form>
      </div>

      {/* ── Main layout ── */}
      <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        style={{ paddingBottom: "12rem" }}>

        {/* ── Left: Info + Controls ── */}
        <div className="col-span-1 lg:col-span-5 flex flex-col gap-6">

          {!currentTrack && (
            <div className="text-center lg:text-left space-y-3 py-10">
              <p className="text-6xl font-serif" style={{ color: `rgba(${c},.12)` }}>♫</p>
              <p className="text-sm text-muted-foreground">Search for any song above to start playing</p>
              <p className="text-[11px] tracking-wide" style={{ color: `rgba(${c},.3)` }}>Full-length songs · YouTube Audio Backend</p>
            </div>
          )}

          {currentTrack && (
            <>
              {/* Track info */}
              <div className="space-y-1 text-center lg:text-left">
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <p className="text-xs uppercase tracking-[0.3em] font-semibold transition-all duration-1000"
                    style={{ color: `rgba(${c},.7)` }}>Now Playing</p>
                  <AnimatePresence mode="wait">
                    {isFindingStream ? (
                      <motion.span key="finding" initial={{ opacity:0,scale:.8 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0,scale:.8 }}
                        className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background:`rgba(${c},.15)`, color:`rgba(${c},.9)`, border:`1px solid rgba(${c},.2)` }}>
                        <Loader2 size={8} className="animate-spin" /> Finding…
                      </motion.span>
                    ) : (
                      <motion.span key="full" initial={{ opacity:0,scale:.8 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0,scale:.8 }}
                        className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background:`rgba(${c},.15)`, color:`rgba(${c},.9)`, border:`1px solid rgba(${c},.2)` }}>
                        <Music size={8} /> Full Song
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <motion.h1 key={`ttl-${currentTrack.trackId}`} initial={{ opacity:0,x:-10 }} animate={{ opacity:1,x:0 }}
                  className="font-serif text-3xl md:text-4xl font-semibold leading-tight transition-all duration-1000"
                  style={{ textShadow:`0 0 40px rgba(${c},.22)` }}>
                  {currentTrack.trackName}
                </motion.h1>
                <button onClick={() => handleArtistClick(currentTrack)}
                  className="text-base text-muted-foreground font-serif italic hover:underline transition-colors text-left">
                  {currentTrack.artistName}
                </button>
                <p className="text-xs transition-all duration-1000" style={{ color:`rgba(${c},.35)` }}>
                  {currentTrack.collectionName}
                  {currentTrack.releaseYear ? ` · ${currentTrack.releaseYear}` : ""}
                  {currentTrack.genre ? ` · ${currentTrack.genre}` : ""}
                </p>
                {/* Similar + panel buttons */}
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start pt-1">
                  <SmBtn icon={<Zap size={10} />} label="Similar" onClick={() => handleSimilar(currentTrack)} c={c} />
                  <SmBtn icon={<FileText size={10} />} label="Lyrics" onClick={() => togglePanel("lyrics")} c={c} active={activeSidePanel==="lyrics"} />
                  <SmBtn icon={<BookOpen size={10} />} label="Bio" onClick={() => togglePanel("bio")} c={c} active={activeSidePanel==="bio"} />
                  <SmBtn icon={<Info size={10} />} label="Info" onClick={() => togglePanel("info")} c={c} active={activeSidePanel==="info"} />
                  <SmBtn icon={<Share2 size={10} />} label="Share" onClick={() => togglePanel("share")} c={c} active={activeSidePanel==="share"} />
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5 w-full max-w-sm mx-auto lg:mx-0">
                <div className="h-1 rounded-full overflow-hidden border cursor-pointer relative group"
                  style={{ background:"rgba(0,0,0,.5)", borderColor:"rgba(255,255,255,.05)" }}
                  onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seek(((e.clientX-r.left)/r.width)*100); }}>
                  <div className="h-full rounded-full relative transition-all duration-500"
                    style={{ width:`${progress}%`, background:`linear-gradient(to right,rgba(${c},.5),rgb(${c}))` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
                      style={{ boxShadow:`0 0 8px rgba(${c},.9)` }} />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-mono tracking-wider">
                  <span>{fmt(currentTime)}</span>
                  <span>{fmt(duration)}</span>
                </div>
              </div>

              {/* ── Main controls row ── */}
              <div className="flex items-center justify-between w-full max-w-sm mx-auto lg:mx-0">
                <button data-testid="button-prev" onClick={handlePrev} disabled={currentIdx === 0}
                  className="w-11 h-11 rounded-full metallic-button flex items-center justify-center disabled:opacity-30 transition-colors"
                  style={{ color:`rgba(${c},.8)` }}><SkipBack size={18} fill="currentColor" /></button>

                <button data-testid="button-play-pause" onClick={togglePlay}
                  className="w-16 h-16 rounded-full metallic-button flex items-center justify-center transition-all"
                  style={{ color:`rgb(${c})`, boxShadow:`0 0 24px rgba(${c},.2)` }}>
                  {busy ? <Loader2 size={24} className="animate-spin" />
                    : isPlaying ? <Pause size={24} fill="currentColor" />
                    : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>

                <button data-testid="button-next" onClick={handleNext} disabled={currentIdx >= shelfTracks.length-1}
                  className="w-11 h-11 rounded-full metallic-button flex items-center justify-center disabled:opacity-30 transition-colors"
                  style={{ color:`rgba(${c},.8)` }}><SkipForward size={18} fill="currentColor" /></button>

                {/* Mute */}
                <button onClick={toggleMute}
                  className="w-10 h-10 rounded-full metallic-button flex items-center justify-center transition-colors"
                  style={{ color: isMuted ? "rgba(255,255,255,.3)" : `rgba(${c},.8)` }}>
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>

                <VolumeKnob volume={volume} onChange={changeVolume} c={c} />
              </div>

              {/* ── Secondary controls ── */}
              <div className="flex items-center gap-3 w-full max-w-sm mx-auto lg:mx-0 flex-wrap">
                {/* Loop */}
                <button onClick={() => setLoopMode(m => m==="off"?"one":m==="one"?"all":"off")}
                  title={`Loop: ${loopMode}`}
                  className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs transition-all metallic-button"
                  style={{ color: loopMode!=="off" ? `rgb(${c})` : `rgba(${c},.45)`, background: loopMode!=="off" ? `rgba(${c},.1)` : "transparent" }}>
                  {loopMode==="one" ? <Repeat1 size={14} /> : <Repeat size={14} />}
                  <span className="hidden sm:inline">{loopMode==="off"?"Off":loopMode==="one"?"One":"All"}</span>
                </button>

                {/* Speed */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setShowSpeedMenu(v => !v)}
                    className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs metallic-button transition-all"
                    style={{ color:`rgba(${c},.8)`, background: playbackRate!==1 ? `rgba(${c},.1)` : "transparent" }}>
                    <Zap size={12} />{playbackRate}×
                  </button>
                  <AnimatePresence>
                    {showSpeedMenu && (
                      <motion.div initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:4 }}
                        className="absolute bottom-full mb-1 left-0 rounded-lg overflow-hidden border z-50"
                        style={{ background:"rgba(12,10,8,.97)", borderColor:`rgba(${c},.2)` }}>
                        {SPEEDS.map(s => (
                          <button key={s} onClick={() => { setPlaybackRate(s); setShowSpeedMenu(false); }}
                            className="w-full px-4 py-2 text-xs hover:bg-white/5 transition-colors flex items-center justify-between gap-4"
                            style={{ color: playbackRate===s ? `rgb(${c})` : "rgba(255,255,255,.7)" }}>
                            {s}× {playbackRate===s && "✓"}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Sleep timer */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <button onClick={() => sleepMinutes ? setSleepMinutes(null) : setShowSleepMenu(v => !v)}
                    className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs metallic-button transition-all"
                    style={{ color: sleepMinutes ? `rgb(${c})` : `rgba(${c},.45)`, background: sleepMinutes ? `rgba(${c},.1)` : "transparent" }}>
                    <AlarmClock size={12} />
                    {sleepMinutes ? fmt(sleepSecsLeft) : <span className="hidden sm:inline">Sleep</span>}
                  </button>
                  <AnimatePresence>
                    {showSleepMenu && (
                      <motion.div initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:4 }}
                        className="absolute bottom-full mb-1 left-0 rounded-lg overflow-hidden border z-50"
                        style={{ background:"rgba(12,10,8,.97)", borderColor:`rgba(${c},.2)` }}>
                        {SLEEP_OPTS.map(m => (
                          <button key={m} onClick={() => { setSleepMinutes(m); setShowSleepMenu(false); }}
                            className="w-full px-4 py-2 text-xs hover:bg-white/5 transition-colors whitespace-nowrap"
                            style={{ color:`rgba(${c},.8)` }}>
                            {m} min
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Keyboard hint */}
              <p className="text-[10px] tracking-widest hidden lg:block" style={{ color:`rgba(${c},.2)` }}>
                SPACE · ←→ seek · ↑↓ vol · M mute · L loop
              </p>
            </>
          )}
        </div>

        {/* ── Right: Turntable + SidePanel ── */}
        <div className="col-span-1 lg:col-span-7 flex flex-col items-center gap-4">
          <div className="relative">
            <Turntable
              isPlaying={isPlaying} progress={progress}
              currentTrack={currentTrack} isLoading={isLoading}
              isFindingStream={isFindingStream} accentColor={c}
              finish={turntableFinish} />
            <SidePanel panel={activeSidePanel} track={currentTrack} accentColor={c} onClose={() => setActiveSidePanel(null)} />
          </div>

          {/* Finish picker */}
          <div className="flex items-center gap-2">
            {FINISHES.map(f => (
              <button key={f.id} onClick={() => setTurntableFinish(f.id)} title={f.label}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full transition-all metallic-button"
                style={{ color: turntableFinish===f.id ? `rgb(${c})` : `rgba(${c},.35)`,
                         border: turntableFinish===f.id ? `1px solid rgba(${c},.4)` : "1px solid transparent" }}>
                <span className="w-3 h-3 rounded-full shrink-0 inline-block" style={{ background: f.swatch }} />
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Bottom shelf ══════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-4 pt-10 z-20"
        style={{ background:"linear-gradient(to top,#000 0%,rgba(0,0,0,.92) 50%,transparent 100%)" }}>
        <div className="max-w-6xl mx-auto">

          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-3 overflow-x-auto hide-scrollbar">
            {/* Back button in artist view */}
            {isArtistView && (
              <button onClick={() => setIsArtistView(false)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full metallic-button shrink-0 transition-colors mr-1"
                style={{ color:`rgba(${c},.7)` }}>
                <ChevronLeft size={12} /> Back
              </button>
            )}
            <Tab id="search" active={activeTab==="search" && !isArtistView} onClick={() => { setActiveTab("search"); setIsArtistView(false); }} icon={<Search size={12}/>} label={isArtistView ? artistName : "Search"} c={c} />
            <Tab id="charts" active={activeTab==="charts"} onClick={() => { setActiveTab("charts"); setIsArtistView(false); }} icon={<TrendingUp size={12}/>} label="Charts" c={c} />
            <Tab id="history" active={activeTab==="history"} onClick={() => { setActiveTab("history"); setIsArtistView(false); }} icon={<Clock size={12}/>} label="History" c={c} />
          </div>

          {/* Content based on tab */}
          {(isLoadingCharts || isLoadingArtist || isSearching) ? (
            <div className="flex items-center gap-3 py-3">
              <Loader2 size={14} className="animate-spin" style={{ color:`rgb(${c})` }} />
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                {isSearching ? "Searching…" : isLoadingCharts ? "Loading charts…" : `Loading ${artistName}…`}
              </p>
            </div>
          ) : shelfTracks.length > 0 ? (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 font-semibold">
                {isArtistView ? `${artistName} · ${shelfTracks.length} tracks` :
                  activeTab==="history" ? `Recently played · ${shelfTracks.length}` :
                  activeTab==="charts" ? "iTunes Top 25" :
                  `${shelfTracks.length} tracks — click to play`}
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar">
                {shelfTracks.map((track, idx) => (
                  <TrackCard key={`${track.trackId}-${idx}`} track={track} idx={idx}
                    isActive={currentTrack?.trackId === track.trackId}
                    isPlaying={isPlaying && currentTrack?.trackId === track.trackId}
                    onClick={() => playTrack(track, idx)} c={c} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs uppercase tracking-widest font-semibold py-1"
              style={{ color:`rgba(${c},.2)` }}>
              {activeTab==="history" ? "No recently played tracks" :
               activeTab==="charts" ? "Charts unavailable" :
               "Search above to fill your collection"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Small tag button ─────────────────────────────────────────────── */
function SmBtn({ icon, label, onClick, c, active }: { icon: React.ReactNode; label: string; onClick: () => void; c: string; active?: boolean }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full metallic-button transition-all"
      style={{ color: active ? `rgb(${c})` : `rgba(${c},.45)`, border: `1px solid ${active ? `rgba(${c},.35)` : "transparent"}`, background: active ? `rgba(${c},.1)` : "transparent" }}>
      {icon}{label}
    </button>
  );
}

/* ── Tab ──────────────────────────────────────────────────────────── */
function Tab({ active, onClick, icon, label, c }: { id: string; active: boolean; onClick: () => void; icon: React.ReactNode; label: string; c: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full metallic-button shrink-0 transition-all max-w-[120px]"
      style={{ color: active ? `rgb(${c})` : `rgba(${c},.45)`, background: active ? `rgba(${c},.1)` : "transparent", border: active ? `1px solid rgba(${c},.3)` : "1px solid transparent" }}>
      {icon}<span className="truncate">{label}</span>
    </button>
  );
}

/* ── Track card ───────────────────────────────────────────────────── */
function TrackCard({ track, isActive, isPlaying, onClick, c }: { track: iTunesTrack; idx: number; isActive: boolean; isPlaying: boolean; onClick: () => void; c: string }) {
  return (
    <button data-testid={`card-track-${track.trackId}`} onClick={onClick}
      className={`snap-start shrink-0 text-left transition-transform duration-300 ${isActive ? "-translate-y-4" : "hover:-translate-y-2"}`}>
      <div className="w-28 h-28 md:w-32 md:h-32 rounded-sm relative overflow-hidden bg-card"
        style={{ boxShadow:"5px 5px 15px rgba(0,0,0,.6)", border: isActive ? `1.5px solid rgba(${c},.6)` : "1px solid rgba(255,255,255,.07)" }}>
        {track.artworkUrl && <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background:"linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.1) 60%,transparent 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-[9px] truncate" style={{ color:"rgba(255,255,255,.4)" }}>{track.artistName}</p>
          <p className="text-xs font-semibold text-white truncate leading-tight">{track.trackName}</p>
        </div>
        {isPlaying && (
          <div className="absolute top-1.5 right-1.5 flex gap-px items-end" style={{ height:14 }}>
            {[40,80,55,90,65].map((h,i) => (
              <div key={i} className="w-px rounded-full playing-bar"
                style={{ background:`rgb(${c})`, height:`${h}%`, animationDelay:`${i*.12}s` }} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

/* ── Volume Knob ─────────────────────────────────────────────────── */
function VolumeKnob({ volume, onChange, c }: { volume: number; onChange: (v: number) => void; c: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const angle = -135 + volume * 270;
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div ref={ref} className="w-10 h-10 rounded-full metallic-button relative cursor-ns-resize"
        onPointerDown={e => { setDrag(true); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerUp={e => { setDrag(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerMove={e => {
          if (!drag || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          let a = Math.atan2(e.clientY - (r.top+r.height/2), e.clientX - (r.left+r.width/2)) * 180/Math.PI + 90;
          if (a > 180) a -= 360;
          onChange(Math.min(1, Math.max(0, (Math.max(-135,Math.min(135,a)) + 135) / 270)));
        }}>
        <div className="absolute inset-0 rounded-full" style={{ transform:`rotate(${angle}deg)` }}>
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-2.5 rounded-full transition-all duration-1000"
            style={{ background:`rgb(${c})`, boxShadow:`0 0 5px rgba(${c},.5)` }} />
        </div>
      </div>
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Vol</span>
    </div>
  );
}
