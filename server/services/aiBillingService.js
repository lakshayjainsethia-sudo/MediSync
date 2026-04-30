const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * AI Revenue Auditor & Discount Optimizer
 * Ensures no revenue leakage and suggests optimization for billing.
 */
const auditBill = async (treatmentSummary, items, patientHistory, totalBillSize) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY missing - skipping AI check');
      return { 
        flaggedItems: [], 
        suggestedAdditions: [], 
        billingSummary: "No API key found. Skipping AI audit." 
      };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

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

Return ONLY a JSON object in this exact schema:
{
  "flaggedItems": ["string"],
  "suggestedAdditions": ["string"],
  "billingSummary": "string"
}
Output valid JSON only.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch(err) {
      console.error('Failed to parse Gemini billing audit response:', text);
      throw new Error('Invalid AI response format');
    }

    // Basic Structure Enforcement
    if (!data.flaggedItems) data.flaggedItems = [];
    if (!data.suggestedAdditions) data.suggestedAdditions = [];
    if (!data.billingSummary) data.billingSummary = "Audit completed.";

    return data;
  } catch (error) {
    console.error('Billing Audit Service Error:', error);
    throw error;
  }
};

module.exports = {
  auditBill
};
