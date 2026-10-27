require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../modules/product/product.model');

function generateOrnateSlug(title = '', barcode = '', fallbackSku = '') {
  const cleanTitle = String(title || '').trim();
  const idPart = String(barcode || fallbackSku || '').trim();
  const raw = idPart ? `${cleanTitle}-${idPart}` : cleanTitle;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function migrate() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('\n======================================================');
  console.log('NEIRAH JEWELLERS — Migrate Ornate Product Slugs');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (Read-only)' : 'COMMIT (Applying database updates)'}`);
  console.log('======================================================\n');

  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  const filter = {
    $or: [{ isOrnate: true }, { 'ornate.barcode': { $exists: true, $ne: '' } }],
    'meta.deletedAt': null,
  };

  const products = await Product.find(filter)
    .select('_id basicInfo ornate isOrnate')
    .lean();

  console.log(`Found ${products.length} ornate products to inspect.\n`);

  let updatedCount = 0;
  let alreadyCorrectCount = 0;
  const changes = [];

  for (const product of products) {
    const title = product.basicInfo?.title || 'ornate-jewellery';
    const barcode = product.ornate?.barcode || '';
    const fallbackSku = product.basicInfo?.sku || product.ornate?.tagNo || '';
    const currentSlug = product.basicInfo?.slug || '';
    const newSlug = generateOrnateSlug(title, barcode, fallbackSku);

    if (currentSlug === newSlug) {
      alreadyCorrectCount++;
      continue;
    }

    changes.push({
      id: product._id,
      title,
      barcode,
      oldSlug: currentSlug,
      newSlug,
    });

    if (!isDryRun) {
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            'basicInfo.slug': newSlug,
            'meta.updatedAt': new Date(),
          },
        }
      );
    }

    updatedCount++;
  }

  console.log('Sample Slug Updates (First 10):');
  console.log('------------------------------------------------------');
  changes.slice(0, 10).forEach((c, idx) => {
    console.log(
      `${idx + 1}. [${c.id}] "${c.title}" (Barcode: ${c.barcode})`
    );
    console.log(`   Old Slug: ${c.oldSlug}`);
    console.log(`   New Slug: ${c.newSlug}\n`);
  });

  console.log('------------------------------------------------------');
  console.log(`Total Inspected:    ${products.length}`);
  console.log(`Already Correct:    ${alreadyCorrectCount}`);
  console.log(`Slugs Updated:      ${updatedCount}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
