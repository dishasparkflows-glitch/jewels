const mongoose = require('mongoose');
const Setting = require('../setting/setting.model');
const ApiError = require('../../utils/ApiError');
const { PAYMENT_PROVIDER } = require('../../config/constants');

// ------------------------------- generate order number ----------------------------
async function generateOrderNumber() {
  return mongoose.model('Order').generateOrderNumber();
}

// ------------------------------- resolve payment provider ----------------------------
async function resolvePaymentProvider(requestedProvider) {
  let configured = 'razorpay';
  try {
    const setting = await Setting.findOne({ 'meta.deletedAt': null })
      .select('paymentProvider')
      .lean();
    if (setting?.paymentProvider) {
      configured = setting.paymentProvider.toLowerCase();
    } else if (PAYMENT_PROVIDER) {
      configured = PAYMENT_PROVIDER.toLowerCase();
    }
  } catch {
    configured = (PAYMENT_PROVIDER || 'razorpay').toLowerCase();
  }
  return (requestedProvider || configured).toLowerCase();
}

// ------------------------------- format order items ----------------------------
async function formatOrderItems(items = []) {
  const Product = mongoose.model('Product');
  const Diamond = mongoose.model('Diamond');

  // Extract all valid ref IDs to query in DB
  const itemIds = items
    .map((item) => {
      const rawId = item.refId?._id || item.refId || item.productId?._id || item.productId || item.id || item._id;
      return mongoose.isValidObjectId(rawId) ? String(rawId) : null;
    })
    .filter(Boolean);

  const productMap = new Map();
  const diamondMap = new Map();
  if (itemIds.length > 0) {
    try {
      const [prods, diams] = await Promise.all([
        Product.find({ _id: { $in: itemIds } }).select('basicInfo pricing').lean(),
        Diamond.find({ _id: { $in: itemIds } }).select('sku title price carat').lean(),
      ]);
      prods.forEach((p) => productMap.set(String(p._id), p));
      diams.forEach((d) => diamondMap.set(String(d._id), d));
    } catch (err) {
      console.warn('Failed to fetch products/diamonds for SKU fallback in order items:', err.message);
    }
  }

  return items.map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const price = Number(item.price) || 0;
    const rawRefId = item.refId?._id || item.refId || item.productId?._id || item.productId || item.id || item._id;
    const refIdStr = String(rawRefId || '');
    const dbProduct = productMap.get(refIdStr);
    const dbDiamond = diamondMap.get(refIdStr);
    const isDiamond = Boolean(item.itemType === 'diamond' || (!dbProduct && dbDiamond));
    const resolvedItemType = isDiamond ? 'diamond' : 'product';

    const refDoc = typeof item.refId === 'object' ? item.refId : null;
    const resolvedSku =
      item.sku ||
      refDoc?.sku ||
      refDoc?.basicInfo?.sku ||
      dbDiamond?.sku ||
      dbProduct?.basicInfo?.sku ||
      '';

    const resolvedTitle =
      item.title ||
      refDoc?.title ||
      refDoc?.basicInfo?.title ||
      dbDiamond?.title ||
      dbProduct?.basicInfo?.title ||
      '';

    return {
      itemType: resolvedItemType,
      refId: rawRefId,
      title: resolvedTitle,
      sku: resolvedSku,
      price,
      quantity: qty,
      totalItemPrice:
        item.totalItemPrice !== undefined
          ? Number(item.totalItemPrice)
          : price * qty,
      selectedMetal: item.selectedMetal || '',
      selectedSize: item.selectedSize || '',
      selectedAttributes: item.selectedAttributes || null
    };
  });
}

// ------------------------------- map cart items to order items ----------------------------
function mapCartItemsToOrderItems(cartItems = []) {
  return cartItems.map((cartItem) => {
    const qty = Math.max(1, Number(cartItem.quantity) || 1);
    const price = Number(cartItem.price) || 0;
    const doc = cartItem.refId && typeof cartItem.refId === 'object' ? cartItem.refId : null;
    const itemType = cartItem.itemType || 'product';
    const isDiamond = itemType === 'diamond';
    const refId = doc?._id || cartItem.refId;
    const title = isDiamond
      ? (doc?.title || cartItem.title || '')
      : (doc?.basicInfo?.title || doc?.title || cartItem.title || '');
    const sku = cartItem.sku || (isDiamond ? doc?.sku : doc?.basicInfo?.sku) || '';

    return {
      itemType,
      refId,
      title,
      sku,
      price,
      quantity: qty,
      totalItemPrice: Number(cartItem.totalItemPrice) || price * qty,
      selectedMetal: cartItem.selectedMetal || '',
      selectedSize: cartItem.selectedSize || '',
      selectedAttributes: cartItem.selectedAttributes || null
    };
  });
}

// ------------------------------- calculate order subtotal ----------------------------
function calculateOrderSubtotal(items = []) {
  return items.reduce(
    (acc, curr) => acc + (Number(curr.totalItemPrice) || 0),
    0
  );
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
function calculateOrderPricing({
  subtotal,
  discount = 0,
  paymentMethod = 'online',
  codFee = 0
}) {
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
    paidAmount: 0
  };
}

