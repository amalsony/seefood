import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["onnxruntime-node"],

  outputFileTracingIncludes: {
    "/api/predict": [
      "./models/**/*",
      // Forces Vercel to bundle the native Linux C++ engine
      "./node_modules/onnxruntime-node/bin/napi-v3/linux-x64/**/*",
    ],
  },
};

export default nextConfig;
