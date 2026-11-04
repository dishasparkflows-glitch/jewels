const Order = require('./order.model');
const Cart = require('../cart/cart.model');
const couponService = require('../coupon/coupon.service');
const codSequenceService = require('../codSequence/codSequence.service');
const paymentService = require('../payment/payment.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const {
  generateOrderNumber,
  resolvePaymentProvider,
  formatOrderItems,
  mapCartItemsToOrderItems,
  calculateOrderSubtotal,
  calculateOrderPricing,
  buildShippingAddress,
  validateShippingAddress,
  buildCustomerInfo,
  checkOrderAccess,
  buildUserOrderFilters,
  buildAdminOrderFilters,
} = require('./order.utils');

class OrderService {
    // ------------------------------- generate order number ----------------------------
  generateOrderNumber() {
    return generateOrderNumber();
  }

    // ------------------------------- create order ----------------------------
  async createOrder(data, user = null) {
    const effectiveUserId = user?._id || data.userId || null;
    let items = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];

    // If no items passed in request body, retrieve items from the user's saved Cart
    if (items.length === 0 && effectiveUserId) {
      const cart = await Cart.findOne({
        userId: effectiveUserId,
      }).populate('items.productId').lean();

      if (cart && Array.isArray(cart.items) && cart.items.length > 0) {
        items = mapCartItemsToOrderItems(cart.items);
      }
    }

    if (!items.length) {
      throw new ApiError(400, 'Your bag is empty. Please add items to order.');
    }

    // Format and validate items without redundant conditions
    const formattedItems = formatOrderItems(items);

    // Calculate subtotal
    const subtotal = calculateOrderSubtotal(formattedItems);

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
        throw new ApiError(400, `Coupon error: ${err.message}`);
      }
    }

    // Payment method & COD checks
    const paymentMethod = data.paymentMethod === 'cod' ? 'cod' : 'online';
    let codCheck = null;

    if (paymentMethod === 'cod') {
      const tentativeTotal = Math.max(0, subtotal - discount);
      codCheck = await codSequenceService.calculateFee(tentativeTotal);
      if (!codCheck.isAvailable) {
        throw new ApiError(400, codCheck.message || 'Cash on Delivery is not available for this order total.');
      }
    }

    // Complete pricing calculations
    const pricing = calculateOrderPricing({
      subtotal,
      discount,
      paymentMethod,
      codFee: codCheck?.charge,
    });

    // Shipping address & Customer snapshot
    const shippingAddress = buildShippingAddress(data, user);
    validateShippingAddress(shippingAddress);
    const customer = buildCustomerInfo(shippingAddress, user);

    const orderNumber = generateOrderNumber();
    const chosenProvider = await resolvePaymentProvider(data.paymentProvider);

    // Create the order document
    const order = new Order({
      orderNumber,
      userId: effectiveUserId,
      customer,
      shippingAddress,
      billingAddress: data.billingAddress || shippingAddress,
      items: formattedItems,
      pricing,
      coupon: appliedCoupon || { code: null, discountAmount: 0, couponId: null },
      payment: {
        method: paymentMethod,
        provider: paymentMethod === 'cod' && pricing.codDueNow === 0 ? 'cod' : chosenProvider,
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

    if (paymentMethod === 'online' || (paymentMethod === 'cod' && pricing.codDueNow > 0)) {
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
          { userId: effectiveUserId },
          { $set: { items: [] } }
        );
      }
    }

    return {
      order,
      payment: paymentResponse,
    };
  }

  async getOrderById(orderId, user = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    checkOrderAccess(order, user);
    return order;
  }

  async getOrderByNumber(orderNumber, user = null) {
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    checkOrderAccess(order, user);
    return order;
  }

    // ------------------------------- get my orders ----------------------------
  async getMyOrders(userId, queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = buildUserOrderFilters(userId, queryParams);

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

    // ------------------------------- get all orders ----------------------------
  async getAllOrders(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = buildAdminOrderFilters(queryParams);

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'profile.firstName profile.lastName auth.email')
        .lean(),
      Order.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

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

  async cancelOrder(orderId, user = null, reason = '') {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    checkOrderAccess(order, user);

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
