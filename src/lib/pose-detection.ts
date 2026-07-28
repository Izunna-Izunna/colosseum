/**
 * Pose Detection — MoveNet Lightning integration via client-side runtime loading.
 *
 * Dynamically loads TensorFlow.js and MoveNet pose detection scripts on the client
 * to avoid bundler/Turbopack issues with MediaPipe dependencies.
 */

export interface Keypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export interface PoseDetector {
  estimatePoses(
    image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    config?: unknown
  ): Promise<{ keypoints: Keypoint[] }[]>;
}

declare global {
  interface Window {
    tf?: any;
    poseDetection?: any;
  }
}

let detector: PoseDetector | null = null;
let isLoading = false;

// MoveNet keypoint indices
export const KEYPOINTS = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
} as const;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

/**
 * Initialize the MoveNet Lightning pose detector.
 * Dynamically loads TensorFlow.js + MoveNet scripts into window context.
 */
export async function initPoseDetector(): Promise<PoseDetector> {
  if (detector) return detector;
  if (typeof window === "undefined") {
    throw new Error("initPoseDetector can only be called in the browser");
  }

  if (isLoading) {
    while (isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return detector!;
  }

  isLoading = true;
  try {
    // Load TensorFlow.js core runtime first
    if (!window.tf) {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"
      );
    }
    if (window.tf?.ready) {
      await window.tf.ready();
    }

    // Load Pose Detection model script
    if (!window.poseDetection) {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js"
      );
    }

    const pd = window.poseDetection;
    if (!pd) {
      throw new Error("Failed to load window.poseDetection script");
    }

    detector = await pd.createDetector(pd.SupportedModels.MoveNet, {
      modelType: pd.movenet?.modelType?.SINGLEPOSE_LIGHTNING || "SinglePose.Lightning",
      enableSmoothing: true,
      minPoseScore: 0.25,
    });

    return detector!;
  } catch (err) {
    console.error("Failed to initialize pose detector:", err);
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Run pose detection on a video frame.
 * Returns keypoints array or null if detection fails.
 */
export async function detectPose(
  video: HTMLVideoElement
): Promise<Keypoint[] | null> {
  if (!detector) return null;
  if (video.readyState < 2) return null; // Video not ready

  try {
    const poses = await detector.estimatePoses(video, {
      flipHorizontal: false,
    });
    if (!poses || poses.length === 0) return null;
    return poses[0].keypoints;
  } catch {
    return null;
  }
}

/**
 * Calculate the angle at a joint given three keypoints (in degrees).
 * e.g., elbow angle from shoulder → elbow → wrist.
 */
export function calculateAngle(
  a: Keypoint,
  b: Keypoint, // The joint
  c: Keypoint
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

/**
 * Calculate the average elbow angle (both arms).
 * Returns the average of left and right elbow angles.
 */
export function calculateElbowAngle(keypoints: Keypoint[]): number {
  const leftShoulder = keypoints[KEYPOINTS.LEFT_SHOULDER];
  const leftElbow = keypoints[KEYPOINTS.LEFT_ELBOW];
  const leftWrist = keypoints[KEYPOINTS.LEFT_WRIST];
  const rightShoulder = keypoints[KEYPOINTS.RIGHT_SHOULDER];
  const rightElbow = keypoints[KEYPOINTS.RIGHT_ELBOW];
  const rightWrist = keypoints[KEYPOINTS.RIGHT_WRIST];

  const MIN_CONFIDENCE = 0.3;

  const leftConfident =
    leftShoulder &&
    leftElbow &&
    leftWrist &&
    (leftShoulder.score ?? 0) > MIN_CONFIDENCE &&
    (leftElbow.score ?? 0) > MIN_CONFIDENCE &&
    (leftWrist.score ?? 0) > MIN_CONFIDENCE;

  const rightConfident =
    rightShoulder &&
    rightElbow &&
    rightWrist &&
    (rightShoulder.score ?? 0) > MIN_CONFIDENCE &&
    (rightElbow.score ?? 0) > MIN_CONFIDENCE &&
    (rightWrist.score ?? 0) > MIN_CONFIDENCE;

  if (leftConfident && rightConfident) {
    const leftAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rightAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    return (leftAngle + rightAngle) / 2;
  } else if (leftConfident) {
    return calculateAngle(leftShoulder, leftElbow, leftWrist);
  } else if (rightConfident) {
    return calculateAngle(rightShoulder, rightElbow, rightWrist);
  }

  return -1; // Not enough confidence
}

/**
 * Check if the chin/nose is above a calibrated bar reference height.
 */
export function isChinAboveBar(
  keypoints: Keypoint[],
  barY: number
): boolean {
  const nose = keypoints[KEYPOINTS.NOSE];
  if (!nose || (nose.score ?? 0) < 0.3) return false;
  // In video coordinates, Y increases downward, so "above" means smaller Y
  return nose.y < barY;
}

/**
 * Get the average confidence score of key upper-body landmarks.
 */
export function getUpperBodyConfidence(keypoints: Keypoint[]): number {
  const relevantIndices = [
    KEYPOINTS.NOSE,
    KEYPOINTS.LEFT_SHOULDER,
    KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_ELBOW,
    KEYPOINTS.RIGHT_ELBOW,
    KEYPOINTS.LEFT_WRIST,
    KEYPOINTS.RIGHT_WRIST,
  ];

  let total = 0;
  let count = 0;
  for (const idx of relevantIndices) {
    const score = keypoints[idx]?.score ?? 0;
    total += score;
    count++;
  }

  return count > 0 ? total / count : 0;
}

/**
 * Draw pose skeleton overlay on a canvas (for debug/visual feedback).
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  keypoints: Keypoint[],
  color: string = "#00f5d4",
  minConfidence: number = 0.3
): void {
  // Draw keypoints
  for (const kp of keypoints) {
    if ((kp.score ?? 0) < minConfidence) continue;
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Connections to draw
  const connections: [number, number][] = [
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER],
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_ELBOW],
    [KEYPOINTS.LEFT_ELBOW, KEYPOINTS.LEFT_WRIST],
    [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_ELBOW],
    [KEYPOINTS.RIGHT_ELBOW, KEYPOINTS.RIGHT_WRIST],
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP],
    [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP],
    [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
  ];

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (const [i, j] of connections) {
    const a = keypoints[i];
    const b = keypoints[j];
    if (!a || !b || (a.score ?? 0) < minConfidence || (b.score ?? 0) < minConfidence) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
