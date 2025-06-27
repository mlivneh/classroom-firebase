// functions/index.js - COMPLETE FIXED VERSION

const {onCall} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const https = require("https");

// Initialize Firebase Admin SDK if it hasn't been already
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Callable Cloud Function to get a response from Gemini AI.
 */
exports.askGemini = onCall({
  region: "me-west1"
}, async (request) => {
  console.log("🔍 askGemini called with:", request.data);
  
  if (!request.auth) {
    console.error("❌ No authentication provided");
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const prompt = request.data.prompt;
  if (!prompt) {
    console.error("❌ No prompt provided");
    throw new HttpsError("invalid-argument", "Prompt is required");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ Gemini API key not found");
    throw new HttpsError("failed-precondition", "Gemini API key not configured");
  }

  console.log("✅ Gemini API key found, making request...");

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  
  const requestBody = JSON.stringify({
    contents: [{parts: [{text: prompt}]}],
  });

  console.log("🔍 Making request to Gemini API...");

  return new Promise((resolve, reject) => {
    const req = https.request(geminiUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"}
    }, (res) => {
      console.log("📨 Response status:", res.statusCode);
      
      let responseBody = "";
      res.on("data", (chunk) => responseBody += chunk);
      res.on("end", () => {
        console.log("📨 Response received, parsing...");
        
        try {
          const response = JSON.parse(responseBody);
          if (response.error) {
            console.error("❌ Gemini API error:", response.error);
            reject(new HttpsError("internal", `Gemini error: ${response.error.message}`));
            return;
          }
          
          const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            console.error("❌ Invalid response format:", response);
            reject(new HttpsError("internal", "Invalid Gemini response format"));
            return;
          }
          
          console.log("✅ Success! Gemini response length:", text.length);
          resolve({result: text, model: "gemini-pro"});
        } catch (e) {
          console.error("❌ Failed to parse response:", e);
          console.error("❌ Raw response:", responseBody);
          reject(new HttpsError("internal", "Failed to parse Gemini response"));
        }
      });
    });

    req.on("error", (error) => {
      console.error("❌ Request error:", error);
      reject(new HttpsError("internal", "Failed to connect to Gemini"));
    });

    req.write(requestBody);
    req.end();
  });
});

/**
 * Callable Cloud Function to get a response from Claude AI.
 */
exports.askClaude = onCall({
  region: "me-west1"
}, async (request) => {
  console.log("🔍 askClaude called with:", request.data);
  
  if (!request.auth) {
    console.error("❌ No authentication provided");
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const prompt = request.data.prompt;
  if (!prompt) {
    console.error("❌ No prompt provided");
    throw new HttpsError("invalid-argument", "Prompt is required");
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error("❌ Claude API key not found");
    throw new HttpsError("failed-precondition", "Claude API key not configured");
  }

  console.log("✅ Claude API key found, making request...");

  const requestBody = JSON.stringify({
    model: "claude-3-sonnet-20240229",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: prompt
    }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    }, (res) => {
      console.log("📨 Claude response status:", res.statusCode);
      
      let responseBody = "";
      res.on("data", (chunk) => responseBody += chunk);
      res.on("end", () => {
        console.log("📨 Claude response received, parsing...");
        
        try {
          const response = JSON.parse(responseBody);
          if (response.error) {
            console.error("❌ Claude API error:", response.error);
            reject(new HttpsError("internal", `Claude error: ${response.error.message}`));
            return;
          }
          
          const text = response.content?.[0]?.text;
          if (!text) {
            console.error("❌ Invalid Claude response format:", response);
            reject(new HttpsError("internal", "Invalid Claude response format"));
            return;
          }
          
          console.log("✅ Success! Claude response length:", text.length);
          resolve({result: text, model: "claude-3-sonnet"});
        } catch (e) {
          console.error("❌ Failed to parse Claude response:", e);
          console.error("❌ Raw response:", responseBody);
          reject(new HttpsError("internal", "Failed to parse Claude response"));
        }
      });
    });

    req.on("error", (error) => {
      console.error("❌ Claude request error:", error);
      reject(new HttpsError("internal", "Failed to connect to Claude"));
    });

    req.write(requestBody);
    req.end();
  });
});

/**
 * Callable Cloud Function to get a response from ChatGPT.
 */
