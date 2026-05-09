const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');

const medicines = [
  // Analgesics
  { name:'Paracetamol', category:'Tablet', unit:'tablets', unitPrice:2, currentStock:500, minimumThreshold:100, manufacturer:'GSK', description:'Fever and pain relief' },
  { name:'Ibuprofen', category:'Tablet', unit:'tablets', unitPrice:5, currentStock:300, minimumThreshold:50, manufacturer:'Abbott', description:'Anti-inflammatory' },
  { name:'Aspirin', category:'Tablet', unit:'tablets', unitPrice:3, currentStock:250, minimumThreshold:50, manufacturer:'Bayer', description:'Antiplatelet, pain relief' },
  { name:'Diclofenac', category:'Tablet', unit:'tablets', unitPrice:6, currentStock:200, minimumThreshold:40, manufacturer:'Novartis', description:'NSAID for inflammation' },
  { name:'Tramadol', category:'Capsule', unit:'capsules', unitPrice:15, currentStock:150, minimumThreshold:30, manufacturer:'Grunenthal', description:'Moderate to severe pain' },

  // Antibiotics
  { name:'Amoxicillin', category:'Capsule', unit:'capsules', unitPrice:12, currentStock:300, minimumThreshold:60, manufacturer:'Cipla', description:'Broad-spectrum antibiotic' },
  { name:'Azithromycin', category:'Tablet', unit:'tablets', unitPrice:28, currentStock:200, minimumThreshold:40, manufacturer:'Pfizer', description:'Respiratory infections' },
  { name:'Ciprofloxacin', category:'Tablet', unit:'tablets', unitPrice:18, currentStock:180, minimumThreshold:35, manufacturer:'Bayer', description:'UTI and GI infections' },
  { name:'Metronidazole', category:'Tablet', unit:'tablets', unitPrice:8, currentStock:220, minimumThreshold:40, manufacturer:'Alkem', description:'Antibiotic antiprotozoal' },
  { name:'Doxycycline', category:'Capsule', unit:'capsules', unitPrice:14, currentStock:160, minimumThreshold:30, manufacturer:'Pfizer', description:'Tetracycline antibiotic' },
  { name:'Cephalexin', category:'Capsule', unit:'capsules', unitPrice:16, currentStock:140, minimumThreshold:28, manufacturer:'Sun Pharma', description:'Cephalosporin antibiotic' },
  { name:'Clindamycin', category:'Capsule', unit:'capsules', unitPrice:22, currentStock:100, minimumThreshold:20, manufacturer:'Pfizer', description:'Anaerobic infections' },

  // Antihypertensives
  { name:'Amlodipine', category:'Tablet', unit:'tablets', unitPrice:5, currentStock:400, minimumThreshold:80, manufacturer:'Pfizer', description:'Calcium channel blocker' },
  { name:'Atenolol', category:'Tablet', unit:'tablets', unitPrice:4, currentStock:350, minimumThreshold:70, manufacturer:'AstraZeneca', description:'Beta blocker' },
  { name:'Losartan', category:'Tablet', unit:'tablets', unitPrice:10, currentStock:280, minimumThreshold:55, manufacturer:'Merck', description:'ARB for hypertension' },
  { name:'Ramipril', category:'Capsule', unit:'capsules', unitPrice:9, currentStock:240, minimumThreshold:45, manufacturer:'Sanofi', description:'ACE inhibitor' },
  { name:'Metoprolol', category:'Tablet', unit:'tablets', unitPrice:7, currentStock:300, minimumThreshold:60, manufacturer:'AstraZeneca', description:'Selective beta-1 blocker' },

  // Diabetes
  { name:'Metformin', category:'Tablet', unit:'tablets', unitPrice:4, currentStock:500, minimumThreshold:100, manufacturer:'Merck', description:'Type 2 diabetes' },
  { name:'Glimepiride', category:'Tablet', unit:'tablets', unitPrice:8, currentStock:200, minimumThreshold:40, manufacturer:'Sanofi', description:'Sulfonylurea' },
  { name:'Insulin Regular', category:'Injection', unit:'vials', unitPrice:180, currentStock:50, minimumThreshold:15, manufacturer:'Novo Nordisk', description:'Short-acting insulin' },
  { name:'Levothyroxine', category:'Tablet', unit:'tablets', unitPrice:6, currentStock:250, minimumThreshold:50, manufacturer:'Abbott', description:'Thyroid replacement' },

  // Gastrointestinal
  { name:'Omeprazole', category:'Capsule', unit:'capsules', unitPrice:8, currentStock:400, minimumThreshold:80, manufacturer:'AstraZeneca', description:'Proton pump inhibitor' },
  { name:'Pantoprazole', category:'Tablet', unit:'tablets', unitPrice:10, currentStock:350, minimumThreshold:70, manufacturer:'Pfizer', description:'GERD and peptic ulcer' },
  { name:'Domperidone', category:'Tablet', unit:'tablets', unitPrice:5, currentStock:300, minimumThreshold:60, manufacturer:'Janssen', description:'Antiemetic' },
  { name:'Ondansetron', category:'Tablet', unit:'tablets', unitPrice:12, currentStock:200, minimumThreshold:40, manufacturer:'GSK', description:'Nausea and vomiting' },
  { name:'Loperamide', category:'Capsule', unit:'capsules', unitPrice:7, currentStock:180, minimumThreshold:35, manufacturer:'Janssen', description:'Antidiarrheal' },
  { name:'Lactulose Syrup', category:'Syrup', unit:'bottles', unitPrice:95, currentStock:60, minimumThreshold:15, manufacturer:'Abbott', description:'Osmotic laxative' },

  // Respiratory
  { name:'Salbutamol Inhaler', category:'Inhaler', unit:'units', unitPrice:120, currentStock:80, minimumThreshold:20, manufacturer:'3M Pharma', description:'Bronchodilator' },
  { name:'Budesonide Inhaler', category:'Inhaler', unit:'units', unitPrice:280, currentStock:50, minimumThreshold:15, manufacturer:'AstraZeneca', description:'Inhaled corticosteroid' },
  { name:'Montelukast', category:'Tablet', unit:'tablets', unitPrice:18, currentStock:200, minimumThreshold:40, manufacturer:'Merck', description:'Asthma and allergies' },
  { name:'Cetirizine', category:'Tablet', unit:'tablets', unitPrice:4, currentStock:350, minimumThreshold:70, manufacturer:'UCB', description:'Antihistamine' },
  { name:'Dextromethorphan Syrup', category:'Syrup', unit:'bottles', unitPrice:75, currentStock:90, minimumThreshold:20, manufacturer:'Pfizer', description:'Cough suppressant' },

  // Cardiovascular
  { name:'Atorvastatin', category:'Tablet', unit:'tablets', unitPrice:9, currentStock:400, minimumThreshold:80, manufacturer:'Pfizer', description:'Cholesterol management' },
  { name:'Rosuvastatin', category:'Tablet', unit:'tablets', unitPrice:14, currentStock:280, minimumThreshold:55, manufacturer:'AstraZeneca', description:'Hyperlipidemia' },
  { name:'Clopidogrel', category:'Tablet', unit:'tablets', unitPrice:20, currentStock:200, minimumThreshold:40, manufacturer:'Sanofi', description:'Antiplatelet' },
  { name:'Digoxin', category:'Tablet', unit:'tablets', unitPrice:8, currentStock:120, minimumThreshold:25, manufacturer:'GSK', description:'Heart failure and AF' },
  { name:'Furosemide', category:'Tablet', unit:'tablets', unitPrice:5, currentStock:250, minimumThreshold:50, manufacturer:'Sanofi', description:'Loop diuretic' },
  { name:'Nitroglycerin', category:'Tablet', unit:'tablets', unitPrice:25, currentStock:100, minimumThreshold:20, manufacturer:'Pfizer', description:'Acute angina' },

  // Neurology
  { name:'Sertraline', category:'Tablet', unit:'tablets', unitPrice:18, currentStock:180, minimumThreshold:35, manufacturer:'Pfizer', description:'SSRI antidepressant' },
  { name:'Alprazolam', category:'Tablet', unit:'tablets', unitPrice:10, currentStock:100, minimumThreshold:20, manufacturer:'Pfizer', description:'Anxiety disorders' },
  { name:'Phenytoin', category:'Capsule', unit:'capsules', unitPrice:12, currentStock:150, minimumThreshold:30, manufacturer:'Pfizer', description:'Seizure management' },
  { name:'Levodopa+Carbidopa', category:'Tablet', unit:'tablets', unitPrice:22, currentStock:120, minimumThreshold:25, manufacturer:'Merck', description:'Parkinson disease' },

  // IV Fluids and Injections
  { name:'Normal Saline', category:'Injection', unit:'bags', unitPrice:45, currentStock:100, minimumThreshold:30, manufacturer:'Baxter', description:'IV hydration' },
  { name:'Ringer Lactate', category:'Injection', unit:'bags', unitPrice:50, currentStock:80, minimumThreshold:25, manufacturer:'Baxter', description:'Balanced IV fluid' },
  { name:'Dextrose', category:'Injection', unit:'bags', unitPrice:48, currentStock:75, minimumThreshold:20, manufacturer:'Fresenius', description:'IV glucose solution' },
  { name:'Morphine Sulphate', category:'Injection', unit:'ampoules', unitPrice:85, currentStock:40, minimumThreshold:10, manufacturer:'Hameln', description:'Severe pain relief' },
  { name:'Adrenaline', category:'Injection', unit:'ampoules', unitPrice:65, currentStock:30, minimumThreshold:10, manufacturer:'Pfizer', description:'Anaphylaxis emergency' },
  { name:'Atropine', category:'Injection', unit:'ampoules', unitPrice:55, currentStock:30, minimumThreshold:10, manufacturer:'Hameln', description:'Bradycardia treatment' },
  { name:'Heparin', category:'Injection', unit:'vials', unitPrice:120, currentStock:40, minimumThreshold:12, manufacturer:'Pfizer', description:'Anticoagulant DVT PE' },

  // Vitamins
  { name:'Vitamin D3', category:'Capsule', unit:'capsules', unitPrice:25, currentStock:300, minimumThreshold:60, manufacturer:'Abbott', description:'Vitamin D supplement' },
  { name:'Vitamin B12', category:'Tablet', unit:'tablets', unitPrice:15, currentStock:250, minimumThreshold:50, manufacturer:'Merck', description:'B12 deficiency' },
  { name:'Ferrous Sulphate', category:'Tablet', unit:'tablets', unitPrice:6, currentStock:300, minimumThreshold:60, manufacturer:'Abbott', description:'Iron for anaemia' },
  { name:'Calcium + Vitamin D', category:'Tablet', unit:'tablets', unitPrice:12, currentStock:280, minimumThreshold:55, manufacturer:'Pfizer', description:'Bone health' },
  { name:'Folic Acid', category:'Tablet', unit:'tablets', unitPrice:3, currentStock:400, minimumThreshold:80, manufacturer:'GSK', description:'Pregnancy and anaemia' },

  // Topicals
  { name:'Betamethasone Cream', category:'Ointment', unit:'tubes', unitPrice:55, currentStock:80, minimumThreshold:15, manufacturer:'GSK', description:'Topical corticosteroid' },
  { name:'Mupirocin Ointment', category:'Ointment', unit:'tubes', unitPrice:70, currentStock:60, minimumThreshold:12, manufacturer:'GSK', description:'Topical antibiotic' },
  { name:'Povidone Iodine', category:'Solution', unit:'bottles', unitPrice:45, currentStock:100, minimumThreshold:20, manufacturer:'Win Medicare', description:'Wound antiseptic' },
  { name:'Silver Sulfadiazine', category:'Ointment', unit:'tubes', unitPrice:90, currentStock:40, minimumThreshold:10, manufacturer:'Flammazine', description:'Burns treatment' }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected:', process.env.MONGO_URI);

    const existing = await Medicine.countDocuments();
    if (existing > 0) {
      console.log(`⚠ ${existing} medicines exist.`);
      console.log('Run this to clear first:');
      console.log('  db.medicines.deleteMany({})');
      console.log('Then rerun this script.');
      return;
    }

    // Add expiry date 1 year from now to all medicines
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    const seededData = medicines.map(m => ({
      name: m.name,
      category: m.category,
      unit: m.unit,
      price: m.unitPrice,
      stockQuantity: m.currentStock,
      minimumThreshold: m.minimumThreshold,
      manufacturer: m.manufacturer,
      description: m.description,
      expiryDate: oneYearFromNow
    }));

    const result = await Medicine.insertMany(seededData, { ordered: false });
    console.log(`✓ Inserted ${result.length} medicines`);
    console.log('Inserted IDs:', result.map(r => r._id).join(', '));
    console.log('\nCategories:');
    const cats = [...new Set(medicines.map(m => m.category))];
    cats.forEach(c => console.log(`  - ${c}`));

  } catch(err) {
    if (err.code === 11000) {
      console.error('✗ Duplicate key error:', err.message);
      console.error('Some medicines already exist.');
    } else {
      console.error('✗ Seed failed:', err.message);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Disconnected');
  }
}

seed();
