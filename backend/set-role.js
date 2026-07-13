// set-role.js
// Usage: node set-role.js <email> <role>
// Roles: client | listener | therapist | admin
require('dotenv').config();
const { connectDB, closeDB, getDB } = require('./config/database');

const email = process.argv[2];
const role  = process.argv[3];

const VALID_ROLES = ['client', 'listener', 'therapist', 'admin'];

if (!email || !role) {
  console.error('Usage: node set-role.js <email> <role>');
  console.error('Valid roles:', VALID_ROLES.join(', '));
  process.exit(1);
}

if (!VALID_ROLES.includes(role)) {
  console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

async function setRole() {
  try {
    await connectDB();
    const db = getDB();
    const users = db.collection('users');

    const result = await users.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { role, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      console.error(`❌ No user found with email: ${email}`);
    } else {
      console.log(`✅ Role updated!`);
      console.log(`   Email : ${result.email}`);
      console.log(`   Name  : ${result.name}`);
      console.log(`   Role  : ${result.role}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await closeDB();
  }
}

setRole();
