require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const resetAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medisync');
    console.log('Connected to MongoDB');

    let admin = await User.findOne({ email: 'admin@medisync.com' });
    
    if (admin) {
      console.log('Admin user found, resetting password...');
      // By resetting the password field and saving, the Mongoose schema 'pre' save hook
      // will trigger and encrypt 'Admin@123'
      admin.password = 'Admin@123';
      await admin.save();
      console.log('Password reset successfully!');
    } else {
      console.log('Admin user not found, creating one...');
      admin = new User({
        name: 'System Admin',
        email: 'admin@medisync.com',
        password: 'Admin@123',
        role: 'admin',
        isApproved: true
      });
      await admin.save();
      console.log('Admin user created successfully!');
    }

    console.log('Login -> admin@medisync.com');
    console.log('Password -> Admin@123');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

resetAdmin();
