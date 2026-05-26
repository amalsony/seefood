"use client";

import NextImage from "next/image";
import { useState, useRef } from "react";
import * as ort from "onnxruntime-web";

type AppState = "landing" | "camera" | "analyzing" | "result";

export default function SeeFoodApp() {
  const [appState, setAppState] = useState<AppState>("landing");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"hotdog" | "not_hotdog" | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Enter Camera Mode
  const startCamera = async () => {
    setAppState("camera");
    setVerdict(null);
    setPreviewUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
    } catch (err) {
      console.error(err);
      alert("Could not access the camera. Please check permissions.");
      setAppState("landing");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  // 2. Snap Photo and Immediately Analyze
  const captureAndAnalyze = async () => {
    if (!videoRef.current) return;

    // Snap the photo
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(videoRef.current, 0, 0);

    const imageUrl = canvas.toDataURL("image/jpeg");
    setPreviewUrl(imageUrl);
    stopCamera();

    // Move to analyzing state
    setAppState("analyzing");

    try {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const scaleCanvas = document.createElement("canvas");
      scaleCanvas.width = 224;
      scaleCanvas.height = 224;
      const scaleCtx = scaleCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      if (!scaleCtx) throw new Error("Canvas not supported");

      scaleCtx.drawImage(img, 0, 0, 224, 224);
      const imageData = scaleCtx.getImageData(0, 0, 224, 224).data;

      const float32Data = new Float32Array(3 * 224 * 224);
      const mean = [0.485, 0.456, 0.406];
      const std = [0.229, 0.224, 0.225];

      let i = 0;
      for (let y = 0; y < 224; y++) {
        for (let x = 0; x < 224; x++) {
          const idx = (y * 224 + x) * 4;
          float32Data[i] = (imageData[idx] / 255.0 - mean[0]) / std[0];
          float32Data[i + 50176] =
            (imageData[idx + 1] / 255.0 - mean[1]) / std[1];
          float32Data[i + 100352] =
            (imageData[idx + 2] / 255.0 - mean[2]) / std[2];
          i++;
        }
      }

      const session = await ort.InferenceSession.create("/seefood.onnx");
      const tensor = new ort.Tensor("float32", float32Data, [1, 3, 224, 224]);
      const results = await session.run({ input: tensor });

      const output = results.output.data as Float32Array;
      setVerdict(output[0] > output[1] ? "hotdog" : "not_hotdog");
      setAppState("result");
    } catch (error) {
      console.error("Error analyzing image:", error);
      alert("Failed to run the brain.");
      setAppState("landing");
    }
  };

  const resetApp = () => {
    setAppState("landing");
    setVerdict(null);
    setPreviewUrl(null);
  };

  return (
    <main className="relative w-full h-[100svh] bg-black overflow-hidden font-sans select-none">
      {/* --- SCREEN 1: THE SPLASH PAGE --- */}
      {appState === "landing" && (
        <div className="absolute inset-0 flex flex-col bg-white">
          {/* Classic Red Header */}
          <div className="bg-[#cc0000] pt-12 pb-2 border-b-4 border-black flex items-center justify-center shadow-md z-10">
            <h1
              className="text-white text-5xl font-black tracking-widest"
              style={{ WebkitTextStroke: "1.5px black" }}
            >
              SEEFOOD
            </h1>
          </div>
          <div className="bg-white text-[#cc0000] font-bold text-xl text-center py-2 border-b-4 border-black shadow-sm z-10">
            &quot;The Shazam for Food&quot;
          </div>

          {/* Fake Food Grid Background */}
          <div className="flex-1 flex flex-col w-full">
            <div className="flex-1 bg-[url('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80')] bg-cover bg-center border-b-2 border-neutral-300"></div>
            <div className="flex-1 bg-[url('https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=800&q=80')] bg-cover bg-center border-b-2 border-neutral-300"></div>
            <div className="flex-1 bg-[url('https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&q=80')] bg-cover bg-center"></div>
          </div>

          {/* Bottom Camera Trigger */}
          <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/80 via-black/50 to-transparent flex flex-col items-center justify-end pb-8">
            <button
              onClick={startCamera}
              className="w-20 h-20 bg-[#cc0000] rounded-full border-[6px] border-white shadow-2xl mb-3 active:scale-90 transition-transform"
            />
            <p className="text-white font-extrabold text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-tight">
              Touch to SEEFOOD
            </p>
          </div>
        </div>
      )}

      {/* --- SCREEN 2 & 3 & 4: CAMERA / ANALYZING / RESULT --- */}
      {appState !== "landing" && (
        <div className="absolute inset-0 bg-black flex flex-col">
          {/* Top Banner (Only visible on result) */}
          {appState === "result" && verdict === "hotdog" && (
            <div
              className="absolute top-0 left-0 w-full bg-[#00ff00] text-white text-6xl font-black pt-12 pb-6 text-center z-50 shadow-2xl tracking-tighter border-b-4 border-black"
              onClick={resetApp}
            >
              Hotdog!
            </div>
          )}
          {appState === "result" && verdict === "not_hotdog" && (
            <div
              className="absolute top-0 left-0 w-full bg-[#cc0000] text-white text-6xl font-black pt-12 pb-6 text-center z-50 shadow-2xl tracking-tighter flex flex-col items-center border-b-4 border-black"
              onClick={resetApp}
            >
              Not hotdog!
              <span className="text-8xl mt-1 leading-none">✕</span>
            </div>
          )}

          {/* Viewfinder / Image Preview */}
          <div className="flex-1 relative w-full overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`object-cover w-full h-full ${appState === "camera" ? "block" : "hidden"}`}
            />
            {previewUrl && (
              <NextImage
                src={previewUrl}
                alt="Captured"
                fill
                unoptimized
                sizes="100vw"
                className="object-cover w-full h-full"
              />
            )}

            {/* Loading Spinner */}
            {appState === "analyzing" && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm z-30">
                <div className="animate-spin rounded-full h-24 w-24 border-t-8 border-b-8 border-white mb-6"></div>
                <p className="text-white font-bold text-2xl animate-pulse">
                  Analyzing...
                </p>
              </div>
            )}
          </div>

          {/* Camera Controls (Only in Camera mode) */}
          {appState === "camera" && (
            <div className="absolute bottom-0 left-0 w-full h-32 bg-black/50 flex items-center justify-center pb-6">
              <button
                onClick={captureAndAnalyze}
                className="w-20 h-20 bg-white rounded-full border-4 border-neutral-300 shadow-2xl active:scale-90 transition-transform"
              />
              <button
                onClick={resetApp}
                className="absolute left-6 text-white font-bold text-lg"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Tap to Reset Hint (Only in Result mode) */}
          {appState === "result" && (
            <div className="absolute bottom-10 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col items-stretch gap-2.5 rounded-3xl border border-zinc-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.18),0_1px_2px_rgba(15,23,42,0.08)]">
              <button
                className="w-full cursor-pointer rounded-2xl border border-zinc-950 bg-zinc-900 px-5 py-3.5 text-center text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_0_rgba(24,24,27,1),0_10px_18px_rgba(24,24,27,0.18)] transition-all hover:-translate-y-px hover:bg-zinc-800 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_3px_0_rgba(24,24,27,1),0_12px_20px_rgba(24,24,27,0.2)] active:translate-y-0 active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.24),0_1px_0_rgba(24,24,27,1)]"
                onClick={() =>
                  window.open(
                    "https://www.amalsony.com",
                    "_blank",
                    "noreferrer",
                  )
                }
              >
                Check out my other projects
              </button>
              <button
                className="w-full cursor-pointer rounded-2xl border border-zinc-200 bg-white px-5 py-3.5 text-center text-[15px] font-semibold text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_0_rgba(212,212,216,1),0_5px_12px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-px hover:border-zinc-300 hover:text-zinc-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_0_rgba(212,212,216,1),0_8px_14px_rgba(15,23,42,0.08)] active:translate-y-0 active:shadow-[inset_0_2px_5px_rgba(15,23,42,0.07),0_1px_0_rgba(212,212,216,1)]"
                onClick={resetApp}
              >
                Tap anywhere to reset
              </button>
            </div>
          )}

          {/* Invisible overlay to catch clicks on the result image to reset */}
          {appState === "result" && (
            <div className="absolute inset-0 z-40" onClick={resetApp}></div>
          )}
        </div>
      )}
    </main>
  );
}