// ------------------------------- build shipping address ----------------------------
function buildShippingAddress(data, user = null) {
  if (data.shippingAddress) {
    const raw = data.shippingAddress.address || data.shippingAddress;
    return {
      firstName:
        data.shippingAddress.firstName || user?.profile?.firstName || '',
      lastName: data.shippingAddress.lastName || user?.profile?.lastName || '',
      fullName: [
        data.shippingAddress.firstName || user?.profile?.firstName,
        data.shippingAddress.lastName || user?.profile?.lastName
      ]
        .filter(Boolean)
        .join(' '),
      email: data.shippingAddress.email || user?.auth?.email || '',
      phone:
        raw.phone || data.shippingAddress.phone || user?.profile?.phone || '',
      countryCode: data.shippingAddress.countryCode || '+91',
      addressLine: raw.addressLine || raw.street || '',
      apartment: data.shippingAddress.apartment || raw.street || '',
      city: raw.city || '',
      state: raw.state || '',
      postalCode: raw.pincode || raw.postalCode || '',
      country: raw.country || 'India'
    };
  }
  return {
    firstName: data.firstName || user?.profile?.firstName || '',
    lastName: data.lastName || user?.profile?.lastName || '',
    fullName: [
      data.firstName || user?.profile?.firstName,
      data.lastName || user?.profile?.lastName
    ]
      .filter(Boolean)
      .join(' '),
    email: data.email || user?.auth?.email || '',
    phone: data.phone || user?.profile?.phone || '',
    countryCode: data.countryCode || '+91',
    addressLine: data.addressLine || data.street || '',
    apartment: data.apartment || '',
    city: data.city || '',
    state: data.state || '',
    postalCode: data.postalCode || data.pincode || '',
    country: data.country || 'India'
  };
}

// ------------------------------- validate shipping address ----------------------------
function validateShippingAddress(shippingAddress) {
  if (
    !shippingAddress.addressLine ||
    !shippingAddress.city ||
    !shippingAddress.state ||
    !shippingAddress.postalCode
  ) {
    throw new ApiError(
      400,
      'Complete shipping address is required (addressLine, city, state, postalCode).'
    );
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
    countryCode:
      shippingAddress.countryCode || user?.profile?.countryCode || '+91'
  };
}

// ------------------------------- check order access ----------------------------
function checkOrderAccess(order, user = null) {
  // Admin / super admin has access
  if (user && (user.role === 'admin' || user.role === 'super_admin')) {
    return;
  }

  const rawOwner = order.userId;
  const ownerId = rawOwner?._id
    ? rawOwner._id.toString()
    : rawOwner
      ? rawOwner.toString()
      : null;

  // If order belongs to an authenticated user, an unauthenticated guest cannot access it
  if (ownerId && !user) {
    throw new ApiError(401, 'Authentication required to access this order');
  }

  if (user) {
    const currentUserId = user._id ? user._id.toString() : null;

    // Direct owner ID match
    if (ownerId && currentUserId && ownerId === currentUserId) {
      return;
    }

    // Email match fallback (e.g. order placed with account email)
    const userEmail = (user.auth?.email || user.email || '')
      .toLowerCase()
      .trim();
    const customerEmail = (
      order.customer?.email ||
      order.shippingAddress?.email ||
      ''
    )
      .toLowerCase()
      .trim();
    if (userEmail && customerEmail && userEmail === customerEmail) {
      return;
    }

    if (ownerId && currentUserId && ownerId !== currentUserId) {
      throw new ApiError(
        403,
        'You do not have permission to access this order'
      );
    }
  }
}

// ------------------------------- build user order filters ----------------------------
function buildUserOrderFilters(userId, queryParams = {}, userEmail = null) {
  const filter = {
    'meta.deletedAt': null
  };

  if (userId && userEmail) {
    const escapedEmail = String(userEmail).replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
    const emailRegex = new RegExp(`^${escapedEmail}$`, 'i');
    filter.$or = [
      { userId },
      { 'customer.email': emailRegex },
      { 'shippingAddress.email': emailRegex }
    ];
  } else if (userId) {
    filter.userId = userId;
  } else if (userEmail) {
    const escapedEmail = String(userEmail).replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
    const emailRegex = new RegExp(`^${escapedEmail}$`, 'i');
    filter.$or = [
      { 'customer.email': emailRegex },
      { 'shippingAddress.email': emailRegex }
    ];
  }

  if (queryParams.orderStatus && queryParams.orderStatus !== 'all') {
    const statusVal = String(queryParams.orderStatus).toLowerCase();
    if (statusVal === 'pending') {
      filter.orderStatus = 'pending';
    } else if (statusVal === 'processing') {
      filter.orderStatus = {
        $in: ['processing', 'shipped', 'out_for_delivery']
      };
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

  const status = queryParams.orderStatus || queryParams.status;
  if (status && status !== 'all') {
    const statusVal = String(status).toLowerCase();
    if (statusVal === 'pending') {
      filter.orderStatus = 'pending';
    } else if (statusVal === 'processing') {
      filter.orderStatus = {
        $in: ['processing', 'accepted']
      };
    } else if (statusVal === 'shipped') {
      filter.orderStatus = {
        $in: ['shipped', 'out_for_delivery']
      };
    } else if (statusVal.includes(',')) {
      filter.orderStatus = { $in: statusVal.split(',').map((s) => s.trim()) };
    } else {
      filter.orderStatus = statusVal;
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
    const escaped = String(queryParams.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reg = new RegExp(escaped, 'i');
    filter.$or = [
      { orderNumber: reg },
      { 'customer.firstName': reg },
      { 'customer.lastName': reg },
      { 'customer.email': reg },
      { 'customer.phone': reg },
      { 'shippingAddress.fullName': reg },
      { 'shippingAddress.firstName': reg },
      { 'shippingAddress.lastName': reg },
      { 'shippingAddress.phone': reg },
      { 'shippingAddress.email': reg },
      { 'shippingAddress.city': reg }
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
  buildAdminOrderFilters
};
