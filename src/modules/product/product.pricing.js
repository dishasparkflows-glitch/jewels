const ApiError = require('../../utils/ApiError');

const id = (value) => String(value?._id || value || '');
const round = (value, places = 2) =>
  Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places;
const number = (value, label, fallback = 0) => {
  const result = Number(value ?? fallback);
  if (!Number.isFinite(result) || result < 0)
    throw new ApiError(400, `${label} must be a non-negative number`);
  return result;
};
const dimensions = [
  'diamondTypeId',
  'diamondShapeId',
  'diamondColorId',
  'diamondClarityId'
];
const signature = (row) =>
  row
    ? [
        ...dimensions.map((key) => id(row[key])),
        row.caratWeight,
        row.pieces || '', row.sizeFrom ?? '', row.sizeTo ?? ''
      ].join(':')
    : 'none';

function stoneRate(row, rates, side) {
  if (dimensions.some((key) => !id(row[key])))
    throw new ApiError(
      400,
      'Select diamond type, shape, color and clarity for every row'
    );
  const carat = number(row.caratWeight, 'Diamond carat weight');
  if (!carat)
    throw new ApiError(400, 'Diamond carat weight must be greater than zero');
  const pieces = side ? number(row.pieces, 'Side diamond pieces') : 1;
  if (!pieces || !Number.isInteger(pieces))
    throw new ApiError(400, 'Side diamond pieces must be a positive integer');
  if (row.rateSource === 'manual' || (row.rateSource !== 'master' && Number(side ? row.priceINR : row.pricePerCarat) > 0)) {
    const rate = number(
      side ? row.priceINR : row.pricePerCarat,
      'Manual diamond rate'
    );
    if (!rate) throw new ApiError(400, 'Enter a positive manual diamond rate');
    return rate;
  }
  const size = carat;
  if (side && (number(row.sizeFrom, 'Sieve size from') > number(row.sizeTo, 'Sieve size to')))
    throw new ApiError(400, 'Sieve size from must not exceed size to');
  const matches = rates.filter(
    (rate) =>
      dimensions.every((key) => id(rate[key]) === id(row[key])) &&
      (side
        ? Number(row.sizeFrom) === Number(rate.sizeFrom) && Number(row.sizeTo) === Number(rate.sizeTo)
        : size >= Number(rate.sizeFrom) && size <= Number(rate.sizeTo))
  );
  if (matches.length !== 1)
    throw new ApiError(
      400,
      `${side ? 'Side' : 'Center'} diamond rate ${matches.length ? 'is ambiguous' : 'is missing'} for ${size} ct; check the pricing master or choose a manual rate`
    );
  const rate = number(matches[0].priceINR, 'Diamond master rate');
  if (!rate)
    throw new ApiError(400, 'Diamond master rate must be greater than zero');
  return rate;
}

