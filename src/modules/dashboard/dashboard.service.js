const Product = require('../product/product.model');
const Appointment = require('../appointment/appointment.model');
const User = require('../user/user.model');
const Review = require('../review/review.model');
const Order = require('../order/order.model');

const extractFirstProductImage = (prod) => {
  if (!prod) return null;

  if (Array.isArray(prod.colorImages)) {
    for (const group of prod.colorImages) {
      if (!Array.isArray(group?.images)) continue;
      const img = group.images.find((m) => m?.url && m?.mediaType !== 'video') || group.images.find((m) => m?.url);
      if (img?.url) return img.url;
    }
  }

  const ornateImgs = prod.ornate?.ornateImages || prod.ornateImages;
  if (Array.isArray(ornateImgs)) {
    const img = ornateImgs.find((m) => m?.url && m?.mediaType !== 'video') || ornateImgs.find((m) => m?.url);
    if (img?.url) return img.url;
  }

  return null;
};

class DashboardService {
  // ------------------------------- GET Dashboard Summary Counts ----------------------------
  /**
   * Get dashboard summary counts for top overview cards:
   * - Products: Approved, non-deleted catalog products
   * - Appointments: Non-deleted customer appointments
   * - Customers: Non-deleted customer accounts (role: 'user')
   * - Reviews: Non-deleted product reviews
   * - Orders: Non-deleted customer orders
   */
  async getCounts() {
    const [products, appointments, customers, reviews, orders] = await Promise.all([
      Product.countDocuments({ 'meta.deletedAt': null, status: 'approved' }),
      Appointment.countDocuments({ 'meta.deletedAt': null }),
      User.countDocuments({ role: 'user', 'meta.deletedAt': null }),
      Review.countDocuments({ 'meta.deletedAt': null }),
      Order.countDocuments({ 'meta.deletedAt': null }),
    ]);

    return {
      products,
      appointments,
      customers,
      reviews,
      orders,
    };
  }

  // ------------------------------- GET Top Selling Products ----------------------------
  /**
   * Get top selling products ranked by order count & quantity sold
   * @param {number} limit
   */
  async getTopSellingProducts(limit = 5) {
    const topFromOrders = await Order.aggregate([
      { $match: { 'meta.deletedAt': null, orderStatus: { $nin: ['cancelled', 'returned'] } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.refId',
          title: { $first: '$items.title' },
          sku: { $first: '$items.sku' },
          price: { $first: '$items.price' },
          ordersCount: { $sum: 1 },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalItemPrice' },
        },
      },
      { $sort: { ordersCount: -1, totalQuantity: -1 } },
      { $limit: limit },
    ]);

    const productIds = topFromOrders.map((t) => t._id).filter(Boolean);
    const productsMap = new Map();
    if (productIds.length > 0) {
      const products = await Product.find({ _id: { $in: productIds } })
        .select('basicInfo pricing colorImages ornate.ornateImages')
        .lean();
      products.forEach((p) => productsMap.set(String(p._id), p));
    }

    const result = topFromOrders.map((item, idx) => {
      const prod = productsMap.get(String(item._id));
      const title = prod?.basicInfo?.title || item.title || 'Untitled Jewelry';
      const sku = prod?.basicInfo?.sku || item.sku || 'SKU-N/A';
      const price = item.price || prod?.pricing?.salePrice || prod?.pricing?.calculatedPrice || prod?.pricing?.mrp || 0;
      const imageUrl = extractFirstProductImage(prod);

      return {
        _id: prod?._id || item._id,
        rank: idx + 1,
        basicInfo: prod?.basicInfo || { title, sku },
        price,
        formattedPrice: `₹${Number(price).toLocaleString('en-IN')}`,
        ordersCount: item.ordersCount || 1,
        totalQuantity: item.totalQuantity || 1,
        imageUrl,
        images: imageUrl ? [imageUrl] : [],
      };
    });

    // If fewer than limit items from orders, fill with active/approved catalog products
    if (result.length < limit) {
      const remaining = limit - result.length;
      const existingIds = result.map((r) => r._id).filter(Boolean);
      const fallbackProducts = await Product.find({
        'meta.deletedAt': null,
        status: 'approved',
        _id: { $nin: existingIds },
      })
        .select('basicInfo pricing colorImages ornate.ornateImages')
        .sort({ 'meta.createdAt': -1, createdAt: -1 })
        .limit(remaining)
        .lean();

      fallbackProducts.forEach((prod) => {
        const price = prod.pricing?.salePrice || prod.pricing?.calculatedPrice || prod.pricing?.mrp || 0;
        const imageUrl = extractFirstProductImage(prod);

        result.push({
          _id: prod._id,
          rank: result.length + 1,
          basicInfo: prod.basicInfo,
          price,
          formattedPrice: `₹${Number(price).toLocaleString('en-IN')}`,
          ordersCount: 0,
          totalQuantity: 0,
          imageUrl,
          images: imageUrl ? [imageUrl] : [],
        });
      });
    }

    return result;
  }

  // ------------------------------- GET Recent Orders ----------------------------
  /**
   * Get recent orders with customer name, amount, and fulfillment status
   * @param {number} limit
   */
  async getRecentOrders(limit = 5) {
    const orders = await Order.find({ 'meta.deletedAt': null })
      .sort({ 'meta.createdAt': -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return orders.map((order) => {
      const customerName =
        order.shippingAddress?.fullName ||
        [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') ||
        [order.shippingAddress?.firstName, order.shippingAddress?.lastName].filter(Boolean).join(' ') ||
        order.customer?.email ||
        'Guest Customer';

      return {
        _id: order._id,
        orderId: order.orderNumber || `ORD-${String(order._id).slice(-4).toUpperCase()}`,
        orderNumber: order.orderNumber,
        customer: customerName,
        amount: order.pricing?.total ?? 0,
        formattedAmount: `₹${Number(order.pricing?.total ?? 0).toLocaleString('en-IN')}`,
        status: order.orderStatus || 'pending',
        createdAt: order.meta?.createdAt || order.createdAt,
      };
    });
  }
}

module.exports = new DashboardService();
