import { Response } from "express";
import OpenAI from "openai";
import { AuthRequest } from "../middleware/auth.middleware";

const client = new OpenAI({
  baseURL: "https://inference.baseten.co/v1",
  apiKey: process.env.BASETEN_API_KEY,
});

export async function analyzeCargo(req: AuthRequest, res: Response) {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ message: "Description required" });

    const response = await client.chat.completions.create({
      model: "meta-models/muse-spark-open-1026",
      messages: [
        { 
          role: "system", 
          content: "You are Safirisha, a Kenyan logistics AI. Categorize the user's cargo into one of these vehicle types: 'bike' (Boda), 'tuktuk' (TukTuk), 'pickup' (Pickup), or 'lorry' (Lorry). Detect if it's fragile. Return a strict JSON object with keys: 'vehicleType', 'loadSize' (Small, Medium, Large, Extra Large), 'isFragile' (boolean), and 'reason' (string)." 
        },
        { role: "user", content: description }
      ],
    });

    const content = response.choices[0].message.content || "{}";
    // Clean up potential markdown formatting from AI
    const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    
    return res.json(parsed);
  } catch (error) {
    console.error("[AI Analyze Cargo Error]", error);
    return res.status(500).json({ message: "AI analysis failed" });
  }
}
