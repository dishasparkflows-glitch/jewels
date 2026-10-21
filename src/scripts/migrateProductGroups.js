require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../modules/product/product.model');
const ProductGroup = require('../modules/productGroup/productGroup.model');

async function migrate() {
  const isCommit = process.argv.includes('--commit');
  console.log(`\n======================================================`);
  console.log(`NEIRAH JEWELLERS — Common Product Groups Migration`);
  console.log(`Mode: ${isCommit ? 'COMMIT (Writing changes)' : 'DRY RUN (Read-only report)'}`);
  console.log(`======================================================\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const distinctCustomNames = await Product.distinct('ornate.customGroupName', {
    isOrnate: true,
    'meta.deletedAt': null,
  });
  console.log(`Found ${distinctCustomNames.filter(Boolean).length} distinct custom group names on products.`);

  const candidateNames = Array.from(
    new Set(distinctCustomNames.map((n) => n?.trim()))
  ).filter(Boolean);

  console.log('\nCandidate Group Review:');
  console.log('------------------------------------------------------');

  let nextSequence = 1;

  for (const name of candidateNames) {
    const products = await Product.find({
      'ornate.customGroupName': name,
      isOrnate: true,
      'meta.deletedAt': null,
    })
      .select('_id basicInfo.title basicInfo.sku ornate.tagNo pricing.salePrice')
      .lean();

    const groupCode = `CG-${String(nextSequence).padStart(6, '0')}`;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    console.log(`\nGroup: "${name}"`);
    console.log(`  Suggested Code: ${groupCode}`);
    console.log(`  Suggested Slug: ${slug}`);
    console.log(`  Matching Products Count: ${products.length}`);
    products.forEach((p, idx) => {
      console.log(
        `    ${idx + 1}. [${p.ornate?.tagNo || p.basicInfo?.sku || p._id}] ${p.basicInfo?.title || 'Untitled'} (₹${p.pricing?.salePrice || 0})`
      );
    });

    if (isCommit) {
      const existing = await ProductGroup.findOne({
        $or: [{ groupName: name }, { slug }],
        'meta.deletedAt': null,
      });

      if (existing) {
        console.log(`  -> Group already exists in "product_groups" (_id: ${existing._id}). Skipping.`);
      } else {
        const productIds = products.map((p) => p._id);
        const created = await ProductGroup.create({
          groupCode,
          groupName: name,
          slug,
          productIds,
          primaryProductId: productIds[0] || null,
          representativeMode: 'auto',
          status: 'active',
          sync: {
            firstSyncedAt: null,
            firstSyncedBy: null,
            firstSourceProductId: null,
            firstProductIds: [],
            firstSyncedFields: [],
            lastSyncedAt: null,
            lastSyncedBy: null,
            lastSyncOperationId: null,
            syncVersion: 0,
          },
          meta: {
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`  -> Successfully created product_groups document (${created.groupCode}, _id: ${created._id}).`);
      }
    }

    nextSequence++;
  }

  console.log('\n======================================================');
  if (!isCommit) {
    console.log('DRY RUN COMPLETE. No data was modified.');
    console.log('Run "node src/scripts/migrateProductGroups.js --commit" to execute.');
  } else {
    console.log('MIGRATION COMMITTED. All groups written to "product_groups".');
  }
  console.log('======================================================\n');

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
