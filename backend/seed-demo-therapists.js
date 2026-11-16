require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { MongoClient } = require('mongodb');

const demoProfiles = [
  ['Aarav Mehta', 'CBT and anxiety support', ['Anxiety', 'CBT', 'Stress'], 'Anxiety can feel loud; starting with one thing you can influence today may make the next step clearer.'],
  ['Nisha Rao', 'Relationships and life transitions', ['Relationships', 'Stress', 'Mindfulness'], 'Curiosity about what each person needs can make a difficult conversation feel more open.'],
  ['Kabir Shah', 'Trauma-informed support', ['Trauma', 'Anxiety', 'Sleep'], 'Moving at a pace that feels safe is part of building a sense of choice.'],
  ['Riya Menon', 'Mood and depression support', ['Depression', 'Anxiety', 'CBT'], 'You do not have to solve everything at once; one manageable step can be enough for today.'],
  ['Arjun Iyer', 'Work stress and burnout', ['Stress', 'Anxiety', 'Mindfulness'], 'Rest is part of caring for your energy, not something you have to earn.'],
  ['Sana Kapoor', 'Relationships and self-esteem', ['Relationships', 'Depression', 'Stress'], 'Clear boundaries can leave more room for honesty and connection.'],
  ['Devika Nair', 'Grief and life changes', ['Grief', 'Depression', 'Mindfulness'], 'Grief can come in waves; there is no single timetable for finding your footing.'],
  ['Farhan Ali', 'Anxiety and coping skills', ['Anxiety', 'CBT', 'Sleep'], 'A thought can feel convincing without being the whole story; pausing can make room for another view.'],
  ['Meera Sethi', 'Trauma and emotional wellbeing', ['Trauma', 'Relationships', 'Anxiety'], 'Support can follow your sense of safety and readiness, one step at a time.'],
  ['Karan Malhotra', 'Habits, focus and stress', ['Stress', 'CBT', 'Sleep'], 'Small routines can reduce decision fatigue and make a hard day feel more manageable.'],
  ['Priya Das', 'Depression and self-compassion', ['Depression', 'Mindfulness', 'Relationships'], 'Self-compassion can be a gentler place to begin again.'],
  ['Ananya Bose', 'Young adult wellbeing', ['Anxiety', 'Relationships', 'Stress'], 'Growing into adulthood can include learning what fits you, beyond others’ expectations.'],
  ['Vikram Joshi', 'Confidence and life transitions', ['Stress', 'Depression', 'CBT'], 'Confidence can grow through small, repeated acts of trust in yourself.'],
  ['Isha Kulkarni', 'Anxiety and grounding skills', ['Anxiety', 'Trauma', 'Mindfulness'], 'Grounding can begin with noticing one breath or one detail around you.'],
  ['Rehan Mirza', 'Relationships and communication', ['Relationships', 'Stress', 'CBT'], 'Listening to understand can open a different path through a disagreement.'],
  ['Tara Banerjee', 'Sleep and mood support', ['Sleep', 'Depression', 'Anxiety'], 'A steadier wind-down routine can help signal that the day is slowing down.'],
].map(([name, focus, specialties, reflection], index) => ({
  seedKey: `mannmate-demo-therapist-${String(index + 1).padStart(2, '0')}`,
  isDemo: true,
  name,
  title: focus,
  description: reflection,
  credentials: 'Fictional sample profile — credentials not verified',
  specialties,
  experience: '',
  pricePerMin: 0,
  rating: 0,
  googleCalendarConnected: false,
  availability: {},
  updatedAt: new Date(),
}));

async function seedDemoTherapists() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from backend/.env');
  }

  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    const collection = client.db('stressrelief').collection('therapists');
    const operations = demoProfiles.map((profile) => ({
      updateOne: {
        filter: { seedKey: profile.seedKey },
        update: {
          $set: {
            ...profile,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    }));

    const result = await collection.bulkWrite(operations, { ordered: true });
    const totalDemoProfiles = await collection.countDocuments({ isDemo: true });
    console.log(`Seeded ${demoProfiles.length} demo therapist profiles (${result.upsertedCount} added, ${result.modifiedCount} refreshed).`);
    console.log(`${totalDemoProfiles} demo profiles are now stored in MongoDB and will remain after restarts.`);
  } finally {
    await client.close();
  }
}

seedDemoTherapists().catch((error) => {
  console.error('Could not seed demo therapists:', error.message);
  process.exitCode = 1;
});
