import { useState, useRef, useEffect } from "react";
import { motion, useAnimation, useMotionValue } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { albums, Album, Track } from "./lib/albums";

export default function App() {
  const [currentAlbum, setCurrentAlbum] = useState<Album>(albums[0]);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  
  const track = currentAlbum.tracks[currentTrackIdx];
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            handleNext();
            return 0;
          }
          // Progress roughly scaled to track duration for simulation
          return p + (100 / (track.duration * 10)); 
        });
      }, 100);
    } else {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying, track, currentTrackIdx]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  
  const handleNext = () => {
    setProgress(0);
    if (currentTrackIdx < currentAlbum.tracks.length - 1) {
      setCurrentTrackIdx(currentTrackIdx + 1);
    } else {
      setIsPlaying(false);
      setCurrentTrackIdx(0);
    }
  };

  const handlePrev = () => {
    setProgress(0);
    if (currentTrackIdx > 0) {
      setCurrentTrackIdx(currentTrackIdx - 1);
    }
  };

  const handleSelectAlbum = (album: Album) => {
    if (album.id === currentAlbum.id) return;
    setIsPlaying(false);
    setProgress(0);
    setCurrentAlbum(album);
    setCurrentTrackIdx(0);
    // Slight delay before auto-playing
    setTimeout(() => setIsPlaying(true), 600);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 md:p-8 font-sans overflow-hidden">
      
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-amber-900/10 rounded-full blur-[150px] mix-blend-screen" />
      </div>

      <div className="z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        
        {/* Left Column: Player info and controls */}
        <div className="col-span-1 lg:col-span-5 flex flex-col gap-10">
          
          <div className="space-y-2 text-center lg:text-left">
            <motion.h2 
              key={currentAlbum.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs uppercase tracking-[0.3em] text-primary/70 font-semibold"
            >
              Now Playing
            </motion.h2>
            <motion.h1 
              key={track.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight glow-text"
            >
              {track.title}
            </motion.h1>
            <motion.p 
              key={currentAlbum.artist}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg md:text-xl text-muted-foreground font-serif italic"
            >
              {currentAlbum.artist} &mdash; {currentAlbum.title}
            </motion.p>
          </div>

          <div className="flex flex-col gap-6 w-full max-w-sm mx-auto lg:mx-0">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="h-1 bg-black/50 rounded-full overflow-hidden shadow-inner border border-white/5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-primary/50 to-primary rounded-full relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(212,168,83,0.8)]" />
                </motion.div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground font-mono tracking-wider">
                <span>{formatTime(track.duration * (progress/100))}</span>
                <span>{formatTime(track.duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between lg:justify-start lg:gap-8">
              <div className="flex items-center gap-4">
                <button 
                  onClick={handlePrev}
                  className="w-12 h-12 rounded-full metallic-button flex items-center justify-center text-primary/80 hover:text-primary transition-colors"
                >
                  <SkipBack size={20} fill="currentColor" />
                </button>
                <button 
                  onClick={handlePlayPause}
                  className="w-16 h-16 rounded-full metallic-button flex items-center justify-center text-primary hover:text-amber-300 transition-colors shadow-[0_0_15px_rgba(212,168,83,0.15)]"
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <button 
                  onClick={handleNext}
                  className="w-12 h-12 rounded-full metallic-button flex items-center justify-center text-primary/80 hover:text-primary transition-colors"
                >
                  <SkipForward size={20} fill="currentColor" />
                </button>
              </div>

              {/* Volume Knob */}
              <VolumeKnob volume={volume} onChange={setVolume} />
            </div>
          </div>
        </div>

        {/* Right Column: Turntable */}
        <div className="col-span-1 lg:col-span-7 flex justify-center relative perspective-[1000px]">
          <div className="relative w-[320px] h-[320px] md:w-[480px] md:h-[480px] plinth-texture rounded-xl p-4 md:p-8 transform-gpu rotate-x-12 rotate-y-[-5deg] rotate-z-2 shadow-2xl border border-white/5">
            
            {/* Turntable Platter */}
            <div className="absolute top-1/2 left-[45%] md:left-[45%] -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] md:w-[420px] md:h-[420px] bg-[#111] rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.8),inset_0_0_10px_rgba(0,0,0,0.5)] border border-[#222]">
              
              {/* The Vinyl Record */}
              <div 
                className={`w-full h-full rounded-full vinyl-grooves relative flex items-center justify-center ${isPlaying ? 'spin-record' : ''}`}
                style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
              >
                <div className="absolute inset-0 rounded-full vinyl-highlight pointer-events-none mix-blend-screen" />
                
                {/* Album Label */}
                <div 
                  className="w-[100px] h-[100px] md:w-[140px] md:h-[140px] rounded-full flex items-center justify-center relative shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] transition-colors duration-1000"
                  style={{ background: currentAlbum.labelStyle }}
                >
                  <div className="text-center p-2 text-white/90">
                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-80">{currentAlbum.artist}</p>
                    <p className="text-xs md:text-sm font-serif font-black mt-1 leading-tight">{currentAlbum.title}</p>
                  </div>
                  {/* Spindle hole */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 bg-[#1a1a1a] rounded-full shadow-inner border border-black/50" />
                </div>
              </div>
            </div>

            {/* Tonearm */}
            <Tonearm isPlaying={isPlaying} progress={progress} />
            
          </div>
        </div>

      </div>

      {/* Bottom Shelf: Queue */}
      <div className="fixed bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-black via-black/80 to-transparent z-20">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 font-semibold">Record Collection</p>
          <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 px-2 snap-x snap-mandatory hide-scrollbar">
            {albums.map((album) => (
              <div 
                key={album.id}
                onClick={() => handleSelectAlbum(album)}
                className={`snap-start shrink-0 cursor-pointer group relative transition-transform duration-300 ${currentAlbum.id === album.id ? '-translate-y-4' : 'hover:-translate-y-2'}`}
              >
                <div 
                  className="w-32 h-32 md:w-40 md:h-40 rounded-sm shadow-[5px_5px_15px_rgba(0,0,0,0.6)] border border-white/10 relative overflow-hidden"
                  style={{ background: album.sleeveStyle }}
                >
                  {/* Faux wear/texture on sleeve */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 mix-blend-overlay pointer-events-none" />
                  <div className="absolute top-0 bottom-0 left-0 w-2 bg-gradient-to-r from-black/40 to-transparent" />
                  
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-xs text-white/70 uppercase tracking-wider mb-1">{album.artist}</p>
                    <p className="text-sm font-serif font-bold text-white leading-tight">{album.title}</p>
                  </div>
                </div>
                {currentAlbum.id === album.id && (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(212,168,83,0.8)]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

function VolumeKnob({ volume, onChange }: { volume: number, onChange: (v: number) => void }) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Angle roughly -135 to 135 deg
  const valToAngle = (v: number) => -135 + (v * 270);
  const angleToVal = (a: number) => Math.min(1, Math.max(0, (a + 135) / 270));

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !knobRef.current) return;
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle > 180) angle -= 360;
    
    // Clamp
    if (angle < -135) angle = -135;
    if (angle > 135) angle = 135;
    
    onChange(angleToVal(angle));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div 
        ref={knobRef}
        className="w-12 h-12 rounded-full metallic-button relative cursor-ns-resize"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div 
          className="absolute inset-0 rounded-full"
          style={{ transform: `rotate(${valToAngle(volume)}deg)` }}
        >
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-primary rounded-full shadow-[0_0_5px_rgba(212,168,83,0.5)]" />
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Vol</span>
    </div>
  );
}

function Tonearm({ isPlaying, progress }: { isPlaying: boolean, progress: number }) {
  // Base angle + progress angle
  // Rest position: ~15deg
  // Play start: ~30deg
  // Play end: ~45deg
  
  const playAngle = 28 + (progress * 0.15); // Progress from 0-100 scales to about 15 degrees of movement
  const rotation = isPlaying ? playAngle : 15;

  return (
    <div className="absolute top-8 right-8 md:top-12 md:right-12 w-24 h-64 md:w-32 md:h-80 origin-top-right z-10 pointer-events-none">
      <motion.div 
        initial={false}
        animate={{ rotate: rotation }}
        transition={{ type: "spring", stiffness: 40, damping: 15 }}
        className="relative w-full h-full origin-[80%_15%]"
      >
        {/* Base/Pivot */}
        <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-[#444] to-[#111] rounded-full border-4 border-[#222] shadow-xl flex items-center justify-center">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-[#1a1a1a] rounded-full border border-black/50 shadow-inner" />
        </div>
        
        {/* Arm Tube */}
        <div className="absolute top-8 right-8 w-2 h-48 md:w-3 md:h-64 bg-gradient-to-r from-[#e0e0e0] via-[#888] to-[#e0e0e0] origin-top -rotate-[20deg] rounded-full shadow-[2px_10px_10px_rgba(0,0,0,0.5)] border border-white/20" />
        
        {/* Headhead */}
        <div className="absolute bottom-4 left-6 md:bottom-2 md:left-8 w-6 h-12 md:w-8 md:h-16 bg-[#111] rotate-[10deg] rounded-sm shadow-[0_10px_15px_rgba(0,0,0,0.6)] border border-[#333]">
          <div className="absolute bottom-0 right-0 w-2 h-2 bg-red-600 rounded-full shadow-[0_0_5px_red]" />
        </div>
      </motion.div>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
