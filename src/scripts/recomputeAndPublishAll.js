/**
 * recomputeAndPublishAll.js
 *
 * Bulk migration and recompute script for all jewellery products:
 * - Loads pricing masters (metals, purities, diamonds, rates).
 * - Enforces fixed ₹3,000 / ct for color stone & side color stone gemstones.
 * - Enforces mutual exclusivity between center diamonds and center color stones.
 * - Recomputes multi-variant pricing matrix and updates all catalogue products in MongoDB.
 */

const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Product = require('../modules/product/product.model');
const {
  loadPricingMasters,
  calculateProductPricing
} = require('../modules/product/product.pricing');
const { normalizeStoneConfig } = require('../modules/product/product.service');

async function recomputeAndPublishAll() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI environment variable not defined.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB successfully.');

  try {
    console.log('Loading pricing masters...');
    const masters = await loadPricingMasters();
    console.log('Pricing masters loaded.');

    const filter = {
      productType: { $ne: 'silver' },
      isOrnate: { $ne: true },
      'meta.deletedAt': null
    };

    const count = await Product.countDocuments(filter);
    console.log(`Found ${count} active products to recompute.`);

    const cursor = Product.find(filter).cursor();
    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      processed++;
      try {
        const productObj = doc.toObject();

        // Enforce 3,000 / ct fixed rate for colorstones
        if (Array.isArray(productObj.colorStoneRows) && productObj.colorStoneRows.length > 0) {
          productObj.colorStoneRows = productObj.colorStoneRows.map((r) => ({
            ...r,
            pricePerCarat: 3000
          }));
        }
        if (Array.isArray(productObj.sideColorStoneRows) && productObj.sideColorStoneRows.length > 0) {
          productObj.sideColorStoneRows = productObj.sideColorStoneRows.map((r) => ({
            ...r,
            pricePerCarat: 3000
          }));
        }

        // Apply stone configuration normalization
        normalizeStoneConfig(productObj);

        // Compute pricing using the centralized pricing engine
        const pricingResult = calculateProductPricing(productObj, masters);

        if (pricingResult && Array.isArray(pricingResult.variants) && pricingResult.variants.length > 0) {
          await Product.updateOne(
            { _id: doc._id },
            {
              $set: {
                stoneConfigType: productObj.stoneConfigType || 'centerDiamond',
                colorStoneRows: productObj.colorStoneRows || [],
                sideStoneConfigType: productObj.sideStoneConfigType || 'none',
                sideColorStoneRows: productObj.sideColorStoneRows || [],
                variants: pricingResult.variants,
                'pricing.salePrice': pricingResult.salePrice || 0,
                'meta.updatedAt': new Date()
              }
            }
          );
          updated++;
        }
      } catch (err) {
        errors++;
        console.warn(`[SKIPPED] Product ${doc._id} (${doc.basicInfo?.title || 'Untitled'}): ${err.message}`);
      }

      if (processed % 25 === 0 || processed === count) {
        console.log(`Progress: ${processed}/${count} processed (${updated} updated, ${errors} skipped/errored)`);
      }
    }

    console.log('\n=============================================');
    console.log(`Completed recompute and publish run.`);
    console.log(`Total processed: ${processed}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Skipped / errors: ${errors}`);
    console.log('=============================================\n');
  } catch (err) {
    console.error('Fatal error during recompute:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

if (require.main === module) {
  recomputeAndPublishAll()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = recomputeAndPublishAll;
