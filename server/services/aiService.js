const { GoogleGenerativeAI } = require("@google/generative-ai");

// Local Cache for Symptom Suggestions (10 Minute TTL)
const symptomCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

exports.suggestSymptoms = async (partialInput) => {
  if (!partialInput || typeof partialInput !== 'string') return [];
  const query = partialInput.trim().toLowerCase();
  
  if (symptomCache.has(query)) {
    const cached = symptomCache.get(query);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    symptomCache.delete(query);
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return ["Fever", "Cough", "Headache", "Fatigue", "Nausea", "Pain"]; // Fallback
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `You are a medical assistant. The user typed: '${query}'. Return exactly 6 common medical symptoms that start with or relate to this input. Return ONLY a JSON array of strings. No explanation.`;
    
    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());
    
    symptomCache.set(query, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error('AI Symptom Suggest Error:', error);
    return [];
  }
};

exports.analyzeSymptoms = async (symptoms) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not configured. Returning default triage.');
      return { 
        aiPriority: "Normal", 
        aiSuggestedDept: "General", 
        aiConfidence: 0, 
        aiReasoning: "No AI summary available.", 
        aiRedFlags: [] 
      };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `You are a medical triage assistant. Analyze the following symptoms and return ONLY a JSON object with this exact shape:
{
  "aiPriority": "High" | "Medium" | "Low",
  "aiSuggestedDept": "string",
  "aiConfidence": number (0-100),
  "aiReasoning": "string (max 2 sentences, plain English)",
  "aiRedFlags": ["string"] (symptoms that triggered high priority, empty array if Low/Medium)
}
Note: This is an AI-generated triage suggestion for administrative sorting only, not a medical diagnosis.

Symptoms: ${symptoms}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return {
      aiPriority: data.aiPriority || "Medium",
      aiSuggestedDept: data.aiSuggestedDept || "General",
      aiConfidence: typeof data.aiConfidence === 'number' ? data.aiConfidence : 50,
      aiReasoning: data.aiReasoning || "Symptoms analyzed.",
      aiRedFlags: Array.isArray(data.aiRedFlags) ? data.aiRedFlags : []
    };
  } catch (error) {
    console.error('AI Triage Error:', error);
    return { 
      aiPriority: "Normal", 
      aiSuggestedDept: "General", 
      aiConfidence: 0, 
      aiReasoning: "Error in AI processing.", 
      aiRedFlags: [] 
    };
  }
};