function calculateProductPricing(product, masters) {
  const settings = product.pricing || {};
  if (product.isOrnate)
    throw new ApiError(400, 'ERP products retain their ERP pricing');
  const baseWeight = number(
    product.specifications?.metalWeight,
    'Base 14KT metal weight'
  );
  if (!baseWeight)
    throw new ApiError(400, 'Enter a positive base 14KT metal weight');
  const baseCarat = number(settings.baseCarat, 'Base center carat', 1);
  const labourRate = number(settings.baseLabourCharge, 'Labour rate per gram');
  const certificate = number(settings.certificateCharge, 'Certificate charge');
  const markup = number(settings.otherAmountPercentage, 'Markup percentage');
  const gstPercent = number(settings.gstPercentage, 'GST percentage', 3);
  const centers = product.centerDiamondRows || [];
  const sides = product.sideDiamondRows || [];
  const purities = (product.metalPurityIds || []).map((value) =>
    masters.purities.find((p) => id(p) === id(value))
  );
  if (!purities.length || purities.some((p) => !p))
    throw new ApiError(400, 'Select valid metal purities');
  const centerRates = centers.map((row) =>
    stoneRate(row, masters.centerRates, false)
  );
  const sideRates = sides.map((row) => stoneRate(row, masters.sideRates, true));
  const choices = centers.length
    ? centers.map((center, centerIndex) => {
        const matching = sides.map((side, sideIndex) => ({ side, sideIndex }))
          .filter(({ side }) => ['diamondTypeId', 'diamondColorId', 'diamondClarityId']
            .every((key) => id(side[key]) === id(center[key])));
        const accents = sides.length === 1 ? [{ side: sides[0], sideIndex: 0 }] : matching;
        if (sides.length && !accents.length)
          throw new ApiError(400, 'No side diamond quality matches a center variant');
        return { center, centerIndex, accents };
      })
    : sides.length ? sides.map((side, sideIndex) => ({ side, accents: [{ side, sideIndex }] })) : [{ accents: [] }];
  if (purities.length * choices.length > 2000)
    throw new ApiError(
      400,
      'Too many variants; limit the configuration to 2,000 combinations'
    );
  const seen = new Set();
  const variants = [];
  for (const purity of purities)
      for (const choice of choices) {
        if (
          purity.metalType !== 'Gold' ||
          !(purity.karat > 0 && purity.karat <= 24)
        )
          throw new ApiError(
            400,
            'Calculated jewellery pricing requires a valid gold purity'
          );
        const { center, side, centerIndex, accents } = choice;
        const key = [
          id(purity),
          signature(center),
          accents.map(({ side }) => signature(side)).sort().join(',')
        ].join('|');
        if (seen.has(key))
          throw new ApiError(400, 'Duplicate diamond quality combination');
        seen.add(key);
        let previous = (product.variants || []).find((v) => v.pricingKey === key);
        if (!previous) {
          const stone = center || side;
          const legacy = (product.variants || []).filter((v) => id(v.metalPurityId) === id(purity)
            && dimensions.every((field) => id(v[field]) === id(stone?.[field]))
            && Number(v.caratWeight || 0) === Number(stone?.caratWeight || 0));
          if (legacy.length > 1) throw new ApiError(400, 'Multiple saved variants match this quality. Reconcile color-specific stock before converting to purity-only variants');
          previous = legacy[0];
        }
        const karatWeight = baseWeight * (1 + (Number(purity.karat) - 14) / 24);
        const scaling = center
          ? 1 + (Number(center.caratWeight) - baseCarat) * 0.08
          : 1;
        const metalWeight = round(karatWeight * scaling * 1.05, 3);
        if (metalWeight <= 0)
          throw new ApiError(
            400,
            'Base carat produces a non-positive metal weight'
          );
        const metalRate =
          (number(masters.gold?.base24KRate, '24KT gold rate') * purity.karat) /
          24;
        if (!metalRate)
          throw new ApiError(400, 'Configure a positive 24KT gold rate');
        const metalCost = metalWeight * metalRate;
        const centerCost = center
          ? Number(center.caratWeight) * centerRates[centerIndex]
          : 0;
        const sideScale = center ? 1 + Math.round((Number(center.caratWeight) - baseCarat) / 0.5) * 0.25 : 1;
        if (accents.length && sideScale <= 0) throw new ApiError(400, 'Center carat produces a non-positive side diamond weight');
        const sideWeight = accents.reduce((sum, { side }) => sum + Number(side.caratWeight) * sideScale, 0);
        const sideCost = accents.reduce((sum, { side, sideIndex }) => sum + Number(side.caratWeight) * sideScale * sideRates[sideIndex], 0);
        const labour = metalWeight * labourRate;
        const subtotal =
          metalCost + centerCost + sideCost + labour + certificate;
        const gst = (subtotal * gstPercent) / 100;
        const finalBeforeMarkup = round(subtotal + gst);
        const extra = (finalBeforeMarkup * markup) / 100;
        const stone = center || side;
        const typeName = stone ? (masters.labels?.[id(stone.diamondTypeId)] || '') : '';
        const colorName = stone ? (masters.labels?.[id(stone.diamondColorId)] || '') : '';
        const clarityName = stone ? (masters.labels?.[id(stone.diamondClarityId)] || '') : '';
        variants.push({
          ...(previous?._id ? { _id: previous._id } : {}),
          pricingKey: key,
          combination: [
            typeName,
            colorName,
            clarityName,
            purity.name,
            stone && `${stone.caratWeight}ct`,
          ]
            .filter(Boolean)
            .join(' · '),
          sku: [product.basicInfo?.sku || 'JEWEL', purity.name, center && 'C', accents.length && 'S'].filter(Boolean).join('-'),
          stock: previous?.stock ?? 0,
          metalPurityId: id(purity),
          ...Object.fromEntries(
            dimensions
              .filter((key) => stone?.[key])
              .map((key) => [key, id(stone[key])])
          ),
          caratWeight: Number(stone?.caratWeight || 0),
          metalWeight,
          isCalculated: true,
          metalRate: round(metalRate, 4),
          metalCost: round(metalCost),
          centerDiamondWeight: Number(center?.caratWeight || 0),
          centerDiamondRate: center ? centerRates[centerIndex] : 0,
          centerDiamondCost: round(centerCost),
          sideDiamondWeight: round(sideWeight, 6),
          sideDiamondCost: round(sideCost),
          diamondCost: round(centerCost + sideCost),
          labourCharge: round(labour),
          computedMakingCharge: round(labour),
          certificateCharge: certificate,
          subtotal: round(subtotal),
          computedGst: round(gst),
          otherAmount: round(finalBeforeMarkup + extra),
          price: round(finalBeforeMarkup)
        });
      }
  return { variants, salePrice: Math.min(...variants.map((v) => v.price)) };
}

async function loadPricingMasters() {
  const [
    gold,
    purities,
    colors,
    centerRates,
    sideRates,
    types,
    diamondColors,
    clarities,
    shapes,
  ] = await Promise.all([
    require('../goldPrice/goldPrice.model')
      .findOne()
      .sort({ updatedAt: -1 })
      .lean(),
    require('../metalPurity/metalPurity.model')
      .find({ status: 'active', 'meta.deletedAt': null })
      .lean(),
    require('../metalColor/metalColor.model')
      .find({ 'meta.deletedAt': null })
      .lean(),
    require('../centerDiamondPrice/centerDiamondPrice.model')
      .find({ 'meta.deletedAt': null })
      .lean(),
    require('../sideDiamondPrice/sideDiamondPrice.model')
      .find({ 'meta.deletedAt': null })
      .lean(),
    require('../diamondType/diamondType.model')
      .find({ 'meta.deletedAt': null })
      .lean(),
    require('../diamondColor/diamondColor.model')
      .find({ 'meta.deletedAt': null })
      .lean(),
    require('../diamondClarity/diamondClarity.model')
      .find({ 'meta.deletedAt': null })
      .lean(),
    require('../diamondShape/diamondShape.model')
      .find({ 'meta.deletedAt': null })
      .lean(),
  ]);
  return {
    gold,
    purities,
    colors,
    centerRates,
    sideRates,
    labels: Object.fromEntries(
      [...(types || []), ...(diamondColors || []), ...(clarities || []), ...(shapes || [])].map((item) => [
        id(item),
        item.name
      ])
    )
  };
}

module.exports = { calculateProductPricing, loadPricingMasters };
