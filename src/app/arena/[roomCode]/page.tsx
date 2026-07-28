"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, getGuestId, getGuestName } from "@/lib/supabase";
import { getRoomByCode, updateRoomStatus, type Room } from "@/lib/room";
import { initPoseDetector, detectPose } from "@/lib/pose-detection";
import { RepTracker } from "@/lib/rep-tracker";
import {
  createInitialGameState,
  registerRep,
  checkWinCondition,
  calculateDamage,
  type GameState,
} from "@/lib/game-engine";
import WebcamView from "@/components/webcam-view";
import CalibrationOverlay from "@/components/calibration-overlay";
import Countdown from "@/components/countdown";
import ArenaHud from "@/components/arena-hud";

type ArenaPhase =
  | "loading"
  | "waiting"
  | "calibrating"
  | "countdown"
  | "fighting"
  | "finished";

export default function ArenaPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase();

  const [phase, setPhase] = useState<ArenaPhase>("loading");
  const [room, setRoom] = useState<Room | null>(null);
  const [mySlot, setMySlot] = useState<"A" | "B" | null>(null);
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [isReady, setIsReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calibration state
  const [calibrationStep, setCalibrationStep] = useState<
    "idle" | "extension" | "top" | "done"
  >("idle");
  const [extensionProgress, setExtensionProgress] = useState(0);
  const [topProgress, setTopProgress] = useState(0);

  // Damage animation state
  const [lastDamageA, setLastDamageA] = useState<number | null>(null);
  const [lastDamageB, setLastDamageB] = useState<number | null>(null);

  // Refs
  const playerId = useRef(getGuestId());
  const playerName = useRef(getGuestName());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const repTrackerRef = useRef<RepTracker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const gameStateRef = useRef<GameState>(createInitialGameState());
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep gameStateRef in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Initialize room and realtime channel
  useEffect(() => {
    if (!roomCode) return;

    let mounted = true;

    async function init() {
      const fetchedRoom = await getRoomByCode(roomCode);
      if (!fetchedRoom) {
        setError("Room not found. Check your code and try again.");
        return;
      }

      if (!mounted) return;
      setRoom(fetchedRoom);

      // Determine which slot I am
      const pid = playerId.current;
      if (fetchedRoom.player_a_id === pid) {
        setMySlot("A");
      } else if (fetchedRoom.player_b_id === pid) {
        setMySlot("B");
      } else {
        // Not a player in this room — redirect to dashboard
        setError("You're not part of this duel.");
        return;
      }

      // Set up the realtime channel
      const channel = supabase.channel(`arena:${roomCode}`, {
        config: {
          broadcast: { self: false },
          presence: { key: pid },
        },
      });

      // Presence: track connected players + ready state
      channel.on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const keys = Object.keys(presenceState);

        // Check if opponent is connected
        const opponentPresent = keys.some((k) => k !== pid);
        setOpponentConnected(opponentPresent);

        // Check opponent ready state
        for (const key of keys) {
          if (key !== pid) {
            const entries = presenceState[key] as Array<{ ready?: boolean }>;
            if (entries && entries.length > 0) {
              setOpponentReady(entries[0].ready === true);
            }
          }
        }

        // Clear disconnect timer if opponent reconnects
        if (opponentPresent && disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
      });

      channel.on("presence", { event: "leave" }, ({ key }) => {
        if (key !== pid && gameStateRef.current.status === "active") {
          // Opponent disconnected during active duel — 15s grace period
          disconnectTimerRef.current = setTimeout(() => {
            // Auto-forfeit: opponent loses
            channel.send({
              type: "broadcast",
              event: "duel_end",
              payload: {
                winnerId: pid,
                reason: "disconnect",
              },
            });
          }, 15000);
        }
      });

      // Broadcast events
      channel.on("broadcast", { event: "countdown_start" }, () => {
        setPhase("countdown");
      });

      channel.on("broadcast", { event: "rep_completed" }, ({ payload }) => {
        if (!payload || payload.playerId === pid) return;

        // Opponent completed a rep — update game state
        const opponentSlot = mySlot === "A" ? "B" : "A";
        setGameState((prev) => {
          const newState = registerRep(prev, opponentSlot, payload.repNumber);

          // Trigger damage animation on my health bar
          const damage = calculateDamage(payload.repNumber);
          if (mySlot === "A") {
            setLastDamageA(damage);
            setTimeout(() => setLastDamageA(null), 600);
          } else {
            setLastDamageB(damage);
            setTimeout(() => setLastDamageB(null), 600);
          }

          // Check win condition
          const winner = checkWinCondition(newState);
          if (winner) {
            const winnerId =
              winner === "A"
                ? fetchedRoom.player_a_id
                : fetchedRoom.player_b_id;
            channel.send({
              type: "broadcast",
              event: "duel_end",
              payload: { winnerId },
            });
          }

          return newState;
        });
      });

      channel.on("broadcast", { event: "duel_end" }, ({ payload }) => {
        setPhase("finished");

        // Store results for the result page
        const finalState = gameStateRef.current;
        const isWinner = payload.winnerId === pid;
        const resultData = {
          winnerId: payload.winnerId,
          winnerName: isWinner
            ? playerName.current
            : fetchedRoom.player_a_id === payload.winnerId
            ? fetchedRoom.player_a_name
            : fetchedRoom.player_b_name,
          loserName: !isWinner
            ? playerName.current
            : fetchedRoom.player_a_id !== payload.winnerId
            ? fetchedRoom.player_a_name
            : fetchedRoom.player_b_name,
          winnerReps:
            payload.winnerId === fetchedRoom.player_a_id
              ? finalState.playerAReps
              : finalState.playerBReps,
          loserReps:
            payload.winnerId === fetchedRoom.player_a_id
              ? finalState.playerBReps
              : finalState.playerAReps,
          winnerHealthRemaining:
            payload.winnerId === fetchedRoom.player_a_id
              ? finalState.playerAHealth
              : finalState.playerBHealth,
          durationSeconds: finalState.startTime
            ? Math.floor((Date.now() - finalState.startTime) / 1000)
            : 0,
          reason: payload.reason,
        };

        sessionStorage.setItem(
          `duel_result_${roomCode}`,
          JSON.stringify(resultData)
        );

        // Stop pose detection loop
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }

        // Navigate to result page after a brief delay
        setTimeout(() => {
          router.push(`/arena/${roomCode}/result`);
        }, 1500);
      });

      channelRef.current = channel;

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            ready: false,
            name: playerName.current,
          });

          // Determine initial phase
          if (fetchedRoom.player_b_id) {
            setPhase("calibrating");
          } else {
            setPhase("waiting");
          }
        }
      });
    }

    init();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Watch for opponent joining (waiting phase)
  useEffect(() => {
    if (phase !== "waiting" || !opponentConnected) return;
    setPhase("calibrating");
    if (room?.id) {
      updateRoomStatus(room.id, "calibrating");
    }
  }, [phase, opponentConnected, room?.id]);

  // Watch for both players ready → start countdown
  useEffect(() => {
    if (phase !== "calibrating" || !isReady || !opponentReady) return;

    // Player A triggers the countdown broadcast
    if (mySlot === "A" && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "countdown_start",
        payload: {},
      });
      setPhase("countdown");
    }
  }, [phase, isReady, opponentReady, mySlot]);

  // Initialize rep tracker
  useEffect(() => {
    repTrackerRef.current = new RepTracker({
      onRepCompleted: (repNumber, confidence) => {
        // Send rep to channel
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "rep_completed",
            payload: {
              playerId: playerId.current,
              repNumber,
              confidence,
              timestamp: Date.now(),
            },
          });
        }

        // Update local game state optimistically
        setGameState((prev) => {
          const slot = mySlot || "A";
          const newState = registerRep(prev, slot, repNumber);

          // Trigger damage animation on opponent's health bar
          const damage = calculateDamage(repNumber);
          if (slot === "A") {
            setLastDamageB(damage);
            setTimeout(() => setLastDamageB(null), 600);
          } else {
            setLastDamageA(damage);
            setTimeout(() => setLastDamageA(null), 600);
          }

          // Check win condition
          const winner = checkWinCondition(newState);
          if (winner && channelRef.current) {
            const winnerId =
              winner === "A" ? room?.player_a_id : room?.player_b_id;
            channelRef.current.send({
              type: "broadcast",
              event: "duel_end",
              payload: { winnerId },
            });
          }

          return newState;
        });
      },
      onStateChange: () => {
        // Could use this for UI feedback on rep state
      },
    });
  }, [mySlot, room]);

  // Pose detection loop
  const startPoseLoop = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      await initPoseDetector();
    } catch {
      setError("Failed to load pose detection. Please use Chrome for best results.");
      return;
    }

    const loop = async () => {
      if (!videoRef.current || phase === "finished") return;

      const keypoints = await detectPose(videoRef.current);

      if (keypoints && repTrackerRef.current) {
        if (repTrackerRef.current.isCalibrated && phase === "fighting") {
          repTrackerRef.current.processFrame(keypoints);
        } else if (!repTrackerRef.current.isCalibrated) {
          const done = repTrackerRef.current.feedCalibrationFrame(keypoints);
          if (repTrackerRef.current.calibrationProgress === "extension") {
            setExtensionProgress(
              Math.min(100, (repTrackerRef.current as unknown as { extensionSamples: unknown[] }).extensionSamples?.length ?? 0) / 15 * 100
            );
            if (done) setExtensionProgress(100);
          }
          if (repTrackerRef.current.calibrationProgress === "top") {
            setTopProgress(
              Math.min(100, (repTrackerRef.current as unknown as { topSamples: unknown[] }).topSamples?.length ?? 0) / 30 * 100
            );
            if (done) setTopProgress(100);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    loop();
  }, [phase]);

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      videoRef.current = video;
      startPoseLoop();
    },
    [startPoseLoop]
  );

  const handleToggleReady = () => {
    const newReady = !isReady;
    setIsReady(newReady);
    if (channelRef.current) {
      channelRef.current.track({
        ready: newReady,
        name: playerName.current,
      });
    }
  };

  const handleCountdownComplete = useCallback(() => {
    setPhase("fighting");
    setGameState((prev) => ({
      ...prev,
      status: "active",
      startTime: Date.now(),
    }));
    if (room?.id) {
      updateRoomStatus(room.id, "active");
    }
  }, [room?.id]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const myName = playerName.current || "You";
  const opponentName =
    mySlot === "A"
      ? room?.player_b_name || "Opponent"
      : room?.player_a_name || "Opponent";

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--grad-hero)" }}
      >
        <div className="glass-panel p-8 text-center max-w-md">
          <div className="text-5xl mb-4">😵</div>
          <h2
            className="text-xl font-bold mb-3"
            style={{
              color: "var(--col-text)",
              fontFamily: "var(--font-heading, Outfit, sans-serif)",
            }}
          >
            Oops
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--col-text-muted)" }}>
            {error}
          </p>
          <button
            onClick={() => router.push("/colosseum")}
            className="btn-primary"
          >
            Back to Colosseum
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ background: "var(--col-bg-deep)" }}
    >
      {/* Countdown overlay */}
      <Countdown
        isActive={phase === "countdown"}
        onComplete={handleCountdownComplete}
      />

      {/* HUD — shown during fighting */}
      {phase === "fighting" && (
        <div className="sticky top-0 z-40 p-3">
          <ArenaHud
            playerAName={mySlot === "A" ? myName : opponentName}
            playerBName={mySlot === "A" ? opponentName : myName}
            playerAHealth={gameState.playerAHealth}
            playerBHealth={gameState.playerBHealth}
            playerAReps={gameState.playerAReps}
            playerBReps={gameState.playerBReps}
            startTime={gameState.startTime}
            lastDamageA={lastDamageA}
            lastDamageB={lastDamageB}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        {/* Loading */}
        {phase === "loading" && (
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--col-purple)", borderTopColor: "transparent" }}
            />
            <span style={{ color: "var(--col-text-muted)" }}>
              Entering the Arena...
            </span>
          </div>
        )}

        {/* Waiting for opponent */}
        {phase === "waiting" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="text-5xl mb-6">🏛️</div>
            <h2
              className="text-2xl font-bold mb-3"
              style={{
                color: "var(--col-text)",
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
              }}
            >
              Waiting for Your Opponent
            </h2>
            <p
              className="text-sm mb-6"
              style={{ color: "var(--col-text-muted)" }}
            >
              Share this code with your challenger to begin the duel.
            </p>

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
                {roomCode}
              </span>
              <span
                className="text-xs sm:text-sm opacity-60 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--col-text-muted)" }}
              >
                {copied ? "✓ Copied!" : "📋"}
              </span>
            </div>

            <div className="flex items-center gap-2 justify-center">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-sm" style={{ color: "var(--col-text-muted)" }}>
                Listening for challengers...
              </span>
            </div>
          </motion.div>
        )}

        {/* Calibration + Fighting — show webcam */}
        {(phase === "calibrating" || phase === "fighting" || phase === "countdown") && (
          <div className="w-full max-w-4xl">
            {/* Webcam feeds */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* My camera */}
              <div className="relative">
                <WebcamView
                  onVideoReady={handleVideoReady}
                  mirror={true}
                  label={myName}
                  className="w-full"
                />
                {phase === "calibrating" && (
                  <div
                    className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold"
                    style={{
                      background: calibrationStep === "done"
                        ? "rgba(34, 197, 94, 0.2)"
                        : "rgba(124, 58, 237, 0.2)",
                      color: calibrationStep === "done"
                        ? "#4ade80"
                        : "var(--col-purple-light)",
                      border: `1px solid ${
                        calibrationStep === "done"
                          ? "rgba(34, 197, 94, 0.3)"
                          : "rgba(124, 58, 237, 0.3)"
                      }`,
                    }}
                  >
                    {calibrationStep === "done" ? "✓ Calibrated" : "Calibrating..."}
                  </div>
                )}
              </div>

              {/* Opponent's view — placeholder when not fighting */}
              <div
                className="relative rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "2px solid var(--col-border)",
                  aspectRatio: "4/3",
                }}
              >
                <div className="text-center">
                  <div
                    className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold"
                    style={{
                      background: "linear-gradient(135deg, #ff6b35, #ff3d00)",
                      fontFamily: "var(--font-heading, Outfit, sans-serif)",
                    }}
                  >
                    {opponentName.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className="font-bold text-lg"
                    style={{
                      color: "var(--col-text)",
                      fontFamily: "var(--font-heading, Outfit, sans-serif)",
                    }}
                  >
                    {opponentName}
                  </div>
                  <div
                    className="text-xs mt-1"
                    style={{ color: "var(--col-text-muted)" }}
                  >
                    {opponentConnected ? "Connected" : "Connecting..."}
                  </div>
                </div>

                {/* Corner decorations */}
                <div
                  className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl-lg"
                  style={{ borderColor: "var(--col-orange)" }}
                />
                <div
                  className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-lg"
                  style={{ borderColor: "var(--col-orange)" }}
                />
                <div
                  className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 rounded-bl-lg"
                  style={{ borderColor: "var(--col-orange)" }}
                />
                <div
                  className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br-lg"
                  style={{ borderColor: "var(--col-orange)" }}
                />
              </div>
            </div>

            {/* Calibration overlay */}
            {phase === "calibrating" && (
              <CalibrationOverlay
                step={calibrationStep}
                isReady={isReady}
                opponentReady={opponentReady}
                onStartExtensionCalibration={() => {
                  setCalibrationStep("extension");
                  repTrackerRef.current?.startCalibrationExtension();
                }}
                onStartTopCalibration={() => {
                  setCalibrationStep("top");
                  repTrackerRef.current?.startCalibrationTop();
                }}
                onFinalizeCalibration={() => {
                  const success = repTrackerRef.current?.finalizeCalibration();
                  if (success) {
                    setCalibrationStep("done");
                  }
                }}
                onToggleReady={handleToggleReady}
                extensionProgress={extensionProgress}
                topProgress={topProgress}
              />
            )}

            {/* Fighting state indicator */}
            <AnimatePresence>
              {phase === "fighting" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center mt-4"
                >
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                    style={{
                      background: "rgba(255, 0, 51, 0.15)",
                      border: "1px solid rgba(255, 0, 51, 0.3)",
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span
                      className="text-sm font-bold"
                      style={{
                        color: "#ff6b6b",
                        fontFamily: "var(--font-heading, Outfit, sans-serif)",
                      }}
                    >
                      LIVE — DUEL IN PROGRESS
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Finished — transitioning to result */}
        {phase === "finished" && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="text-center"
          >
            <div
              className="text-8xl font-black mb-4"
              style={{
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
                color: "var(--col-orange)",
                textShadow:
                  "0 0 60px rgba(255, 107, 53, 0.5), 0 0 120px rgba(255, 107, 53, 0.2)",
              }}
            >
              K.O.
            </div>
            <p style={{ color: "var(--col-text-muted)" }}>
              Loading results...
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
