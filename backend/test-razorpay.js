require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function testRazorpay() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', userSchema, 'users');

    // Check if users exist
    const userCount = await User.countDocuments();
    console.log(`📊 Total users in database: ${userCount}`);

    if (userCount === 0) {
      console.log('❌ No users found. Creating a test user...');
      const testUser = await User.create({
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'user',
        walletBalance: 0,
        createdAt: new Date()
      });
      console.log('✅ Test user created:', testUser._id);
      var userId = testUser._id;
    } else {
      const firstUser = await User.findOne();
      console.log(`✅ Found user: ${firstUser._id} (${firstUser.email})`);
      var userId = firstUser._id;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: userId.toString(), role: 'user' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );
    console.log('✅ Generated JWT token');

    // Test Razorpay endpoint
    const response = await axios.post(
      'http://localhost:5000/api/users/razorpay/create-order',
      { amount: 50000 }, // 500 INR in paise
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Razorpay endpoint response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

testRazorpay();
