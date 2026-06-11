import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// List of vibrant neobrutalist stranger personas
const STRANGER_PERSONAS = [
  {
    alias: "PixelPirate",
    age: 22,
    location: "United` Kingdom",
    avatarColor: "#FFDE4D", // Vibrant Yellow
    interests: ["retro-gaming", "css-art", "vaporwave", "pizza"],
    bio: "Obsessed with 8-bit computers, CRT scanlines, and building weird CSS layouts. HMU with your high score!",
    personality: "A chaotic, enthusiastic high-energy retro gamer who speaks in slight gaming terminology, uses keyboard keys like <kbd>ESC</kbd> in descriptions, and gets distracted by shiny styling easily. Speaks with exciting caps occasionally."
  },
  {
    alias: "BrutalGirdle",
    age: 24,
    location: "Switzerland",
    avatarColor: "#FF85B3", // Hot Pink
    interests: ["neobrutalism", "fonts", "fanzines", "coffee"],
    bio: "Swiss-certified graphic designer. Standard margins are a crime. Thick black outlines and comic sans are my philosophy.",
    personality: "An opinionated, passionate graphic designer. Constantly analyzes the typography, borders, and color scheme of everything, including this text box. Speaks elegantly but makes punchy observations about the brutalism of this interface."
  },
  {
    alias: "CosmicGazer",
    age: 29,
    location: "New Zealand",
    avatarColor: "#8CE0FF", // Sky Cyan
    interests: ["astronomy", "chillhop", "sci-fi", "hiking"],
    bio: "Stargazer, amateur astronomer, and part-time coffee roaster. Let's ponder about solar flares and space-time fabric.",
    personality: "Deep, super-chill, existential, but incredibly friendly and slightly mysterious astronomer. Often brings up cosmic analogies, dark matter, or the size of the universe, prompting mind-blowing questions in a casual tone."
  },
  {
    alias: "MemeAlchemist",
    age: 19,
    location: "United States",
    avatarColor: "#ACFFAD", // Lime Green
    interests: ["memes", "skateboarding", "lofi", "discord"],
    bio: "Professional scroll explorer. I speak in memes and sarcasm. Looking for someone with at least 500 IQ.",
    personality: "Talks in typical internet slang, formats messages with sarcasm, frequently drops meme templates or emotes like (っ☉_☉)っ, and keeps sentences short, energetic, and extremely hilarious."
  },
  {
    alias: "ByteSizedCaf",
    age: 21,
    location: "South Korea",
    avatarColor: "#FF9F29", // Neon Orange
    interests: ["soldering", "diy-keyboards", "cyberpunk", "kpop"],
    bio: "Hardware tinkerer, espresso drinker, and night owl. Currently assembling a transparent macro pad.",
    personality: "Extremely fast-paced, enthusiastic hardware geek. Overuses exclamation marks, writes with frantic typing sounds like *clack clack*, and loves coffee details. Speaks very warmly and asks lots of questions."
  },
  {
    alias: "EchoNirvana",
    age: 27,
    location: "Germany",
    avatarColor: "#C084FC", // Pastel Purple
    interests: ["modular-synths", "ambient", "vinyl", "plants"],
    bio: "Patching synthesizer cables by day, caring for monstera plants by night. Vinyl only.",
    personality: "Vibe-focused, poetic, and relaxed sound designer. Speaks in artistic, minimalist sentences, sometimes mentions their green houseplants, and likes to share metaphors about waves and frequencies."
  }
];

// Seed fallback responses for simulated mode when API key is missing
const FALLBACK_STRANGER_REPLIES = [
  "Woah, that's incredibly neobrutalist of you to say!",
  "Haha, nice! I was just adjusting my border sizes. What are you up to?",
  "Wait, let me double check my alignment settings. Totally makes sense!",
  "Fascinating. Where are you chatting from? I'm hanging out in a text container.",
  "Tell me more about your interests! I also love building chunky blocks.",
  "That is absolute peak aesthetic. I rate that response a solid 10/10 with a drop shadow!",
  "Let's make a deal: you double my outline thickness, and I share my secret pizza recipe."
];

// Helper to get random item from list
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// API: Get a random stranger identity
app.get("/api/stranger", (req: Request, res: Response) => {
  const persona = getRandomItem(STRANGER_PERSONAS);
  // Add a slight randomization to age and country so it doesn't always feel exactly the same
  const randomizedAgeStr = String(Math.floor(Math.random() * 8) + 18); // Ages 18-25
  const randomizedStranger = {
    id: Math.random().toString(36).substring(2, 9),
    alias: persona.alias,
    age: parseInt(randomizedAgeStr, 10),
    location: persona.location,
    interests: persona.interests,
    bio: persona.bio,
    avatarColor: persona.avatarColor,
    personality: persona.personality
  };
  res.json(randomizedStranger);
});

