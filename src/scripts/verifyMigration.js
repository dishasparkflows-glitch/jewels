const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function verify() {
  const args = process.argv.slice(2);
  const useFrom = args.includes('--from');
  const uri = (useFrom ? process.env.FROM_DB : process.env.TO_DB)?.trim();

  if (!uri) {
    throw new Error(`${useFrom ? 'FROM_DB' : 'TO_DB'} must be defined in .env.`);
  }

  const conn = await mongoose.createConnection(uri).asPromise();
  const db = conn.db;
  console.log(`Verifying DB: ${conn.name}\n`);

  const collections = await db.listCollections().toArray();

  console.log('--- 1. VERIFY __v & TOP-LEVEL AUDIT FIELDS ACROSS ALL COLLECTIONS ---');
  let totalV = 0;
  let totalTopAudit = 0;

  for (const c of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const coll = db.collection(c.name);
    const vCount = await coll.countDocuments({ __v: { $exists: true } });
    const auditCount = await coll.countDocuments({
      $or: [
        { createdAt: { $exists: true } },
        { createdBy: { $exists: true } },
        { updatedAt: { $exists: true } },
        { updatedBy: { $exists: true } },
      ],
    });
    if (vCount > 0 || auditCount > 0) {
      console.log(`FAIL [${c.name}]: __v=${vCount}, topAudit=${auditCount}`);
      totalV += vCount;
      totalTopAudit += auditCount;
    }
  }
  console.log('Total docs with __v remaining:', totalV);
  console.log('Total docs with top-level createdAt/By or updatedAt/By remaining:', totalTopAudit);

  console.log('\n--- 2. VERIFY PRODUCTS ---');
  const totalProducts = await db.collection('products').countDocuments();
  const withSlug = await db.collection('products').countDocuments({ 'basicInfo.slug': { $exists: true, $ne: '' } });
  const withBasicInfo = await db.collection('products').countDocuments({ 'basicInfo.title': { $exists: true, $ne: '' } });
  const withPricing = await db.collection('products').countDocuments({ pricing: { $exists: true } });
  const withMeta = await db.collection('products').countDocuments({ meta: { $exists: true } });
  const withSubTypePreserved = await db.collection('products').countDocuments({ subType: { $exists: true } });

  console.log('Total products:', totalProducts);
  console.log('Products with basicInfo.slug:', withSlug);
  console.log('Products with basicInfo.title:', withBasicInfo);
  console.log('Products with pricing:', withPricing);
  console.log('Products with meta:', withMeta);
  console.log('Products with preserved subType:', withSubTypePreserved);

  const sampleProd = await db.collection('products').findOne();
  if (sampleProd) {
    console.log('\nSample Product basicInfo:', sampleProd.basicInfo);
    console.log('Sample Product meta:', sampleProd.meta);
    console.log('Sample Product top-level createdAt:', sampleProd.createdAt, '| __v:', sampleProd.__v);
  }

  await conn.close();
}

verify().catch((e) => {
  console.error(e);
  process.exit(1);
});
