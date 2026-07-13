const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

(async () => {
  let client;
  try {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db();

    let user = await db.collection('users').findOne({});

    if (!user) {
      console.log('Creating test user...');
      const result = await db.collection('users').insertOne({
        name: 'Test User',
        email: 'test@example.com',
        role: 'client',
        emailVerified: true,
        walletBalance: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      user = await db.collection('users').findOne({ _id: result.insertedId });
      console.log('✅ Test user created');
    }

    console.log('✅ User found:', user.email);

    const token = jwt.sign(
      { email: user.email, userId: user._id.toString() },
      'your-secret-key-change-this-in-production'
    );

    console.log('\n✅ Generated Token:');
    console.log(token);

  } catch(e) {
    console.error('❌ Error:', e.message);
  } finally {
    if (client) await client.close();
  }
})();
