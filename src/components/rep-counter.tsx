"use client";

import { motion, AnimatePresence } from "framer-motion";

interface RepCounterProps {
  count: number;
  label?: string;
  size?: "sm" | "lg";
}

export default function RepCounter({
  count,
  label = "REPS",
  size = "lg",
}: RepCounterProps) {
  const fontSize = size === "lg" ? "4rem" : "2rem";
  const labelSize = size === "lg" ? "0.875rem" : "0.75rem";

  return (
    <div className="text-center">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={count}
          initial={{ scale: 1.6, opacity: 0, y: -10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 12,
          }}
          className="font-black tabular-nums"
          style={{
            fontSize,
            fontFamily: "var(--font-heading, Outfit, sans-serif)",
            color: "var(--col-text)",
            textShadow: "0 0 30px rgba(0, 245, 212, 0.4)",
            lineHeight: 1.1,
          }}
        >
          {count}
        </motion.div>
      </AnimatePresence>
      <div
        className="font-bold tracking-widest"
        style={{
          fontSize: labelSize,
          color: "var(--col-text-muted)",
          fontFamily: "var(--font-heading, Outfit, sans-serif)",
        }}
      >
        {label}
      </div>
    </div>
  );
}