// API: Send a chat request to the AI Stranger
app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { history, stranger } = req.body;

    if (!history || !Array.isArray(history) || history.length === 0) {
      res.status(400).json({ error: "Missing or invalid chat history" });
      return;
    }

    if (!stranger) {
      res.status(400).json({ error: "Missing stranger profile context" });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Check if the API key is not set or is generic
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
      // Return a responsive simulation reply to keep the app functional
      setTimeout(() => {
        const lastUserMessage = history[history.length - 1]?.text || "";
        const baseResponse = getRandomItem(FALLBACK_STRANGER_REPLIES);
        
        let customResponse = `[DEMO MODE] ${baseResponse}`;
        if (stranger.alias === "PixelPirate") {
          customResponse = `[DEMO MODE] *PixelPirate* here: GAMER MODE ACTIVATED! 🕹️ You said "${lastUserMessage}"? That's awesome, but can we beat the boss? *spams keyboard*`;
        } else if (stranger.alias === "BrutalGirdle") {
          customResponse = `[DEMO MODE] *BrutalGirdle*: Speaking from a typographic perspective, "${lastUserMessage}" has great grid alignment. Very brutalist. I approve.`;
        } else if (stranger.alias === "CosmicGazer") {
          customResponse = `[DEMO MODE] *CosmicGazer*: That reminds me of a neutron star spinning. Interstellar stuff. "${lastUserMessage}" is just floating in the cosmic void.`;
        } else if (stranger.alias === "MemeAlchemist") {
          customResponse = `[DEMO MODE] *MemeAlchemist*: 👁️👄👁️ Bruh. Did you really just write "${lastUserMessage}"? Peak communication. S-tier.`;
        } else if (stranger.alias === "ByteSizedCaf") {
          customResponse = `[DEMO MODE] *ByteSizedCaf*: OMG YES! *clack clack* "${lastUserMessage}" is so true. Let me take an espresso shot to process this! ☕`;
        } else if (stranger.alias === "EchoNirvana") {
          customResponse = `[DEMO MODE] *EchoNirvana*: Your frequency corresponds to "${lastUserMessage}". Very chill vibrations. Let's modular synth that. 🌿`;
        }

        res.json({ reply: customResponse, modelUsed: "mock-offline-simulator" });
      }, 700);
      return;
    }

    // Initialize GoogleGenAI SDK in the backend
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Structure the system instruction based on stranger personality
    const systemInstruction = `You are an anonymous user chatting on an online neobrutalism-themed Omegle clone.
Your avatar moniker is "${stranger.alias}".
You are ${stranger.age} years old and live in ${stranger.location}.
Your interests are: ${stranger.interests.join(", ")}.
Your bio: "${stranger.bio}".
Your primary personality instructions are: ${stranger.personality}.

CONSTRAINTS:
1. Stay strictly in character! Never reveal you are an AI model or a chatbot. Act exactly like a real young person sitting on their computer.
2. Keep your responses short, conversational, slightly spontaneous, and casual (ranging from 1 to 3 short sentences mostly, sometimes just a fragment. Never write long paragraphs unless the user asks for a complex essay).
3. Use lowercase letters, casual punctuation or lack thereof, conversational emoji, or slangs where fitting for your specific character.
4. React to what the user says with genuine responsiveness, adding dynamic questions or banter that ties back to your character's quirks or interests.
5. If the user asks about the website design, comment on the vibrant colors and thick lines!`;

    // Map history to Google GenAI schema: { role: "user" | "model", parts: [{ text: "..." }] }
    const formattedContents = history.map((msg: any) => {
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }]
      };
    });

    // Make the API call to gemini-3.5-flash
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.85,
        maxOutputTokens: 200,
      }
    });

    const reply = response.text || "Sorry, I lagged out for a second! What were we saying?";

    res.json({
      reply,
      modelUsed: "gemini-3.5-flash"
    });

  } catch (error: any) {
    console.error("Gemini API Error on Server:", error);
    res.status(500).json({
      error: "Failed to generate server response",
      details: error.message || error
    });
  }
});

// Setup Vite development middleware or serve static dist directory
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Serve index.html for all undefined paths (SPA behavior)
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Neobrutalist Omegle] Server running on http://localhost:${PORT}`);
  });
}

startServer();
