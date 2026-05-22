"use client";

import { useState } from "react";

export default function SeeFoodApp() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"hotdog" | "not_hotdog" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle the file selection and create a temporary URL for the preview
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setVerdict(null); // Reset the verdict when a new image is chosen
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
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-neutral-900 overflow-hidden font-sans">
      {/* 1. The Banner Overlay (Only shows if we have a verdict) */}
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

      {/* 2. The Main Image Display */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-neutral-800 rounded-2xl overflow-hidden shadow-2xl border-4 border-neutral-700 z-10 flex items-center justify-center">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Target"
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-neutral-500 text-xl font-medium">
            No target acquired
          </span>
        )}

        {/* Loading Spinner Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-30">
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-white"></div>
          </div>
        )}
      </div>

      {/* 3. The Control Panel */}
      <div className="absolute bottom-10 flex flex-col gap-4 z-20 w-full max-w-md px-6">
        {/* Hidden File Input mapped to a styled label */}
        <label className="w-full bg-neutral-700 hover:bg-neutral-600 text-white text-xl font-bold py-4 rounded-xl cursor-pointer text-center transition-colors shadow-lg">
          Upload Photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </label>

        <button
          onClick={analyzeImage}
          disabled={!selectedFile || isLoading}
          className="w-full bg-cyan-400 hover:bg-cyan-300 disabled:bg-neutral-600 disabled:text-neutral-400 text-neutral-900 text-2xl font-black py-4 rounded-xl transition-colors shadow-lg"
        >
          {isLoading ? "Analyzing..." : "Identify"}
        </button>
      </div>
    </main>
  );
}
