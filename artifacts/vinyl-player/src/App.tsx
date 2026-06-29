import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import YouTube, { YouTubePlayer } from "react-youtube";
import {
  Play, Pause, SkipBack, SkipForward, Search, X, Loader2, Music,
  Repeat, Repeat1, Volume2, VolumeX, AlarmClock, Zap,
  ChevronLeft, TrendingUp, Clock, ExternalLink, Heart, FileText
} from "lucide-react";
import type { iTunesTrack } from "./lib/itunes";
import { searchMusic, getTopCharts, getArtistTracks, getSuggestions } from "./lib/itunes";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import Turntable from "./components/Turntable";



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
    const d = await r.json() as any;
    return d.videoId || d.id || null;
  } catch { return null; }
}

/* ── Finish definitions ──────────────────────────────────────────── */
const SLEEP_OPTS = [5, 10, 15, 30, 45, 60];

/* ── Hooks ── */
type LoopMode = "off" | "one" | "all";
type TabId = "search" | "charts" | "history" | "favorites";

/* ═══════════════════════════════════════════════════════════════════ */
export default function App() {
  /* ── YouTube State ── */
  const [ytVideoId, setYtVideoId] = useState<string | null>(null);
  const [ytPlayer, setYtPlayer] = useState<YouTubePlayer | null>(null);
  const [ytDuration, setYtDuration] = useState(0);
  const [ytTime, setYtTime] = useState(0);
  const [ytIsPlaying, setYtIsPlaying] = useState(false);
  const [ytIsLoading, setYtIsLoading] = useState(false);

  /* ── Playback ── */
  const {
    isPlaying: audioIsPlaying, progress: audioProgress, currentTime: audioCurrentTime, duration: audioDuration,
    volume: audioVolume, isLoading: audioIsLoading, isMuted: audioIsMuted, playbackRate: audioPlaybackRate,
    loadAndPlay, togglePlay: audioTogglePlay, seek: audioSeek, seekBy: audioSeekBy,
    changeVolume: audioChangeVolume, toggleMute: audioToggleMute, setPlaybackRate: audioSetPlaybackRate,
    setOnEnded: audioSetOnEnded, forceStop: audioForceStop, audioRef,
  } = useAudioPlayer();

  const isPlaying = ytVideoId ? ytIsPlaying : audioIsPlaying;
  const currentTime = ytVideoId ? ytTime : audioCurrentTime;
  const duration = ytVideoId ? ytDuration : audioDuration;
  const progress = ytVideoId ? (ytDuration ? (ytTime / ytDuration) * 100 : 0) : audioProgress;
  const isLoading = ytVideoId ? ytIsLoading : audioIsLoading;
  const volume = audioVolume;
  const isMuted = audioIsMuted;
  const playbackRate = audioPlaybackRate;
  const setPlaybackRate = audioSetPlaybackRate;
  const setOnEnded = audioSetOnEnded;

  const forceStop = useCallback(() => {
    setYtVideoId(null);
    if (ytPlayer) ytPlayer.pauseVideo();
    audioForceStop();
  }, [ytPlayer, audioForceStop]);

  const togglePlay = useCallback(() => {
    if (ytVideoId && ytPlayer) {
      if (ytIsPlaying) ytPlayer.pauseVideo();
      else ytPlayer.playVideo();
    } else {
      audioTogglePlay();
    }
  }, [ytVideoId, ytPlayer, ytIsPlaying, audioTogglePlay]);

  const seekBy = useCallback((seconds: number) => {
    if (ytVideoId && ytPlayer) {
      const t = ytTime + seconds;
      ytPlayer.seekTo(Math.max(0, Math.min(ytDuration, t)), true);
    } else {
      audioSeekBy(seconds);
    }
  }, [ytVideoId, ytPlayer, ytTime, ytDuration, audioSeekBy]);

  const seek = useCallback((pct: number) => {
    if (ytVideoId && ytPlayer) {
      ytPlayer.seekTo((pct / 100) * ytDuration, true);
    } else {
      audioSeek(pct);
    }
  }, [ytVideoId, ytPlayer, ytDuration, audioSeek]);

  const changeVolume = useCallback((v: number) => {
    if (ytPlayer) ytPlayer.setVolume(v * 100);
    audioChangeVolume(v);
  }, [ytPlayer, audioChangeVolume]);

  const toggleMute = useCallback(() => {
    if (ytPlayer) {
      if (ytPlayer.isMuted()) ytPlayer.unMute();
      else ytPlayer.mute();
    }
    audioToggleMute();
  }, [ytPlayer, audioToggleMute]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (ytIsPlaying && ytPlayer) {
      interval = setInterval(async () => {
        try {
          const time = await ytPlayer.getCurrentTime();
          setYtTime(time);
        } catch {}
      }, 500);
    }
    return () => clearInterval(interval);
  }, [ytIsPlaying, ytPlayer]);

  /* ── State ── */
  const [query, setQuery]                   = useState("");
  const [searchResults, setSearchResults]   = useState<iTunesTrack[]>([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [searchHistory, setSearchHistory]   = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("vinyl-search-history") ?? "[]"); } catch { return []; }
  });

  const [currentTrack, setCurrentTrack]     = useState<iTunesTrack | null>(null);
  const [currentIdx, setCurrentIdx]         = useState(0);
  const [isFindingStream, setIsFindingStream] = useState(false);
  const [accentColor, setAccentColor]       = useState("212,168,83");

  const [loopMode, setLoopMode]             = useState<LoopMode>("off");
  const [activeTab, setActiveTab]           = useState<TabId>("search");
  const [chartsData, setChartsData]         = useState<iTunesTrack[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [recentlyPlayed, setRecentlyPlayed] = useState<iTunesTrack[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem("vinyl-history") ?? "[]");
      return Array.isArray(v) ? v.filter(t => t && t.trackId) : [];
    } catch { return []; }
  });
  const [favorites, setFavorites] = useState<iTunesTrack[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem("vinyl-favorites") ?? "[]");
      return Array.isArray(v) ? v.filter(t => t && t.trackId) : [];
    } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("vinyl-favorites", JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem("vinyl-search-history", JSON.stringify(searchHistory)); }, [searchHistory]);

  const [sleepMinutes, setSleepMinutes]     = useState<number | null>(null);
  const [suggestions, setSuggestions]       = useState<iTunesTrack[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isArtistView, setIsArtistView]     = useState(false);
  const [artistTracks, setArtistTracks]     = useState<iTunesTrack[]>([]);
  const [artistName, setArtistName]         = useState("");
  const [isLoadingArtist, setIsLoadingArtist] = useState(false);
  const [sleepSecsLeft, setSleepSecsLeft]   = useState(0);
  const [showSleepMenu, setShowSleepMenu]   = useState(false);
  const [showSpeedMenu, setShowSpeedMenu]   = useState(false);
  const [showColorMenu, setShowColorMenu]   = useState(false);
  const [lyrics, setLyrics]                 = useState<string | null>(null);
  const [showLyrics, setShowLyrics]         = useState(false);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [showUpNext, setShowUpNext]         = useState(false);
  const [radioMode, setRadioMode]           = useState(false);
  const [relatedArtists, setRelatedArtists] = useState<string[]>([]);
  const [similarTracks, setSimilarTracks]   = useState<iTunesTrack[]>([]);
  const [showSimilar, setShowSimilar]       = useState(false);
  const [isSimilarLoading, setIsSimilarLoading] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowSimilar(false);
    setSimilarTracks([]);
  }, [currentTrack?.trackId]);

  const inputRef            = useRef<HTMLInputElement>(null);
  const searchResultsRef    = useRef<iTunesTrack[]>([]);
  const currentIdxRef       = useRef(0);
  const currentTrackRef     = useRef<iTunesTrack | null>(null);
  const loopModeRef         = useRef<LoopMode>("off");

  useEffect(() => { searchResultsRef.current = searchResults; }, [searchResults]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { loopModeRef.current = loopMode; }, [loopMode]);

  const c = currentTrack ? accentColor : "255,255,255";
  const busy = isLoading || isFindingStream;

  /* ── Play a track (full song via API, fallback to iTunes preview) ── */
  const playTrack = useCallback(async (track: iTunesTrack, idx: number) => {
    setCurrentTrack(track);
    setCurrentIdx(idx);
    currentIdxRef.current = idx;
    setIsFindingStream(true);

    if (track.artworkUrl) extractAccentColor(track.artworkUrl).then(setAccentColor).catch(() => {});

    /* Add to history */
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => t.trackId !== track.trackId);
      const next = [track, ...filtered].slice(0, 25);
      try { localStorage.setItem("vinyl-history", JSON.stringify(next)); } catch {}
      return next;
    });

    forceStop();
    setYtVideoId(null);
    setYtTime(0);
    setYtDuration(0);

    const videoId = await findStream(track);
    setIsFindingStream(false);
    
    if (videoId) {
      setYtIsLoading(true);
      setYtVideoId(videoId);
    } else {
      loadAndPlay(track.previewUrl);
    }
  }, [loadAndPlay, forceStop]);

  const toggleFavorite = useCallback((track: iTunesTrack, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites(prev => {
      if (prev.some(t => t.trackId === track.trackId)) return prev.filter(t => t.trackId !== track.trackId);
      return [track, ...prev];
    });
  }, []);

  const goHome = useCallback(() => {
    forceStop();
    setCurrentTrack(null);
    setCurrentIdx(0);
    setQuery("");
    setSearchResults([]);
    setIsArtistView(false);
    setActiveTab("search");
    setSuggestions([]);
    setShowSuggestions(false);
  }, [forceStop]);


  /* ── Loop + auto-advance ── */
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.loop = loopMode === "one";
  }, [loopMode, audioRef]);

  /* ── Lyrics fetch ── */
  useEffect(() => {
    if (!currentTrack || !showLyrics) return;
    setLyrics(null);
    setIsLoadingLyrics(true);
    // basic regex to remove things like (Remastered) or (feat. xyz) from title for better matches
    const cleanTitle = currentTrack.trackName.replace(/\(.*\)/g, "").trim();
    fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(currentTrack.artistName)}&track_name=${encodeURIComponent(cleanTitle)}`)
      .then(r => r.json())
      .then(d => {
        const raw = d.plainLyrics || d.syncedLyrics || "Lyrics not found.";
        setLyrics(raw.replace(/\[\d{2}:\d{2}\.\d{2,3}\]\s*/g, ""));
        setIsLoadingLyrics(false);
      })
      .catch(() => { setLyrics("Lyrics not found."); setIsLoadingLyrics(false); });
  }, [currentTrack, showLyrics]);

  useEffect(() => {
    setOnEnded(() => {
      /* ── #2 Vinyl run-out groove crackle ── */
      try {
        const ctx = new window.AudioContext();
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(50, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 3);
      } catch {}

      if (loopModeRef.current === "one") return;
      const results = searchResultsRef.current;
      const idx = currentIdxRef.current;
      if (loopModeRef.current === "all") {
        const next = (idx + 1) % results.length;
        playTrack(results[next], next);
      } else if (idx < results.length - 1) {
        playTrack(results[idx + 1], idx + 1);
      } else if (radioMode) {
        /* ── #20 Radio Mode ── */
        const last = results[idx];
        if (last) {
           searchMusic(last.genre || last.artistName).then(more => {
             const newTracks = more.filter(m => !results.some(r => r.trackId === m.trackId));
             if (newTracks.length) {
               setSearchResults(prev => [...prev, ...newTracks]);
               playTrack(newTracks[0], idx + 1);
             }
           }).catch(()=>{});
        }
      }
    });
  }, [setOnEnded, playTrack, radioMode]);

  /* ── Up Next Logic ── */
  const upNextTrack = activeTab === "history" ? recentlyPlayed[currentIdx + 1] : searchResults[currentIdx + 1];
  useEffect(() => {
    if (isPlaying && duration > 0 && currentTime > duration - 10 && upNextTrack && loopMode !== "one") {
      setShowUpNext(true);
    } else {
      setShowUpNext(false);
    }
  }, [currentTime, duration, isPlaying, upNextTrack, loopMode]);

  /* ── Dynamic Title ── */
  useEffect(() => {
    if (currentTrack) {
      document.title = `${isPlaying ? "▶" : "❚❚"} ${currentTrack.trackName} - ${currentTrack.artistName}`;
    } else {
      document.title = "Coda Player";
    }
  }, [currentTrack, isPlaying]);

  const handleSimilarClick = async () => {
    if (showSimilar) {
      setShowSimilar(false);
      return;
    }
    setShowSimilar(true);
    if (similarTracks.length > 0 || !currentTrack) return;
    setIsSimilarLoading(true);
    try {
      const more = await searchMusic(currentTrack.genre || currentTrack.artistName);
      const newTracks = more.filter(m => m.trackId !== currentTrack.trackId).slice(0, 4);
      setSimilarTracks(newTracks);
    } catch { }
    setIsSimilarLoading(false);
  };

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
        case "ArrowLeft":    if (e.shiftKey) { e.preventDefault(); seekBy(-5); } break;
        case "ArrowRight":   if (e.shiftKey) { e.preventDefault(); seekBy(5); } break;
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

  /* ── Charts (auto load for empty state) ── */
  useEffect(() => {
    if (chartsData.length === 0 && !isLoadingCharts) {
      setIsLoadingCharts(true);
      getTopCharts().then(setChartsData).catch(() => {}).finally(() => setIsLoadingCharts(false));
    }
  }, [chartsData.length, isLoadingCharts]);

  /* ── Search ── */
  const handleSearch = async (e?: React.FormEvent, forceQuery?: string) => {
    e?.preventDefault();
    const q = (forceQuery || query).trim(); if (!q) return;
    setQuery(q);
    setSearchHistory(prev => {
      const next = [q, ...prev.filter(x => x !== q)].slice(0, 5);
      return next;
    });
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
      const finalTracks = tracks.length ? tracks : await searchMusic(track.artistName);
      setArtistTracks(finalTracks);
      
      /* ── #21 Related Artists ── */
      const genres = [...new Set(finalTracks.map(t => t.genre).filter(Boolean))];
      if (genres.length) {
        searchMusic(genres[0] as string).then(similar => {
          setRelatedArtists([...new Set(similar.map(t => t.artistName))].filter(a => a !== track.artistName).slice(0, 5));
        }).catch(() => setRelatedArtists([]));
      } else {
        setRelatedArtists([]);
      }
    } catch { setArtistTracks([]); setRelatedArtists([]); }
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
    activeTab === "favorites" ? favorites :
    searchResults;

  /* ── iPod style navigation ── */
  const [focusedIdx, setFocusedIdx] = useState(0);

  useEffect(() => { setFocusedIdx(0); }, [activeTab, isArtistView, shelfTracks.length]);

  const playTickSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") {
        setFocusedIdx(prev => {
          if (shelfTracks.length === 0) return 0;
          const next = Math.min(prev + 1, shelfTracks.length - 1);
          if (next !== prev) playTickSound();
          return next;
        });
      } else if (e.key === "ArrowLeft") {
        setFocusedIdx(prev => {
          if (shelfTracks.length === 0) return 0;
          const next = Math.max(prev - 1, 0);
          if (next !== prev) playTickSound();
          return next;
        });
      } else if (e.key === "Enter") {
        if (shelfTracks[focusedIdx]) {
          playTrack(shelfTracks[focusedIdx], focusedIdx);
          playTickSound();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shelfTracks, focusedIdx, playTrack, playTickSound]);

  const handleNext = () => { const s = shelfTracks; if (currentIdx < s.length-1) playTrack(s[currentIdx+1], currentIdx+1); };
  const handlePrev = () => { if (currentIdx > 0) playTrack(shelfTracks[currentIdx-1], currentIdx-1); };


  /* ══════════════════════════════════════════════════════════════════ */
  const handleTrackEnd = useCallback(() => {
    if (loopModeRef.current === "one") {
      if (ytVideoId && ytPlayer) ytPlayer.playVideo();
      return;
    }
    const results = searchResultsRef.current;
    const idx = currentIdxRef.current;
    if (loopModeRef.current === "all") {
      const next = (idx + 1) % results.length;
      playTrack(results[next], next);
    } else if (idx < results.length - 1) {
      playTrack(results[idx + 1], idx + 1);
    }
  }, [playTrack, ytVideoId, ytPlayer]);

  return (
    <div className="min-h-screen text-foreground transition-colors duration-1000 overflow-x-hidden relative bg-black text-white flex flex-col p-4 md:p-8 pt-8 md:pt-10 font-sans"
      onClick={() => { setShowSuggestions(false); setShowSleepMenu(false); setShowSpeedMenu(false); setShowColorMenu(false); }}>

      {/* Hidden YouTube Player */}
      <div className="hidden">
        {ytVideoId && (
          <YouTube
            videoId={ytVideoId}
            opts={{ height: "0", width: "0", playerVars: { autoplay: 1 } }}
            onReady={(e) => {
              setYtPlayer(e.target);
              setYtDuration(e.target.getDuration());
              e.target.setVolume(volume * 100);
            }}
            onPlay={() => {
              setYtIsPlaying(true);
              setYtIsLoading(false);
            }}
            onPause={() => setYtIsPlaying(false)}
            onEnd={() => {
              setYtIsPlaying(false);
              handleTrackEnd();
            }}
            onError={() => {
              setYtVideoId(null);
              if (currentTrackRef.current?.previewUrl) {
                loadAndPlay(currentTrackRef.current.previewUrl);
              }
            }}
          />
        )}
      </div>


      {/* ── Header ── */}
      <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
        className="relative z-[60] flex items-center justify-between mb-8 max-w-[1600px] w-full mx-auto">
        {/* Header Title (Left Aligned) */}
        <div className="flex-1 flex justify-start">
          <button onClick={goHome} className="flex shrink-0 items-center justify-start gap-3 transition-transform hover:scale-105 active:scale-95 group" style={{ transform: isPlaying ? "scale(1.02)" : "scale(1)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 group-hover:rotate-45"
              style={{ background: `linear-gradient(135deg,rgba(${c},.8),rgba(${c},.3))`, boxShadow: isPlaying ? `0 0 20px rgba(${c},.6)` : `0 0 12px rgba(${c},.4)`, transform: isPlaying ? "scale(1.1)" : "scale(1)" }}>
              <div className="w-2 h-2 rounded-full bg-background" />
            </div>
            <div className="flex flex-col items-start hidden sm:flex">
              <span className="font-serif text-2xl tracking-[0.3em] uppercase transition-all duration-1000 animate-pulse leading-none"
                style={{ color: `rgba(${c},.9)` }}>Coda</span>
              <span className="text-[9px] tracking-[0.2em] uppercase opacity-50 font-semibold mt-1" style={{ color: `rgba(${c},.8)` }}>
                by Y7XIFIED © All Rights Reserved
              </span>
            </div>
          </button>
        </div>

        <div className="flex-1 flex gap-3 justify-end items-center">
          <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-xl" onClick={e => e.stopPropagation()}>


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
                  <motion.ul initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-1 rounded-2xl overflow-hidden z-50 border backdrop-blur-xl"
                    style={{ background: "rgba(12,10,8,.95)", borderColor: `rgba(${c},.2)`, boxShadow: `0 8px 32px rgba(0,0,0,.9)` }}>
                    {suggestions.map((s, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                        <button type="button"
                          onClick={() => { setQuery(`${s.trackName} ${s.artistName}`); setShowSuggestions(false); playTrack(s, 0); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                          <img src={s.artworkUrl} alt="" loading="lazy" className="w-8 h-8 rounded shrink-0 object-cover" />
                          <div className="overflow-hidden">
                            <p className="text-sm truncate">{s.trackName}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.artistName}</p>
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </motion.ul>
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
      </motion.div>
      </AnimatePresence>

      {/* ── Main layout ── */}
      <div className="flex-1 relative z-10 w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center transition-all duration-1000"
        style={{ paddingBottom: "10rem" }}>

        {/* ── Left: Info + Controls ── */}
        <div className="col-span-1 lg:col-span-5 flex flex-col gap-6">

          {!currentTrack && (
            <div className="text-center lg:text-left space-y-8 py-10 w-full">
              <div>
                <p className="text-6xl font-serif mb-4" style={{ color: `rgba(${c},.12)` }}>♫</p>
                <p className="text-sm text-muted-foreground">Search for any song above to start playing</p>

              </div>

              {/* Trending Fill */}
              {chartsData.length > 0 && (
                <div className="w-full">
                  <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-semibold mb-4">Trending Now</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {chartsData.slice(0, 6).map((track, i) => (
                      <motion.button key={i} onClick={() => playTrack(track, 0)}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20, delay: i * 0.05 }}
                        whileHover={{ scale: 1.03, boxShadow: `0 0 20px rgba(${c}, 0.3)`, backgroundColor: `rgba(${c}, 0.05)` }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-3 p-2 rounded-xl text-left group"
                        style={{ background: `rgba(${c},.03)`, border: `1px solid rgba(${c},.05)` }}>
                        <img src={track.artworkUrl} className="w-10 h-10 rounded-lg object-cover shadow-md group-hover:scale-105 transition-transform" />
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors" style={{ color: `rgba(${c},.9)` }}>{track.trackName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{track.artistName}</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentTrack && (
            <>
              {/* Track info */}
              <div className="space-y-1 text-center lg:text-left">
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <p className="text-xs uppercase tracking-[0.4em] font-semibold transition-all duration-1000 flex items-center gap-2"
                    style={{ color: `rgba(${c},.8)` }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: `rgb(${c})`, boxShadow: `0 0 8px rgb(${c})` }} />
                    Now Playing
                  </p>
                  <button onClick={() => toggleFavorite(currentTrack)} className="p-1 ml-2 transition-transform hover:scale-110">
                    <Heart size={16} fill={favorites.some(t => t.trackId === currentTrack.trackId) ? `rgb(${c})` : "none"} 
                           color={favorites.some(t => t.trackId === currentTrack.trackId) ? `rgb(${c})` : `rgba(${c},.5)`} />
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  <motion.h1 key={`ttl-${currentTrack.trackId}`} initial={{ opacity:0, x: 20 }} animate={{ opacity:1, x: 0 }} exit={{ opacity:0, x: -20 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="font-serif text-3xl md:text-4xl font-normal hover:font-bold leading-tight transition-all duration-500 cursor-default"
                    style={{ textShadow:`0 0 40px rgba(${c},.22)` }}>
                    {currentTrack.trackName}
                  </motion.h1>
                </AnimatePresence>
                <div className="flex items-center gap-4 justify-center lg:justify-start">
                  <button onClick={() => handleArtistClick(currentTrack)}
                    className="text-base text-muted-foreground font-serif italic hover:underline transition-colors text-left">
                    {currentTrack.artistName}
                  </button>
                  {currentTrack.trackViewUrl && (
                    <a href={currentTrack.trackViewUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity uppercase tracking-widest font-semibold"
                      style={{ color: `rgba(${c},.9)` }}>
                      <ExternalLink size={12} /> Apple Music
                    </a>
                  )}
                </div>
              </div>

              {/* Related Artists Carousel */}
              {relatedArtists.length > 0 && (
                <div className="w-full max-w-sm mx-auto lg:mx-0 mt-6 pt-4 border-t" style={{ borderColor:`rgba(${c},.15)` }}>
                  <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-semibold mb-3">Similar Artists</p>
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                    {relatedArtists.map(artist => (
                      <button key={artist} onClick={() => handleSearch(undefined, artist)}
                        className="px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap transition-colors border"
                        style={{ borderColor:`rgba(${c},.2)`, color:`rgba(${c},.8)`, background:`rgba(${c},.05)` }}>
                        {artist}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lyrics Panel */}
              <AnimatePresence>
                {showLyrics && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="w-full max-w-sm mx-auto lg:mx-0 overflow-y-auto hide-scrollbar rounded-2xl border"
                    style={{ maxHeight: "250px", borderColor: `rgba(${c},.2)`, background: "rgba(0,0,0,.3)" }}
                    ref={lyricsRef}>
                    {isLoadingLyrics ? (
                      <div className="flex items-center justify-center h-full"><Loader2 size={16} className="animate-spin" style={{ color:`rgb(${c})` }} /></div>
                    ) : (
                      <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap p-4">{lyrics}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

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
              <div className="flex items-center justify-between w-full max-w-sm mx-auto lg:mx-0 mt-4">
                <VolumeKnob volume={volume} onChange={changeVolume} c={c} />
                <motion.button whileHover={{ scale: 1.1, boxShadow: `0 0 15px rgba(${c}, 0.5)` }} whileTap={{ scale: 0.9 }} data-testid="button-prev" onClick={handlePrev} disabled={currentIdx === 0}
                  className="w-11 h-11 rounded-full metallic-button flex items-center justify-center disabled:opacity-30 transition-colors"
                  style={{ color:`rgba(${c},.7)` }}>
                  <SkipBack size={18} />
                </motion.button>

                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} data-testid="button-play" onClick={togglePlay}
                  className="w-16 h-16 rounded-full metallic-button flex items-center justify-center transition-all relative group"
                  style={{ color:`rgb(${c})`, boxShadow:`0 0 24px rgba(${c},.2)` }}>

                  <AnimatePresence mode="wait">
                    {busy ? <motion.div key="busy" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}><Loader2 size={24} className="animate-spin" /></motion.div>
                      : isPlaying ? <motion.div key="pause" initial={{ scale: 0.5, opacity: 0, rotate: -90 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}><Pause size={24} fill="currentColor" /></motion.div>
                      : <motion.div key="play" initial={{ scale: 0.5, opacity: 0, rotate: -90 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}><Play size={24} fill="currentColor" className="ml-1" /></motion.div>}
                  </AnimatePresence>
                </motion.button>

                <motion.button whileHover={{ scale: 1.1, boxShadow: `0 0 15px rgba(${c}, 0.5)` }} whileTap={{ scale: 0.9 }} data-testid="button-next" onClick={handleNext} disabled={currentIdx >= shelfTracks.length-1}
                  className="w-11 h-11 rounded-full metallic-button flex items-center justify-center disabled:opacity-30 transition-colors"
                  style={{ color:`rgba(${c},.7)` }}>
                  <SkipForward size={18} />
                </motion.button>

                {/* Mute */}
                <button onClick={toggleMute}
                  className="w-10 h-10 rounded-full metallic-button flex items-center justify-center transition-colors"
                  style={{ color: isMuted ? "rgba(255,255,255,.3)" : `rgba(${c},.8)` }}>
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>

              {/* ── Secondary controls ── */}
              <div className="flex items-center gap-2 w-full mx-auto lg:mx-0 flex-wrap justify-center lg:justify-start">
                {/* Loop */}
                <motion.button whileHover={{ scale: 1.05, boxShadow: `0 0 15px rgba(${c}, 0.5)` }} whileTap={{ scale: 0.95 }} onClick={() => setLoopMode(m => m==="off"?"one":m==="one"?"all":"off")}
                  title={`Loop: ${loopMode}`}
                  className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs transition-all metallic-button"
                  style={{ color: loopMode!=="off" ? `rgb(${c})` : `rgba(${c},.45)`, background: loopMode!=="off" ? `rgba(${c},.1)` : "transparent" }}>
                  {loopMode==="one" ? <Repeat1 size={14} /> : <Repeat size={14} />}
                  <span className="hidden sm:inline">{loopMode==="off"?"Off":loopMode==="one"?"One":"All"}</span>
                </motion.button>

                {/* Speed / Pitch */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <motion.button whileHover={{ scale: 1.05, boxShadow: `0 0 15px rgba(${c}, 0.5)` }} whileTap={{ scale: 0.95 }} onClick={() => setShowSpeedMenu(v => !v)}
                    className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs metallic-button transition-all"
                    style={{ color:`rgba(${c},.8)`, background: playbackRate!==1 ? `rgba(${c},.1)` : "transparent" }}>
                    <Zap size={12} />{playbackRate.toFixed(2)}x
                  </motion.button>
                  <AnimatePresence>
                    {showSpeedMenu && (
                      <motion.div initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:4 }}
                        className="absolute bottom-full mb-1 left-0 rounded-2xl overflow-hidden border z-50 p-3"
                        style={{ background: "rgba(12,10,8,.97)", borderColor:`rgba(${c},.2)`, width: "200px" }}>
                        <div className="flex flex-col gap-2 items-center min-w-[140px]">
                          <span className="text-[10px] text-muted-foreground tracking-widest uppercase">Pitch: {playbackRate.toFixed(2)}x</span>
                          <input type="range" min="0.5" max="1.5" step="0.01" value={playbackRate} onChange={e => setPlaybackRate(parseFloat(e.target.value))} 
                            className="w-full h-1 bg-white/10 rounded-full appearance-none outline-none cursor-pointer"
                            style={{ accentColor: `rgb(${c})` }} />
                          <button onClick={() => setPlaybackRate(1)} className="text-[10px] opacity-60 hover:opacity-100 transition-opacity mt-1">Reset Pitch</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative" onClick={e => e.stopPropagation()}>
                  <motion.button whileHover={{ scale: 1.05, boxShadow: `0 0 15px rgba(${c}, 0.5)` }} whileTap={{ scale: 0.95 }} onClick={() => setRadioMode(v => !v)}
                    className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs metallic-button transition-all"
                    style={{ color: radioMode ? `rgb(${c})` : `rgba(${c},.45)`, background: radioMode ? `rgba(${c},.1)` : "transparent" }}>
                    <TrendingUp size={12} />
                    <span className="hidden sm:inline">Radio</span>
                  </motion.button>
                </div>

                {/* Sleep timer */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <motion.button whileHover={{ scale: 1.05, boxShadow: `0 0 15px rgba(${c}, 0.5)` }} whileTap={{ scale: 0.95 }} onClick={() => sleepMinutes ? setSleepMinutes(null) : setShowSleepMenu(v => !v)}
                    className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs metallic-button transition-all"
                    style={{ color: sleepMinutes ? `rgb(${c})` : `rgba(${c},.45)`, background: sleepMinutes ? `rgba(${c},.1)` : "transparent" }}>
                    <AlarmClock size={12} />
                    {sleepMinutes ? fmt(sleepSecsLeft) : <span className="hidden sm:inline">Sleep</span>}
                  </motion.button>
                  <AnimatePresence>
                    {showSleepMenu && (
                      <motion.div initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:4 }}
                        className="absolute bottom-full mb-1 left-0 rounded-2xl overflow-hidden border z-50"
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
                


                {/* Lyrics Toggle */}
                <motion.button whileHover={{ scale: 1.05, boxShadow: `0 0 15px rgba(${c}, 0.5)` }} whileTap={{ scale: 0.95 }} onClick={() => setShowLyrics(v => !v)}
                  title="Toggle Lyrics"
                  className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs transition-all metallic-button"
                  style={{ color: showLyrics ? `rgb(${c})` : `rgba(${c},.8)`, background: showLyrics ? `rgba(${c},.1)` : "transparent" }}>
                  <FileText size={14} />
                  <span className="hidden sm:inline">Lyrics</span>
                </motion.button>

              </div>

              {/* ── Similar Songs ── */}
              <div className="w-full flex flex-col items-center lg:items-start mt-6">
                <motion.button whileHover={{ scale: 1.05, boxShadow: `0 0 15px rgba(${c}, 0.5)` }} whileTap={{ scale: 0.98 }} onClick={handleSimilarClick}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest metallic-button transition-all border flex items-center gap-2"
                  style={{ color: showSimilar ? `rgb(${c})` : `rgba(${c},.6)`, borderColor: `rgba(${c},.2)`, background: showSimilar ? `rgba(${c},.1)` : "transparent" }}>
                  <Music size={12} />
                  Similar Songs
                </motion.button>
                <AnimatePresence>
                  {showSimilar && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="w-full mt-4">
                      {isSimilarLoading ? (
                        <div className="flex justify-center p-4"><Loader2 size={20} className="animate-spin" style={{ color:`rgb(${c})` }} /></div>
                      ) : (
                        <div className="flex flex-wrap justify-center lg:justify-start gap-3 pb-4 pt-2 px-2 -mx-2">
                          {similarTracks.map((track, idx) => (
                            <TrackCard key={`sim-${track.trackId}`} track={track} idx={idx}
                              isActive={currentTrack?.trackId === track.trackId}
                              isPlaying={isPlaying && currentTrack?.trackId === track.trackId}
                              isFavorite={favorites.some(t => t.trackId === track.trackId)}
                              onClick={() => { playTrack(track, idx); setSearchResults([track]); }}
                              onToggleFavorite={() => toggleFavorite(track)}
                              c={c}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>

        {/* ── Right: Turntable ── */}
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1, ease: "easeOut" }} 
          className="flex justify-center items-center h-[350px] md:h-[500px] transition-all duration-1000 col-span-1 lg:col-span-7 lg:translate-x-12 lg:translate-y-8">
          <div className={`relative group ${isPlaying ? "playing-wobble" : ""}`}>
            <Turntable
              isPlaying={isPlaying} progress={progress}
              currentTrack={currentTrack} isLoading={isLoading}
              isFindingStream={isFindingStream} accentColor={c}
              onSeek={seek} togglePlay={togglePlay} />
          </div>
        </motion.div>
      </div>

      {/* ══ Bottom shelf ══════════════════════════════════════════════ */}
      <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-0 left-0 right-0 px-4 md:px-12 pb-4 pt-10 z-20 pointer-events-none"
        style={{ background: "linear-gradient(to top,#000 0%,rgba(0,0,0,.92) 50%,transparent 100%)" }}>
        <div className="max-w-[1600px] mx-auto pointer-events-auto">

          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-3 pb-2 overflow-x-auto overflow-y-hidden hide-scrollbar">
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
            <Tab id="favorites" active={activeTab==="favorites"} onClick={() => { setActiveTab("favorites"); setIsArtistView(false); }} icon={<Heart size={12}/>} label="Favorites" c={c} />
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
                  activeTab==="favorites" ? `Your Favorites · ${shelfTracks.length}` :
                  activeTab==="charts" ? "iTunes Top 25" :
                  `${shelfTracks.length} tracks — click to play`}
              </p>
              {activeTab === "favorites" ? (
                <Reorder.Group axis="x" values={favorites} onReorder={setFavorites} className="flex gap-3 overflow-x-auto pt-4 pb-4 px-2 -mx-2 snap-x snap-mandatory hide-scrollbar" style={{ cursor: "grab" }}>
                  {favorites.map((track, idx) => track && track.trackId ? (
                    <Reorder.Item key={track.trackId} value={track} style={{ touchAction: "none" }}>
                      <TrackCard track={track} idx={idx}
                        isActive={currentTrack?.trackId === track.trackId}
                        isPlaying={isPlaying && currentTrack?.trackId === track.trackId}
                        isFavorite={true}
                        isFocused={focusedIdx === idx}
                        onToggleFavorite={(e) => toggleFavorite(track, e)}
                        onClick={() => playTrack(track, idx)} c={c} />
                    </Reorder.Item>
                  ) : null)}
                </Reorder.Group>
              ) : (
                <div className="flex gap-3 overflow-x-auto pt-4 pb-4 px-2 -mx-2 snap-x snap-mandatory hide-scrollbar">
                  {shelfTracks.map((track, idx) => track && track.trackId ? (
                    <TrackCard key={`${track.trackId}-${idx}`} track={track} idx={idx}
                      isActive={currentTrack?.trackId === track.trackId}
                      isPlaying={isPlaying && currentTrack?.trackId === track.trackId}
                      isFavorite={favorites.some(t => t.trackId === track.trackId)}
                      isFocused={focusedIdx === idx}
                      onToggleFavorite={(e) => toggleFavorite(track, e)}
                      onClick={() => playTrack(track, idx)} c={c} />
                  ) : null)}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs uppercase tracking-widest font-semibold py-1"
              style={{ color:`rgba(${c},.2)` }}>
              {activeTab==="history" ? "No recently played tracks" :
               activeTab==="favorites" ? "No favorites yet" :
               activeTab==="charts" ? "Charts unavailable" :
               "Search above to fill your collection"}
            </p>
          )}
        </div>
      </motion.div>
      </AnimatePresence>

      {/* Up Next Toast */}
      <AnimatePresence>
        {showUpNext && upNextTrack && (
          <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }}
            className="fixed bottom-32 right-5 z-50 p-3 rounded-2xl border flex items-center gap-3 shadow-2xl pointer-events-none"
            style={{ background: "rgba(12,10,8,.95)", borderColor:`rgba(${c},.3)` }}>
            <img src={upNextTrack.artworkUrl} className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-semibold">Up Next</p>
              <p className="text-xs font-semibold max-w-[150px] truncate" style={{ color:`rgb(${c})` }}>{upNextTrack.trackName}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



    </div>
  );
}


/* ── Tab ──────────────────────────────────────────────────────────── */
function Tab({ active, onClick, icon, label, c }: { id: string; active: boolean; onClick: () => void; icon: React.ReactNode; label: string; c: string }) {
  return (
    <motion.button whileHover={{ scale: 1.08, y: -2 }} whileTap={{ scale: 0.95 }} onClick={onClick}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full metallic-button shrink-0 transition-all max-w-[120px] relative"
      style={{ color: active ? `rgb(${c})` : `rgba(${c},.45)`, background: active ? `rgba(${c},.1)` : "transparent", border: active ? `1px solid rgba(${c},.3)` : "1px solid transparent" }}>
      {icon}<span className="truncate">{label}</span>
      {active && <motion.div layoutId="tab-glow" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full" style={{ background: `rgb(${c})`, boxShadow: `0 0 8px rgb(${c})` }} />}
    </motion.button>
  );
}

/* ── Track card ───────────────────────────────────────────────────── */
function TrackCard({ track, idx, isActive, isPlaying, isFavorite, onToggleFavorite, onClick, c, isFocused }: { track: iTunesTrack; idx: number; isActive: boolean; isPlaying: boolean; isFavorite: boolean; onToggleFavorite: (e: React.MouseEvent) => void; onClick: () => void; c: string; isFocused?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [isFocused]);

  return (
    <motion.button ref={ref} 
      initial={{ opacity: 0, scale: 0.8, y: 20 }} 
      animate={{ opacity: 1, scale: 1, y: 0 }} 
      whileHover={{ scale: 1.08, y: -5, rotate: -1 }} 
      whileTap={{ scale: 0.92 }} 
      transition={{ type: "spring", stiffness: 400, damping: 20, delay: idx * 0.04 }}
      data-testid={`card-track-${track.trackId}`} onClick={onClick}
      className={`snap-start shrink-0 text-left group ${isActive ? "-translate-y-2" : ""} ${isFocused ? "scale-105 z-10" : ""}`}>
      <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl relative overflow-hidden bg-card"
        style={{ 
          boxShadow: isFocused ? `0 0 25px rgba(${c},.8)` : "5px 5px 15px rgba(0,0,0,.6)", 
          border: isFocused ? `2.5px solid rgb(${c})` : isActive ? `1.5px solid rgba(${c},.6)` : "1px solid rgba(255,255,255,.07)" 
        }}>
        
        <button onClick={onToggleFavorite} 
          className={`absolute top-1.5 left-1.5 z-20 p-1 transition-all ${isFavorite ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 hover:scale-110"}`}>
          <Heart size={14} fill={isFavorite ? `rgb(${c})` : "none"} color={isFavorite ? `rgb(${c})` : "rgba(255,255,255,.8)"} />
        </button>
        {track.artworkUrl && <img src={track.artworkUrl} alt="" loading="lazy" className="w-full h-full object-cover" />}
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
    </motion.button>
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
