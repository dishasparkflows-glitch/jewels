const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const GemstoneType = require('../modules/gemstoneType/gemstoneType.model');
const GemstoneShape = require('../modules/gemstoneShape/gemstoneShape.model');
const Filter = require('../modules/filter/filter.model');

const INITIAL_GEMSTONES = [
  { name: 'Amethyst', slug: 'amethyst', colorCode: '#8A4F7D', colorCodeEnd: '#682860', birthstoneMonth: 'February', order: 1 },
  { name: 'Natural Blue Sapphire', slug: 'natural-blue-sapphire', colorCode: '#0F52BA', colorCodeEnd: '#082567', birthstoneMonth: 'September', order: 2 },
  { name: 'Natural Emerald', slug: 'natural-emerald', colorCode: '#097969', colorCodeEnd: '#024d38', birthstoneMonth: 'May', order: 3 },
  { name: 'Natural Ruby', slug: 'natural-ruby', colorCode: '#E0115F', colorCodeEnd: '#9B111E', birthstoneMonth: 'July', order: 4 },
  { name: 'London Blue Topaz', slug: 'london-blue-topaz', colorCode: '#2E5B88', colorCodeEnd: '#1E3F5A', birthstoneMonth: 'December', order: 5 },
  { name: 'Peridot', slug: 'peridot', colorCode: '#9ACD32', colorCodeEnd: '#6B8E23', birthstoneMonth: 'August', order: 6 },
  { name: 'Pink Sapphire', slug: 'pink-sapphire', colorCode: '#FF69B4', colorCodeEnd: '#DB2777', birthstoneMonth: 'September', order: 7 },
  { name: 'Garnet', slug: 'garnet', colorCode: '#781826', colorCodeEnd: '#55101B', birthstoneMonth: 'January', order: 8 },
  { name: 'Citrine', slug: 'citrine', colorCode: '#E4A010', colorCodeEnd: '#B87333', birthstoneMonth: 'November', order: 9 },
  { name: 'Opal', slug: 'opal', colorCode: '#E8F1F5', colorCodeEnd: '#D0E1FD', birthstoneMonth: 'October', order: 10 },
  { name: 'Tanzanite', slug: 'tanzanite', colorCode: '#4D5382', colorCodeEnd: '#2D3142', birthstoneMonth: 'December', order: 11 },
  { name: 'Aquamarine', slug: 'aquamarine', colorCode: '#7FFFD4', colorCodeEnd: '#5F9EA0', birthstoneMonth: 'March', order: 12 },
];

const INITIAL_SHAPES = [
  { name: 'Heart', code: 'heart', order: 1 },
  { name: 'Round', code: 'round', order: 2 },
  { name: 'Oval', code: 'oval', order: 3 },
  { name: 'Cushion', code: 'cushion', order: 4 },
  { name: 'Cushion Rectangular', code: 'cushion-rectangular', order: 5 },
  { name: 'Emerald Cut', code: 'emerald-cut', order: 6 },
  { name: 'Marquise', code: 'marquise', order: 7 },
  { name: 'Pear', code: 'pear', order: 8 },
  { name: 'Princess', code: 'princess', order: 9 },
  { name: 'Carved Melon', code: 'carved-melon', order: 10 },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const g of INITIAL_GEMSTONES) {
    const existing = await GemstoneType.findOne({ name: g.name });
    if (!existing) {
      await GemstoneType.create(g);
      console.log('Created GemstoneType:', g.name);
    }
  }

  for (const s of INITIAL_SHAPES) {
    const existing = await GemstoneShape.findOne({ name: s.name });
    if (!existing) {
      await GemstoneShape.create(s);
      console.log('Created GemstoneShape:', s.name);
    }
  }

  // Ensure Filter definitions exist in DB
  let gemstoneFilter = await Filter.findOne({ filterId: 'gemstone-types' });
  if (!gemstoneFilter) {
    gemstoneFilter = await Filter.create({
      filterId: 'gemstone-types',
      title: 'Gemstone',
      key: 'gemstone',
      type: 'checkbox',
      order: 4,
      enabled: true,
      categoryConfigs: [],
      meta: { createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
    });
    console.log('Created gemstone-types filter in DB');
  }

  let shapeFilter = await Filter.findOne({ filterId: 'gemstone-shapes' });
  if (!shapeFilter) {
    shapeFilter = await Filter.create({
      filterId: 'gemstone-shapes',
      title: 'Gemstone Shape',
      key: 'gemstoneShape',
      type: 'checkbox',
      order: 5,
      enabled: true,
      categoryConfigs: [],
      meta: { createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
    });
    console.log('Created gemstone-shapes filter in DB');
  }

  console.log('Gemstone seed complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
