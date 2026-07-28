/**
 * Recorder — MediaRecorder wrapper for capturing the final moments of a duel.
 *
 * Uses a rolling buffer approach: continuously records but only keeps
 * the last N seconds of footage. When stopped, returns only the
 * recent clip (the winning moment).
 */

export class DuelRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private maxChunks: number = 30; // Keep last ~10 seconds (at ~3 chunks/second)
  private isRecording: boolean = false;

  /**
   * Start recording from a canvas element's stream.
   */
  start(canvas: HTMLCanvasElement): boolean {
    try {
      const stream = canvas.captureStream(30); // 30fps

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedMimeType(),
        videoBitsPerSecond: 2_500_000,
      });

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          // Rolling buffer — drop oldest chunks
          if (this.chunks.length > this.maxChunks) {
            this.chunks.shift();
          }
        }
      };

      // Request data every 333ms (~3 chunks per second)
      this.mediaRecorder.start(333);
      this.isRecording = true;
      return true;
    } catch (err) {
      console.error("Failed to start recording:", err);
      return false;
    }
  }

  /**
   * Stop recording and return the video Blob.
   */
  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.getSupportedMimeType();
        const blob = new Blob(this.chunks, { type: mimeType });
        this.chunks = [];
        this.isRecording = false;
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Check if the browser supports MediaRecorder.
   */
  static isSupported(): boolean {
    return typeof MediaRecorder !== "undefined";
  }

  private getSupportedMimeType(): string {
    const types = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "video/webm"; // Fallback
  }
}
