const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDb() {
  try {
    await mongoose.connect(env.MONGODB_URI);
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    throw error;
  }
}

module.exports = { mongoose, connectDb };
