import { useRef, useEffect, useCallback } from "react";

interface Props {
  getFreqData: () => Uint8Array;
  isPlaying: boolean;
  accentColor: string;
  height?: number;
}

export default function VUMeter({ getFreqData, isPlaying, accentColor, height = 48 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);
  const c         = accentColor;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const data = getFreqData();
    if (!data.length) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    const bins = Math.min(48, data.length);
    const barW = W / bins - 1;
    const [r, g, b] = c.split(",").map(Number);

    for (let i = 0; i < bins; i++) {
      const v = data[i] / 255;
      const bH = Math.max(2, v * H);
      const bright = 0.4 + v * 0.6;

      const grad = ctx.createLinearGradient(0, H - bH, 0, H);
      grad.addColorStop(0, `rgba(255,255,255,${bright * 0.5})`);
      grad.addColorStop(0.4, `rgba(${Math.min(255, r * 1.3)},${Math.min(255, g * 1.3)},${Math.min(255, b * 1.3)},${bright})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},${bright * 0.7})`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(i * (barW + 1), H - bH, barW, bH, 2);
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [getFreqData, c]);

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={height}
      className="w-full rounded-sm opacity-80"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
