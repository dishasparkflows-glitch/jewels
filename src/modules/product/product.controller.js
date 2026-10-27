const productService = require('./product.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class ProductController {
  previewPricing = catchAsync(async (req, res) => {
    ApiResponse.success(res, await productService.previewPricing(req.body), 'Pricing calculated', 200, true);
  });

  // ------------------------------- create product ----------------------------
  create = catchAsync(async (req, res) => {
    const product = await productService.create(req.body);
    ApiResponse.created(res, product, 'Product created successfully');
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

  // ------------------------------- get storefront filters (single lightweight common API) ----------------------------
  getStorefrontFilters = catchAsync(async (req, res) => {
    const data = await productService.getStorefrontFilters(req.query);
    ApiResponse.success(res, data, 'Storefront filters retrieved successfully');
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
    ApiResponse.success(res, product, 'Product updated successfully');
  });

  // ------------------------------- delete product ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await productService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new ProductController();
