const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI in environment');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('settings');

  const before = await col.findOne({});
  console.log('--- Before Migration ---');
  console.log({
    _id: before?._id,
    bankName: before?.bankName,
    bankAccountNumber: before?.bankAccountNumber,
    ifscCode: before?.ifscCode,
    bankDetails: before?.bankDetails,
  });

  const bankName = before?.bankDetails?.bankName || before?.bankName || 'HDFC BANK';
  const bankAccountNumber = before?.bankDetails?.bankAccountNumber || before?.bankAccountNumber || '50200012345678';
  const ifscCode = before?.bankDetails?.ifscCode || before?.ifscCode || 'HDFC0000451';

  const res = await col.updateMany({}, {
    $set: {
      bankDetails: {
        bankName,
        bankAccountNumber,
        ifscCode,
      },
    },
    $unset: {
      bankName: '',
      bankAccountNumber: '',
      ifscCode: '',
    },
  });

  console.log('--- Migration Result ---');
  console.log(`Matched: ${res.matchedCount}, Modified: ${res.modifiedCount}`);

  const after = await col.findOne({});
  console.log('--- After Migration ---');
  console.log({
    _id: after?._id,
    bankName: after?.bankName,
    bankAccountNumber: after?.bankAccountNumber,
    ifscCode: after?.ifscCode,
    bankDetails: after?.bankDetails,
  });

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

