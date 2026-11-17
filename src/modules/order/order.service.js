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
          const discType = couponValidation.discount?.type || 'Percentage';
          const discVal = Number(couponValidation.discount?.value) || 0;
          appliedCoupon = {
            code: couponValidation.coupon?.code || couponCode.toUpperCase(),
            discountAmount: discount,
            discountType: discType,
            discountValue: discVal,
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

    const orderNumber = await generateOrderNumber();
    const chosenProvider = await resolvePaymentProvider(data.paymentProvider);

    // Create the order document
    const order = new Order({
      orderNumber,
      userId: effectiveUserId,
      customer,
      shippingAddress,
      items: formattedItems,
      pricing,
      coupon: appliedCoupon || { code: null, discountAmount: 0, discountType: null, discountValue: 0, couponId: null },
      payment: {
        method: paymentMethod,
        provider: paymentMethod === 'cod' && pricing.codDueNow === 0 ? 'cod' : chosenProvider,
        status: 'pending',
      },
      orderStatus: 'pending',
      orderTimeline: {
        placed: {
          at: new Date(),
          by: effectiveUserId || null,
        },
        accepted: { at: null, by: null },
        cancelled: { at: null, by: null },
        packed: { at: null },
        shipped: { at: null, by: null },
        delivered: { at: null, by: null },
      },
      notes: data.notes || '',
    });

    await order.save();

    // Payment initialization
    // Payment initialization - Online payment integration temporarily commented out for testing
    let paymentResponse = null;

    /*
    if (paymentMethod === 'online' || (paymentMethod === 'cod' && pricing.codDueNow > 0)) {
      paymentResponse = await paymentService.initiateOrderPayment({
        order,
        provider: chosenProvider,
      });
    } else {
      // Pure COD with no advance charge required
      order.orderStatus = 'pending';
      await order.save();

      // Clear user's cart
      if (effectiveUserId) {
        await Cart.updateOne(
          { userId: effectiveUserId },
          { $set: { items: [] } }
        );
      }
    }
    */

    // Keep order status as pending; mark payment paid if online
    order.orderStatus = 'pending';
    if (paymentMethod === 'online') {
      order.payment.status = 'paid';
      order.payment.paidAt = new Date();
    }
    await order.save();

    // Clear user's cart
    if (effectiveUserId) {
      await Cart.updateOne(
        { userId: effectiveUserId },
        { $set: { items: [] } }
      );
    }

    return {
      order,
      payment: paymentResponse,
    };
  }

  async getOrderById(orderId, user = null) {
    const order = await Order.findById(orderId)
      .populate('userId', 'profile.firstName profile.lastName auth.email')
      .populate('items.productId', 'basicInfo media assets ornate colorImages')
      .populate('orderTimeline.placed.by', 'profile.firstName profile.lastName auth.email role')
      .populate('orderTimeline.accepted.by', 'profile.firstName profile.lastName auth.email role')
      .populate('orderTimeline.cancelled.by', 'profile.firstName profile.lastName auth.email role')
      .populate('orderTimeline.shipped.by', 'profile.firstName profile.lastName auth.email role')
      .populate('orderTimeline.delivered.by', 'profile.firstName profile.lastName auth.email role')
      .lean();
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    checkOrderAccess(order, user);
    return order;
  }

  async getOrderByNumber(orderNumber, user = null) {
    const order = await Order.findOne({ orderNumber })
      .populate('items.productId', 'basicInfo media assets ornate colorImages')
      .populate('orderTimeline.placed.by', 'profile.firstName profile.lastName auth.email role')
      .populate('orderTimeline.accepted.by', 'profile.firstName profile.lastName auth.email role')
      .populate('orderTimeline.cancelled.by', 'profile.firstName profile.lastName auth.email role')
      .populate('orderTimeline.shipped.by', 'profile.firstName profile.lastName auth.email role')
      .populate('orderTimeline.delivered.by', 'profile.firstName profile.lastName auth.email role')
      .lean();
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    checkOrderAccess(order, user);
    return order;
  }

  // ------------------------------- get my orders ----------------------------
  async getMyOrders(userId, queryParams = {}, userEmail = null) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = buildUserOrderFilters(userId, queryParams, userEmail);

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ 'meta.createdAt': -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('items.productId', 'basicInfo media assets ornate colorImages')
        .populate('orderTimeline.placed.by', 'profile.firstName profile.lastName auth.email role')
        .populate('orderTimeline.accepted.by', 'profile.firstName profile.lastName auth.email role')
        .populate('orderTimeline.cancelled.by', 'profile.firstName profile.lastName auth.email role')
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
        .sort({ 'meta.createdAt': -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'profile.firstName profile.lastName auth.email')
        .populate('items.productId', 'basicInfo media assets ornate colorImages')
        .populate('orderTimeline.placed.by', 'profile.firstName profile.lastName auth.email role')
        .populate('orderTimeline.accepted.by', 'profile.firstName profile.lastName auth.email role')
        .populate('orderTimeline.cancelled.by', 'profile.firstName profile.lastName auth.email role')
        .lean(),
      Order.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  async updateOrderStatus(orderId, { orderStatus }, adminUser = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    order.orderStatus = orderStatus;
    if (!order.orderTimeline) {
      order.orderTimeline = {
        placed: { at: order.meta?.createdAt || new Date(), by: order.userId || null },
        accepted: { at: null, by: null },
        cancelled: { at: null, by: null },
        packed: { at: null },
        shipped: { at: null, by: null },
        delivered: { at: null, by: null },
      };
    }

    const now = new Date();
    const adminId = adminUser?._id || adminUser?.id || null;
    const normalizedStatus = String(orderStatus).toLowerCase();

    if (normalizedStatus === 'processing' || normalizedStatus === 'accepted') {
      if (!order.orderTimeline.accepted) order.orderTimeline.accepted = {};
      order.orderTimeline.accepted.at = order.orderTimeline.accepted.at || now;
      if (adminId) order.orderTimeline.accepted.by = adminId;
    } else if (normalizedStatus === 'packed') {
      if (!order.orderTimeline.packed) order.orderTimeline.packed = {};
      order.orderTimeline.packed.at = order.orderTimeline.packed.at || now;
    } else if (normalizedStatus === 'shipped') {
      if (!order.orderTimeline.shipped) order.orderTimeline.shipped = {};
      order.orderTimeline.shipped.at = order.orderTimeline.shipped.at || now;
      if (adminId) order.orderTimeline.shipped.by = adminId;
    } else if (normalizedStatus === 'delivered') {
      if (!order.orderTimeline.delivered) order.orderTimeline.delivered = {};
      order.orderTimeline.delivered.at = order.orderTimeline.delivered.at || now;
      if (adminId) order.orderTimeline.delivered.by = adminId;
    } else if (normalizedStatus === 'cancelled') {
      if (!order.orderTimeline.cancelled) order.orderTimeline.cancelled = {};
      order.orderTimeline.cancelled.at = order.orderTimeline.cancelled.at || now;
      if (adminId) order.orderTimeline.cancelled.by = adminId;
    }

    await order.save();
    return order;
  }

  async cancelOrder(orderId, user = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    checkOrderAccess(order, user);

    if (['shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)) {
      throw new ApiError(400, `Order cannot be cancelled as it is already ${order.orderStatus}`);
    }

    order.orderStatus = 'cancelled';
    if (!order.orderTimeline) {
      order.orderTimeline = {
        placed: { at: order.meta?.createdAt || new Date(), by: order.userId || null },
        accepted: { at: null, by: null },
        cancelled: { at: null, by: null },
        packed: { at: null },
        shipped: { at: null, by: null },
        delivered: { at: null, by: null },
      };
    }
    if (!order.orderTimeline.cancelled) order.orderTimeline.cancelled = {};
    order.orderTimeline.cancelled.at = new Date();
    order.orderTimeline.cancelled.by = user?._id || user?.id || null;

    await order.save();
    return order;
  }
}

module.exports = new OrderService();
