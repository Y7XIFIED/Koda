import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Download } from "lucide-react";
import type { iTunesTrack } from "../lib/itunes";

export type PanelType = "lyrics" | "bio" | "info" | "share" | null;

interface Props {
  panel: PanelType;
  track: iTunesTrack | null;
  accentColor: string;
  onClose: () => void;
}

export default function SidePanel({ panel, track, accentColor: c, onClose }: Props) {
  return (
    <AnimatePresence>
      {panel && (
        <motion.div
          key={panel}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 60 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="absolute inset-0 rounded-xl flex flex-col overflow-hidden z-30"
          style={{ background: "rgba(10,8,6,.95)", backdropFilter: "blur(12px)", border: `1px solid rgba(${c},.15)` }}>

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b shrink-0"
            style={{ borderColor: `rgba(${c},.15)` }}>
            <span className="text-xs uppercase tracking-[0.25em] font-semibold" style={{ color: `rgba(${c},.8)` }}>
              {panel === "lyrics" && "Lyrics"}
              {panel === "bio" && "Artist Bio"}
              {panel === "info" && "Track Info"}
              {panel === "share" && "Share Card"}
            </span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
            {panel === "lyrics" && <LyricsView track={track} accentColor={c} />}
            {panel === "bio" && <BioView track={track} accentColor={c} />}
            {panel === "info" && <InfoView track={track} accentColor={c} />}
            {panel === "share" && <ShareView track={track} accentColor={c} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Lyrics ─────────────────────────────────────────────────────── */
function LyricsView({ track, accentColor: c }: { track: iTunesTrack | null; accentColor: string }) {
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const prevTrackIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!track || track.trackId === prevTrackIdRef.current) return;
    prevTrackIdRef.current = track.trackId;
    setLoading(true);
    setLyrics(null);
    fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(track.artistName)}/${encodeURIComponent(track.trackName)}`)
      .then(r => r.json())
      .then(d => setLyrics(d.lyrics ?? null))
      .catch(() => setLyrics(null))
      .finally(() => setLoading(false));
  }, [track?.trackId]);

  if (!track) return <Empty c={c} msg="Play a track to see lyrics" />;
  if (loading) return <Spinner c={c} />;
  if (!lyrics) return <Empty c={c} msg="Lyrics not available for this track" />;

  return (
    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/80">
      {lyrics}
    </pre>
  );
}

/* ── Artist Bio ─────────────────────────────────────────────────── */
function BioView({ track, accentColor: c }: { track: iTunesTrack | null; accentColor: string }) {
  const [bio, setBio] = useState<{ extract: string; thumbnail?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const prevArtistRef = useRef<string | null>(null);

  useEffect(() => {
    if (!track || track.artistName === prevArtistRef.current) return;
    prevArtistRef.current = track.artistName;
    setLoading(true);
    setBio(null);
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(track.artistName)}`)
      .then(r => r.json())
      .then(d => setBio({ extract: d.extract ?? "", thumbnail: d.thumbnail?.source }))
      .catch(() => setBio(null))
      .finally(() => setLoading(false));
  }, [track?.artistName]);

  if (!track) return <Empty c={c} msg="Play a track to see artist bio" />;
  if (loading) return <Spinner c={c} />;
  if (!bio?.extract) return <Empty c={c} msg={`No Wikipedia bio found for "${track.artistName}"`} />;

  return (
    <div className="space-y-3">
      {bio.thumbnail && (
        <img src={bio.thumbnail} alt={track.artistName}
          className="w-full h-40 object-cover rounded-lg opacity-80"
          style={{ border: `1px solid rgba(${c},.2)` }} />
      )}
      <p className="text-sm leading-relaxed text-foreground/80">{bio.extract}</p>
      <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(track.artistName)}`}
        target="_blank" rel="noopener noreferrer"
        className="text-xs hover:underline transition-colors"
        style={{ color: `rgba(${c},.6)` }}>
        Read more on Wikipedia →
      </a>
    </div>
  );
}

/* ── Track Info ─────────────────────────────────────────────────── */
function InfoView({ track, accentColor: c }: { track: iTunesTrack | null; accentColor: string }) {
  if (!track) return <Empty c={c} msg="Play a track to see info" />;
  const rows: [string, string][] = [
    ["Title", track.trackName],
    ["Artist", track.artistName],
    ["Album", track.collectionName],
    ["Genre", track.genre ?? "—"],
    ["Year", track.releaseYear ?? "—"],
    ["Duration", formatMs(track.durationMs)],
  ];
  return (
    <div className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-3 py-2 border-b" style={{ borderColor: `rgba(${c},.08)` }}>
          <span className="text-xs uppercase tracking-wider w-16 shrink-0" style={{ color: `rgba(${c},.5)` }}>{label}</span>
          <span className="text-sm text-foreground/85 flex-1 leading-snug">{value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Share Card ─────────────────────────────────────────────────── */
function ShareView({ track, accentColor: c }: { track: iTunesTrack | null; accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const draw = useCallback(() => {
    if (!track || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = 600, H = 300;
    canvas.width = W; canvas.height = H;

    const [r, g, b] = c.split(",").map(Number);

    /* Background */
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a0806");
    bg.addColorStop(1, `rgba(${r},${g},${b},0.08)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* Accent bar bottom */
    ctx.fillStyle = `rgba(${c},0.35)`;
    ctx.fillRect(0, H - 4, W, 4);

    /* Branding */
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = `rgba(${c},0.5)`;
    ctx.letterSpacing = "3px";
    ctx.fillText("VINYL PLAYER", 20, H - 14);

    const drawText = () => {
      /* Track name */
      ctx.font = "bold 26px Georgia, serif";
      ctx.fillStyle = "rgba(255,255,255,0.93)";
      ctx.shadowColor = `rgba(${c},0.4)`;
      ctx.shadowBlur = 12;
      const name = track.trackName.length > 28 ? track.trackName.slice(0, 27) + "…" : track.trackName;
      ctx.fillText(name, 200, 110);
      ctx.shadowBlur = 0;

      /* Artist */
      ctx.font = "italic 16px Georgia, serif";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(track.artistName, 200, 140);

      /* Album */
      ctx.font = "12px sans-serif";
      ctx.fillStyle = `rgba(${c},0.5)`;
      const album = track.collectionName.length > 40 ? track.collectionName.slice(0, 39) + "…" : track.collectionName;
      ctx.fillText(album, 200, 165);

      /* Genre / year */
      if (track.genre || track.releaseYear) {
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillText([track.genre, track.releaseYear].filter(Boolean).join(" · "), 200, 195);
      }

      setPreviewUrl(canvas.toDataURL("image/png"));
    };

    if (track.artworkUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        /* Artwork square */
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(20, 20, 160, 160, 8);
        ctx.clip();
        ctx.drawImage(img, 20, 20, 160, 160);
        ctx.restore();
        /* Accent border */
        ctx.strokeStyle = `rgba(${c},0.4)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(20, 20, 160, 160, 8);
        ctx.stroke();
        drawText();
      };
      img.onerror = drawText;
      img.src = track.artworkUrl;
    } else {
      drawText();
    }
  }, [track, c]);

  useEffect(() => { draw(); }, [draw]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `vinyl-${track?.trackName ?? "track"}.png`;
    a.click();
  };

  if (!track) return <Empty c={c} msg="Play a track to generate a share card" />;

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="w-full rounded-lg" style={{ border: `1px solid rgba(${c},.2)` }} />
      <button onClick={handleDownload}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
        style={{ background: `rgba(${c},.15)`, border: `1px solid rgba(${c},.3)`, color: `rgb(${c})` }}>
        <Download size={14} /> Download Card
      </button>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */
function Spinner({ c }: { c: string }) {
  return (
    <div className="flex items-center gap-2 py-6">
      <Loader2 size={16} className="animate-spin" style={{ color: `rgb(${c})` }} />
      <span className="text-xs text-muted-foreground">Loading…</span>
    </div>
  );
}

function Empty({ c, msg }: { c: string; msg: string }) {
  return <p className="text-sm py-6 text-center" style={{ color: `rgba(${c},.4)` }}>{msg}</p>;
}

function formatMs(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
