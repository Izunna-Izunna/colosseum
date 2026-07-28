"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { MAX_HEALTH, getHealthColor } from "@/lib/game-engine";

interface HealthBarProps {
  health: number;
  playerName: string;
  reps: number;
  side: "left" | "right";
  showDamage?: number | null;
}

export default function HealthBar({
  health,
  playerName,
  reps,
  side,
  showDamage,
}: HealthBarProps) {
  const controls = useAnimationControls();
  const barRef = useRef<HTMLDivElement>(null);
  const [damageNumbers, setDamageNumbers] = useState<
    { id: number; value: number }[]
  >([]);
  const damageIdRef = useRef(0);
  const percentage = (health / MAX_HEALTH) * 100;

  // Flash + shake on damage
  useEffect(() => {
    if (showDamage && showDamage > 0) {
      controls.start({
        x: [0, -6, 6, -4, 4, -2, 2, 0],
        transition: { duration: 0.4 },
      });

      const id = damageIdRef.current++;
      setDamageNumbers((prev) => [...prev, { id, value: showDamage }]);

      setTimeout(() => {
        setDamageNumbers((prev) => prev.filter((d) => d.id !== id));
      }, 1000);
    }
  }, [showDamage, controls]);

  return (
    <motion.div
      animate={controls}
      className="relative flex flex-col gap-1 sm:gap-2 min-w-0 w-full"
    >
      {/* Player info row */}
      <div
        className={`flex items-center gap-3 ${
          side === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {/* Avatar circle */}
        <div
          className="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-lg font-bold shrink-0"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #ff6b35)",
            fontFamily: "var(--font-heading, Outfit, sans-serif)",
          }}
        >
          {playerName.charAt(0).toUpperCase()}
        </div>

        <div className={`flex-1 min-w-0 ${side === "right" ? "text-right" : ""}`}>
          <div
            className="text-xs sm:text-sm font-semibold tracking-wide truncate"
            style={{
              color: "var(--col-text)",
              fontFamily: "var(--font-heading, Outfit, sans-serif)",
            }}
          >
            {playerName}
          </div>
          <div
            className="text-xs"
            style={{ color: "var(--col-text-muted)" }}
          >
            {reps} {reps === 1 ? "rep" : "reps"}
          </div>
        </div>

        {/* HP number */}
        <div
          className="text-lg font-bold tabular-nums shrink-0"
          style={{
            color: percentage > 60 ? "#4ade80" : percentage > 30 ? "#facc15" : "#ff0033",
            fontFamily: "var(--font-heading, Outfit, sans-serif)",
          }}
        >
          {Math.ceil(health)}
        </div>
      </div>

      {/* Health bar */}
      <div className="health-bar-container">
        <motion.div
          className="health-bar-fill"
          animate={{
            width: `${percentage}%`,
          }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{
            background: getHealthColor(health),
          }}
        />

        {/* Flash overlay on damage */}
        {showDamage && showDamage > 0 && (
          <motion.div
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 rounded-xl"
            style={{ background: "rgba(255, 255, 255, 0.5)" }}
          />
        )}
      </div>

      {/* Floating damage numbers */}
      {damageNumbers.map((dmg) => (
        <motion.div
          key={dmg.id}
          initial={{ opacity: 1, y: 0, scale: 1.2 }}
          animate={{ opacity: 0, y: -50, scale: 0.6 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="absolute -top-2 font-black text-2xl pointer-events-none"
          style={{
            left: side === "left" ? "50%" : undefined,
            right: side === "right" ? "50%" : undefined,
            color: "#ff0033",
            textShadow: "0 0 10px rgba(255, 0, 51, 0.8)",
            fontFamily: "var(--font-heading, Outfit, sans-serif)",
          }}
        >
          -{dmg.value}
        </motion.div>
      ))}
    </motion.div>
  );
}
