import { useRef, useCallback, useState } from "react";

export const EQ_FREQS = [80, 250, 1000, 4000, 12000] as const;
export const EQ_LABELS = ["Bass", "Low‑Mid", "Mid", "Hi‑Mid", "Treble"] as const;

function makeImpulse(ctx: AudioContext, dur = 1.8, decay = 2.5): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function useWebAudio() {
  const ctxRef        = useRef<AudioContext | null>(null);
  const analyserRef   = useRef<AnalyserNode | null>(null);
  const eqRef         = useRef<BiquadFilterNode[]>([]);
  const reverbConvRef = useRef<ConvolverNode | null>(null);
  const reverbGainRef = useRef<GainNode | null>(null);
  const dryGainRef    = useRef<GainNode | null>(null);
  const crackleRef    = useRef<AudioBufferSourceNode | null>(null);
  const connectedRef  = useRef(false);

  const [eqGains,     setEqGains]     = useState([0, 0, 0, 0, 0]);
  const [reverbWet,   setReverbWet]   = useState(0);
  const [crackleOn,   setCrackleOn]   = useState(false);
  const [bassBoostOn, setBassBoostOn] = useState(false);
  const [monoOn,      setMonoOn]      = useState(false);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const connectAudio = useCallback((audio: HTMLAudioElement) => {
    if (connectedRef.current) return;
    connectedRef.current = true;
    const ctx = getCtx();

    const src = ctx.createMediaElementSource(audio);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    analyserRef.current = analyser;

    const eqNodes = Array.from({ length: 5 }, (_, i) => {
      const f = ctx.createBiquadFilter();
      f.type = i === 0 ? "lowshelf" : i === 4 ? "highshelf" : "peaking";
      f.frequency.value = EQ_FREQS[i];
      f.gain.value = 0;
      f.Q.value = 1.4;
      return f;
    });
    eqRef.current = eqNodes;

    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx);
    reverbConvRef.current = conv;
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0;
    reverbGainRef.current = reverbGain;
    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;
    dryGainRef.current = dryGain;

    /* Chain: src → analyser → EQ[0..4] → dry/reverb split */
    src.connect(analyser);
    let node: AudioNode = analyser;
    for (const eq of eqNodes) { node.connect(eq); node = eq; }
    node.connect(dryGain);
    node.connect(conv);
    dryGain.connect(ctx.destination);
    conv.connect(reverbGain);
    reverbGain.connect(ctx.destination);
  }, [getCtx]);

  const getFreqData = useCallback((): Uint8Array => {
    const a = analyserRef.current;
    if (!a) return new Uint8Array(0);
    const d = new Uint8Array(a.frequencyBinCount);
    a.getByteFrequencyData(d);
    return d;
  }, []);

  const setEQBand = useCallback((i: number, gain: number) => {
    const n = eqRef.current[i];
    if (n) n.gain.value = gain;
    setEqGains(p => { const q = [...p]; q[i] = gain; return q; });
  }, []);

  const setReverb = useCallback((wet: number) => {
    if (reverbGainRef.current) reverbGainRef.current.gain.value = wet;
    if (dryGainRef.current) dryGainRef.current.gain.value = Math.max(0.5, 1 - wet * 0.5);
    setReverbWet(wet);
  }, []);

  const toggleBassBoost = useCallback(() => {
    setBassBoostOn(on => {
      const next = !on;
      const n = eqRef.current[0];
      if (n) n.gain.value = next ? 8 : 0;
      return next;
    });
  }, []);

  const toggleCrackle = useCallback(() => {
    const ctx = getCtx();
    setCrackleOn(on => {
      if (on) { crackleRef.current?.stop(); crackleRef.current = null; return false; }
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, sr * 3, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++)
        d[i] = Math.random() < 0.003 ? (Math.random() * 2 - 1) * 0.55 : 0;
      const src2 = ctx.createBufferSource();
      src2.buffer = buf; src2.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 4800; bp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0.3;
      src2.connect(bp); bp.connect(g); g.connect(ctx.destination);
      src2.start();
      crackleRef.current = src2;
      return true;
    });
  }, [getCtx]);

  const toggleMono = useCallback(() => setMonoOn(m => !m), []);

  return {
    connectAudio, getFreqData,
    setEQBand, eqGains,
    reverbWet, setReverb,
    bassBoostOn, toggleBassBoost,
    crackleOn, toggleCrackle,
    monoOn, toggleMono,
  };
}
