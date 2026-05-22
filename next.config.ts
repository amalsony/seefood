import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Tell Webpack NOT to touch the C++ ONNX engine
  serverExternalPackages: ["onnxruntime-node"],

  // 2. Force Vercel to copy your models folder into the serverless function
  outputFileTracingIncludes: {
    "/api/predict": ["./models/**/*"],
  },
};

export default nextConfig;
