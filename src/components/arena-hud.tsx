"use client";

import { useState, useEffect } from "react";
import HealthBar from "./health-bar";
import { formatDuration } from "@/lib/game-engine";

interface ArenaHudProps {
  playerAName: string;
  playerBName: string;
  playerAHealth: number;
  playerBHealth: number;
  playerAReps: number;
  playerBReps: number;
  startTime: number | null;
  lastDamageA: number | null;
  lastDamageB: number | null;
}

export default function ArenaHud({
  playerAName,
  playerBName,
  playerAHealth,
  playerBHealth,
  playerAReps,
  playerBReps,
  startTime,
  lastDamageA,
  lastDamageB,
}: ArenaHudProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="w-full">
      {/* Top bar — health bars + timer */}
      <div className="glass-panel-sm px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Player A health (left side) */}
          <div className="flex-1 min-w-0">
            <HealthBar
              health={playerAHealth}
              playerName={playerAName}
              reps={playerAReps}
              side="left"
              showDamage={lastDamageA}
            />
          </div>

          {/* Center — VS + Timer */}
          <div className="flex flex-col items-center shrink-0 px-1 sm:px-3">
            <div
              className="text-sm font-black tracking-widest"
              style={{
                color: "rgba(255, 107, 53, 0.6)",
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
              }}
            >
              VS
            </div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{
                color: "var(--col-text)",
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
              }}
            >
              {formatDuration(elapsed)}
            </div>
          </div>

          {/* Player B health (right side) */}
          <div className="flex-1 min-w-0">
            <HealthBar
              health={playerBHealth}
              playerName={playerBName}
              reps={playerBReps}
              side="right"
              showDamage={lastDamageB}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
