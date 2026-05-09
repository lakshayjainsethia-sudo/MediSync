const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Medicine = mongoose.models.Medicine || require('../models/Medicine');
const Equipment = mongoose.models.Equipment || require('../models/Equipment');

const MED_CATEGORIES = ['Analgesic', 'Antibiotic', 'Antiseptic', 'Hormone', 'Antipyretic'];
const EQUIP_CATEGORIES = ['Diagnostic', 'Life Support', 'Surgical', 'Monitoring', 'Other'];

const REALISTIC_EQUIPMENT_NAMES = [
  'Ventilator — Hamilton-G5',
  'MRI Scanner — GE Signa',
  'Defibrillator — Philips HeartStart',
  'Patient Monitor — Mindray BeneVision',
  'Infusion Pump — Alaris System',
  'Ultrasound — Philips Epiq 7',
  'Anesthesia Machine — Dräger Fabius',
  'ECG Machine — MAC 2000',
  'X-Ray — Siemens Mobilett',
  'Surgical Light — Steris Harmony',
  'Incubator — GE Giraffe',
  'CPAP Machine — ResMed AirSense',
  'Pulse Oximeter — Masimo Radical-7',
  'Dialysis Machine — Fresenius 5008',
  'Centrifuge — Eppendorf 5425',
  'Autoclave — Tuttnauer',
  'Endoscopy Tower — Olympus EVIS EXERA III',
  'Suction Pump — Laerdal LSU',
  'Defibrillator — Zoll X Series',
  'Electrosurgical Unit — Valleylab LS10'
];

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
  name: REALISTIC_EQUIPMENT_NAMES[i] || `Equipment ${i + 1}`,
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

    const resultMed = await Medicine.insertMany(medicinesData);
    const resultEq = await Equipment.insertMany(equipmentData);
    console.log('Inserted new inventory data...');
    
    console.log(`Inserted Medicine IDs: ${resultMed.map(r => r._id).join(', ')}`);
    console.log(`Inserted Equipment IDs: ${resultEq.map(r => r._id).join(', ')}`);

    console.log('Seed completed successfully!');
    process.exit();
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
};

seedDB();
