const Setting = require('../setting/setting.model');
const ApiError = require('../../utils/ApiError');

// ------------------------------- generate order number ----------------------------
async function generateOrderNumber() {
  const mongoose = require('mongoose');
  const Order = mongoose.models.Order || mongoose.model('Order');

  if (typeof Order.generateOrderNumber === 'function') {
    return await Order.generateOrderNumber();
  }

  const lastOrder = await Order.findOne({
    orderNumber: { $regex: /^RJ\/ORD-(\d+)/i },
  })
    .sort({ _id: -1 })
    .select('orderNumber')
    .lean();

  let nextSeq = 1;
  if (lastOrder && lastOrder.orderNumber) {
    const match = lastOrder.orderNumber.match(/^RJ\/ORD-(\d+)/i);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  } else {
    const count = await Order.countDocuments();
    nextSeq = count + 1;
  }

  let candidate = `RJ/ORD-${String(nextSeq).padStart(4, '0')}`;
  while (await Order.exists({ orderNumber: candidate })) {
    nextSeq += 1;
    candidate = `RJ/ORD-${String(nextSeq).padStart(4, '0')}`;
  }

  return candidate;
}

// ------------------------------- resolve payment provider ----------------------------
async function resolvePaymentProvider(requestedProvider) {
  let configured = 'razorpay';
  try {
    const setting = await Setting.findOne({ 'meta.deletedAt': null }).select('paymentProvider').lean();
    if (setting?.paymentProvider) {
      configured = setting.paymentProvider.toLowerCase();
    } else if (process.env.DEFAULT_PAYMENT_GATEWAY) {
      configured = process.env.DEFAULT_PAYMENT_GATEWAY.toLowerCase();
    }
  } catch {
    configured = (process.env.DEFAULT_PAYMENT_GATEWAY || 'razorpay').toLowerCase();
  }
  return (requestedProvider || configured).toLowerCase();
}

// ------------------------------- format order items ----------------------------
function formatOrderItems(items = []) {
  return items.map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const price = Number(item.price) || 0;
    return {
      productId: item.productId,
      title: item.title,
      price,
      quantity: qty,
      totalItemPrice: item.totalItemPrice !== undefined ? Number(item.totalItemPrice) : price * qty,
      selectedMetal: item.selectedMetal || '',
      selectedSize: item.selectedSize || '',
      selectedAttributes: item.selectedAttributes || null,
    };
  });
}

// ------------------------------- map cart items to order items ----------------------------
function mapCartItemsToOrderItems(cartItems = []) {
  return cartItems.map((cartItem) => {
    const qty = Math.max(1, Number(cartItem.quantity) || 1);
    const price = Number(cartItem.price) || 0;
    const prod = cartItem.productId && typeof cartItem.productId === 'object' ? cartItem.productId : null;
    const prodId = prod?._id || cartItem.productId;
    const title = prod?.basicInfo?.title || cartItem.title || '';

    return {
      productId: prodId,
      title,
      price,
      quantity: qty,
      totalItemPrice: Number(cartItem.totalItemPrice) || (price * qty),
      selectedMetal: cartItem.selectedMetal || '',
      selectedSize: cartItem.selectedSize || '',
      selectedAttributes: cartItem.selectedAttributes || null,
    };
  });
}

// ------------------------------- calculate order subtotal ----------------------------
function calculateOrderSubtotal(items = []) {
  return items.reduce((acc, curr) => acc + (Number(curr.totalItemPrice) || 0), 0);
}

// ------------------------------- calculate order shipping ----------------------------
function calculateOrderShipping(subtotal) {
  return subtotal > 5000 || subtotal === 0 ? 0 : 250;
}

// ------------------------------- calculate order tax ----------------------------
function calculateOrderTax(subtotal) {
  return Math.round(subtotal * 0.03);
}

// ------------------------------- calculate order pricing ----------------------------
function calculateOrderPricing({ subtotal, discount = 0, paymentMethod = 'online', codFee = 0 }) {
  const shipping = calculateOrderShipping(subtotal);
  const tax = calculateOrderTax(subtotal);
  const total = Math.max(0, subtotal + shipping + tax - discount);

  let codDueNow = 0;
  let codRemaining = 0;

  if (paymentMethod === 'cod') {
    codDueNow = Math.min(total, Number(codFee || 0));
    codRemaining = Math.max(0, total - codDueNow);
  }

  return {
    subtotal,
    shipping,
    tax,
    discount,
    total,
    codDueNow,
    codRemaining,
    paidAmount: 0,
  };
}

