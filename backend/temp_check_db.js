const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb+srv://radhakrishna:stressrelif@cluster0.ukyk01e.mongodb.net/?appName=Cluster0');
  await client.connect();
  const db = client.db('stressrelief');
  const users = await db.collection('users').find({ role: 'therapist' }).toArray();
  console.log('Therapists:', users.map(u => ({ email: u.email, role: u.role, isAvailable: u.isAvailable })));

  const all = await db.collection('users').find({}).toArray();
  console.log('All Users:', all.map(u => ({ email: u.email, role: u.role })));

  await client.close();
}
run().catch(console.error);
