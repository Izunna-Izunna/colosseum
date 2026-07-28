import type { Keypoint } from "./pose-detection";
import { calculateElbowAngle, getUpperBodyConfidence } from "./pose-detection";

export type RepState = "IDLE" | "UP" | "DESCENDING" | "DOWN" | "PUSHING";

export interface CalibrationData {
  upAngle: number;
  downAngle: number;
  descendThreshold: number;
  ascendThreshold: number;
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

  private downSamples: number[] = [];
  private upSamples: number[] = [];
  private calibrationStep: "idle" | "down" | "up" | "done" = "idle";

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

  get calibrationProgress(): "idle" | "down" | "up" | "done" {
    return this.calibrationStep;
  }

  startCalibrationDown(): void {
    this.downSamples = [];
    this.calibrationStep = "down";
  }

  startCalibrationUp(): void {
    this.upSamples = [];
    this.calibrationStep = "up";
  }

  feedCalibrationFrame(keypoints: Keypoint[]): boolean {
    if (this.calibrationStep === "down") {
      const angle = calculateElbowAngle(keypoints);
      if (angle > 0) {
        this.downSamples.push(angle);
      }
      return this.downSamples.length >= 15;
    }

    if (this.calibrationStep === "up") {
      const angle = calculateElbowAngle(keypoints);
      if (angle > 0) {
        this.upSamples.push(angle);
      }
      return this.upSamples.length >= 15;
    }

    return false;
  }

  finalizeCalibration(): boolean {
    if (this.downSamples.length < 10 || this.upSamples.length < 10) {
      return false;
    }

    const sortedDown = [...this.downSamples].sort((a, b) => a - b);
    const downAngle = sortedDown[Math.floor(sortedDown.length / 2)];

    const sortedUp = [...this.upSamples].sort((a, b) => a - b);
    const upAngle = sortedUp[Math.floor(sortedUp.length / 2)];

    const margin = 15;
    this.calibration = {
      upAngle,
      downAngle,
      descendThreshold: upAngle - margin,
      ascendThreshold: downAngle + margin,
    };

    this.calibrationStep = "done";
    this.state = "UP";
    this.callbacks.onStateChange("UP");

    return true;
  }

  setCalibration(data: CalibrationData): void {
    this.calibration = data;
    this.calibrationStep = "done";
    this.state = "UP";
  }

  processFrame(keypoints: Keypoint[]): void {
    if (!this.calibration) return;

    const elbowAngle = calculateElbowAngle(keypoints);
    if (elbowAngle < 0) return;

    const confidence = getUpperBodyConfidence(keypoints);

    switch (this.state) {
      case "UP":
        if (elbowAngle < this.calibration.descendThreshold) {
          this.setState("DESCENDING");
        }
        break;

      case "DESCENDING":
        if (elbowAngle < this.calibration.ascendThreshold) {
          this.setState("DOWN");
        }
        if (elbowAngle > this.calibration.downAngle) {
          this.setState("UP");
        }
        break;

      case "DOWN":
        if (elbowAngle > this.calibration.ascendThreshold) {
          this.setState("PUSHING");
        }
        break;

      case "PUSHING":
        if (elbowAngle > this.calibration.descendThreshold) {
          this.completeRep(confidence);
          this.setState("UP");
        }
        if (elbowAngle < this.calibration.downAngle) {
          this.setState("DOWN");
        }
        break;

      case "IDLE":
        if (elbowAngle > this.calibration.downAngle + 10) {
          this.setState("UP");
        }
        break;
    }
  }

  reset(): void {
    this.state = "IDLE";
    this.currentRep = 0;
    this.lastRepTimestamp = 0;
    this.calibration = null;
    this.calibrationStep = "idle";
    this.downSamples = [];
    this.upSamples = [];
  }

  private setState(newState: RepState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStateChange(newState);
    }
  }

  private completeRep(confidence: number): void {
    const now = Date.now();
    if (now - this.lastRepTimestamp < 400) return;
    this.currentRep++;
    this.lastRepTimestamp = now;
    this.callbacks.onRepCompleted(this.currentRep, confidence);
  }
}
