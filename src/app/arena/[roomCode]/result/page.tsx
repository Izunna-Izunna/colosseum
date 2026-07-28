"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import ShareCard from "@/components/share-card";
import { shareResult, type DuelResult } from "@/lib/share";
import { getGuestId } from "@/lib/supabase";
import { createRoom } from "@/lib/room";
import { getGuestName } from "@/lib/supabase";

interface StoredResult {
  winnerId: string;
  winnerName: string;
  loserName: string;
  winnerReps: number;
  loserReps: number;
  winnerHealthRemaining: number;
  durationSeconds: number;
  reason?: string;
}

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase();

  const [result, setResult] = useState<StoredResult | null>(null);
  const [isWinner, setIsWinner] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isRematch, setIsRematch] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(`duel_result_${roomCode}`);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredResult;
      setResult(parsed);
      setIsWinner(parsed.winnerId === getGuestId());
    }
  }, [roomCode]);

  const handleShare = async () => {
    if (!result) return;
    setIsSharing(true);

    const duelResult: DuelResult = {
      winnerName: result.winnerName,
      loserName: result.loserName,
      winnerReps: result.winnerReps,
      loserReps: result.loserReps,
      winnerHealthRemaining: result.winnerHealthRemaining,
      durationSeconds: result.durationSeconds,
    };

    await shareResult(duelResult);
    setIsSharing(false);
  };

  const handleRematch = async () => {
    setIsRematch(true);
    try {
      const playerId = getGuestId();
      const playerName = getGuestName();
      const newRoom = await createRoom(playerId, playerName);
      if (newRoom) {
        router.push(`/arena/${newRoom.roomCode}`);
      }
    } catch {
      setIsRematch(false);
    }
  };

  if (!result) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--grad-hero)" }}
      >
        <div className="text-center">
          <div className="text-5xl mb-4">🤔</div>
          <h2
            className="text-xl font-bold mb-3"
            style={{
              color: "var(--col-text)",
              fontFamily: "var(--font-heading, Outfit, sans-serif)",
            }}
          >
            No results found
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--col-text-muted)" }}>
            Looks like this duel&apos;s results have expired.
          </p>
          <Link href="/colosseum" className="btn-primary">
            Back to Colosseum
          </Link>
        </div>
      </div>
    );
  }

  const duelResultForCard: DuelResult = {
    winnerName: result.winnerName,
    loserName: result.loserName,
    winnerReps: result.winnerReps,
    loserReps: result.loserReps,
    winnerHealthRemaining: result.winnerHealthRemaining,
    durationSeconds: result.durationSeconds,
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
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-full max-w-2xl text-center"
        >
          {/* Winner/Loser announcement */}
          {isWinner ? (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="text-7xl mb-4"
              >
                👑
              </motion.div>
              <h1
                className="text-4xl md:text-5xl font-black mb-3"
                style={{
                  fontFamily: "var(--font-heading, Outfit, sans-serif)",
                  color: "var(--col-gold)",
                  textShadow: "0 0 40px rgba(255, 215, 0, 0.4)",
                }}
              >
                You conquered the Arena!
              </h1>
              <p
                className="text-lg mb-8"
                style={{ color: "var(--col-text-muted)" }}
              >
                {result.loserName} has been defeated. Total domination.
              </p>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="text-7xl mb-4"
              >
                💀
              </motion.div>
              <h1
                className="text-4xl md:text-5xl font-black mb-3"
                style={{
                  fontFamily: "var(--font-heading, Outfit, sans-serif)",
                  color: "var(--col-red)",
                  textShadow: "0 0 40px rgba(255, 0, 51, 0.4)",
                }}
              >
                Defeated!
              </h1>
              <p
                className="text-lg mb-8"
                style={{ color: "var(--col-text-muted)" }}
              >
                {result.winnerName} proved stronger. Demand a rematch.
              </p>
            </>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
            <div className="glass-panel-sm p-2.5 sm:p-4">
              <div
                className="text-xl sm:text-3xl font-black"
                style={{
                  color: "var(--col-cyan)",
                  fontFamily: "var(--font-heading, Outfit, sans-serif)",
                }}
              >
                {isWinner ? result.winnerReps : result.loserReps}
              </div>
              <div className="text-[10px] sm:text-xs mt-1" style={{ color: "var(--col-text-muted)" }}>
                Your Reps
              </div>
            </div>
            <div className="glass-panel-sm p-2.5 sm:p-4">
              <div
                className="text-xl sm:text-3xl font-black"
                style={{
                  color: "var(--col-orange)",
                  fontFamily: "var(--font-heading, Outfit, sans-serif)",
                }}
              >
                {isWinner ? result.loserReps : result.winnerReps}
              </div>
              <div className="text-[10px] sm:text-xs mt-1" style={{ color: "var(--col-text-muted)" }}>
                Their Reps
              </div>
            </div>
            <div className="glass-panel-sm p-2.5 sm:p-4">
              <div
                className="text-xl sm:text-3xl font-black"
                style={{
                  color: "var(--col-purple-light)",
                  fontFamily: "var(--font-heading, Outfit, sans-serif)",
                }}
              >
                {Math.floor(result.durationSeconds / 60)}:
                {(result.durationSeconds % 60).toString().padStart(2, "0")}
              </div>
              <div className="text-[10px] sm:text-xs mt-1" style={{ color: "var(--col-text-muted)" }}>
                Duration
              </div>
            </div>
          </div>

          {/* Disconnect notice */}
          {result.reason === "disconnect" && (
            <div
              className="mb-6 px-4 py-2 rounded-xl text-sm inline-flex items-center gap-2"
              style={{
                background: "rgba(234, 179, 8, 0.1)",
                border: "1px solid rgba(234, 179, 8, 0.3)",
                color: "#facc15",
              }}
            >
              ⚡ Won by opponent disconnect
            </div>
          )}

          {/* Share card preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex justify-center mb-8"
          >
            <ShareCard result={duelResultForCard} className="max-w-xs" />
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button
              onClick={handleRematch}
              disabled={isRematch}
              className="btn-primary"
            >
              {isRematch ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                "⚔️ Rematch"
              )}
            </button>
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="btn-secondary"
            >
              {isSharing ? "Generating..." : "📤 Share Result"}
            </button>
            <Link href="/colosseum" className="btn-secondary">
              🏛️ Back to Colosseum
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
