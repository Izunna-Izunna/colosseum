"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, getGuestId, getGuestName, setGuestName } from "@/lib/supabase";
import { getRoomByCode, joinRoom, updateRoomStatus, type Room } from "@/lib/room";
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
  | "requesting"
  | "calibrating"
  | "countdown"
  | "fighting"
  | "finished";

interface PendingChallenger {
  id: string;
  name: string;
}

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

  // Accept/Decline Challenge state
  const [pendingChallenger, setPendingChallenger] = useState<PendingChallenger | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);

  // Guest name state (in case player joins via shared link without entering name on dashboard first)
  const [guestNameInput, setGuestNameInput] = useState(() => getGuestName());
  const [showNameModal, setShowNameModal] = useState(false);

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

  // Prompt for guest name if visiting via direct shared link without prior name set
  const handleSaveName = () => {
    if (guestNameInput.trim().length < 2) return;
    setGuestName(guestNameInput.trim());
    playerName.current = guestNameInput.trim();
    setShowNameModal(false);
  };

  // Initialize room and realtime channel
  useEffect(() => {
    if (!roomCode) return;

    let mounted = true;

    async function init() {
      // Check if user has a display name set
      if (!getGuestName()) {
        setShowNameModal(true);
      }

      const fetchedRoom = await getRoomByCode(roomCode);
      if (!fetchedRoom) {
        setError("Room not found. Check your code and try again.");
        return;
      }

      if (!mounted) return;
      setRoom(fetchedRoom);

      const pid = playerId.current;
      const name = playerName.current || "Gladiator";

      let initialSlot: "A" | "B" | null = null;

      if (fetchedRoom.player_a_id === pid) {
        initialSlot = "A";
        setMySlot("A");
      } else if (fetchedRoom.player_b_id === pid) {
        initialSlot = "B";
        setMySlot("B");
      } else if (!fetchedRoom.player_b_id) {
        // Direct shared link visitor! Mark as challenger requesting to join
        setMySlot("B");
        initialSlot = "B";
      } else {
        setError("This Arena is already full!");
        return;
      }

      // Set up Supabase Realtime Channel
      const channel = supabase.channel(`arena:${roomCode}`, {
        config: {
          broadcast: { self: false },
          presence: { key: pid },
        },
      });

      // Presence tracking
      channel.on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const keys = Object.keys(presenceState);

        const opponentPresent = keys.some((k) => k !== pid);
        setOpponentConnected(opponentPresent);

        for (const key of keys) {
          if (key !== pid) {
            const entries = presenceState[key] as Array<{ ready?: boolean; role?: string }>;
            if (entries && entries.length > 0) {
              setOpponentReady(entries[0].ready === true);
            }
          }
        }

        if (opponentPresent && disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
      });

      channel.on("presence", { event: "leave" }, ({ key }) => {
        if (key !== pid && gameStateRef.current.status === "active") {
          disconnectTimerRef.current = setTimeout(() => {
            channel.send({
              type: "broadcast",
              event: "duel_end",
              payload: { winnerId: pid, reason: "disconnect" },
            });
          }, 15000);
        }
      });

      // Challenge Request Events
      channel.on("broadcast", { event: "challenge_request" }, ({ payload }) => {
        // Host (Player A) receives challenge request from Player B
        if (initialSlot === "A" && payload.challengerId !== pid) {
          setPendingChallenger({
            id: payload.challengerId,
            name: payload.challengerName || "Challenger",
          });
        }
      });

      channel.on("broadcast", { event: "challenge_accepted" }, ({ payload }) => {
        // Challenger (Player B) receives acceptance
        if (payload.challengerId === pid || initialSlot === "A") {
          setPendingChallenger(null);
          setPhase("calibrating");
          // Refresh room state
          getRoomByCode(roomCode).then((r) => r && setRoom(r));
        }
      });

      channel.on("broadcast", { event: "challenge_declined" }, ({ payload }) => {
        if (payload.challengerId === pid) {
          setIsDeclined(true);
        }
      });

      // Match Broadcast Events
      channel.on("broadcast", { event: "countdown_start" }, () => {
        setPhase("countdown");
      });

      channel.on("broadcast", { event: "rep_completed" }, ({ payload }) => {
        if (!payload || payload.playerId === pid) return;

        const opponentSlot = initialSlot === "A" ? "B" : "A";
        setGameState((prev) => {
          const newState = registerRep(prev, opponentSlot, payload.repNumber);
          const damage = calculateDamage(payload.repNumber);

          if (initialSlot === "A") {
            setLastDamageA(damage);
            setTimeout(() => setLastDamageA(null), 600);
          } else {
            setLastDamageB(damage);
            setTimeout(() => setLastDamageB(null), 600);
          }

          const winner = checkWinCondition(newState);
          if (winner) {
            const winnerId =
              winner === "A" ? fetchedRoom.player_a_id : fetchedRoom.player_b_id;
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

        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }

        setTimeout(() => {
          router.push(`/arena/${roomCode}/result`);
        }, 1500);
      });

      channelRef.current = channel;

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            ready: false,
            name,
            role: initialSlot,
          });

          // Determine initial phase
          if (fetchedRoom.player_b_id) {
            setPhase("calibrating");
          } else if (initialSlot === "A") {
            setPhase("waiting");
          } else {
            // Player B visiting direct link — send challenge request to Host
            setPhase("requesting");
            channel.send({
              type: "broadcast",
              event: "challenge_request",
              payload: {
                challengerId: pid,
                challengerName: name,
              },
            });
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

  // Host Accept Challenge
  const handleAcceptChallenge = async () => {
    if (!pendingChallenger || !room) return;
    setIsAccepting(true);

    try {
      const updated = await joinRoom(
        roomCode,
        pendingChallenger.id,
        pendingChallenger.name
      );

      if (updated || room) {
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "challenge_accepted",
            payload: { challengerId: pendingChallenger.id },
          });
        }
        setPendingChallenger(null);
        setPhase("calibrating");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAccepting(false);
    }
  };

  // Host Decline Challenge
  const handleDeclineChallenge = () => {
    if (!pendingChallenger) return;
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "challenge_declined",
        payload: { challengerId: pendingChallenger.id },
      });
    }
    setPendingChallenger(null);
  };

  // Watch for both players ready → start countdown
  useEffect(() => {
    if (phase !== "calibrating" || !isReady || !opponentReady) return;

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

        setGameState((prev) => {
          const slot = mySlot || "A";
          const newState = registerRep(prev, slot, repNumber);
          const damage = calculateDamage(repNumber);

          if (slot === "A") {
            setLastDamageB(damage);
            setTimeout(() => setLastDamageB(null), 600);
          } else {
            setLastDamageA(damage);
            setTimeout(() => setLastDamageA(null), 600);
          }

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
      onStateChange: () => {},
    });
  }, [mySlot, room]);

  // Pose detection loop
  const startPoseLoop = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      await initPoseDetector();
    } catch {
      setError("Failed to load pose detection. Please use Chrome/Safari.");
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
              Math.min(
                100,
                ((repTrackerRef.current as unknown as { extensionSamples: unknown[] })
                  .extensionSamples?.length ?? 0) / 15 * 100
              )
            );
            if (done) setExtensionProgress(100);
          }
          if (repTrackerRef.current.calibrationProgress === "top") {
            setTopProgress(
              Math.min(
                100,
                ((repTrackerRef.current as unknown as { topSamples: unknown[] })
                  .topSamples?.length ?? 0) / 30 * 100
              )
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
        role: mySlot,
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
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const myName = playerName.current || "You";
  const opponentName =
    mySlot === "A"
      ? room?.player_b_name || pendingChallenger?.name || "Opponent"
      : room?.player_a_name || "Host";

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
      {/* Name prompt modal if visiting via direct link without prior name set */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel p-6 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">⚔️</div>
            <h3
              className="text-xl font-bold mb-2"
              style={{
                color: "var(--col-text)",
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
              }}
            >
              Enter the Arena
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--col-text-muted)" }}>
              Choose a display name before stepping into the duel.
            </p>
            <input
              type="text"
              value={guestNameInput}
              onChange={(e) => setGuestNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              placeholder="Your Name"
              className="input-field mb-4"
              maxLength={16}
              autoFocus
            />
            <button onClick={handleSaveName} className="btn-primary w-full">
              Step Into Arena →
            </button>
          </div>
        </div>
      )}

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

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        {/* Loading Phase */}
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

        {/* Challenger Declined View */}
        {isDeclined && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel p-8 text-center max-w-md"
          >
            <div className="text-5xl mb-4">🛑</div>
            <h2
              className="text-2xl font-bold mb-2"
              style={{
                color: "var(--col-red)",
                fontFamily: "var(--font-heading, Outfit, sans-serif)",
              }}
            >
              Challenge Declined
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--col-text-muted)" }}>
              The host declined your challenge for this duel.
            </p>
            <button
              onClick={() => router.push("/colosseum")}
              className="btn-primary"
            >
              Back to Dashboard
            </button>
          </motion.div>
        )}

        {/* Active Camera View (Waiting, Requesting, Calibrating, Fighting) */}
        {!isDeclined && (phase === "waiting" || phase === "requesting" || phase === "calibrating" || phase === "fighting" || phase === "countdown") && (
          <div className="w-full max-w-4xl">
            {/* Dual Webcam Layout */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* My Camera Feed */}
              <div className="relative">
                <WebcamView
                  onVideoReady={handleVideoReady}
                  mirror={true}
                  label={`${myName} (You)`}
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

              {/* Opponent / Waiting Container */}
              <div
                className="relative rounded-2xl flex items-center justify-center p-6 text-center overflow-hidden"
                style={{
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "2px solid var(--col-border)",
                  aspectRatio: "4/3",
                }}
              >
                {/* Host Accept / Decline Banner */}
                {pendingChallenger ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-4 z-10"
                  >
                    <div className="text-4xl animate-bounce">⚔️</div>
                    <div
                      className="text-xl font-bold"
                      style={{
                        color: "var(--col-text)",
                        fontFamily: "var(--font-heading, Outfit, sans-serif)",
                      }}
                    >
                      {pendingChallenger.name} wants to duel you!
                    </div>
                    <p className="text-xs" style={{ color: "var(--col-text-muted)" }}>
                      Accept the challenge to start camera calibration.
                    </p>

                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={handleAcceptChallenge}
                        disabled={isAccepting}
                        className="btn-primary px-6 py-2.5 text-sm"
                      >
                        {isAccepting ? "Accepting..." : "✓ Accept Challenge"}
                      </button>
                      <button
                        onClick={handleDeclineChallenge}
                        className="btn-secondary px-4 py-2.5 text-sm"
                      >
                        ✕ Decline
                      </button>
                    </div>
                  </motion.div>
                ) : phase === "requesting" ? (
                  /* Challenger Requesting State */
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: "var(--col-cyan)", borderTopColor: "transparent" }}
                    />
                    <div
                      className="font-bold text-lg"
                      style={{
                        color: "var(--col-text)",
                        fontFamily: "var(--font-heading, Outfit, sans-serif)",
                      }}
                    >
                      Challenging Host...
                    </div>
                    <p className="text-xs max-w-xs" style={{ color: "var(--col-text-muted)" }}>
                      Waiting for the host to accept your duel request.
                    </p>
                  </div>
                ) : (
                  /* Standard Opponent Connected or Waiting */
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
                      {opponentConnected ? "Connected" : "Waiting for challenger..."}
                    </div>
                  </div>
                )}

                {/* Decorative corners */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: "var(--col-orange)" }} />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: "var(--col-orange)" }} />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 rounded-bl-lg" style={{ borderColor: "var(--col-orange)" }} />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br-lg" style={{ borderColor: "var(--col-orange)" }} />
              </div>
            </div>

            {/* Waiting for Challenger Bar — Host can see room code + copy link */}
            {phase === "waiting" && !pendingChallenger && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-4 text-center mb-6"
              >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <div
                      className="text-sm font-bold"
                      style={{
                        color: "var(--col-text)",
                        fontFamily: "var(--font-heading, Outfit, sans-serif)",
                      }}
                    >
                      📷 Camera active! Adjust your setup while waiting.
                    </div>
                    <div className="text-xs" style={{ color: "var(--col-text-muted)" }}>
                      Share this arena link with your challenger to duel.
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className="px-4 py-2 rounded-xl font-black tracking-widest text-lg"
                      style={{
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid var(--col-purple)",
                        color: "var(--col-cyan)",
                        fontFamily: "var(--font-heading, Outfit, sans-serif)",
                      }}
                    >
                      {roomCode}
                    </div>
                    <button onClick={handleCopy} className="btn-primary text-xs py-2 px-4">
                      {copied ? "✓ Copied Link!" : "🔗 Share Link"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Calibration Overlay */}
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

            {/* Live Indicator */}
            {phase === "fighting" && (
              <div className="text-center mt-4">
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
              </div>
            )}
          </div>
        )}

        {/* Finished Phase */}
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
