const mongoose = require('mongoose');
const Order = require('../order/order.model');
const Return = require('../return/return.model');
const ApiError = require('../../utils/ApiError');
const { checkOrderAccess } = require('../order/order.utils');
const { getProvider, getAllProviders, getActiveProviders } = require('./providers');

class LogisticsService {
  // ------------------------------- get provider ----------------------------
  getProvider(name = null) {
    return getProvider(name);
  }

  // ------------------------------- get public config ----------------------------
  getPublicConfig() {
    const active = this.getProvider();
    return {
      activeProvider: active.name,
      displayName: active.displayName,
      isConfigured: active.isConfigured(),
      availableProviders: getAllProviders().map((p) => p.getPublicConfig()),
    };
  }

  // ------------------------------- check serviceability ----------------------------
  async checkServiceability(params, providerName = null) {
    return this.getProvider(providerName).checkServiceability(params);
  }

  // ------------------------------- get courier rates for order ----------------------------
  async getCourierRatesForOrder(orderId, providerName = null) {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    return this.getProvider(providerName).getCourierRatesForOrder(order);
  }

  // ------------------------------- create shipment for order ----------------------------
  async createShipmentForOrder(orderId, options = {}, providerName = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    return this.getProvider(providerName).createShipmentForOrder(order, options);
  }

  // ------------------------------- assign AWB to order ----------------------------
  async assignAwbToOrder(orderId, options = {}, providerName = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    return this.getProvider(providerName).assignAwbToOrder(order, options);
  }

  // ------------------------------- generate shipping label ----------------------------
  async generateShippingLabel(orderId, providerName = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    return this.getProvider(providerName).generateShippingLabel(order);
  }

  // ------------------------------- generate manifest ----------------------------
  async generateManifest(orderId, providerName = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    return this.getProvider(providerName).generateManifest(order);
  }

  // ------------------------------- track shipment by AWB ----------------------------
  async trackShipmentByAwb(awbCode, providerName = null) {
    return this.getProvider(providerName).trackShipmentByAwb(awbCode);
  }

  // ------------------------------- track shipment by order ID ----------------------------
  async trackShipmentByOrderId(orderId, providerName = null, user = null, accessToken = null) {
    if (!mongoose.isValidObjectId(orderId)) {
      throw new ApiError(400, 'Invalid order ID');
    }
    const order = await Order.findOne({ _id: orderId, 'meta.deletedAt': null }).lean();
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    checkOrderAccess(order, user, accessToken);
    return this.getProvider(providerName).trackShipmentByOrderId(order);
  }

  // ------------------------------- cancel shipment ----------------------------
  async cancelShipment(orderId, providerName = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    return this.getProvider(providerName).cancelShipment(order);
  }

  // ------------------------------- create return shipment ----------------------------
  async createReturnShipment(returnId, options = {}, providerName = null) {
    const returnDoc = await Return.findById(returnId);
    if (!returnDoc) {
      throw new ApiError(404, 'Return record not found');
    }
    return this.getProvider(providerName).createReturnShipment(returnDoc, options);
  }

  // ------------------------------- track return shipment ----------------------------
  async trackReturnShipment(returnId, providerName = null) {
    const returnDoc = await Return.findById(returnId).lean();
    if (!returnDoc) {
      throw new ApiError(404, 'Return record not found');
    }
    return this.getProvider(providerName).trackReturnShipment(returnDoc);
  }

  // ------------------------------- generate return label ----------------------------
  async generateReturnLabel(returnId, providerName = null) {
    const returnDoc = await Return.findById(returnId);
    if (!returnDoc) {
      throw new ApiError(404, 'Return record not found');
    }
    return this.getProvider(providerName).generateReturnLabel(returnDoc);
  }
}

module.exports = new LogisticsService();
