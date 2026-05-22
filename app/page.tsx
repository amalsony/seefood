"use client";

import { useState, useRef } from "react";

export default function SeeFoodApp() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"hotdog" | "not_hotdog" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Camera State
  const [isCameraMode, setIsCameraMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Start the Camera
  const startCamera = async () => {
    setVerdict(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsCameraMode(true);

    try {
      // facingMode: 'environment' tries to use the back camera on mobile devices
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access the camera. Check your browser permissions.");
      setIsCameraMode(false);
    }
  };

  // 2. Stop the Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsCameraMode(false);
  };

  // 3. Snap the Photo
  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(videoRef.current, 0, 0);

      // Convert the canvas drawing into a standard File object
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file));
          stopCamera(); // Turn off the live feed once we have the picture
        }
      }, "image/jpeg");
    }
  };

  // Handle standard file uploads
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isCameraMode) stopCamera();
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setVerdict(null);
    }
  };

  // Send the image to our API route
  const analyzeImage = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setVerdict(null);

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("Model Scores:", data.rawScores); // The debugging line!

      if (response.ok) {
        setVerdict(data.class);
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      alert("Failed to connect to the brain.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-neutral-900 overflow-hidden font-sans pb-32">
      {/* The Banner Overlay */}
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

      {/* The Main Image Display / Viewfinder */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-neutral-800 rounded-2xl overflow-hidden shadow-2xl border-4 border-neutral-700 z-10 flex items-center justify-center">
        {/* State 1: Live Camera Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`object-cover w-full h-full ${isCameraMode ? "block" : "hidden"}`}
        />

        {/* State 2: Captured Photo or Uploaded File */}
        {!isCameraMode && previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Target"
            className="object-cover w-full h-full"
          />
        )}

        {/* State 3: Empty State */}
        {!isCameraMode && !previewUrl && (
          <span className="text-neutral-500 text-xl font-medium">
            No target acquired
          </span>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-30">
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-white"></div>
          </div>
        )}
      </div>

      {/* The Control Panel */}
      <div className="absolute bottom-6 flex flex-col gap-3 z-20 w-full max-w-md px-6">
        {/* Action Buttons based on state */}
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

        {/* The Big Identify Button */}
        <button
          onClick={analyzeImage}
          disabled={!selectedFile || isLoading || isCameraMode}
          className="w-full bg-cyan-400 hover:bg-cyan-300 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-900 text-2xl font-black py-4 rounded-xl transition-colors shadow-lg"
        >
          {isLoading ? "Analyzing..." : "Identify"}
        </button>
      </div>
    </main>
  );
}
