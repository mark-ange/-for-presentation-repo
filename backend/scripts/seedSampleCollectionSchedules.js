const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '..', 'atlas-credentials.env') });
}

const connectDB = require('../config/db');
const Schedule = require('../models/Schedule');
const sampleSchedules = require('../data/sampleCollectionSchedules');

async function seedSampleCollectionSchedules() {
  const connection = await connectDB();
  if (!connection) {
    throw new Error('Could not connect to MongoDB; sample schedules were not saved.');
  }

  let added = 0;
  let alreadyPresent = 0;

  try {
    for (const sample of sampleSchedules) {
      const normalizedBarangay = sample.barangay.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await Schedule.findOne({
        barangay: new RegExp(`^${normalizedBarangay}$`, 'i')
      });

      if (!existing) {
        await Schedule.create(sample);
        added += 1;
        continue;
      }

      const hasSampleFallback = existing.areaSchedules.some(areaSchedule =>
        areaSchedule.appliesToAllAreas &&
        areaSchedule.isSample &&
        areaSchedule.areaName === 'Barangay-wide sample route'
      );
      if (hasSampleFallback) {
        alreadyPresent += 1;
        continue;
      }

      existing.areaSchedules.push(sample.areaSchedules[0]);
      await existing.save();
      added += 1;
    }

    console.log(`Sample-only schedules added: ${added}; already present: ${alreadyPresent}.`);
  } finally {
    await connection.disconnect();
  }
}

seedSampleCollectionSchedules().catch(error => {
  console.error(`Sample schedules were not fully applied: ${error.message}`);
  process.exitCode = 1;
});
