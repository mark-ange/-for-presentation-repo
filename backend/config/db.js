const mongoose = require('mongoose');
const dns = require('dns');

const configuredDnsServers = process.env.MONGO_DNS_SERVERS
  ?.split(',')
  .map((server) => server.trim())
  .filter(Boolean);
if (configuredDnsServers?.length) {
  dns.setServers(configuredDnsServers);
}

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    console.error('MongoDB connection unavailable: MONGO_URI is not configured.');
    return null;
  }

  try {
    console.log('🔗 Attempting MongoDB connection...');
    const conn = await mongoose.connect(mongoURI, {
      dbName: process.env.MONGO_DATABASE || 'citycare_db',
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`⚠️ MongoDB Connection Error: ${error.message}`);
    console.log('');
    console.log('🔧 Verify MONGO_URI, Atlas network access, and the database password.');
    return null;
  }
};

module.exports = connectDB;
