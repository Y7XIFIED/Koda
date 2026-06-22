import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GripVertical, Shuffle, Save, FolderOpen, Trash2 } from "lucide-react";
import type { iTunesTrack } from "../lib/itunes";

interface Props {
  tracks: iTunesTrack[];
  currentIdx: number;
  accentColor: string;
  onReorder: (tracks: iTunesTrack[]) => void;
  onRemove: (idx: number) => void;
  onPlay: (track: iTunesTrack, idx: number) => void;
  onClose: () => void;
  savedPlaylists: { name: string; tracks: iTunesTrack[] }[];
  onSavePlaylist: (name: string) => void;
  onLoadPlaylist: (pl: { name: string; tracks: iTunesTrack[] }) => void;
  onDeletePlaylist: (name: string) => void;
}

export default function QueuePanel({
  tracks, currentIdx, accentColor: c, onReorder, onRemove, onPlay,
  onClose, savedPlaylists, onSavePlaylist, onLoadPlaylist, onDeletePlaylist,
}: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [tab, setTab] = useState<"queue" | "playlists">("queue");
  const [plName, setPlName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const handleShuffle = () => {
    const arr = [...tracks];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    onReorder(arr);
  };

  const handleDragStart = (i: number) => setDragIdx(i);
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setOverIdx(i); };
  const handleDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const arr = [...tracks];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(i, 0, moved);
    onReorder(arr);
    setDragIdx(null); setOverIdx(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 80 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="fixed right-0 top-0 bottom-0 w-80 flex flex-col z-40 border-l"
      style={{ background: "rgba(8,6,4,.97)", backdropFilter: "blur(20px)", borderColor: `rgba(${c},.15)` }}>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0"
        style={{ borderColor: `rgba(${c},.12)` }}>
        <div className="flex gap-1">
          {(["queue","playlists"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1 text-xs uppercase tracking-wider rounded-full transition-all"
              style={{ background: tab===t ? `rgba(${c},.15)` : "transparent", color: tab===t ? `rgb(${c})` : `rgba(${c},.4)`, border: `1px solid ${tab===t ? `rgba(${c},.3)` : "transparent"}` }}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
      </div>

      {tab === "queue" && (
        <>
          {/* Queue actions */}
          <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: `rgba(${c},.08)` }}>
            <button onClick={handleShuffle}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full metallic-button transition-colors"
              style={{ color: `rgba(${c},.7)` }}>
              <Shuffle size={11} /> Shuffle
            </button>
            <button onClick={() => setShowSave(v => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full metallic-button transition-colors"
              style={{ color: `rgba(${c},.7)` }}>
              <Save size={11} /> Save
            </button>
            <AnimatePresence>
              {showSave && (
                <motion.div initial={{ opacity:0,y:-4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-4 }}
                  className="fixed top-24 right-4 z-50 flex gap-2 p-2 rounded-lg border"
                  style={{ background:"rgba(12,10,8,.98)", borderColor:`rgba(${c},.2)` }}>
                  <input value={plName} onChange={e=>setPlName(e.target.value)}
                    placeholder="Playlist name…"
                    className="bg-transparent border-b text-xs px-1 outline-none w-32"
                    style={{ borderColor:`rgba(${c},.3)`, color:"rgba(255,255,255,.8)" }} />
                  <button onClick={() => { if (plName.trim()) { onSavePlaylist(plName.trim()); setPlName(""); setShowSave(false); } }}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background:`rgba(${c},.2)`, color:`rgb(${c})` }}>Save</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Queue list */}
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            {tracks.length === 0 ? (
              <p className="text-center text-xs py-8" style={{ color:`rgba(${c},.3)` }}>Queue is empty</p>
            ) : tracks.map((t, i) => (
              <div key={`${t.trackId}-${i}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-white/5 select-none"
                style={{ borderBottom: `1px solid rgba(${c},.05)`, background: overIdx===i ? `rgba(${c},.08)` : i===currentIdx ? `rgba(${c},.06)` : "transparent" }}
                onClick={() => onPlay(t, i)}>
                <GripVertical size={12} className="shrink-0 opacity-30 cursor-grab" />
                <img src={t.artworkUrl} alt="" className="w-8 h-8 rounded shrink-0 object-cover" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-medium truncate" style={{ color: i===currentIdx ? `rgb(${c})` : "rgba(255,255,255,.85)" }}>
                    {t.trackName}
                  </p>
                  <p className="text-[10px] truncate text-muted-foreground">{t.artistName}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); onRemove(i); }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "playlists" && (
        <div className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-2">
          {savedPlaylists.length === 0 ? (
            <p className="text-center text-xs py-8" style={{ color:`rgba(${c},.3)` }}>No saved playlists yet</p>
          ) : savedPlaylists.map((pl) => (
            <div key={pl.name} className="flex items-center gap-2 p-3 rounded-lg border transition-all"
              style={{ borderColor:`rgba(${c},.12)`, background:`rgba(${c},.04)` }}>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate" style={{ color:`rgba(${c},.9)` }}>{pl.name}</p>
                <p className="text-[10px] text-muted-foreground">{pl.tracks.length} tracks</p>
              </div>
              <button onClick={() => onLoadPlaylist(pl)}
                className="p-1.5 rounded transition-colors" style={{ color:`rgba(${c},.7)` }}>
                <FolderOpen size={14} />
              </button>
              <button onClick={() => onDeletePlaylist(pl.name)}
                className="p-1.5 rounded transition-colors hover:text-red-400" style={{ color:`rgba(${c},.4)` }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
