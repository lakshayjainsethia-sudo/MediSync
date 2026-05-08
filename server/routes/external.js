const express = require('express');
const axios = require('axios');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roleCheck');

// Normalization function to handle messy OpenFDA data
const normalizeDrug = (data) => {
  return {
    name: data.openfda?.generic_name?.[0] || data.openfda?.brand_name?.[0] || "Unknown",
    manufacturer: data.openfda?.manufacturer_name?.[0] || "Unknown",
    purpose: data.purpose?.[0] || data.indications_and_usage?.[0] || "N/A"
  };
};

// @route   GET /api/external/medicines
// @desc    Fetch and normalize medicine data from OpenFDA
// @access  Protected (admin, pharmacist)
router.get('/medicines', protect, authorizeRoles('Admin', 'admin', 'Pharmacist', 'pharmacist'), async (req, res) => {
  try {
    const { search } = req.query;
    
    if (!search) {
      return res.status(400).json({ message: 'Search term is required' });
    }

    // Call OpenFDA API
    const response = await axios.get(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${search}"+openfda.brand_name:"${search}"&limit=10`);
    
    if (!response.data || !response.data.results || response.data.results.length === 0) {
      return res.status(404).json({ message: 'No medicine found in OpenFDA' });
    }

    // Normalize results
    const normalizedResults = response.data.results.map(normalizeDrug);
    
    // Remove duplicates based on generic name
    const uniqueResults = [];
    const seen = new Set();
    
    for (const drug of normalizedResults) {
      const lowerName = drug.name.toLowerCase();
      if (!seen.has(lowerName)) {
        seen.add(lowerName);
        uniqueResults.push(drug);
      }
    }

    res.json(uniqueResults);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ message: 'No medicine found in OpenFDA' });
    }
    console.error('Error fetching from OpenFDA:', err.message);
    res.status(500).send('Server Error fetching external data');
  }
});

module.exports = router;
