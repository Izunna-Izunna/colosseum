/**
 * Rep Tracker — State machine for counting valid pull-up reps.
 *
 * States:
 *   IDLE → HANGING (full extension) → PULLING (moving up) →
 *   TOP (chin above bar) → DESCENDING → HANGING (rep complete!)
 *
 * A rep only counts if ALL conditions are met:
 *   1. Starting position: elbow angle > 160° (full extension)
 *   2. Top position: nose/chin crosses above calibrated bar reference
 *   3. Returns to full extension before the next rep counts
 */

import type { Keypoint } from "./pose-detection";
import {
  calculateElbowAngle,
  isChinAboveBar,
  getUpperBodyConfidence,
} from "./pose-detection";

export type RepState =
  | "IDLE"
  | "HANGING"
  | "PULLING"
  | "TOP"
  | "DESCENDING";

export interface CalibrationData {
  /** Elbow angle at full extension (baseline) */
  extensionAngle: number;
  /** Y-coordinate of nose at the top of a rep (bar reference line) */
  barReferenceY: number;
  /** The threshold angle to consider "fully extended" (usually extensionAngle - 15) */
  extensionThreshold: number;
  /** The threshold angle to detect upward movement (usually extensionAngle - 40) */
  pullingThreshold: number;
}

export interface RepTrackerCallbacks {
  onRepCompleted: (repNumber: number, confidence: number) => void;
  onStateChange: (state: RepState) => void;
}

export class RepTracker {
  private state: RepState = "IDLE";
  private currentRep: number = 0;
  private lastRepTimestamp: number = 0;
  private calibration: CalibrationData | null = null;
  private callbacks: RepTrackerCallbacks;

  // Calibration collection
  private extensionSamples: number[] = [];
  private topSamples: number[] = [];
  private calibrationStep: "idle" | "extension" | "top" | "done" = "idle";

  constructor(callbacks: RepTrackerCallbacks) {
    this.callbacks = callbacks;
  }

  get repCount(): number {
    return this.currentRep;
  }

  get currentState(): RepState {
    return this.state;
  }

  get isCalibrated(): boolean {
    return this.calibration !== null;
  }

  get calibrationProgress(): "idle" | "extension" | "top" | "done" {
    return this.calibrationStep;
  }

  /**
   * Start calibration — Step 1: collect extension samples.
   * Call this when the user is hanging at full extension.
   */
  startCalibrationExtension(): void {
    this.extensionSamples = [];
    this.calibrationStep = "extension";
  }

  /**
   * Start calibration — Step 2: collect top position samples.
   * Call this when the user does a rep to the top.
   */
  startCalibrationTop(): void {
    this.topSamples = [];
    this.calibrationStep = "top";
  }

  /**
   * Feed a frame of keypoints during calibration.
   * Returns true when the current calibration step has enough samples.
   */
  feedCalibrationFrame(keypoints: Keypoint[]): boolean {
    if (this.calibrationStep === "extension") {
      const angle = calculateElbowAngle(keypoints);
      if (angle > 0) {
        this.extensionSamples.push(angle);
      }
      return this.extensionSamples.length >= 15; // ~0.5s at 30fps
    }

    if (this.calibrationStep === "top") {
      const nose = keypoints[0]; // NOSE
      if ((nose.score ?? 0) > 0.3) {
        this.topSamples.push(nose.y);
      }
      // We want the minimum Y (highest point)
      return this.topSamples.length >= 30; // ~1s at 30fps
    }

    return false;
  }

  /**
   * Finalize calibration with collected samples.
   */
  finalizeCalibration(): boolean {
    if (this.extensionSamples.length < 10 || this.topSamples.length < 10) {
      return false;
    }

    // Use the median of extension angle samples
    const sortedAngles = [...this.extensionSamples].sort((a, b) => a - b);
    const extensionAngle = sortedAngles[Math.floor(sortedAngles.length / 2)];

    // Use the minimum Y (highest point reached) + small margin
    const minY = Math.min(...this.topSamples);
    const barReferenceY = minY + 20; // Give 20px margin of forgiveness

    this.calibration = {
      extensionAngle,
      barReferenceY,
      extensionThreshold: extensionAngle - 20,
      pullingThreshold: extensionAngle - 45,
    };

    this.calibrationStep = "done";
    this.state = "HANGING";
    this.callbacks.onStateChange("HANGING");

    return true;
  }

  /**
   * Set calibration data directly (e.g., from stored values).
   */
  setCalibration(data: CalibrationData): void {
    this.calibration = data;
    this.calibrationStep = "done";
    this.state = "HANGING";
  }

  /**
   * Process a frame of keypoints during the live duel.
   * Call this every frame (~30fps) with the latest pose data.
   */
  processFrame(keypoints: Keypoint[]): void {
    if (!this.calibration) return;

    const elbowAngle = calculateElbowAngle(keypoints);
    if (elbowAngle < 0) return; // Can't detect arms

    const confidence = getUpperBodyConfidence(keypoints);
    const chinAbove = isChinAboveBar(keypoints, this.calibration.barReferenceY);

    switch (this.state) {
      case "HANGING":
        // Waiting at full extension — detect upward movement
        if (elbowAngle < this.calibration.pullingThreshold) {
          this.setState("PULLING");
        }
        break;

      case "PULLING":
        // Moving upward — check if chin crossed the bar
        if (chinAbove) {
          this.setState("TOP");
        }
        // If they dropped back to extension without reaching top, reset
        if (elbowAngle > this.calibration.extensionThreshold) {
          this.setState("HANGING");
        }
        break;

      case "TOP":
        // At the top — wait for them to start descending
        if (!chinAbove) {
          this.setState("DESCENDING");
        }
        break;

      case "DESCENDING":
        // Going back down — rep counts when they return to full extension
        if (elbowAngle > this.calibration.extensionThreshold) {
          this.completeRep(confidence);
          this.setState("HANGING");
        }
        // Edge case: they went back up before reaching extension
        if (chinAbove) {
          this.setState("TOP");
        }
        break;

      case "IDLE":
        // Not tracking — check if in extension position to start
        if (elbowAngle > this.calibration.extensionThreshold) {
          this.setState("HANGING");
        }
        break;
    }
  }

  /**
   * Reset the tracker to initial state.
   */
  reset(): void {
    this.state = "IDLE";
    this.currentRep = 0;
    this.lastRepTimestamp = 0;
    this.calibration = null;
    this.calibrationStep = "idle";
    this.extensionSamples = [];
    this.topSamples = [];
  }

  private setState(newState: RepState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStateChange(newState);
    }
  }

  private completeRep(confidence: number): void {
    const now = Date.now();

    // Minimum time between reps: 0.4s (anti-cheat)
    if (now - this.lastRepTimestamp < 400) return;

    this.currentRep++;
    this.lastRepTimestamp = now;
    this.callbacks.onRepCompleted(this.currentRep, confidence);
  }
}
