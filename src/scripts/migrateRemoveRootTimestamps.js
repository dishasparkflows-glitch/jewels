const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jewels';

async function migrate() {
  console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  console.log(`Found ${collections.length} collections.`);

  let totalUpdated = 0;

  for (const collInfo of collections) {
    const collName = collInfo.name;
    if (collName.startsWith('system.')) continue;

    const collection = db.collection(collName);
    const totalDocs = await collection.countDocuments();
    if (totalDocs === 0) {
      console.log(`Collection "${collName}": 0 documents (skipped)`);
      continue;
    }

    const cursor = collection.find({});
    let collUpdated = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();

      const existingMeta = doc.meta || {};
      const createdAt = existingMeta.createdAt || doc.createdAt || (doc._id && doc._id.getTimestamp ? doc._id.getTimestamp() : new Date());
      const updatedAt = existingMeta.updatedAt || doc.updatedAt || createdAt || new Date();

      const newMeta = {
        createdBy: existingMeta.createdBy !== undefined ? existingMeta.createdBy : null,
        updatedBy: existingMeta.updatedBy !== undefined ? existingMeta.updatedBy : null,
        deletedBy: existingMeta.deletedBy !== undefined ? existingMeta.deletedBy : null,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
        deletedAt: existingMeta.deletedAt !== undefined ? existingMeta.deletedAt : null,
      };

      const needsUnset = ('createdAt' in doc) || ('updatedAt' in doc);
      const needsMetaUpdate = !doc.meta || !doc.meta.createdAt || !doc.meta.updatedAt;

      if (needsUnset || needsMetaUpdate) {
        const updateOps = {
          $set: { meta: newMeta },
        };
        if (needsUnset) {
          updateOps.$unset = { createdAt: '', updatedAt: '' };
        }

        await collection.updateOne({ _id: doc._id }, updateOps);
        collUpdated++;
      }
    }

    // Handle index migration if root createdAt index existed
    try {
      const indexes = await collection.indexes();
      for (const idx of indexes) {
        if (idx.key && idx.key.createdAt && !idx.key['meta.createdAt']) {
          console.log(`Dropping old index ${idx.name} on ${collName}...`);
          await collection.dropIndex(idx.name);
        }
      }
    } catch (idxErr) {
      console.warn(`Could not inspect/drop index on ${collName}:`, idxErr.message);
    }

    console.log(`Collection "${collName}" (${totalDocs} docs): Updated ${collUpdated} docs to use meta.`);
    totalUpdated += collUpdated;
  }

  console.log(`\n🎉 Migration finished! Total documents migrated: ${totalUpdated}`);

  // Validation pass
  console.log('\n--- Running validation check across all collections ---');
  let hasAnyRootTimestamps = false;
  for (const collInfo of collections) {
    const collName = collInfo.name;
    if (collName.startsWith('system.')) continue;

    const collection = db.collection(collName);
    const countWithRoot = await collection.countDocuments({
      $or: [{ createdAt: { $exists: true } }, { updatedAt: { $exists: true } }],
    });
    const countTotal = await collection.countDocuments();
    const countWithMeta = await collection.countDocuments({
      'meta.createdAt': { $exists: true },
    });

    if (countWithRoot > 0) {
      hasAnyRootTimestamps = true;
      console.error(`❌ "${collName}": STILL HAS ${countWithRoot} docs with root createdAt/updatedAt!`);
    } else if (countTotal > 0) {
      console.log(`✅ "${collName}": All ${countTotal} docs have meta.createdAt & NO root createdAt/updatedAt.`);
    }
  }

  if (!hasAnyRootTimestamps) {
    console.log('\n✅ ALL TABLES VERIFIED: Root createdAt and updatedAt completely removed and stored in meta object!');
  } else {
    console.error('\n❌ Validation failed: Some documents still contain root fields.');
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