exports.askChatGPT = onCall({
  region: "me-west1"
}, async (request) => {
  console.log("🔍 askChatGPT called with:", request.data);
  
  if (!request.auth) {
    console.error("❌ No authentication provided");
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const prompt = request.data.prompt;
  if (!prompt) {
    console.error("❌ No prompt provided");
    throw new HttpsError("invalid-argument", "Prompt is required");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ OpenAI API key not found");
    throw new HttpsError("failed-precondition", "OpenAI API key not configured");
  }

  console.log("✅ OpenAI API key found, making request...");

  const requestBody = JSON.stringify({
    model: "gpt-4",
    messages: [{
      role: "user",
      content: prompt
    }],
    max_tokens: 1000
  });

  return new Promise((resolve, reject) => {
    const req = https.request("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      }
    }, (res) => {
      console.log("📨 OpenAI response status:", res.statusCode);
      
      let responseBody = "";
      res.on("data", (chunk) => responseBody += chunk);
      res.on("end", () => {
        console.log("📨 OpenAI response received, parsing...");
        
        try {
          const response = JSON.parse(responseBody);
          if (response.error) {
            console.error("❌ OpenAI API error:", response.error);
            reject(new HttpsError("internal", `OpenAI error: ${response.error.message}`));
            return;
          }
          
          const text = response.choices?.[0]?.message?.content;
          if (!text) {
            console.error("❌ Invalid OpenAI response format:", response);
            reject(new HttpsError("internal", "Invalid OpenAI response format"));
            return;
          }
          
          console.log("✅ Success! OpenAI response length:", text.length);
          resolve({result: text, model: "gpt-4"});
        } catch (e) {
          console.error("❌ Failed to parse OpenAI response:", e);
          console.error("❌ Raw response:", responseBody);
          reject(new HttpsError("internal", "Failed to parse OpenAI response"));
        }
      });
    });

    req.on("error", (error) => {
      console.error("❌ OpenAI request error:", error);
      reject(new HttpsError("internal", "Failed to connect to OpenAI"));
    });

    req.write(requestBody);
    req.end();
  });
});

/**
 * Universal AI function - automatically selects the best available model
 */
exports.askAI = onCall({
  region: "me-west1"
}, async (request) => {
  console.log("🔍 askAI called with:", request.data);
  
  if (!request.auth) {
    console.error("❌ No authentication provided");
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const prompt = request.data.prompt;
  const preferredModel = request.data.model || "auto";
  
  if (!prompt) {
    console.error("❌ No prompt provided");
    throw new HttpsError("invalid-argument", "Prompt is required");
  }

  // Check which APIs are available
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasClaude = !!process.env.CLAUDE_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  console.log("🔍 Available models:", { hasGemini, hasClaude, hasOpenAI });

  let selectedModel = preferredModel;
  
  // Auto-select model if requested or preferred model not available
  if (preferredModel === "auto" || 
      (preferredModel === "gemini" && !hasGemini) ||
      (preferredModel === "claude" && !hasClaude) ||
      (preferredModel === "chatgpt" && !hasOpenAI)) {
    
    if (hasGemini) selectedModel = "gemini";
    else if (hasClaude) selectedModel = "claude";
    else if (hasOpenAI) selectedModel = "chatgpt";
    else {
      console.error("❌ No AI services configured");
      throw new HttpsError("failed-precondition", "No AI services configured");
    }
  }

  console.log("🎯 Selected model:", selectedModel);

  // Call the appropriate function
  try {
    switch (selectedModel) {
      case "gemini":
        return await exports.askGemini(request);
      case "claude":
        return await exports.askClaude(request);
      case "chatgpt":
        return await exports.askChatGPT(request);
      default:
        throw new HttpsError("invalid-argument", "Invalid model selection");
    }
  } catch (error) {
    console.error(`❌ ${selectedModel} failed, trying fallback:`, error);
    
    // If selected model fails, try fallback
    const fallbacks = ["gemini", "claude", "chatgpt"].filter(m => 
      m !== selectedModel && 
      ((m === "gemini" && hasGemini) || 
       (m === "claude" && hasClaude) || 
       (m === "chatgpt" && hasOpenAI))
    );
    
    if (fallbacks.length > 0) {
      const fallback = fallbacks[0];
      console.log(`🔄 Using fallback model: ${fallback}`);
      
      switch (fallback) {
        case "gemini":
          return await exports.askGemini(request);
        case "claude":
          return await exports.askClaude(request);
        case "chatgpt":
          return await exports.askChatGPT(request);
      }
    }
    
    throw error;
  }
});

/**
 * Scheduled function to clean up old classrooms.
 * Runs every day at 2:00 AM Israel time.
 * NOTE: Uses europe-west1 because Cloud Scheduler is not available in me-west1
 */
exports.cleanupOldClassrooms = onSchedule({
  schedule: "0 2 * * *",
  timeZone: "Asia/Jerusalem",
  region: "europe-west1"  // Changed from me-west1 due to Cloud Scheduler limitations
}, async (event) => {
  console.log("🧹 Starting cleanup of old classrooms...");
  
  const db = admin.firestore();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  console.log("🔍 Looking for rooms older than:", oneWeekAgo);

  const query = db.collection("rooms")
      .where("last_activity", "<", oneWeekAgo);

  const oldRoomsSnapshot = await query.get();
  let deletedCount = 0;

  if (oldRoomsSnapshot.empty) {
    console.log("✅ No old rooms to delete.");
    return {deletedCount: 0};
  }

  const deletePromises = [];
  oldRoomsSnapshot.forEach((doc) => {
    console.log(`🗑️ Scheduling deletion for room: ${doc.id}`);
    deletePromises.push(doc.ref.delete());
    deletedCount++;
  });

  await Promise.all(deletePromises);
  console.log(`✅ Cleanup completed. Deleted ${deletedCount} old rooms.`);
  return {deletedCount};
});