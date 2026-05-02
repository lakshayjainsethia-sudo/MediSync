require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const checkAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medisync');
    const admin = await User.findOne({ email: 'admin@medisync.com' });
    console.log('Admin user:', admin);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkAdmin();
