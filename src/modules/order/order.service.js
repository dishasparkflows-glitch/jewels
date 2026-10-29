const Order = require('./order.model');
const Cart = require('../cart/cart.model');
const Product = require('../product/product.model');
const couponService = require('../coupon/coupon.service');
const codSequenceService = require('../codSequence/codSequence.service');
const paymentService = require('../payment/payment.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class OrderService {
  /**
   * Helper: Generate a unique human-readable order number
   */
  generateOrderNumber() {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(100000 + Math.random() * 900000);
    return `NJ-${datePart}-${randomPart}`;
  }

  /**
   * Create a new order and initialize payment gateway session
   */
  async createOrder(data, user = null) {
    const effectiveUserId = user?._id || data.userId || null;
    let items = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];

    // If no items passed in request body, retrieve items from the user's saved Cart
    if (items.length === 0 && effectiveUserId) {
      const cart = await Cart.findOne({
        $or: [{ user: effectiveUserId }, { userId: effectiveUserId }],
        'meta.deletedAt': null,
      }).lean();

      if (cart && Array.isArray(cart.items) && cart.items.length > 0) {
        items = cart.items.map((cartItem) => ({
          product: cartItem.product || null,
          productId: cartItem.productId || String(cartItem.product || ''),
          title: cartItem.title || 'Jewellery Item',
          price: Number(cartItem.price) || 0,
          quantity: Number(cartItem.quantity) || 1,
          totalItemPrice: (Number(cartItem.price) || 0) * (Number(cartItem.quantity) || 1),
          originalPrice: cartItem.originalPrice || null,
          image: cartItem.image || null,
          category: cartItem.category || '',
          selectedMetal: cartItem.selectedMetal || '',
          selectedSize: cartItem.selectedSize || '',
          selectedAttributes: cartItem.selectedAttributes || null,
        }));
      }
    }

    if (!items.length) {
      throw new ApiError(400, 'Your bag is empty. Please add items to order.');
    }

    // Format and validate items
    const formattedItems = items.map((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const price = Number(item.price) || 0;
      return {
        product: item.product || null,
        productId: String(item.productId || item.id || item._id || ''),
        title: item.title || item.name || 'Jewellery Item',
        price,
        quantity: qty,
        totalItemPrice: price * qty,
        originalPrice: item.originalPrice || null,
        image: item.image || null,
        category: item.category || '',
        selectedMetal: item.selectedMetal || '',
        selectedSize: item.selectedSize || '',
        selectedAttributes: item.selectedAttributes || null,
      };
    });

    // Calculate subtotal
    const subtotal = formattedItems.reduce((acc, curr) => acc + curr.totalItemPrice, 0);

    // Shipping logic (matching cart: free over ₹5000)
    const shipping = subtotal > 5000 || subtotal === 0 ? 0 : 250;

    // GST (3% on fine jewellery)
    const tax = Math.round(subtotal * 0.03);

    // Coupon discount calculation
    let discount = 0;
    let appliedCoupon = null;
    const couponCode = data.couponCode || data.coupon?.code;

    if (couponCode) {
      try {
        const couponValidation = await couponService.validateCoupon(couponCode, subtotal);
        if (couponValidation?.isValid) {
          discount = Number(couponValidation.discountAmount) || 0;
          appliedCoupon = {
            code: couponValidation.coupon?.code || couponCode.toUpperCase(),
            discountAmount: discount,
            couponId: couponValidation.couponId,
          };
        }
      } catch (err) {
        // If an explicit coupon code was given and is invalid, inform the user
        throw new ApiError(400, `Coupon error: ${err.message}`);
      }
    }

    const total = Math.max(0, subtotal + shipping + tax - discount);

    // COD handling
    const paymentMethod = data.paymentMethod === 'cod' ? 'cod' : 'online';
    let codDueNow = 0;
    let codRemaining = 0;

    if (paymentMethod === 'cod') {
      const codCheck = await codSequenceService.calculateFee(total);
      if (!codCheck.isAvailable) {
        throw new ApiError(400, codCheck.message || 'Cash on Delivery is not available for this order total.');
      }
      codDueNow = Math.min(total, Number(codCheck.charge || 0));
      codRemaining = Math.max(0, total - codDueNow);
    }

    // Shipping address validation
    const shippingAddress = data.shippingAddress || {
      firstName: data.firstName || user?.profile?.firstName || '',
      lastName: data.lastName || user?.profile?.lastName || '',
      fullName: [data.firstName, data.lastName].filter(Boolean).join(' '),
      email: data.email || user?.auth?.email || '',
      phone: data.phone || user?.profile?.phone || '',
      countryCode: data.countryCode || '+91',
      addressLine: data.addressLine || data.street || '',
      apartment: data.apartment || '',
      city: data.city || '',
      state: data.state || '',
      postalCode: data.postalCode || data.pincode || '',
      country: data.country || 'India',
    };

    if (!shippingAddress.addressLine || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
      throw new ApiError(400, 'Complete shipping address is required (addressLine, city, state, postalCode).');
    }

    if (!shippingAddress.phone && !data.phone) {
      throw new ApiError(400, 'Phone number is required for shipping.');
    }

    const customer = {
      firstName: shippingAddress.firstName || user?.profile?.firstName || '',
      lastName: shippingAddress.lastName || user?.profile?.lastName || '',
      email: shippingAddress.email || user?.auth?.email || '',
      phone: shippingAddress.phone || user?.profile?.phone || '',
    };

    const orderNumber = this.generateOrderNumber();
    const chosenProvider = (data.paymentProvider || process.env.DEFAULT_PAYMENT_GATEWAY || 'razorpay').toLowerCase();

    // Create the order document
    const order = new Order({
      orderNumber,
      user: effectiveUserId,
      customer,
      shippingAddress,
      billingAddress: data.billingAddress || shippingAddress,
      items: formattedItems,
      pricing: {
        subtotal,
        shipping,
        tax,
        discount,
        total,
        codDueNow,
        codRemaining,
        paidAmount: 0,
      },
      coupon: appliedCoupon || { code: null, discountAmount: 0, couponId: null },
      payment: {
        method: paymentMethod,
        provider: paymentMethod === 'cod' && codDueNow === 0 ? 'cod' : chosenProvider,
        status: 'pending',
      },
      orderStatus: 'placed',
      timeline: [
        {
          status: 'placed',
          message: `Order ${orderNumber} created`,
          timestamp: new Date(),
        },
      ],
      notes: data.notes || '',
    });

    await order.save();

    // Payment initialization
    let paymentResponse = null;

    if (paymentMethod === 'online' || (paymentMethod === 'cod' && codDueNow > 0)) {
      paymentResponse = await paymentService.initiateOrderPayment({
        order,
        provider: chosenProvider,
      });
    } else {
      // Pure COD with no advance charge required
      order.orderStatus = 'confirmed';
      order.timeline.push({
        status: 'confirmed',
        message: 'Order confirmed with Cash on Delivery',
        timestamp: new Date(),
      });
      await order.save();

      // Clear user's cart
      if (effectiveUserId) {
        await Cart.updateOne(
          { $or: [{ user: effectiveUserId }, { userId: effectiveUserId }] },
          { $set: { items: [] } }
        );
      }
    }

    return {
      order,
      payment: paymentResponse,
    };
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId, user = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    // Authorization: only the owner or an admin can view
    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      if (order.user && order.user.toString() !== user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to view this order');
      }
    }

    return order;
  }

  /**
   * Get order by orderNumber
   */
  async getOrderByNumber(orderNumber, user = null) {
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      if (order.user && order.user.toString() !== user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to view this order');
      }
    }

    return order;
  }

  /**
   * Get orders for the logged-in user
   */
  async getMyOrders(userId, queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = {
      'meta.deletedAt': null,
      $or: [{ user: userId }, { 'customer.email': queryParams.email || '' }].filter(Boolean),
    };

    if (queryParams.orderStatus) {
      filter.orderStatus = queryParams.orderStatus;
    }
    if (queryParams.paymentStatus) {
      filter['payment.status'] = queryParams.paymentStatus;
    }

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  /**
   * Admin: Get all orders with filters
   */
  async getAllOrders(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.orderStatus) {
      filter.orderStatus = queryParams.orderStatus;
    }
    if (queryParams.paymentStatus) {
      filter['payment.status'] = queryParams.paymentStatus;
    }
    if (queryParams.paymentProvider) {
      filter['payment.provider'] = queryParams.paymentProvider;
    }
    if (queryParams.paymentMethod) {
      filter['payment.method'] = queryParams.paymentMethod;
    }
    if (queryParams.search) {
      const reg = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { orderNumber: reg },
        { 'customer.firstName': reg },
        { 'customer.lastName': reg },
        { 'customer.email': reg },
        { 'customer.phone': reg },
      ];
    }

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'profile.firstName profile.lastName auth.email')
        .lean(),
      Order.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, { orderStatus, message }) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    order.orderStatus = orderStatus;
    order.timeline.push({
      status: orderStatus,
      message: message || `Status updated to ${orderStatus}`,
      timestamp: new Date(),
    });

    await order.save();
    return order;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId, user = null, reason = '') {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      if (order.user && order.user.toString() !== user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to cancel this order');
      }
    }

    if (['shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)) {
      throw new ApiError(400, `Order cannot be cancelled as it is already ${order.orderStatus}`);
    }

    order.orderStatus = 'cancelled';
    order.timeline.push({
      status: 'cancelled',
      message: reason ? `Order cancelled: ${reason}` : 'Order cancelled by customer',
      timestamp: new Date(),
    });

    await order.save();
    return order;
  }
}

module.exports = new OrderService();

