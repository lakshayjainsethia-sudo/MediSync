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
    let text = result.response.text();
    text = text.replace(/```json|```/gi, '').trim();
    const data = JSON.parse(text);
    
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
        severity: 5, urgency_score: 5,
        triage_tag: "ORANGE", triage_reason: "Manual review required"
      };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `You are a medical triage assistant. Analyze the following symptoms and return ONLY a JSON object with this exact shape, no explanation, no markdown fences:
{
  "severity": <integer 1-10>,
  "urgency_score": <integer 1-10>,
  "triage_tag": "RED" | "ORANGE" | "GREEN",
  "triage_reason": "<max 15 words, plain English>"
}

Triage tag rules you must follow:
  RED    → severity > 8 OR urgency_score > 8
  ORANGE → severity 5-7 AND urgency_score <= 8
  GREEN  → severity < 5 AND urgency_score < 5

Symptoms: ${symptoms}`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    responseText = responseText.replace(/```json|```/gi, '').trim();
    const data = JSON.parse(responseText);

    if (
      typeof data.severity !== 'number' || data.severity < 1 || data.severity > 10 ||
      typeof data.urgency_score !== 'number' || data.urgency_score < 1 || data.urgency_score > 10 ||
      !['RED', 'ORANGE', 'GREEN'].includes(data.triage_tag) ||
      typeof data.triage_reason !== 'string'
    ) {
      throw new Error('AI response validation failed');
    }

    return {
      severity: data.severity,
      urgency_score: data.urgency_score,
      triage_tag: data.triage_tag,
      triage_reason: data.triage_reason
    };
  } catch (error) {
    console.error('AI Triage Error:', error);
    return { 
      severity: 5, urgency_score: 5,
      triage_tag: "ORANGE", triage_reason: "Manual review required"
    };
  }
};

exports.analyzePrescription = async (prescription, patientAge, existingConditions) => {
  const prompt = `
    You are a clinical pharmacology assistant in an Indian hospital.
    A doctor has written this prescription:
    "${prescription}"
    
    Patient age: ${patientAge}
    Known conditions: ${existingConditions || 'None provided'}
    
    Analyze for drug-drug interactions and dosage issues.
    Return ONLY this JSON, no explanation, no markdown:
    {
      "interactions": [
        {
          "drug1": string,
          "drug2": string, 
          "severity": "HIGH" | "MEDIUM" | "LOW",
          "reason": "<max 20 words plain English>"
        }
      ],
      "dosageWarnings": [
        {
          "drug": string,
          "issue": "<max 20 words plain English>",
          "severity": "HIGH" | "MEDIUM" | "LOW"
        }
      ],
      "overallSafe": boolean,
      "disclaimer": "AI-generated. Verify with clinical judgment."
    }
  `;
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error('No API Key');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" }});
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (!Array.isArray(parsed.interactions) || !Array.isArray(parsed.dosageWarnings)) {
      throw new Error('Invalid shape');
    }

    parsed.interactions = parsed.interactions.filter(i => i.drug1 && i.drug2 && i.severity && i.reason);
    parsed.dosageWarnings = parsed.dosageWarnings.filter(d => d.drug && d.issue && d.severity);
    return parsed;
  } catch (err) {
    console.error('[AI analyzePrescription failed]', err.message);
    return {
      interactions: [],
      dosageWarnings: [],
      overallSafe: true,
      disclaimer: 'AI analysis unavailable. Review manually.',
      fallback: true
    };
  }
};

exports.predictMaintenance = async (equipment) => {
  const logs = equipment.maintenanceLogs || [];
  const logsContext = logs.slice(-5).map(l => 
    `Date: ${l.date}, Hours operated: ${l.hoursOperated || 'N/A'}, Issue: ${l.issueFound || 'None'}, Notes: ${l.notes}`
  ).join('\n');

  const prompt = `
    You are a biomedical equipment maintenance specialist.
    Equipment: ${equipment.name} (${equipment.type})
    Serial: ${equipment.serialNumber}
    Current status: ${equipment.status}
    Last serviced: ${equipment.lastMaintenanceDate || 'Unknown'}
    Recent maintenance logs (last 5):
    ${logsContext || 'No logs available'}
    
    Predict maintenance needs for this equipment.
    Return ONLY this JSON, no explanation, no markdown:
    {
      "predictedNextService": "<date string YYYY-MM-DD>",
      "confidenceLevel": "HIGH" | "MEDIUM" | "LOW",
      "predictedIssues": ["<issue 1 max 10 words>", "<issue 2 max 10 words>"],
      "recommendedActions": ["<action 1 max 15 words>", "<action 2 max 15 words>"],
      "urgency": "IMMEDIATE" | "SCHEDULED" | "ROUTINE",
      "reasoning": "<max 30 words plain English>"
    }
  `;
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error('No API Key');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" }});

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    
    if (!parsed.predictedNextService || !parsed.urgency) {
      throw new Error('Invalid shape');
    }
    return parsed;
  } catch (err) {
    console.error('[AI predictMaintenance failed]', err.message);
    return {
      predictedNextService: null,
      confidenceLevel: 'LOW',
      predictedIssues: [],
      recommendedActions: ['Manual review recommended'],
      urgency: 'ROUTINE',
      reasoning: 'Insufficient data for AI prediction.',
      fallback: true
    };
  }
};
