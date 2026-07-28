"use client";

import { motion, AnimatePresence } from "framer-motion";

interface CalibrationOverlayProps {
  step: "idle" | "down" | "up" | "done";
  isReady: boolean;
  opponentReady: boolean;
  onStartDownCalibration: () => void;
  onStartUpCalibration: () => void;
  onFinalizeCalibration: () => void;
  onToggleReady: () => void;
  downProgress: number;
  upProgress: number;
}

export default function CalibrationOverlay({
  step,
  isReady,
  opponentReady,
  onStartDownCalibration,
  onStartUpCalibration,
  onFinalizeCalibration,
  onToggleReady,
  downProgress,
  upProgress,
}: CalibrationOverlayProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4 }}
        className="glass-panel p-6 max-w-md mx-auto"
      >
        {step === "idle" && (
          <div className="text-center">
            <div className="text-5xl mb-4">🎯</div>
            <h3
              className="text-xl font-bold mb-2"
              style={{
                color: "var(--col-text)",
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
              }}
            >
              Calibration Time
            </h3>
            <p
              className="text-sm mb-6"
              style={{ color: "var(--col-text-muted)" }}
            >
              Get into push-up position in front of your camera. We&apos;ll
              learn your range of motion to track every rep.
            </p>
            <div
              className="text-xs mb-6 p-3 rounded-xl"
              style={{
                background: "rgba(0, 245, 212, 0.08)",
                border: "1px solid rgba(0, 245, 212, 0.2)",
                color: "var(--col-cyan)",
              }}
            >
              💡 Make sure your full upper body is visible. Green hand markers
              will appear to confirm your position.
            </div>
            <button
              onClick={onStartDownCalibration}
              className="btn-primary text-base"
            >
              Start Calibration
            </button>
          </div>
        )}

        {step === "down" && (
          <div className="text-center">
            <div className="text-5xl mb-4">⬇️</div>
            <h3
              className="text-xl font-bold mb-2"
              style={{
                color: "var(--col-text)",
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
              }}
            >
              Step 1: Lower Yourself Down
            </h3>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--col-text-muted)" }}
            >
              Get into push-up position and lower your chest toward the ground.
              Bend your elbows to about 90°. Hold steady.
            </p>

            <div
              className="w-full h-3 rounded-full overflow-hidden mb-4"
              style={{ background: "rgba(0,0,0,0.3)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, #7c3aed, #00f5d4)",
                  width: `${downProgress}%`,
                }}
                transition={{ duration: 0.2 }}
              />
            </div>

            {downProgress >= 100 && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={onStartUpCalibration}
                className="btn-primary text-base"
              >
                ✓ Got it! Next Step →
              </motion.button>
            )}
          </div>
        )}

        {step === "up" && (
          <div className="text-center">
            <div className="text-5xl mb-4">⬆️</div>
            <h3
              className="text-xl font-bold mb-2"
              style={{
                color: "var(--col-text)",
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
              }}
            >
              Step 2: Push All the Way Up
            </h3>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--col-text-muted)" }}
            >
              Push up until your arms are fully extended. Lock your elbows and
              hold for a moment.
            </p>

            <div
              className="w-full h-3 rounded-full overflow-hidden mb-4"
              style={{ background: "rgba(0,0,0,0.3)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, #ff6b35, #ffd700)",
                  width: `${upProgress}%`,
                }}
                transition={{ duration: 0.2 }}
              />
            </div>

            {upProgress >= 100 && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={onFinalizeCalibration}
                className="btn-primary text-base"
              >
                ✓ Calibration Complete!
              </motion.button>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="text-5xl mb-4">⚔️</div>
            <h3
              className="text-xl font-bold mb-2"
              style={{
                color: "var(--col-cyan)",
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
              }}
            >
              You&apos;re Calibrated!
            </h3>
            <p
              className="text-sm mb-6"
              style={{ color: "var(--col-text-muted)" }}
            >
              Hit Ready when you&apos;re set to fight. The duel starts when both
              gladiators are ready.
            </p>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={onToggleReady}
                className={`px-8 py-3 rounded-xl font-bold text-lg transition-all duration-300 ${
                  isReady
                    ? "bg-green-500/20 border-2 border-green-500 text-green-400"
                    : "btn-primary"
                }`}
                style={{
                  fontFamily: "var(--font-heading, Outfit, sans-serif)",
                }}
              >
                {isReady ? "✓ READY!" : "I'm Ready"}
              </button>

              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: "var(--col-text-muted)" }}
              >
                <div
                  className={`w-3 h-3 rounded-full ${
                    opponentReady ? "bg-green-500" : "bg-gray-600"
                  }`}
                />
                {opponentReady
                  ? "Opponent is ready!"
                  : "Waiting for opponent..."}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
