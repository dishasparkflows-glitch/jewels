require('dotenv').config();
const mongoose = require('mongoose');
const ProductGroup = require('../modules/productGroup/productGroup.model');
const Product = require('../modules/product/product.model');

async function cleanGroups() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('\n======================================================');
  console.log('NEIRAH JEWELLERS — Clean Product Group Slugs and Titles');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (Read-only)' : 'COMMIT (Applying database updates)'}`);
  console.log('======================================================\n');

  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  const groups = await ProductGroup.find({ 'meta.deletedAt': null }).lean();
  console.log(`Found ${groups.length} product groups to inspect.\n`);

  let updatedCount = 0;
  let alreadyCleanCount = 0;
  const updates = [];

  for (const group of groups) {
    let newName = group.groupName;
    let newSlug = group.slug;

    // Check if group is single-product
    if (group.productIds?.length === 1) {
      const prodId = group.primaryProductId || group.productIds[0];
      const prod = await Product.findById(prodId).select('basicInfo ornate barcode').lean();
      if (prod) {
        const title = (prod.basicInfo?.title || group.groupName || '').trim();
        const barcode = (prod.ornate?.barcode || prod.barcode || prod.ornate?.tagNo || '').trim();
        if (barcode && !title.toLowerCase().includes(barcode.toLowerCase())) {
          newName = `${title} - ${barcode}`;
        } else {
          newName = title || group.groupName;
        }
        if (prod.basicInfo?.slug) {
          newSlug = prod.basicInfo.slug;
        }
      }
    } else {
      // For multi-product groups, clean trailing sequence numbers from slug if present
      if (newSlug && /-\d{6}$/.test(newSlug)) {
        newSlug = newSlug.replace(/-\d{6}$/, '');
      }
      // Clean trailing barcode from groupName if present
      if (newName && newName.includes(' - ')) {
        const parts = newName.split(' - ');
        if (parts.length === 2 && /^\d+$/.test(parts[1].trim())) {
          newName = parts[0].trim();
        }
      }
    }

    if (newName === group.groupName && newSlug === group.slug) {
      alreadyCleanCount++;
      continue;
    }

    updates.push({
      id: group._id,
      code: group.groupCode,
      oldName: group.groupName,
      newName,
      oldSlug: group.slug,
      newSlug,
    });

    if (!isDryRun) {
      await ProductGroup.updateOne(
        { _id: group._id },
        {
          $set: {
            groupName: newName,
            slug: newSlug,
            'meta.updatedAt': new Date(),
          },
        }
      );
    }

    updatedCount++;
  }

  console.log('Sample Cleanups:');
  console.log('------------------------------------------------------');
  updates.slice(0, 10).forEach((u, i) => {
    console.log(`${i + 1}. [${u.code}] ${u.id}`);
    console.log(`   Name: "${u.oldName}" -> "${u.newName}"`);
    console.log(`   Slug: "${u.oldSlug}" -> "${u.newSlug}"\n`);
  });

  console.log('------------------------------------------------------');
  console.log(`Total Inspected:    ${groups.length}`);
  console.log(`Already Clean:      ${alreadyCleanCount}`);
  console.log(`Updated:            ${updatedCount}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

cleanGroups().catch((err) => {
  console.error('Cleanup failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
