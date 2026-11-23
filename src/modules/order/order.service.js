const Order = require('./order.model');
const Cart = require('../cart/cart.model');
const Setting = require('../setting/setting.model');
const couponService = require('../coupon/coupon.service');
const codSequenceService = require('../codSequence/codSequence.service');
const paymentService = require('../payment/payment.service');
const whatsappService = require('../whatsapp/whatsapp.service');
const { sendEmail } = require('../../utils/emailService');
const { generateInvoicePDF } = require('../../utils/invoiceGenerator');
const { getInvoiceEmailHtml } = require('../../template');
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
    const formattedItems = await formatOrderItems(items);

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
        shipped: { at: null, by: null },
        delivered: { at: null, by: null },
      },
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
      order.orderStatus = 'pending';
      order.payment.status = 'pending';
      await order.save();

      // Clear user's cart
      if (effectiveUserId) {
        await Cart.updateOne(
          { userId: effectiveUserId },
          { $set: { items: [] } }
        );
      }

      // Automated Dispatch: Generate PDF invoice and deliver to customer email in background
      this.dispatchInvoice(order._id, ['email']).catch((err) => {
        console.warn('[AutoInvoice] Background order invoice dispatch failed:', err.message);
      });
    }

    return {
      order,
      payment: paymentResponse,
    };
  }

  // ------------------------------- get order for invoice ----------------------------
  async getOrderForInvoice(orderId) {
    const order = await Order.findById(orderId)
      .populate('userId', 'profile.firstName profile.lastName auth.email')
      .populate('items.productId', 'basicInfo media assets ornate colorImages')
      .lean();
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    return order;
  }

  // ------------------------------- get store setting ----------------------------
  async getStoreSetting() {
    try {
      return (await Setting.findOne({ 'meta.deletedAt': null }).lean()) || (await Setting.findOne().lean()) || {};
    } catch (_) {
      return {};
    }
  }

  // ------------------------------- generate order invoice ----------------------------
  async generateOrderInvoice(orderId, user = null) {
    const order = await this.getOrderForInvoice(orderId);
    if (user && user.role !== 'admin' && user.role !== 'superadmin') {
      checkOrderAccess(order, user);
    }
    const setting = await this.getStoreSetting();
    const pdfBuffer = await generateInvoicePDF(order, { setting });
    return { order, pdfBuffer };
  }

  // ------------------------------- dispatch invoice ----------------------------
  async dispatchInvoice(orderId, methods = ['email', 'whatsapp']) {
    const order = await this.getOrderForInvoice(orderId);
    const setting = await this.getStoreSetting();
    const pdfBuffer = await generateInvoicePDF(order, { setting });

    const brandName = setting?.businessDetails?.companyName || 'NEIRAH';
    const brandPrefix = brandName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const safeOrderNum = (order.orderNumber || 'ORD').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${brandPrefix || 'NEIRAH'}_INVOICE_${safeOrderNum}.pdf`;
    const dispatched = [];
    const errors = [];

    // 1. Email Dispatch
    if (methods.includes('email')) {
      const recipientEmail =
        order.customer?.email ||
        order.shippingAddress?.email ||
        order.userId?.auth?.email;

      if (recipientEmail) {
        try {
          await sendEmail({
            to: recipientEmail,
            subject: `${brandName}: Invoice for Order #${order.orderNumber}`,
            text: `Dear Customer,\n\nPlease find attached your tax invoice for Order #${order.orderNumber}.\n\nThank you for choosing ${brandName}.\n\nWarm regards,\n${brandName} Team`,
            html: getInvoiceEmailHtml({ order, setting }),
            attachments: [
              {
                filename,
                content: pdfBuffer,
              },
            ],
          });
          dispatched.push('email');
        } catch (err) {
          console.error('[OrderService] Invoice email dispatch failed:', err.message);
          errors.push(`Email error: ${err.message}`);
        }
      } else {
        errors.push('No recipient email found for this order.');
      }
    }

    // 2. WhatsApp Dispatch
    if (methods.includes('whatsapp')) {
      const recipientPhone =
        order.customer?.phone ||
        order.shippingAddress?.phone;

      if (recipientPhone) {
        try {
          const waResult = await whatsappService.sendWhatsAppInvoice(recipientPhone, pdfBuffer, order.orderNumber);
          if (waResult?.success) {
            dispatched.push('whatsapp');
          } else {
            errors.push(`WhatsApp error: ${waResult?.error || 'Failed to dispatch WhatsApp message'}`);
          }
        } catch (err) {
          console.error('[OrderService] Invoice WhatsApp dispatch failed:', err.message);
          errors.push(`WhatsApp error: ${err.message}`);
        }
      } else {
        errors.push('No recipient phone number found for this order.');
      }
    }

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      dispatched,
      errors: errors.length > 0 ? errors : null,
      pdfBuffer,
    };
  }


  // ------------------------------- get order by id ----------------------------
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

  // ------------------------------- get order by number ----------------------------
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
  
  // ------------------------------- update order status ----------------------------
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

  // ------------------------------- cancel order ----------------------------
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

  // ------------------------------- delete order ----------------------------
  async deleteOrder(id, adminUser = null) {
    const item = await Order.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          'meta.deletedAt': new Date(),
          'meta.deletedBy': adminUser?._id || adminUser?.id || null,
        },
      },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Order not found');
    }

    return { message: 'Order deleted successfully', id };
  }

  // ------------------------------- bulk delete orders ----------------------------
  async bulkDeleteOrders(ids, adminUser = null) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of order IDs to delete');
    }

    const result = await Order.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          'meta.deletedAt': new Date(),
          'meta.deletedBy': adminUser?._id || adminUser?.id || null,
        },
      }
    );

    return {
      message: `${result.modifiedCount} order(s) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }
}

module.exports = new OrderService();
