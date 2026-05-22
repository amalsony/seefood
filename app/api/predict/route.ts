import { NextRequest, NextResponse } from "next/server";
import * as ort from "onnxruntime-node";
import { Jimp } from "jimp";
import path from "path";

// 1. Load the model globally so it doesn't re-load on every single request
let session: ort.InferenceSession | null = null;

async function loadModel() {
  if (!session) {
    const modelPath = path.join(process.cwd(), "models", "seefood.onnx");
    session = await ort.InferenceSession.create(modelPath);
  }
  return session;
}

export async function POST(req: NextRequest) {
  try {
    // 2. Intercept the uploaded image from the frontend
    const data = await req.formData();
    const file = data.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Convert the uploaded file into a Node Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Preprocessing (The JS Translation of our PyTorch Transforms)
    const image = await Jimp.read(buffer);
    image.resize({ w: 224, h: 224 }); // Force the 224x224 shape

    // Prepare the empty mathematical array [Batch, Channels, Height, Width]
    const dims = [1, 3, 224, 224];
    const float32Data = new Float32Array(3 * 224 * 224);

    // ImageNet standard normalization math
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    // 4. Scan every pixel, extract RGB, normalize, and flatten it into the array
    let i = 0;
    image.scan(0, 0, 224, 224, (_x, _y, idx) => {
      // Red Channel
      float32Data[i] = (image.bitmap.data[idx] / 255.0 - mean[0]) / std[0];
      // Green Channel
      float32Data[i + 224 * 224] =
        (image.bitmap.data[idx + 1] / 255.0 - mean[1]) / std[1];
      // Blue Channel
      float32Data[i + 2 * 224 * 224] =
        (image.bitmap.data[idx + 2] / 255.0 - mean[2]) / std[2];
      i++;
    });

    // 5. Convert the flattened array into an ONNX Tensor
    const tensor = new ort.Tensor("float32", float32Data, dims);

    // 6. Run the Model!
    const activeSession = await loadModel();

    // Notice 'input' matches the input_names we set during the Python export
    const feeds = { input: tensor };
    const results = await activeSession.run(feeds);

    // 7. Interpret the Output
    // The output is an array of two numbers: [Hotdog Score, Not Hotdog Score]
    const output = results.output.data as Float32Array;

    // Whichever score is higher wins (Argmax)
    const isHotdog = output[0] > output[1];

    // Send the verdict back to the client
    return NextResponse.json({
      class: isHotdog ? "hotdog" : "not_hotdog",
      rawScores: {
        hotdog: output[0],
        not_hotdog: output[1],
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 },
    );
  }
}
