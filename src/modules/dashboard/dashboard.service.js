const Product = require('../product/product.model');
const Category = require('../category/category.model');
const User = require('../user/user.model');
const Review = require('../review/review.model');

class DashboardService {
  /**
   * Get dashboard summary counts for top overview cards:
   * - Products: Approved, non-deleted catalog products
   * - Categories: Non-deleted categories
   * - Customers: Non-deleted customer accounts (role: 'user')
   * - Reviews: Non-deleted product reviews
   */
  async getCounts() {
    const [products, categories, customers, reviews] = await Promise.all([
      Product.countDocuments({ 'meta.deletedAt': null, status: 'approved' }),
      Category.countDocuments({ 'meta.deletedAt': null }),
      User.countDocuments({ role: 'user', 'meta.deletedAt': null }),
      Review.countDocuments({ 'meta.deletedAt': null }),
    ]);

    return {
      products,
      categories,
      customers,
      reviews,
      // Direct label keys for frontend indexing
      Products: products,
      Categories: categories,
      Customers: customers,
      Reviews: reviews,
    };
  }
}

module.exports = new DashboardService();
