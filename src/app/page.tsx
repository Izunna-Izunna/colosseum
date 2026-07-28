"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

function FloatingParticles() {
  const [particles, setParticles] = useState<
    { id: number; x: number; delay: number; duration: number; size: number }[]
  >([]);

  useEffect(() => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 8,
      size: 2 + Math.random() * 4,
    }));
    setParticles(items);
  }, []);

  return (
    <div className="particles">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            background:
              p.id % 3 === 0
                ? "var(--col-orange)"
                : p.id % 3 === 1
                ? "var(--col-purple-light)"
                : "var(--col-cyan)",
          }}
        />
      ))}
    </div>
  );
}

const steps = [
  {
    icon: "🎯",
    title: "Calibrate",
    description: "Quick camera setup. We learn your range of motion in seconds.",
  },
  {
    icon: "⚔️",
    title: "Duel",
    description:
      "Go head-to-head in real-time. Every rep is a hit on your opponent.",
  },
  {
    icon: "🏆",
    title: "Win",
    description:
      "Drain their health bar to zero. Share your victory with the world.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background layers */}
      <div
        className="fixed inset-0"
        style={{ background: "var(--grad-hero)" }}
      />
      <div className="fixed inset-0 bg-grid" />
      <FloatingParticles />

      {/* Radial glow behind hero */}
      <div
        className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: "800px",
          height: "800px",
          background:
            "radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-3xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
              style={{
                background: "rgba(124, 58, 237, 0.15)",
                border: "1px solid rgba(124, 58, 237, 0.3)",
              }}
            >
              <span className="text-sm">⚡</span>
              <span
                className="text-sm font-medium"
                style={{ color: "var(--col-purple-light)" }}
              >
                Real-time webcam pull-up battles
              </span>
            </motion.div>

            {/* Title */}
            <h1
              className="text-gradient leading-none mb-6"
              style={{
                fontSize: "clamp(4rem, 12vw, 9rem)",
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
              }}
            >
              COLOSSEUM
            </h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-xl md:text-2xl mb-12 max-w-xl mx-auto"
              style={{
                color: "var(--col-text-muted)",
                fontFamily: "var(--font-body, Inter, sans-serif)",
                lineHeight: 1.5,
              }}
            >
              Enter the Arena.{" "}
              <span style={{ color: "var(--col-orange)" }}>
                Every rep is a hit.
              </span>
              <br />
              Challenge your friends. Pull up or get pulled down.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center gap-4 justify-center"
            >
              <Link href="/colosseum" className="btn-primary text-xl px-10 py-5">
                Enter the Colosseum ⚔️
              </Link>
            </motion.div>

            {/* Scroll hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.6 }}
              className="mt-20 animate-bounce"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="mx-auto"
                style={{ color: "var(--col-text-muted)" }}
              >
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </motion.div>
          </motion.div>
        </section>

        {/* How It Works */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2
                className="text-4xl md:text-5xl font-bold mb-4"
                style={{
                  color: "var(--col-text)",
                  fontFamily: "var(--font-heading, Outfit, sans-serif)",
                }}
              >
                How It Works
              </h2>
              <p
                className="text-lg"
                style={{ color: "var(--col-text-muted)" }}
              >
                Three steps. Zero excuses. Pure competition.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="card text-center group"
                >
                  <div
                    className="text-5xl mb-6 transition-transform duration-300 group-hover:scale-125"
                  >
                    {step.icon}
                  </div>
                  <h3
                    className="text-2xl font-bold mb-3"
                    style={{
                      color: "var(--col-text)",
                      fontFamily: "var(--font-heading, Outfit, sans-serif)",
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--col-text-muted)" }}
                  >
                    {step.description}
                  </p>

                  {/* Step number */}
                  <div
                    className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      background: "rgba(124, 58, 237, 0.15)",
                      color: "var(--col-purple-light)",
                      fontFamily: "var(--font-heading, Outfit, sans-serif)",
                    }}
                  >
                    {index + 1}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bottom CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center mt-16"
            >
              <Link href="/colosseum" className="btn-secondary text-lg">
                Ready to fight? Let&apos;s go →
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-6 text-center border-t" style={{ borderColor: "var(--col-border)" }}>
          <p
            className="text-sm"
            style={{ color: "var(--col-text-muted)" }}
          >
            Built with sweat and code. COLOSSEUM © {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
