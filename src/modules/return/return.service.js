const mongoose = require('mongoose');
const Return = require('./return.model');
const Order = require('../order/order.model');
const ApiError = require('../../utils/ApiError');
const { checkOrderAccess } = require('../order/order.utils');
const { ROLES } = require('../../config/constants');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class ReturnService {
  // ------------------------------- create return request ----------------------------
  async createReturn(data, user = null) {
    if (!user) {
      throw new ApiError(401, 'Authentication required');
    }
    const orderId = data.orderId;
    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      throw new ApiError(400, 'Valid Order ID is required');
    }

    const order = await Order.findOne({ _id: orderId, 'meta.deletedAt': null });
    if (!order) throw new ApiError(404, 'Order not found');

    checkOrderAccess(order, user);

    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(user.role);
    const effectiveUserId = isAdmin ? (order.userId || user._id || null) : user._id;

    // Build pickup address from request or fallback to order shipping address
    const pickupAddress = data.pickupAddress || {
      fullName: order.shippingAddress?.fullName || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim(),
      phone: order.shippingAddress?.phone || order.customer?.phone || '',
      countryCode: order.shippingAddress?.countryCode || '+91',
      addressLine: order.shippingAddress?.addressLine || '',
      apartment: order.shippingAddress?.apartment || '',
      city: order.shippingAddress?.city || '',
      state: order.shippingAddress?.state || '',
      postalCode: order.shippingAddress?.postalCode || '',
      country: order.shippingAddress?.country || 'India',
    };

    let items;
    if (Array.isArray(data.items) && data.items.length > 0 && !isAdmin) {
      const orderItemMap = new Map((order.items || []).map((it) => [String(it.refId), it]));
      items = data.items
        .map((reqItem) => {
          const matched = orderItemMap.get(String(reqItem.productId || reqItem.refId));
          if (!matched) return null;
          const requestedQty = Math.min(Math.max(1, parseInt(reqItem.quantity, 10) || 1), matched.quantity || 1);
          return {
            productId: matched.refId,
            title: matched.title,
            sku: matched.sku || '',
            price: matched.price || 0,
            quantity: requestedQty,
            reason: reqItem.reason || data.reason || 'Customer Return',
          };
        })
        .filter(Boolean);
      if (items.length === 0) {
        throw new ApiError(400, 'Requested return items do not match this order');
      }
    } else if (Array.isArray(data.items) && data.items.length > 0 && isAdmin) {
      items = data.items;
    } else {
      items = order.items.map((it) => ({
        productId: it.refId,
        title: it.title,
        sku: it.sku || '',
        price: it.price || 0,
        quantity: it.quantity || 1,
        reason: data.reason || 'Customer Return',
      }));
    }

    const computedRefundAmount = items.reduce((sum, i) => sum + (Number(i.price || 0) * (Number(i.quantity) || 1)), 0);
    const refundAmount = isAdmin && data.refundAmount !== undefined
      ? Number(data.refundAmount)
      : computedRefundAmount;

    const returnDoc = await Return.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: effectiveUserId,
      customer: {
        firstName: order.customer?.firstName || '',
        lastName: order.customer?.lastName || '',
        email: order.customer?.email || '',
        phone: order.customer?.phone || '',
        countryCode: order.customer?.countryCode || '+91',
      },
      pickupAddress,
      items,
      reason: data.reason || 'Customer Return / Exchange Request',
      status: 'requested',
      refund: {
        amount: refundAmount,
        status: 'pending',
      },
      adminNotes: isAdmin ? (data.adminNotes || '') : '',
    });

    return returnDoc;
  }

  // ------------------------------- get all returns ----------------------------
  async getAllReturns(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = {};

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      const q = queryParams.search.trim();
      filter.$or = [
        { returnNumber: { $regex: q, $options: 'i' } },
        { orderNumber: { $regex: q, $options: 'i' } },
        { 'customer.firstName': { $regex: q, $options: 'i' } },
        { 'customer.phone': { $regex: q, $options: 'i' } },
        { 'shiprocketReturnInfo.awbCode': { $regex: q, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      Return.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('orderId', 'orderNumber orderStatus pricing payment')
        .populate('items.productId', 'basicInfo media assets ornate colorImages')
        .lean(),
      Return.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get my returns ----------------------------
  async getMyReturns(userId, queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { userId };

    const [items, total] = await Promise.all([
      Return.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('orderId', 'orderNumber orderStatus pricing payment')
        .populate('items.productId', 'basicInfo media assets ornate colorImages')
        .lean(),
      Return.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get return by id ----------------------------
  async getReturnById(returnId, user = null) {
    if (!mongoose.isValidObjectId(returnId)) {
      throw new ApiError(400, 'Invalid return ID');
    }
    const returnDoc = await Return.findOne({ _id: returnId, 'meta.deletedAt': null })
      .populate('orderId')
      .populate('items.productId', 'basicInfo media assets ornate colorImages')
      .lean();
    if (!returnDoc) throw new ApiError(404, 'Return record not found');

    if (!user) {
      throw new ApiError(401, 'Authentication required');
    }

    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(user.role);
    if (!isAdmin) {
      const ownerId = returnDoc.userId ? String(returnDoc.userId) : null;
      if (!ownerId || ownerId !== String(user._id)) {
        throw new ApiError(403, 'You do not have permission to access this return');
      }
    }

    return returnDoc;
  }

  // ------------------------------- update return status ----------------------------
  async updateReturnStatus(returnId, { status, adminNotes }) {
    const returnDoc = await Return.findById(returnId);
    if (!returnDoc) throw new ApiError(404, 'Return record not found');

    if (status) returnDoc.status = status;
    if (adminNotes !== undefined) returnDoc.adminNotes = adminNotes;

    await returnDoc.save();
    return returnDoc;
  }
}

module.exports = new ReturnService();
