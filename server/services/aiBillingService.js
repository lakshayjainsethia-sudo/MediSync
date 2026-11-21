const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateJson } = require('./ollamaService');

/**
 * AI Revenue Auditor & Discount Optimizer
 * Uses local Ollama LLM with fallback to Gemini.
 */
const auditBill = async (treatmentSummary, items, patientHistory, totalBillSize) => {
  const itemsText = items.map(i => `${i.description} (Qty: ${i.quantity}, Price: ${i.unitPrice})`).join(', ');

  const prompt = `You are the Lead Medical Revenue Auditor at MediSync Hospital.
A patient is being billed. 
Treatment Summary / Symptoms: ${treatmentSummary || 'General consultation'}
Current Line Items: ${itemsText}
Patient History: ${patientHistory || 'No special history'}
Total Bill Size: Rs. ${totalBillSize}

Task 1: Check for "Revenue Leakage". For example, if a patient had a 'Surgery' but 'Anesthesia' wasn't billed, suggest it.
Task 2: Suggest financial assistance or discounts if the total bill size is huge, or patient history dictates care packages.
Task 3: Provide a brief billing summary.

Return ONLY a JSON object in this exact schema without markdown fences:
{
  "flaggedItems": ["string"],
  "suggestedAdditions": ["string"],
  "billingSummary": "string"
}
Output valid JSON only.`;

  // Primary: Ollama
  try {
    const data = await generateJson(prompt);
    if (data && typeof data === 'object') {
      return {
        flaggedItems: Array.isArray(data.flaggedItems) ? data.flaggedItems : [],
        suggestedAdditions: Array.isArray(data.suggestedAdditions) ? data.suggestedAdditions : [],
        billingSummary: data.billingSummary || "Audit completed via MediSync AI."
      };
    }
  } catch (ollamaErr) {
    console.warn('[auditBill] Ollama fallback:', ollamaErr.message);
  }

  // Secondary: Gemini Fallback
  try {
    if (process.env.GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      let data = JSON.parse(text);
      if (!data.flaggedItems) data.flaggedItems = [];
      if (!data.suggestedAdditions) data.suggestedAdditions = [];
      if (!data.billingSummary) data.billingSummary = "Audit completed.";
      return data;
    }
  } catch(err) {
    console.error('Failed to parse Gemini billing audit response:', err.message);
  }

  return {
    flaggedItems: [],
    suggestedAdditions: [],
    billingSummary: "Audit completed."
  };
};

module.exports = {
  auditBill
};
