const mongoose = require('mongoose');
const dns = require('dns');

const configuredDnsServers = process.env.MONGO_DNS_SERVERS
  ?.split(',')
  .map((server) => server.trim())
  .filter(Boolean);
if (configuredDnsServers?.length) {
  dns.setServers(configuredDnsServers);
}

const getMongoUri = () => {
  const mongoURI = process.env.MONGO_URI
    || process.env.MONGODB_URI
    || process.env.MONGO_URI_DIRECT
    || process.env.MONGODB_URI_DIRECT;

  if (!mongoURI || mongoURI.includes('<db_username>') || mongoURI.includes('******')) {
    return null;
  }

  return mongoURI;
};

const connectDB = async () => {
  const mongoURI = getMongoUri();
  if (!mongoURI) {
    console.error('MongoDB connection unavailable: no valid MONGO_URI or MONGODB_URI is configured.');
    return null;
  }

  try {
    console.log('🔗 Attempting MongoDB connection...');
    const conn = await mongoose.connect(mongoURI, {
      dbName: process.env.MONGO_DATABASE || 'citycare_db',
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`⚠️ MongoDB Connection Error: ${error.message}`);
    console.log('');
    console.log('🔧 Verify the MongoDB URI, Atlas network access, and the database password.');
    return null;
  }
};

module.exports = connectDB;