// ------------------------------- build shipping address ----------------------------
function buildShippingAddress(data, user = null) {
  if (data.shippingAddress) {
    const raw = data.shippingAddress.address || data.shippingAddress;
    return {
      firstName: data.shippingAddress.firstName || user?.profile?.firstName || '',
      lastName: data.shippingAddress.lastName || user?.profile?.lastName || '',
      fullName: [data.shippingAddress.firstName || user?.profile?.firstName, data.shippingAddress.lastName || user?.profile?.lastName].filter(Boolean).join(' '),
      email: data.shippingAddress.email || user?.auth?.email || '',
      phone: raw.phone || data.shippingAddress.phone || user?.profile?.phone || '',
      countryCode: data.shippingAddress.countryCode || '+91',
      addressLine: raw.addressLine || raw.street || '',
      apartment: data.shippingAddress.apartment || raw.street || '',
      city: raw.city || '',
      state: raw.state || '',
      postalCode: raw.pincode || raw.postalCode || '',
      country: raw.country || 'India',
    };
  }
  return {
    firstName: data.firstName || user?.profile?.firstName || '',
    lastName: data.lastName || user?.profile?.lastName || '',
    fullName: [data.firstName || user?.profile?.firstName, data.lastName || user?.profile?.lastName].filter(Boolean).join(' '),
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
}

// ------------------------------- validate shipping address ----------------------------
function validateShippingAddress(shippingAddress) {
  if (!shippingAddress.addressLine || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
    throw new ApiError(400, 'Complete shipping address is required (addressLine, city, state, postalCode).');
  }
  if (!shippingAddress.phone) {
    throw new ApiError(400, 'Phone number is required for shipping.');
  }
}

// ------------------------------- build customer info ----------------------------
function buildCustomerInfo(shippingAddress, user = null) {
  return {
    firstName: shippingAddress.firstName || user?.profile?.firstName || '',
    lastName: shippingAddress.lastName || user?.profile?.lastName || '',
    email: shippingAddress.email || user?.auth?.email || '',
    phone: shippingAddress.phone || user?.profile?.phone || '',
  };
}

// ------------------------------- check order access ----------------------------
function checkOrderAccess(order, user = null) {
  if (user && user.role !== 'admin' && user.role !== 'super_admin') {
    const orderOwner = order.userId;
    if (orderOwner && orderOwner.toString() !== user._id.toString()) {
      throw new ApiError(403, 'You do not have permission to access this order');
    }
  }
}

// ------------------------------- build user order filters ----------------------------
function buildUserOrderFilters(userId, queryParams = {}, userEmail = null) {
  const filter = {
    'meta.deletedAt': null,
  };

  if (userId && userEmail) {
    const escapedEmail = String(userEmail).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const emailRegex = new RegExp(`^${escapedEmail}$`, 'i');
    filter.$or = [
      { userId },
      { 'customer.email': emailRegex },
      { 'shippingAddress.email': emailRegex },
    ];
  } else if (userId) {
    filter.userId = userId;
  } else if (userEmail) {
    const escapedEmail = String(userEmail).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const emailRegex = new RegExp(`^${escapedEmail}$`, 'i');
    filter.$or = [
      { 'customer.email': emailRegex },
      { 'shippingAddress.email': emailRegex },
    ];
  }

  if (queryParams.orderStatus && queryParams.orderStatus !== 'all') {
    const statusVal = String(queryParams.orderStatus).toLowerCase();
    if (statusVal === 'pending') {
      filter.orderStatus = { $in: ['placed', 'confirmed', 'pending'] };
    } else if (statusVal === 'processing') {
      filter.orderStatus = { $in: ['processing', 'shipped', 'out_for_delivery'] };
    } else if (statusVal.includes(',')) {
      filter.orderStatus = { $in: statusVal.split(',').map((s) => s.trim()) };
    } else {
      filter.orderStatus = queryParams.orderStatus;
    }
  }
  if (queryParams.paymentStatus) {
    filter['payment.status'] = queryParams.paymentStatus;
  }

  return filter;
}

// ------------------------------- build admin order filters ----------------------------
function buildAdminOrderFilters(queryParams = {}) {
  const filter = { 'meta.deletedAt': null };

  if (queryParams.orderStatus && queryParams.orderStatus !== 'all') {
    const statusVal = String(queryParams.orderStatus).toLowerCase();
    if (statusVal === 'pending') {
      filter.orderStatus = { $in: ['placed', 'confirmed', 'pending'] };
    } else if (statusVal === 'processing') {
      filter.orderStatus = { $in: ['processing', 'shipped', 'out_for_delivery'] };
    } else if (statusVal.includes(',')) {
      filter.orderStatus = { $in: statusVal.split(',').map((s) => s.trim()) };
    } else {
      filter.orderStatus = queryParams.orderStatus;
    }
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

  return filter;
}

module.exports = {
  generateOrderNumber,
  resolvePaymentProvider,
  formatOrderItems,
  mapCartItemsToOrderItems,
  calculateOrderSubtotal,
  calculateOrderShipping,
  calculateOrderTax,
  calculateOrderPricing,
  buildShippingAddress,
  validateShippingAddress,
  buildCustomerInfo,
  checkOrderAccess,
  buildUserOrderFilters,
  buildAdminOrderFilters,
};
