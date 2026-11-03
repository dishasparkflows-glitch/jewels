const mongoose = require('mongoose');
const productService = require('./product.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const GoldPrice = require('../goldPrice/goldPrice.model');
const MetalPurity = require('../metalPurity/metalPurity.model');
const CenterDiamondPrice = require('../centerDiamondPrice/centerDiamondPrice.model');
const SideDiamondPrice = require('../sideDiamondPrice/sideDiamondPrice.model');
const { calculateEffectiveWeight } = require('./product.pricing');

class ProductController {
  // ------------------------------- calculate single product/variant price ----------------------------
  calculateProductPrice = catchAsync(async (req, res) => {
    try {
      const {
        metalWeight,
        metalPurityId,
        centerDiamonds = [],
        sideDiamonds = [],
        labourCharge = 0,
        gstPercentage = 0,
        certificateCharge = 0,
        isCalculated = false,
      } = req.body;

      // 1. Fetch Metal master data
      const goldPriceMaster = await GoldPrice.findOne().lean();
      const metalPurity = metalPurityId ? await MetalPurity.findById(metalPurityId).lean() : null;

      // 2. METAL COST & DISPLAY RATE
      let metalCost = 0;
      let effectiveWeight = parseFloat(metalWeight) || 0;
      let goldRatePerGram = 0;

      const primaryCenterCarat = centerDiamonds[0]?.caratWeight || 0;
      const parsedBaseCarat = parseFloat(req.body.baseCarat);
      const baseCarat = (!isNaN(parsedBaseCarat) && parsedBaseCarat > 0) ? parsedBaseCarat : (primaryCenterCarat || 1);

      if (metalPurity && goldPriceMaster) {
        if (!isCalculated) {
          effectiveWeight = calculateEffectiveWeight(metalWeight, metalPurity, primaryCenterCarat, baseCarat);
        }

        if (metalPurity.metalType === 'Platinum') {
          goldRatePerGram = goldPriceMaster.platinumRate || 0;
        } else if (metalPurity.metalType === 'Silver') {
          goldRatePerGram = goldPriceMaster.silverRate || 0;
        } else {
          goldRatePerGram = parseFloat(((goldPriceMaster.base24KRate / 24) * (metalPurity.karat || 0)).toFixed(2));
        }

        metalCost = goldRatePerGram * effectiveWeight;
      }

      // 3. CENTER DIAMOND COST
      let totalCenterCost = 0;
      if (centerDiamonds.length > 0) {
        const centerConditions = centerDiamonds
          .filter(d =>
            d.diamondTypeId && mongoose.Types.ObjectId.isValid(d.diamondTypeId) &&
            d.diamondClarityId && mongoose.Types.ObjectId.isValid(d.diamondClarityId) &&
            d.diamondColorId && mongoose.Types.ObjectId.isValid(d.diamondColorId)
          )
          .map(d => ({
            diamondTypeId: new mongoose.Types.ObjectId(d.diamondTypeId),
            diamondClarityId: new mongoose.Types.ObjectId(d.diamondClarityId),
            diamondColorId: new mongoose.Types.ObjectId(d.diamondColorId)
          }));

        const centerPrices = centerConditions.length > 0
          ? await CenterDiamondPrice.find({ $or: centerConditions, 'meta.deletedAt': null }).lean()
          : [];

        centerDiamonds.forEach(d => {
          if (!d.diamondTypeId || !d.diamondClarityId || !d.diamondColorId) return;
          const caratWeight = parseFloat(d.caratWeight) || 0;

          let match = centerPrices.find(p =>
            p.diamondTypeId?.toString() === d.diamondTypeId?.toString() &&
            (!d.diamondShapeId || !p.diamondShapeId || p.diamondShapeId?.toString() === d.diamondShapeId?.toString()) &&
            p.diamondClarityId?.toString() === d.diamondClarityId?.toString() &&
            p.diamondColorId?.toString() === d.diamondColorId?.toString() &&
            caratWeight >= (p.sizeFrom || 0) && caratWeight <= (p.sizeTo || 0)
          );

          if (!match) {
            match = centerPrices.find(p =>
              p.diamondTypeId?.toString() === d.diamondTypeId?.toString() &&
              (!d.diamondShapeId || !p.diamondShapeId || p.diamondShapeId?.toString() === d.diamondShapeId?.toString()) &&
              p.diamondClarityId?.toString() === d.diamondClarityId?.toString() &&
              p.diamondColorId?.toString() === d.diamondColorId?.toString()
            );
          }

          const ratePerCarat = match?.priceINR || 0;
          totalCenterCost += ratePerCarat * caratWeight;
        });
      }

      // 4. SIDE DIAMOND COST
      let totalSideCost = 0;
      if (sideDiamonds.length > 0) {
        const sideConditions = sideDiamonds
          .filter(d =>
            d.diamondTypeId && mongoose.Types.ObjectId.isValid(d.diamondTypeId) &&
            d.sizeFrom !== undefined && d.sizeTo !== undefined &&
            !isNaN(d.sizeFrom) && !isNaN(d.sizeTo) &&
            isFinite(d.sizeFrom) && isFinite(d.sizeTo)
          )
          .map(d => ({
            diamondTypeId: new mongoose.Types.ObjectId(d.diamondTypeId),
            sizeFrom: Number(d.sizeFrom),
            sizeTo: Number(d.sizeTo)
          }));

        const sidePrices = sideConditions.length > 0
          ? await SideDiamondPrice.find({ $or: sideConditions, 'meta.deletedAt': null }).lean()
          : [];

        sideDiamonds.forEach(d => {
          if (!d.diamondTypeId) return;

          let ratePerCarat = parseFloat(d.priceINR || d.rate) || 0;

          if (ratePerCarat <= 0) {
            const targetShapeId = (d.diamondShapeId || d.diamondShape)?._id || d.diamondShapeId || d.diamondShape;
            const targetClarityId = (d.diamondClarityId || d.diamondClarity)?._id || d.diamondClarityId || d.diamondClarity;
            const targetColorId = (d.diamondColorId || d.diamondColor)?._id || d.diamondColorId || d.diamondColor;

            let match = sidePrices.find(p =>
              p.diamondTypeId?.toString() === d.diamondTypeId?.toString() &&
              (!targetShapeId || !p.diamondShapeId || p.diamondShapeId?.toString() === targetShapeId.toString()) &&
              (!targetClarityId || !p.diamondClarityId || p.diamondClarityId?.toString() === targetClarityId.toString()) &&
              (!targetColorId || !p.diamondColorId || p.diamondColorId?.toString() === targetColorId.toString()) &&
              Number(p.sizeFrom) === Number(d.sizeFrom) &&
              Number(p.sizeTo) === Number(d.sizeTo)
            );

            if (!match) {
              match = sidePrices.find(p =>
                p.diamondTypeId?.toString() === d.diamondTypeId?.toString() &&
                Number(p.sizeFrom) === Number(d.sizeFrom) &&
                Number(p.sizeTo) === Number(d.sizeTo)
              );
            }
            ratePerCarat = match?.priceINR || 0;
          }

          const caratWeight = parseFloat(d.caratWeight) || 0;
          totalSideCost += ratePerCarat * caratWeight;
        });
      }

      // 5. TOTALS
      const totalMakingCharge = isCalculated
        ? (parseFloat(labourCharge) || 0)
        : effectiveWeight * (parseFloat(labourCharge) || 0);

      const totalDiamondCost = totalCenterCost + totalSideCost;
      const baseTotal = metalCost + totalDiamondCost + totalMakingCharge + (parseFloat(certificateCharge) || 0);
      const gstAmount = (baseTotal * (parseFloat(gstPercentage) || 0)) / 100;
      const finalPrice = parseFloat((baseTotal + gstAmount).toFixed(2));

      return res.status(200).json({
        success: true,
        data: {
          metalCost: parseFloat(metalCost.toFixed(2)),
          metalRate: goldRatePerGram,
          centerDiamondCost: parseFloat(totalCenterCost.toFixed(2)),
          sideDiamondCost: parseFloat(totalSideCost.toFixed(2)),
          diamondCost: parseFloat(totalDiamondCost.toFixed(2)),
          totalMakingCharge: parseFloat(totalMakingCharge.toFixed(2)),
          certificateCharge: parseFloat((parseFloat(certificateCharge) || 0).toFixed(2)),
          gstAmount: parseFloat(gstAmount.toFixed(2)),
          finalPrice,
          effectiveWeight: parseFloat(effectiveWeight.toFixed(3)),
          appliedGst: parseFloat(gstPercentage) || 0
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Pricing calculation failed'
      });
    }
  });

  previewPricing = catchAsync(async (req, res) => {
    ApiResponse.success(res, await productService.previewPricing(req.body), 'Pricing calculated', 200, true);
  });

  // ------------------------------- create product ----------------------------
  create = catchAsync(async (req, res) => {
    const product = await productService.create(req.body);
    ApiResponse.created(res, null, 'Product created successfully');
  });

  // ------------------------------- get home products (streamlined info) ----------------------------
  getHomeProducts = catchAsync(async (req, res) => {
    const data = await productService.getHomeProducts(req.query, req.user?._id);
    ApiResponse.success(res, data, 'Home products retrieved successfully');
  });

  // ------------------------------- get storefront products (clean lightweight info) ----------------------------
  getStorefrontProducts = catchAsync(async (req, res) => {
    const { items, pagination, facets } = await productService.getStorefrontProducts(req.query, req.user?._id);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Storefront products retrieved successfully',
      facets
    );
  });

  // ------------------------------- get search storefront products (clean lightweight info) ----------------------------
  getSearchStorefront = catchAsync(async (req, res) => {
    const { items, pagination } = await productService.getSearchStorefront(req.query, req.user?._id);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Storefront search results retrieved successfully'
    );
  });

  // ------------------------------- get all products ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination, facets } = await productService.getAll(req.query, req.user?._id);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Products retrieved successfully',
      facets
    );
  });


  // ------------------------------- get product lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const { items, pagination } = await productService.getLookup(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Product lookup list retrieved successfully'
    );
  });

  // ------------------------------- get one product ----------------------------
  getOne = catchAsync(async (req, res) => {
    const product = await productService.getOne(req.params.id, req.user?._id);
    ApiResponse.success(res, product, 'Product retrieved successfully');
  });

  // ------------------------------- get product by sku or tag ----------------------------
  getBySkuOrTag = catchAsync(async (req, res) => {
    const product = await productService.getBySkuOrTag(req.params.code, req.user?._id);
    ApiResponse.success(res, product, 'Product retrieved successfully');
  });

  // ------------------------------- update product ----------------------------
  update = catchAsync(async (req, res) => {
    const product = await productService.update(req.params.id, req.body);
    ApiResponse.success(res, null, 'Product updated successfully');
  });

  // ------------------------------- delete product ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await productService.delete(req.params.id);
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new ProductController();
