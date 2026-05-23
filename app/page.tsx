"use client";

import { useState, useRef } from "react";
import * as ort from "onnxruntime-web";

export default function SeeFoodApp() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"hotdog" | "not_hotdog" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isCameraMode, setIsCameraMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setVerdict(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsCameraMode(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      streamRef.current = stream;
    } catch (err) {
      console.error(err);
      alert("Could not access the camera.");
      setIsCameraMode(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current)
      streamRef.current.getTracks().forEach((track) => track.stop());
    setIsCameraMode(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file));
          stopCamera();
        }
      }, "image/jpeg");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isCameraMode) stopCamera();
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setVerdict(null);
    }
  };

  // The New WebAssembly Brain!
  const analyzeImage = async () => {
    if (!previewUrl) return;
    setIsLoading(true);
    setVerdict(null);

    try {
      // 1. Load the image into an HTML Canvas to extract the pixels
      const img = new Image();
      img.src = previewUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas not supported");

      ctx.drawImage(img, 0, 0, 224, 224);
      const imageData = ctx.getImageData(0, 0, 224, 224).data;

      // 2. Preprocess the pixels (The PyTorch transforms in pure JS)
      const float32Data = new Float32Array(3 * 224 * 224);
      const mean = [0.485, 0.456, 0.406];
      const std = [0.229, 0.224, 0.225];

      let i = 0;
      for (let y = 0; y < 224; y++) {
        for (let x = 0; x < 224; x++) {
          const idx = (y * 224 + x) * 4; // RGBA array
          float32Data[i] = (imageData[idx] / 255.0 - mean[0]) / std[0]; // Red
          float32Data[i + 50176] =
            (imageData[idx + 1] / 255.0 - mean[1]) / std[1]; // Green (224*224 offset)
          float32Data[i + 100352] =
            (imageData[idx + 2] / 255.0 - mean[2]) / std[2]; // Blue (2*224*224 offset)
          i++;
        }
      }

      // 3. Run the WASM Engine
      // It downloads the model from your public folder automatically
      const session = await ort.InferenceSession.create("/seefood.onnx");
      const tensor = new ort.Tensor("float32", float32Data, [1, 3, 224, 224]);
      const results = await session.run({ input: tensor });

      const output = results.output.data as Float32Array;
      console.log("WebAssembly Scores:", {
        hotdog: output[0],
        not_hotdog: output[1],
      });

      setVerdict(output[0] > output[1] ? "hotdog" : "not_hotdog");
    } catch (error) {
      console.error("Error analyzing image:", error);
      alert("Failed to run the local brain.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-neutral-900 overflow-hidden font-sans pb-32">
      {verdict === "hotdog" && (
        <div className="absolute top-0 left-0 w-full bg-green-500 text-white text-6xl font-black py-6 text-center z-20 shadow-2xl tracking-tighter">
          Hotdog!
        </div>
      )}

      {verdict === "not_hotdog" && (
        <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-6xl font-black py-6 text-center z-20 shadow-2xl tracking-tighter flex flex-col items-center">
          Not hotdog!
          <span className="text-8xl mt-2">✕</span>
        </div>
      )}

      <div className="relative w-full max-w-md aspect-[3/4] bg-neutral-800 rounded-2xl overflow-hidden shadow-2xl border-4 border-neutral-700 z-10 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`object-cover w-full h-full ${isCameraMode ? "block" : "hidden"}`}
        />
        {!isCameraMode && previewUrl && (
          <img
            src={previewUrl}
            alt="Target"
            className="object-cover w-full h-full"
          />
        )}
        {!isCameraMode && !previewUrl && (
          <span className="text-neutral-500 text-xl font-medium">
            No target acquired
          </span>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-30">
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-white"></div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 flex flex-col gap-3 z-20 w-full max-w-md px-6">
        {isCameraMode ? (
          <button
            onClick={capturePhoto}
            className="w-full bg-white hover:bg-neutral-200 text-neutral-900 text-xl font-bold py-4 rounded-xl transition-colors shadow-lg"
          >
            📸 Snap Photo
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={startCamera}
              className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white text-lg font-bold py-4 rounded-xl transition-colors shadow-lg"
            >
              Open Camera
            </button>
            <label className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white text-lg font-bold py-4 rounded-xl cursor-pointer text-center transition-colors shadow-lg">
              Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
          </div>
        )}

        <button
          onClick={analyzeImage}
          disabled={!previewUrl || isLoading || isCameraMode}
          className="w-full bg-cyan-400 hover:bg-cyan-300 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-900 text-2xl font-black py-4 rounded-xl transition-colors shadow-lg"
        >
          {isLoading ? "Analyzing..." : "Identify"}
        </button>
      </div>
    </main>
  );
}
