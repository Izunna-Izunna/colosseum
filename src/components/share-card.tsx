"use client";

import { useRef, useEffect } from "react";
import type { DuelResult } from "@/lib/share";

interface ShareCardProps {
  result: DuelResult;
  className?: string;
}

/**
 * Visual share card rendered on a canvas element.
 * This is the preview version — the actual exported image uses the
 * generateShareCard function from lib/share.ts.
 */
export default function ShareCard({ result, className = "" }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const scale = w / 1080;

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, "#0a0612");
    bgGrad.addColorStop(0.4, "#1a0a2e");
    bgGrad.addColorStop(0.7, "#2d1052");
    bgGrad.addColorStop(1, "#0a0612");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(124, 58, 237, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40 * scale) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40 * scale) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Title
    ctx.font = `900 ${48 * scale}px Outfit, sans-serif`;
    ctx.textAlign = "center";
    const titleGrad = ctx.createLinearGradient(w * 0.3, 0, w * 0.7, 0);
    titleGrad.addColorStop(0, "#ff6b35");
    titleGrad.addColorStop(0.5, "#ffd700");
    titleGrad.addColorStop(1, "#ff9a6c");
    ctx.fillStyle = titleGrad;
    ctx.fillText("COLOSSEUM", w / 2, 80 * scale);

    // Subtitle
    ctx.font = `500 ${18 * scale}px Inter, sans-serif`;
    ctx.fillStyle = "#9b8ec4";
    ctx.fillText("DUEL RESULTS", w / 2, 115 * scale);

    // Winner
    ctx.font = `700 ${22 * scale}px Outfit, sans-serif`;
    ctx.fillStyle = "#ffd700";
    ctx.fillText("👑 WINNER", w / 2, 195 * scale);

    ctx.font = `900 ${52 * scale}px Outfit, sans-serif`;
    ctx.fillStyle = "#f0edf6";
    ctx.fillText(result.winnerName.toUpperCase(), w / 2, 255 * scale);

    ctx.font = `600 ${24 * scale}px Inter, sans-serif`;
    ctx.fillStyle = "#00f5d4";
    ctx.fillText(
      `${result.winnerReps} REPS · ${result.winnerHealthRemaining}% HP`,
      w / 2,
      300 * scale
    );

    // VS
    ctx.font = `800 ${36 * scale}px Outfit, sans-serif`;
    ctx.fillStyle = "rgba(255, 107, 53, 0.4)";
    ctx.fillText("VS", w / 2, 380 * scale);

    // Loser
    ctx.font = `700 ${22 * scale}px Outfit, sans-serif`;
    ctx.fillStyle = "#ff0033";
    ctx.fillText("💀 DEFEATED", w / 2, 440 * scale);

    ctx.font = `700 ${42 * scale}px Outfit, sans-serif`;
    ctx.fillStyle = "rgba(240, 237, 246, 0.6)";
    ctx.fillText(result.loserName.toUpperCase(), w / 2, 495 * scale);

    ctx.font = `600 ${20 * scale}px Inter, sans-serif`;
    ctx.fillStyle = "#9b8ec4";
    ctx.fillText(`${result.loserReps} REPS`, w / 2, 535 * scale);

    // Health bars
    const barY = 590 * scale;
    const barW = 400 * scale;
    const barH = 24 * scale;
    const barX = (w - barW) / 2;

    // Winner bar bg
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 12 * scale);
    ctx.fill();

    // Winner bar fill
    const hpW = (result.winnerHealthRemaining / 100) * barW;
    const hpGrad = ctx.createLinearGradient(barX, 0, barX + hpW, 0);
    hpGrad.addColorStop(0, "#22c55e");
    hpGrad.addColorStop(1, "#4ade80");
    ctx.fillStyle = hpGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, hpW, barH, 12 * scale);
    ctx.fill();

    // Loser bar bg (empty)
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(barX, barY + 36 * scale, barW, barH, 12 * scale);
    ctx.fill();

    // Duration
    const mins = Math.floor(result.durationSeconds / 60);
    const secs = result.durationSeconds % 60;
    ctx.font = `500 ${18 * scale}px Inter, sans-serif`;
    ctx.fillStyle = "#9b8ec4";
    ctx.fillText(
      `Duration: ${mins}:${secs.toString().padStart(2, "0")}`,
      w / 2,
      700 * scale
    );

    // Footer
    ctx.font = `600 ${16 * scale}px Outfit, sans-serif`;
    ctx.fillStyle = "rgba(124, 58, 237, 0.5)";
    ctx.fillText("colosseum.gg — Enter the Arena", w / 2, h - 30 * scale);
  }, [result]);

  return (
    <canvas
      ref={canvasRef}
      width={540}
      height={540}
      className={`rounded-2xl ${className}`}
      style={{
        maxWidth: "100%",
        height: "auto",
        border: "2px solid var(--col-border)",
      }}
    />
  );
}
