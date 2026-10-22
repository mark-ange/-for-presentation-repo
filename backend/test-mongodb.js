/**
 * Test the configured MongoDB connection.
 * Run from any directory with: node backend/test-mongodb.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const mongoURI = process.env.MONGO_URI
  || process.env.MONGODB_URI
  || process.env.MONGO_URI_DIRECT
  || process.env.MONGODB_URI_DIRECT;

if (!mongoURI || mongoURI.includes('<db_username>') || mongoURI.includes('******')) {
  console.error('MongoDB URI is not configured. Set MONGO_URI or MONGODB_URI in backend/.env.');
  process.exit(1);
}

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    const connection = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log('MongoDB connection test passed.');
    console.log(`Host: ${connection.connection.host}`);
    console.log(`Database: ${connection.connection.name}`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('MongoDB connection test failed:', error.message);
    process.exitCode = 1;
    await mongoose.disconnect();
  }
};

connectDB();
