"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface CountdownProps {
  isActive: boolean;
  onComplete: () => void;
}

const STEPS = ["3", "2", "1", "GO!"];

export default function Countdown({ isActive, onComplete }: CountdownProps) {
  const [currentStep, setCurrentStep] = useState(-1);

  useEffect(() => {
    if (!isActive) {
      setCurrentStep(-1);
      return;
    }

    setCurrentStep(0);

    const timers: NodeJS.Timeout[] = [];

    for (let i = 1; i < STEPS.length; i++) {
      timers.push(
        setTimeout(() => {
          setCurrentStep(i);
        }, i * 1000)
      );
    }

    // Complete after "GO!" shows for 0.8s
    timers.push(
      setTimeout(() => {
        setCurrentStep(-1);
        onComplete();
      }, STEPS.length * 1000)
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isActive, onComplete]);

  return (
    <AnimatePresence>
      {currentStep >= 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(10, 6, 18, 0.85)" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ scale: 0, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 15,
                duration: 0.5,
              }}
              className="text-center"
            >
              <span
                className="font-black"
                style={{
                  fontSize: currentStep === STEPS.length - 1 ? "12rem" : "14rem",
                  fontFamily: "var(--font-heading, Outfit, sans-serif)",
                  color:
                    currentStep === STEPS.length - 1
                      ? "var(--col-orange)"
                      : "var(--col-text)",
                  textShadow:
                    currentStep === STEPS.length - 1
                      ? "0 0 80px rgba(255, 107, 53, 0.6), 0 0 160px rgba(255, 107, 53, 0.3)"
                      : "0 0 60px rgba(124, 58, 237, 0.5), 0 0 120px rgba(124, 58, 237, 0.2)",
                  lineHeight: 1,
                }}
              >
                {STEPS[currentStep]}
              </span>

              {/* Pulsing ring effect */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute inset-0 rounded-full"
                style={{
                  border: `4px solid ${
                    currentStep === STEPS.length - 1
                      ? "var(--col-orange)"
                      : "var(--col-purple)"
                  }`,
                  width: "200px",
                  height: "200px",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
