"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface WebcamViewProps {
  onVideoReady?: (video: HTMLVideoElement) => void;
  mirror?: boolean;
  className?: string;
  showOverlay?: boolean;
  overlayCanvas?: React.RefObject<HTMLCanvasElement | null>;
  label?: string;
}

export default function WebcamView({
  onVideoReady,
  mirror = true,
  className = "",
  showOverlay = false,
  overlayCanvas,
  label,
}: WebcamViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasCalledReady = useRef(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play();
          setIsLoading(false);

          if (onVideoReady && !hasCalledReady.current) {
            hasCalledReady.current = true;
            onVideoReady(videoRef.current!);
          }
        };
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError(
        "Camera access denied. Please allow camera access to enter the Arena."
      );
      setIsLoading(false);
    }
  }, [onVideoReady]);

  useEffect(() => {
    startCamera();

    return () => {
      // Cleanup: stop all tracks when component unmounts
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-black/40 ${className}`}
      style={{
        border: "2px solid var(--col-border)",
        aspectRatio: "4/3",
      }}
    >
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${mirror ? "webcam-mirror" : ""}`}
        style={{ display: error ? "none" : "block" }}
      />

      {/* Skeleton overlay canvas */}
      {showOverlay && overlayCanvas && (
        <canvas
          ref={overlayCanvas}
          className={`absolute inset-0 w-full h-full ${mirror ? "webcam-mirror" : ""}`}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Label */}
      {label && (
        <div
          className="absolute bottom-3 left-3 px-3 py-1 rounded-lg text-xs font-semibold"
          style={{
            background: "rgba(10, 6, 18, 0.7)",
            backdropFilter: "blur(8px)",
            color: "var(--col-text)",
            fontFamily: "var(--font-heading, Outfit, sans-serif)",
          }}
        >
          {label}
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--col-purple)", borderTopColor: "transparent" }}
            />
            <span
              className="text-sm"
              style={{ color: "var(--col-text-muted)" }}
            >
              Starting camera...
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-4xl mb-3">📷</div>
            <p
              className="text-sm"
              style={{ color: "var(--col-text-muted)" }}
            >
              {error}
            </p>
            <button
              onClick={startCamera}
              className="mt-4 btn-secondary text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Corner decorations */}
      <div
        className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl-lg"
        style={{ borderColor: "var(--col-purple)" }}
      />
      <div
        className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-lg"
        style={{ borderColor: "var(--col-purple)" }}
      />
      <div
        className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 rounded-bl-lg"
        style={{ borderColor: "var(--col-purple)" }}
      />
      <div
        className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br-lg"
        style={{ borderColor: "var(--col-purple)" }}
      />
    </div>
  );
}
