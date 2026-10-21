const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '..', 'atlas-credentials.env') });
}

const connectDB = require('../config/db');
const CommunityContent = require('../models/CommunityContent');
const examples = require('../data/communityContentExamples');

async function seedCommunityContentExamples() {
  const connection = await connectDB();
  if (!connection) {
    throw new Error('Could not connect to MongoDB; no community content was saved.');
  }

  let added = 0;
  let alreadyPresent = 0;

  try {
    for (const example of examples) {
      const existing = await CommunityContent.findOne({
        type: example.type,
        title: example.title
      }).select('_id');

      if (existing) {
        alreadyPresent += 1;
        continue;
      }

      await CommunityContent.create(example);
      added += 1;
    }

    console.log(`Community examples added: ${added}; matching records already present: ${alreadyPresent}.`);
    console.log('Published examples are returned by the resident content API; drafts remain admin-only.');
  } finally {
    await connection.disconnect();
  }
}

seedCommunityContentExamples().catch(error => {
  console.error(`Community content examples were not fully applied: ${error.message}`);
  process.exitCode = 1;
});
