const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Medicine = require('../models/Medicine');
const Equipment = require('../models/Equipment');

dotenv.config();

const MED_CATEGORIES = ['Analgesic', 'Antibiotic', 'Antiseptic', 'Hormone', 'Antipyretic'];
const EQUIP_CATEGORIES = ['Diagnostic', 'Life Support', 'Surgical', 'Monitoring', 'Other'];

const generateRandomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const medicinesData = Array.from({ length: 50 }).map((_, i) => ({
  name: `Medicine ${i + 1}`,
  category: MED_CATEGORIES[Math.floor(Math.random() * MED_CATEGORIES.length)],
  stockQuantity: Math.floor(Math.random() * 500),
  price: parseFloat((Math.random() * 100).toFixed(2)),
  manufacturer: `PharmaCorp ${Math.floor(Math.random() * 5) + 1}`,
  batchNumber: `BAT-${Math.floor(Math.random() * 90000) + 10000}`,
  expiryDate: generateRandomDate(new Date(), new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000)),
  minimumThreshold: 50,
  unit: 'units'
}));

const equipmentData = Array.from({ length: 20 }).map((_, i) => ({
  name: `Equipment ${i + 1}`,
  serialNumber: `SN-${Math.floor(Math.random() * 900000) + 100000}`,
  type: 'Other', // Required by schema
  category: EQUIP_CATEGORIES[Math.floor(Math.random() * EQUIP_CATEGORIES.length)],
  unit: ['ICU', 'OT', 'Ward'][Math.floor(Math.random() * 3)],
  location: `Room ${Math.floor(Math.random() * 100) + 1}`,
  status: ['Active', 'Maintenance', 'Offline'][Math.floor(Math.random() * 3)]
}));

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    await Medicine.deleteMany();
    await Equipment.deleteMany();
    console.log('Cleared existing inventory data...');

    await Medicine.insertMany(medicinesData);
    await Equipment.insertMany(equipmentData);
    console.log('Inserted new inventory data...');

    console.log('Seed completed successfully!');
    process.exit();
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
};

seedDB();
