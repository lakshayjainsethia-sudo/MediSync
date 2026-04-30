const axios = require('axios');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Mock in-memory queue for demonstration. 
// In production, this would be Redis or MongoDB.
let liveQueue = [];

/**
 * Controller strictly for Triage actions. It communicates with the FastAPI Intelligence Engine.
 */
class TriageController {

  /**
   * Evaluates patient vitals using FastAPI and adds them to a weighted live queue.
   */
  evaluateAndQueuePatient = asyncHandler(async (req, res) => {
    const { patientId, vitals } = req.body;
    
    if (!vitals) {
        throw new ApiError(400, 'Vitals are required for triage evaluation');
    }

    // 1. Inter-Service Communication: Call the FastAPI Intelligence Engine
    const fastApiUrl = process.env.INTELLIGENCE_ENGINE_URL || 'http://localhost:8000';
    let triageResult;
    try {
        const response = await axios.post(`${fastApiUrl}/triage`, vitals);
        triageResult = response.data; // { priorityLevel, urgencyText, recommendedAction }
    } catch (error) {
        console.error("Failed to connect to Intelligence Engine:", error.message);
        throw new ApiError(503, 'Intelligence Engine is currently unavailable');
    }

    // 2. Weighted Queue Logic
    // Emergency tokens (Level 1-2) must automatically jump to the top of the queue.
    const newQueueEntry = {
        tokenId: `TKN-${Math.floor(Math.random() * 10000)}`,
        patientId,
        priorityLevel: triageResult.priorityLevel,
        urgencyText: triageResult.urgencyText,
        arrivalTime: new Date().toISOString()
    };

    if (triageResult.priorityLevel <= 2) {
        // High priority: Unshift directly to the start
        liveQueue.unshift(newQueueEntry);
    } else {
        // Normal priority: Push to the end
        // A more advanced queue would sort by priorityLevel iteratively
        liveQueue.push(newQueueEntry);
        liveQueue.sort((a, b) => a.priorityLevel - b.priorityLevel);
    }

    // 3. Return JSON standardized response
    res.status(200).json({
        success: true,
        message: 'Patient evaluated and added to live queue successfully',
        data: {
             triageResult,
             queuePosition: liveQueue.findIndex(q => q.tokenId === newQueueEntry.tokenId) + 1,
             assignedToken: newQueueEntry.tokenId,
             currentQueue: liveQueue // Returning for frontend display purposes in this demo
        }
    });
  });
  
  // Method to fetch the current queue
  getLiveQueue = asyncHandler(async (req, res) => {
      res.status(200).json({
          success: true,
          data: liveQueue,
          message: 'Retrieved live queue successfully'
      });
  });
}

module.exports = new TriageController();
