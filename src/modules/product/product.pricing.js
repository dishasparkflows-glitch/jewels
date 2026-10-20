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
        row.pieces || ''
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
  if (row.rateSource === 'manual') {
    const rate = number(
      side ? row.priceINR : row.pricePerCarat,
      'Manual diamond rate'
    );
    if (!rate) throw new ApiError(400, 'Enter a positive manual diamond rate');
    return rate;
  }
  // Side brackets use average carat per stone, never the whole parcel weight.
  const size = carat / pieces;
  const matches = rates.filter(
    (rate) =>
      dimensions.every((key) => id(rate[key]) === id(row[key])) &&
      size >= Number(rate.sizeFrom) &&
      size <= Number(rate.sizeTo)
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
  if (product.basicInfo?.isOrnate || product.isOrnate)
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
  const colors = (product.metalColorIds || []).map((value) =>
    masters.colors.find((c) => id(c) === id(value))
  );
  if (
    !purities.length ||
    purities.some((p) => !p) ||
    !colors.length ||
    colors.some((c) => !c)
  )
    throw new ApiError(400, 'Select valid metal purities and colors');
  const centerRates = centers.map((row) =>
    stoneRate(row, masters.centerRates, false)
  );
  const sideRates = sides.map((row) => stoneRate(row, masters.sideRates, true));
  const choices = centers.length
    ? centers.map((center, centerIndex) => {
        let matchedSide = null;
        let matchedSideIndex = -1;
        if (sides.length === 1) {
          // If only 1 side diamond row is configured, it applies as fixed accent stones to all center variants
          matchedSide = sides[0];
          matchedSideIndex = 0;
        } else if (sides.length > 1) {
          // Find matching side diamond quality tier
          const matching = sides
            .map((side, index) => ({ side, index }))
            .filter(({ side }) =>
              ['diamondTypeId', 'diamondColorId', 'diamondClarityId'].every(
                (key) => id(side[key]) === id(center[key])
              )
            );
          if (matching.length > 0) {
            matchedSide = matching[0].side;
            matchedSideIndex = matching[0].index;
          } else {
            // Fallback to first side row if no exact match
            matchedSide = sides[0];
            matchedSideIndex = 0;
          }
        }
        return {
          center,
          centerIndex,
          side: matchedSide,
          sideIndex: matchedSideIndex,
        };
      })
    : sides.length
      ? sides.map((side, sideIndex) => ({ side, sideIndex }))
      : [{}];
  if (purities.length * colors.length * choices.length > 2000)
    throw new ApiError(
      400,
      'Too many variants; limit the configuration to 2,000 combinations'
    );
  const seen = new Set();
  const variants = [];
  for (const purity of purities)
    for (const color of colors)
      for (const choice of choices) {
        if (
          purity.metalType !== 'Gold' ||
          !(purity.karat > 0 && purity.karat <= 24)
        )
          throw new ApiError(
            400,
            'Calculated jewellery pricing requires a valid gold purity'
          );
        const { center, side, centerIndex, sideIndex } = choice;
        const key = [
          id(purity),
          id(color),
          signature(center),
          signature(side)
        ].join('|');
        if (seen.has(key))
          throw new ApiError(400, 'Duplicate diamond quality combination');
        seen.add(key);
        const previous = (product.variants || []).find(
          (v) => v.pricingKey === key
        );
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
        const sideCost = side
          ? Number(side.caratWeight) * sideRates[sideIndex]
          : 0;
        const labour = metalWeight * labourRate;
        const subtotal =
          metalCost + centerCost + sideCost + labour + certificate;
        const gst = (subtotal * gstPercent) / 100;
        const finalBeforeMarkup = subtotal + gst;
        const extra = (finalBeforeMarkup * markup) / 100;
        const stone = center || side;
        const typeName = stone ? (masters.labels?.[id(stone.diamondTypeId)] || '') : '';
        const colorName = stone ? (masters.labels?.[id(stone.diamondColorId)] || '') : '';
        const clarityName = stone ? (masters.labels?.[id(stone.diamondClarityId)] || '') : '';
        variants.push({
          ...(previous?._id ? { _id: previous._id } : {}),
          pricingKey: key,
          combination: [
            purity.name,
            color.name,
            typeName,
            colorName,
            clarityName,
            stone && `${stone.caratWeight}ct`,
          ]
            .filter(Boolean)
            .join(' · '),
          sku:
            previous?.sku ||
            `${product.basicInfo?.sku || 'JEWEL'}-${purity.name}-${stone?.caratWeight ? `${stone.caratWeight}ct-` : ''}${center ? 'C' : 'S'}`,
          stock: previous?.stock ?? 0,
          metalPurityId: id(purity),
          metalColorId: id(color),
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
          sideDiamondWeight: Number(side?.caratWeight || 0),
          sideDiamondCost: round(sideCost),
          diamondCost: round(centerCost + sideCost),
          labourCharge: round(labour),
          computedMakingCharge: round(labour),
          certificateCharge: certificate,
          subtotal: round(subtotal),
          computedGst: round(gst),
          otherAmount: round(extra),
          price: round(finalBeforeMarkup + extra)
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
