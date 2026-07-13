const { getDB } = require('../config/database');

// Get user by email
const getUser = async (req, res, next) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');
    const { email } = req.params;

    const user = await usersCollection.findOne({ email: decodeURIComponent(email).toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const { _id, ...userData } = user;
    res.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    next(error);
  }
};

// Create or update user
const createOrUpdateUser = async (req, res, next) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');
    const { email } = req.params;
    const userData = req.body;

    // Never allow frontend sync to overwrite role — role is managed only by auth endpoints
    const { role, isAvailable, ...safeUserData } = userData;

    const normalizedEmail = decodeURIComponent(email).toLowerCase();
    const result = await usersCollection.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          ...safeUserData,
          email: normalizedEmail,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const { _id, ...user } = result || {};
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUser,
  createOrUpdateUser,
};








