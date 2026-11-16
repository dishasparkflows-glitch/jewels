const Return = require('./return.model');
const Order = require('../order/order.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class ReturnService {
  async createReturn(data, user = null) {
    const orderId = data.orderId;
    if (!orderId) throw new ApiError(400, 'Order ID is required');

    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const effectiveUserId = user?._id || order.userId || null;

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

    const items = Array.isArray(data.items) && data.items.length > 0
      ? data.items
      : order.items.map((it) => ({
          productId: it.productId,
          title: it.title,
          sku: it.sku || '',
          price: it.price || 0,
          quantity: it.quantity || 1,
          reason: data.reason || 'Customer Return',
        }));

    const refundAmount = data.refundAmount !== undefined
      ? Number(data.refundAmount)
      : items.reduce((sum, i) => sum + (Number(i.price || 0) * (Number(i.quantity) || 1)), 0);

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
      adminNotes: data.adminNotes || '',
    });

    return returnDoc;
  }

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

  async getReturnById(returnId) {
    const returnDoc = await Return.findById(returnId)
      .populate('orderId')
      .populate('items.productId', 'basicInfo media assets ornate colorImages')
      .lean();
    if (!returnDoc) throw new ApiError(404, 'Return record not found');
    return returnDoc;
  }

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
