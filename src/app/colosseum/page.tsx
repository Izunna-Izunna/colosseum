"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { createRoom, joinRoom } from "@/lib/room";
import { getGuestId, getGuestName, setGuestName } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState(() => getGuestName());
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(() => !getGuestName());
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSetName = () => {
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters, gladiator.");
      return;
    }
    if (name.trim().length > 16) {
      setError("Keep it under 16 characters.");
      return;
    }
    setGuestName(name.trim());
    setShowNamePrompt(false);
    setError(null);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const playerId = getGuestId();
      const playerName = getGuestName();
      const result = await createRoom(playerId, playerName);

      if (result) {
        setCreatedCode(result.roomCode);
      } else {
        setError("Failed to create duel. Try again.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.trim().length !== 4) {
      setError("Room codes are 4 characters. Check and try again.");
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const playerId = getGuestId();
      const playerName = getGuestName();
      const room = await joinRoom(joinCode.trim().toUpperCase(), playerId, playerName);

      if (room) {
        router.push(`/arena/${room.room_code}`);
      } else {
        setError("Room not found or already full. Double-check the code.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopy = async () => {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnterArena = () => {
    if (createdCode) {
      router.push(`/arena/${createdCode}`);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ background: "var(--grad-hero)" }}
    >
      <div className="fixed inset-0 bg-grid pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-gradient text-2xl font-black"
          style={{ fontFamily: "var(--font-heading, Outfit, sans-serif)" }}
        >
          COLOSSEUM
        </Link>
        <div
          className="text-sm px-3 py-1.5 rounded-lg"
          style={{
            background: "rgba(124, 58, 237, 0.15)",
            color: "var(--col-purple-light)",
            fontFamily: "var(--font-heading, Outfit, sans-serif)",
          }}
        >
          {getGuestName() || "Gladiator"}
        </div>
      </nav>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-2xl"
        >
          {/* Name prompt */}
          {showNamePrompt && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel p-8 text-center mb-8"
            >
              <div className="text-4xl mb-4">⚔️</div>
              <h2
                className="text-2xl font-bold mb-2"
                style={{
                  color: "var(--col-text)",
                  fontFamily: "var(--font-heading, Outfit, sans-serif)",
                }}
              >
                What&apos;s your name, gladiator?
              </h2>
              <p
                className="text-sm mb-6"
                style={{ color: "var(--col-text-muted)" }}
              >
                Pick a name your opponents will fear.
              </p>
              <div className="flex gap-3 max-w-xs mx-auto">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSetName()}
                  placeholder="Enter your name"
                  className="input-field flex-1"
                  autoFocus
                  maxLength={16}
                />
                <button
                  onClick={handleSetName}
                  className="btn-primary px-6 py-3 text-base"
                >
                  Go
                </button>
              </div>
            </motion.div>
          )}

          {/* Created room — show code */}
          {createdCode && !showNamePrompt && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel p-8 text-center"
            >
              <div className="text-4xl mb-4">🏛️</div>
              <h2
                className="text-2xl font-bold mb-2"
                style={{
                  color: "var(--col-text)",
                  fontFamily: "var(--font-heading, Outfit, sans-serif)",
                }}
              >
                Your Arena is Ready
              </h2>
              <p
                className="text-sm mb-6"
                style={{ color: "var(--col-text-muted)" }}
              >
                Share this code with your opponent so they can join the duel.
              </p>

              {/* Room code display */}
              <div
                className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-8 py-3 sm:py-4 rounded-2xl mb-6 cursor-pointer group max-w-full"
                onClick={handleCopy}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "2px solid var(--col-purple)",
                }}
              >
                <span
                  className="text-3xl sm:text-5xl font-black tracking-[0.25em] sm:tracking-[0.3em]"
                  style={{
                    color: "var(--col-cyan)",
                    fontFamily: "var(--font-heading, Outfit, sans-serif)",
                    textShadow: "0 0 30px rgba(0, 245, 212, 0.4)",
                  }}
                >
                  {createdCode}
                </span>
                <span
                  className="text-xs sm:text-sm opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--col-text-muted)" }}
                >
                  {copied ? "✓ Copied!" : "📋 Copy"}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={handleEnterArena} className="btn-primary">
                  Enter the Arena →
                </button>
              </div>
            </motion.div>
          )}

          {/* Main options — Create or Join */}
          {!createdCode && !showNamePrompt && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Create Duel */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="card text-center cursor-pointer group"
                onClick={!isCreating ? handleCreate : undefined}
              >
                <div className="text-5xl mb-5 transition-transform duration-300 group-hover:scale-110">
                  ⚔️
                </div>
                <h3
                  className="text-2xl font-bold mb-3"
                  style={{
                    color: "var(--col-text)",
                    fontFamily: "var(--font-heading, Outfit, sans-serif)",
                  }}
                >
                  Start a Duel
                </h3>
                <p
                  className="text-sm mb-6"
                  style={{ color: "var(--col-text-muted)" }}
                >
                  Create an arena and get a room code to share with your
                  challenger.
                </p>
                <button
                  className="btn-primary w-full"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <span className="flex items-center gap-2 justify-center">
                      <span
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                      />
                      Creating...
                    </span>
                  ) : (
                    "Create Arena"
                  )}
                </button>
              </motion.div>

              {/* Join Duel */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="card text-center"
              >
                <div className="text-5xl mb-5">🎟️</div>
                <h3
                  className="text-2xl font-bold mb-3"
                  style={{
                    color: "var(--col-text)",
                    fontFamily: "var(--font-heading, Outfit, sans-serif)",
                  }}
                >
                  Join a Duel
                </h3>
                <p
                  className="text-sm mb-6"
                  style={{ color: "var(--col-text-muted)" }}
                >
                  Got a room code? Enter it below and step into the arena.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(e.target.value.toUpperCase().slice(0, 4))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    placeholder="CODE"
                    className="input-field flex-1"
                    maxLength={4}
                  />
                  <button
                    onClick={handleJoin}
                    className="btn-secondary px-6"
                    disabled={isJoining}
                  >
                    {isJoining ? "..." : "Join"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 rounded-xl text-center text-sm"
              style={{
                background: "rgba(255, 0, 51, 0.1)",
                border: "1px solid rgba(255, 0, 51, 0.3)",
                color: "#ff6b6b",
              }}
            >
              {error}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
