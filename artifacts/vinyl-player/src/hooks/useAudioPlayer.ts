import { useState, useRef, useEffect, useCallback } from "react";

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    try { return parseFloat(localStorage.getItem("vinyl-volume") ?? "0.8"); } catch { return 0.8; }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const onEndedCallbackRef = useRef<(() => void) | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedVolumeRef = useRef(volume);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (audio.duration > 0) {
        setCurrentTime(audio.currentTime);
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const handleDurationChange = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      onEndedCallbackRef.current?.();
    };
    const handleCanPlay = () => setIsLoading(false);
    const handleWaiting = () => setIsLoading(true);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  const loadAndPlay = useCallback((url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsLoading(true);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    audio.pause();
    audio.src = url;
    audio.playbackRate = playbackRate;
    audio.load();
    audio.addEventListener(
      "canplay",
      () => { audio.play().catch(() => setIsLoading(false)); },
      { once: true }
    );
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((pct: number) => {
    const audio = audioRef.current;
    if (!audio || isNaN(audio.duration)) return;
    audio.currentTime = (pct / 100) * audio.duration;
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || isNaN(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
  }, []);

  const changeVolume = useCallback((v: number) => {
    if (audioRef.current) {
      const clamped = Math.min(1, Math.max(0, v));
      audioRef.current.volume = clamped;
      audioRef.current.muted = false;
      setVolume(clamped);
      setIsMuted(false);
      savedVolumeRef.current = clamped;
      try { localStorage.setItem("vinyl-volume", clamped.toString()); } catch {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    if (isMuted) {
      const target = savedVolumeRef.current || 0.8;
      let v = 0;
      audio.muted = false;
      audio.volume = 0;
      fadeIntervalRef.current = setInterval(() => {
        v = Math.min(target, v + target / 20);
        audio.volume = v;
        if (v >= target) {
          clearInterval(fadeIntervalRef.current!);
          fadeIntervalRef.current = null;
        }
      }, 15);
      setIsMuted(false);
      setVolume(target);
    } else {
      savedVolumeRef.current = audio.volume;
      let v = audio.volume;
      fadeIntervalRef.current = setInterval(() => {
        v = Math.max(0, v - audio.volume / 20);
        audio.volume = v;
        if (v <= 0) {
          audio.muted = true;
          clearInterval(fadeIntervalRef.current!);
          fadeIntervalRef.current = null;
        }
      }, 15);
      setIsMuted(true);
    }
  }, [isMuted]);

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  const setOnEnded = useCallback((fn: () => void) => {
    onEndedCallbackRef.current = fn;
  }, []);

  const forceStop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
  }, []);

  return {
    isPlaying, progress, currentTime, duration, volume,
    isLoading, isMuted, playbackRate,
    loadAndPlay, togglePlay, seek, seekBy, changeVolume,
    toggleMute, setPlaybackRate, setOnEnded, forceStop,
    audioRef,
  };
}
