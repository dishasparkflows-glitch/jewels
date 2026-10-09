const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Coupon = require('../modules/coupon/coupon.model');

async function migrateCoupons() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jewels');
  console.log('Connected to DB');

  // Drop old unique index on couponcode first if it exists
  try {
    await Coupon.collection.dropIndex('couponcode_1');
    console.log('Dropped old index couponcode_1');
  } catch (err) {
    // index might not exist
  }

  const oldCoupons = await Coupon.collection.find({}).toArray();
  console.log('Found', oldCoupons.length, 'existing coupons');

  for (const doc of oldCoupons) {
    const isOld = doc.couponcode !== undefined || !doc.coupon?.code;
    if (isOld) {
      console.log('Migrating coupon:', doc.couponcode || doc._id);
      const newDoc = {
        coupon: {
          code: doc.couponcode || doc.coupon?.code || 'COUPON',
          description: doc.description || doc.coupon?.description || '',
        },
        discount: {
          type: doc.discounttype || doc.discount?.type || 'Percentage',
          value: doc.discountvalue !== undefined ? doc.discountvalue : (doc.discount?.value || 0),
          minimumOrderAmount: doc.minimumorderamount !== undefined ? doc.minimumorderamount : (doc.discount?.minimumOrderAmount || 0),
        },
        validity: {
          startDate: doc.startdate || doc.validity?.startDate || null,
          endDate: doc.enddate || doc.validity?.endDate || null,
        },
        usage: {
          usageLimit: doc.usagelimit !== undefined ? doc.usagelimit : (doc.usage?.usageLimit || null),
          usedCount: doc.usedCount !== undefined ? doc.usedCount : (doc.usage?.usedCount || 0),
          perUserLimit: doc.peruserlimit !== undefined ? doc.peruserlimit : (doc.usage?.perUserLimit || 1),
        },
        status: doc.status || 'active',
        isDeleted: doc.isDeleted || false,
        meta: doc.meta || { createdAt: new Date(), updatedAt: new Date() }
      };

      await Coupon.collection.updateOne(
        { _id: doc._id },
        {
          $set: newDoc,
          $unset: {
            couponcode: '',
            description: '',
            discounttype: '',
            discountvalue: '',
            minimumorderamount: '',
            startdate: '',
            enddate: '',
            usagelimit: '',
            usedCount: '',
            peruserlimit: '',
            createdAt: '',
            updatedAt: '',
          }
        }
      );
    }
  }

  // Also ensure DIWALI20 exists
  const diwali = await Coupon.findOne({ 'coupon.code': 'DIWALI20' });
  if (!diwali) {
    await Coupon.create({
      coupon: {
        code: 'DIWALI20',
        description: 'Special festive discount',
      },
      discount: {
        type: 'Percentage',
        value: 20,
        minimumOrderAmount: 20000,
      },
      validity: {
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-31T23:59:59.999Z'),
      },
      usage: {
        usageLimit: 100,
        usedCount: 12,
        perUserLimit: 1,
      },
      status: 'active',
    });
    console.log('Created DIWALI20 coupon');
  }

  // Ensure new indexes
  await Coupon.syncIndexes();
  console.log('Synced Coupon indexes');

  const updatedCoupons = await Coupon.find({}).lean();
  console.log('Migrated coupons count:', updatedCoupons.length);
  console.log('Sample coupon:', JSON.stringify(updatedCoupons[0], null, 2));

  await mongoose.disconnect();
}

migrateCoupons().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
