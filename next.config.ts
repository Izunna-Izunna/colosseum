import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [
    "@tensorflow/tfjs",
    "@tensorflow-models/pose-detection",
    "@mediapipe/pose",
  ],
};

export default nextConfig;
