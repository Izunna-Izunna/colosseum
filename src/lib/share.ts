/**
 * Share — Result card generation and Web Share API integration.
 */

export interface DuelResult {
  winnerName: string;
  loserName: string;
  winnerReps: number;
  loserReps: number;
  winnerHealthRemaining: number;
  durationSeconds: number;
}

/**
 * Generate a share card image as a Blob.
 * Renders Colosseum-branded result data onto an offscreen canvas.
 */
export async function generateShareCard(
  result: DuelResult
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
  bgGrad.addColorStop(0, "#0a0612");
  bgGrad.addColorStop(0.4, "#1a0a2e");
  bgGrad.addColorStop(0.7, "#2d1052");
  bgGrad.addColorStop(1, "#0a0612");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1080);

  // Grid pattern overlay
  ctx.strokeStyle = "rgba(124, 58, 237, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < 1080; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1080);
    ctx.stroke();
  }
  for (let y = 0; y < 1080; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1080, y);
    ctx.stroke();
  }

  // Title: COLOSSEUM
  ctx.font = "900 64px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  const titleGrad = ctx.createLinearGradient(340, 0, 740, 0);
  titleGrad.addColorStop(0, "#ff6b35");
  titleGrad.addColorStop(0.5, "#ffd700");
  titleGrad.addColorStop(1, "#ff9a6c");
  ctx.fillStyle = titleGrad;
  ctx.fillText("COLOSSEUM", 540, 120);

  // Subtitle
  ctx.font = "500 24px 'Inter', sans-serif";
  ctx.fillStyle = "#9b8ec4";
  ctx.fillText("DUEL RESULTS", 540, 165);

  // Divider line
  const lineGrad = ctx.createLinearGradient(200, 0, 880, 0);
  lineGrad.addColorStop(0, "transparent");
  lineGrad.addColorStop(0.3, "#7c3aed");
  lineGrad.addColorStop(0.7, "#7c3aed");
  lineGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(200, 195);
  ctx.lineTo(880, 195);
  ctx.stroke();

  // Winner section
  ctx.font = "700 28px 'Outfit', sans-serif";
  ctx.fillStyle = "#ffd700";
  ctx.fillText("👑 WINNER", 540, 270);

  ctx.font = "900 72px 'Outfit', sans-serif";
  ctx.fillStyle = "#f0edf6";
  ctx.fillText(result.winnerName.toUpperCase(), 540, 360);

  // Winner stats
  ctx.font = "600 32px 'Inter', sans-serif";
  ctx.fillStyle = "#00f5d4";
  ctx.fillText(`${result.winnerReps} REPS · ${result.winnerHealthRemaining}% HP LEFT`, 540, 420);

  // VS divider
  ctx.font = "800 48px 'Outfit', sans-serif";
  ctx.fillStyle = "rgba(255, 107, 53, 0.4)";
  ctx.fillText("VS", 540, 520);

  // Loser section
  ctx.font = "700 28px 'Outfit', sans-serif";
  ctx.fillStyle = "#ff0033";
  ctx.fillText("💀 DEFEATED", 540, 600);

  ctx.font = "700 56px 'Outfit', sans-serif";
  ctx.fillStyle = "rgba(240, 237, 246, 0.6)";
  ctx.fillText(result.loserName.toUpperCase(), 540, 670);

  ctx.font = "600 28px 'Inter', sans-serif";
  ctx.fillStyle = "#9b8ec4";
  ctx.fillText(`${result.loserReps} REPS`, 540, 720);

  // Health bars
  const barY = 790;
  const barWidth = 600;
  const barHeight = 36;
  const barX = (1080 - barWidth) / 2;

  // Winner health bar background
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barWidth, barHeight, 18);
  ctx.fill();

  // Winner health bar fill
  const hpWidth = (result.winnerHealthRemaining / 100) * barWidth;
  const hpGrad = ctx.createLinearGradient(barX, 0, barX + hpWidth, 0);
  hpGrad.addColorStop(0, "#22c55e");
  hpGrad.addColorStop(1, "#4ade80");
  ctx.fillStyle = hpGrad;
  ctx.beginPath();
  ctx.roundRect(barX, barY, hpWidth, barHeight, 18);
  ctx.fill();

  // Loser health bar (empty — 0 HP)
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.roundRect(barX, barY + 50, barWidth, barHeight, 18);
  ctx.fill();

  // Duration
  const mins = Math.floor(result.durationSeconds / 60);
  const secs = result.durationSeconds % 60;
  ctx.font = "500 24px 'Inter', sans-serif";
  ctx.fillStyle = "#9b8ec4";
  ctx.fillText(`Duration: ${mins}:${secs.toString().padStart(2, "0")}`, 540, 930);

  // Footer branding
  ctx.font = "600 20px 'Outfit', sans-serif";
  ctx.fillStyle = "rgba(124, 58, 237, 0.6)";
  ctx.fillText("colosseum.gg — Enter the Arena", 540, 1040);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/png",
      1
    );
  });
}

/**
 * Share results using Web Share API with fallback to download.
 */
export async function shareResult(result: DuelResult): Promise<void> {
  const blob = await generateShareCard(result);
  if (!blob) return;

  const file = new File([blob], "colosseum-duel-result.png", {
    type: "image/png",
  });

  // Try Web Share API first
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: "Colosseum Duel Result",
        text: `${result.winnerName} conquered the Arena with ${result.winnerReps} reps! 🏛️⚔️`,
        files: [file],
      });
      return;
    } catch (err) {
      // User cancelled or share failed — fall through to download
      if ((err as Error).name === "AbortError") return;
    }
  }

  // Fallback: download the image
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "colosseum-duel-result.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
