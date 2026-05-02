const { GoogleGenerativeAI } = require("@google/generative-ai");
const aiBillingService = require('../services/aiBillingService');
const aiService = require('../services/aiService'); // For existing suggestSymptoms / analyzeSymptoms logic if abstracted, but moving it here as requested.
const Appointment = require('../models/Appointment');

// Full File: controllers/aiController.js
const getTriage = async (req, res) => {
  try {
    const { symptoms } = req.body;
    
    if (!symptoms) {
      return res.status(400).json({ message: "Symptoms are required for triage analysis" });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not configured. Returning default triage.');
      return res.json({ 
        aiPriority: "Medium", 
        aiSuggestedDept: "General", 
        aiConfidence: 0, 
        aiReasoning: "No AI summary available.", 
        aiRedFlags: [] 
      });
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

    const triageResult = {
      aiPriority: data.aiPriority || "Medium",
      aiSuggestedDept: data.aiSuggestedDept || "General",
      aiConfidence: typeof data.aiConfidence === 'number' ? data.aiConfidence : 50,
      aiReasoning: data.aiReasoning || "Symptoms analyzed.",
      aiRedFlags: Array.isArray(data.aiRedFlags) ? data.aiRedFlags : []
    };

    res.json(triageResult);
  } catch (error) {
    console.error('AI Triage Error:', error);
    res.status(500).json({ 
      message: 'Error in AI processing.',
      aiPriority: "Medium", 
      aiSuggestedDept: "General", 
      aiConfidence: 0, 
      aiReasoning: "Fallback triggered due to error.", 
      aiRedFlags: [] 
    });
  }
};

const suggestSymptoms = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json([]);
    
    // Defer to aiService cache & fetch if you kept it, otherwise inline here
    // Inlining for simplicity if moving away from aiService
    const suggestions = await aiService.suggestSymptoms(query);
    res.json(suggestions);
  } catch (error) {
    console.error('Symptom suggest route error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const recommendSlot = async (req, res) => {
  try {
    const { doctorId, symptoms, aiPriority } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return res.json([
        new Date(tomorrow.setHours(9, 0, 0, 0)).toISOString(),
        new Date(tomorrow.setHours(11, 0, 0, 0)).toISOString(),
        new Date(tomorrow.setHours(14, 0, 0, 0)).toISOString()
      ]);
    }

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const existingAppointments = await Appointment.find({
      doctor: doctorId,
      date: { $gte: new Date(), $lte: nextWeek },
      status: { $ne: 'cancelled' }
    }).select('date startTime endTime').lean();

    const occupiedTimes = existingAppointments.map(a => 
      `${a.date.toISOString().split('T')[0]} from ${a.startTime} to ${a.endTime}`
    ).join(', ');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Given a doctor has appointments at these times: [${occupiedTimes}], and a new patient has priority: '${aiPriority}' with symptoms: '${symptoms}', suggest the 3 best available 1-hour appointment slots in the next 7 days (business hours 9 AM to 5 PM). 
For High priority, suggest earliest possible slots avoiding exact overlaps with the occupied times.
Today is ${new Date().toISOString().split('T')[0]}.
Return ONLY a JSON array of 3 ISO datetime strings representing the start times of the suggested slots. No additional text.`;

    const result = await model.generateContent(prompt);
    let slots = JSON.parse(result.response.text());

    res.json(slots);
  } catch (error) {
    console.error('Recommend slot route error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const suggestBillingItems = async (req, res) => {
  try {
    const { symptoms, aiSuggestedDept, aiPriority, doctorSpecialisation } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY missing - returning dummy billing items');
      return res.json([
        { description: 'Consultation Fee', quantity: 1, unitPrice: 500 },
        { description: 'General Checkup', quantity: 1, unitPrice: 300 }
      ]);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    let sympText = Array.isArray(symptoms) ? symptoms.join(', ') : symptoms;
    if (!sympText) sympText = "General visit";

    const prompt = `You are a hospital billing assistant for an Indian hospital. 
A patient visited with symptoms: ${sympText}, department: ${aiSuggestedDept || 'General'}, priority: ${aiPriority || 'Normal'}, doctor specialisation: ${doctorSpecialisation || 'General Physician'}.
Suggest realistic line items for their hospital bill.
Return ONLY a JSON array, no explanation:
[{ "description": "string", "quantity": number, "unitPrice": number }]
Use Indian Rupee pricing. Max 6 items. Be specific and realistic.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse Gemini billing response:', text);
      return res.status(500).json({ message: 'Invalid AI response format' });
    }

    // Output schema validation
    if (!Array.isArray(data)) {
      return res.status(500).json({ message: 'AI response was not an array' });
    }

    const validItems = data.filter(item => {
      return (
        item && 
        typeof item.description === 'string' &&
        item.description.trim() !== '' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0 &&
        typeof item.unitPrice === 'number' &&
        item.unitPrice >= 0
      );
    }).slice(0, 6);

    res.json(validItems);

  } catch (error) {
    console.error('Billing suggestions route error:', error);
    res.status(500).json({ message: 'Server Error generating billing suggestions' });
  }
};

const auditBilling = async (req, res) => {
  try {
    const { treatmentSummary, items, patientHistory, totalBillSize } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "items array is required" });
    }

    const auditData = await aiBillingService.auditBill(treatmentSummary, items, patientHistory, totalBillSize);
    res.json(auditData);
  } catch (err) {
    console.error('Audit Billing error:', err);
    res.status(500).json({ message: 'Server Error during AI audit' });
  }
};

const Equipment = require('../models/Equipment');

const analyzePrescription = async (req, res) => {
  try {
    const { prescription, patientAge, existingConditions } = req.body;
    if (!prescription) {
      return res.status(400).json({ message: "Prescription is required" });
    }
    const result = await aiService.analyzePrescription(prescription, patientAge, existingConditions);
    
    // Attempt audit log if appointmentId is present (optional)
    if (req.body.appointmentId) {
      const { logAudit } = require('../utils/auditLogger');
      await logAudit('PRESCRIPTION_ANALYZED', req, req.body.appointmentId, 'Appointment', { overallSafe: result.overallSafe });
    }

    res.json(result);
  } catch (error) {
    console.error('Analyze prescription route error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const predictMaintenance = async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.equipmentId);
    if (!equipment) return res.status(404).json({ message: 'Equipment not found' });

    const result = await aiService.predictMaintenance(equipment);

    const { logAudit } = require('../utils/auditLogger');
    await logAudit('MAINTENANCE_PREDICTED', req, equipment._id, 'Equipment', { 
      urgency: result.urgency, 
      predictedNextService: result.predictedNextService 
    });

    res.json(result);
  } catch (error) {
    console.error('Predict maintenance route error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getTriage,
  suggestSymptoms,
  recommendSlot,
  suggestBillingItems,
  auditBilling,
  analyzePrescription,
  predictMaintenance
};
