require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const collectionMap = {
  metalpurities: 'metal_purities',
  metaltypes: 'metal_types',
  metalcolors: 'metal_colors',
  diamondcolors: 'diamond_colors',
  diamondcuts: 'diamond_cuts',
  diamondshapes: 'diamond_shapes',
  diamondsizes: 'diamond_sizes',
  diamondtypes: 'diamond_types',
  diamondclarities: 'diamond_clarities',
  diamondprices: 'diamond_prices',
  diamondpricenews: 'diamond_price_news',
  centerdiamondprices: 'center_diamond_prices',
  sidediamondprices: 'side_diamond_prices',
  caratweights: 'carat_weights',
  ringsizes: 'ring_sizes',
  sievesizes: 'sieve_sizes',
  custominquiries: 'custom_inquiries',
  custjewellerybeforafters: 'cust_jewellery_before_afters',
  footersettings: 'footer_settings',
  instagramposts: 'instagram_posts',
  integrationtokens: 'integration_tokens',
  menuitems: 'menu_items',
  menusections: 'menu_sections',
  vtomasters: 'vto_masters',
  whatsappmessages: 'whatsapp_messages',
  whatsapptemplates: 'whatsapp_templates',
  codsequences: 'cod_sequences',
};

async function migrateCollections() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log('📋 Fetching existing collections...');
  const existingCollectionsList = await db.listCollections().toArray();
  const existingNames = new Set(existingCollectionsList.map((c) => c.name));

  let renamedCount = 0;
  let alreadyMigratedCount = 0;
  let skippedCount = 0;

  for (const [oldName, newName] of Object.entries(collectionMap)) {
    if (existingNames.has(oldName)) {
      if (!existingNames.has(newName)) {
        console.log(`⏳ Renaming: "${oldName}" -> "${newName}"...`);
        await db.collection(oldName).rename(newName);
        console.log(`✅ Renamed: "${oldName}" -> "${newName}"`);
        renamedCount++;
      } else {
        const oldCount = await db.collection(oldName).countDocuments();
        const newCount = await db.collection(newName).countDocuments();

        if (newCount === 0 && oldCount > 0) {
          console.log(`ℹ️ "${newName}" exists but is empty. Dropping empty collection and renaming "${oldName}" -> "${newName}"...`);
          await db.collection(newName).drop();
          await db.collection(oldName).rename(newName);
          console.log(`✅ Renamed: "${oldName}" -> "${newName}"`);
          renamedCount++;
        } else if (oldCount === 0) {
          console.log(`ℹ️ "${oldName}" is empty while "${newName}" has ${newCount} documents. Dropping empty "${oldName}"...`);
          await db.collection(oldName).drop();
          alreadyMigratedCount++;
        } else {
          console.warn(`⚠️ Both "${oldName}" (${oldCount} docs) and "${newName}" (${newCount} docs) have data! Merging docs from old to new...`);
          const docs = await db.collection(oldName).find({}).toArray();
          if (docs.length > 0) {
            await db.collection(newName).insertMany(docs, { ordered: false }).catch(() => {});
          }
          await db.collection(oldName).drop();
          console.log(`✅ Merged and dropped "${oldName}"`);
          renamedCount++;
        }
      }
    } else if (existingNames.has(newName)) {
      console.log(`✨ Already migrated: "${newName}"`);
      alreadyMigratedCount++;
    } else {
      console.log(`⏭️ Skipped: "${oldName}" does not exist in DB`);
      skippedCount++;
    }
  }

  console.log('\n========================================');
  console.log('🎉 Migration Completed!');
  console.log(`   Renamed: ${renamedCount}`);
  console.log(`   Already migrated: ${alreadyMigratedCount}`);
  console.log(`   Not found / skipped: ${skippedCount}`);
  console.log('========================================\n');

  console.log('📊 Current Collections in Database:');
  const updatedCollections = await db.listCollections().toArray();
  for (const col of updatedCollections.sort((a, b) => a.name.localeCompare(b.name))) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`   • ${col.name}: ${count} documents`);
  }

  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB.');
}

migrateCollections().catch((err) => {
  console.error('❌ Migration error:', err);
  process.exit(1);
});
