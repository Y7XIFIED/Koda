import { motion } from "framer-motion";
import { X, RotateCcw } from "lucide-react";
import { EQ_LABELS } from "../hooks/useWebAudio";

interface Props {
  eqGains: number[];
  reverbWet: number;
  bassBoostOn: boolean;
  crackleOn: boolean;
  monoOn: boolean;
  accentColor: string;
  onEQ: (i: number, v: number) => void;
  onReverb: (v: number) => void;
  onBassBoost: () => void;
  onCrackle: () => void;
  onMono: () => void;
  onClose: () => void;
  onReset: () => void;
}

export default function EQPanel({
  eqGains, reverbWet, bassBoostOn, crackleOn, monoOn, accentColor: c,
  onEQ, onReverb, onBassBoost, onCrackle, onMono, onClose, onReset,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      className="fixed bottom-0 left-0 right-0 z-40 border-t"
      style={{ background: "rgba(6,4,2,.97)", backdropFilter: "blur(20px)", borderColor: `rgba(${c},.15)` }}>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-[0.25em] font-semibold" style={{ color:`rgba(${c},.7)` }}>
            Equalizer & Effects
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onReset} className="text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors hover:bg-white/5"
              style={{ color:`rgba(${c},.5)` }}>
              <RotateCcw size={11}/> Reset
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16}/></button>
          </div>
        </div>

        <div className="flex gap-6 items-end">
          {/* 5-band EQ */}
          {EQ_LABELS.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-2 flex-1">
              <span className="text-[9px] font-mono tabular-nums" style={{ color:`rgba(${c},.6)` }}>
                {eqGains[i] >= 0 ? "+" : ""}{eqGains[i].toFixed(0)}
              </span>
              <div className="relative h-28 flex items-center justify-center">
                <input type="range" min="-12" max="12" step="0.5"
                  value={eqGains[i]}
                  onChange={e => onEQ(i, parseFloat(e.target.value))}
                  className="eq-slider"
                  style={{ writingMode:"vertical-lr" as React.CSSProperties["writingMode"], direction:"rtl", height:"100%", width:"28px", accentColor:`rgb(${c})` }} />
              </div>
              <span className="text-[9px] uppercase tracking-wider text-center leading-tight" style={{ color:`rgba(${c},.45)` }}>
                {label}
              </span>
            </div>
          ))}

          {/* Reverb fader */}
          <div className="flex flex-col items-center gap-2 w-12">
            <span className="text-[9px] font-mono tabular-nums" style={{ color:`rgba(${c},.6)` }}>
              {Math.round(reverbWet * 100)}%
            </span>
            <div className="relative h-28 flex items-center justify-center">
              <input type="range" min="0" max="1" step="0.02"
                value={reverbWet}
                onChange={e => onReverb(parseFloat(e.target.value))}
                className="eq-slider"
                style={{ writingMode:"vertical-lr" as React.CSSProperties["writingMode"], direction:"rtl", height:"100%", width:"28px", accentColor:`rgb(${c})` }} />
            </div>
            <span className="text-[9px] uppercase tracking-wider text-center" style={{ color:`rgba(${c},.45)` }}>Reverb</span>
          </div>

          {/* Toggle buttons */}
          <div className="flex flex-col gap-2 justify-center pb-6">
            {[
              { label:"Bass+", active:bassBoostOn, fn:onBassBoost },
              { label:"Crackle", active:crackleOn, fn:onCrackle },
              { label:"Mono", active:monoOn, fn:onMono },
            ].map(({ label, active, fn }) => (
              <button key={label} onClick={fn}
                className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-full metallic-button transition-all"
                style={{ color: active ? `rgb(${c})` : `rgba(${c},.4)`, background: active ? `rgba(${c},.15)` : "transparent", border:`1px solid ${active ? `rgba(${c},.35)` : "transparent"}` }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
