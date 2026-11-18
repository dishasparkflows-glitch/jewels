const ApiError = require('../../../utils/ApiError');

class BaseLogisticsProvider {
  constructor(name, displayName) {
    if (!name) {
      throw new Error('Logistics provider must have a unique name identifier');
    }
    this.name = name.toLowerCase().trim();
    this.displayName = displayName || name;
  }

  isConfigured() {
    return false;
  }

  getPublicConfig() {
    return {
      id: this.name,
      name: this.displayName,
      isConfigured: this.isConfigured(),
    };
  }

  // ------------------------------- serviceability & rates ----------------------------
  async checkServiceability(params) {
    throw new ApiError(501, `checkServiceability is not implemented for ${this.displayName}`);
  }

  async getCourierRatesForOrder(order) {
    throw new ApiError(501, `getCourierRatesForOrder is not implemented for ${this.displayName}`);
  }

  // ------------------------------- forward shipment ----------------------------
  async createShipmentForOrder(order, options = {}) {
    throw new ApiError(501, `createShipmentForOrder is not implemented for ${this.displayName}`);
  }

  async assignAwbToOrder(order, options = {}) {
    throw new ApiError(501, `assignAwbToOrder is not implemented for ${this.displayName}`);
  }

  async generateShippingLabel(order) {
    throw new ApiError(501, `generateShippingLabel is not implemented for ${this.displayName}`);
  }

  async generateManifest(order) {
    throw new ApiError(501, `generateManifest is not implemented for ${this.displayName}`);
  }

  // ------------------------------- tracking ----------------------------
  async trackShipmentByAwb(awbCode) {
    throw new ApiError(501, `trackShipmentByAwb is not implemented for ${this.displayName}`);
  }

  async trackShipmentByOrderId(order) {
    throw new ApiError(501, `trackShipmentByOrderId is not implemented for ${this.displayName}`);
  }

  async cancelShipment(order) {
    throw new ApiError(501, `cancelShipment is not implemented for ${this.displayName}`);
  }

  // ------------------------------- reverse logistics / returns ----------------------------
  async createReturnShipment(returnDoc, options = {}) {
    throw new ApiError(501, `createReturnShipment is not implemented for ${this.displayName}`);
  }

  async trackReturnShipment(returnDoc) {
    throw new ApiError(501, `trackReturnShipment is not implemented for ${this.displayName}`);
  }

  async generateReturnLabel(returnDoc) {
    throw new ApiError(501, `generateReturnLabel is not implemented for ${this.displayName}`);
  }

  // ------------------------------- webhook handling ----------------------------
  async handleWebhook(payload, headers) {
    throw new ApiError(501, `handleWebhook is not implemented for ${this.displayName}`);
  }
}

module.exports = BaseLogisticsProvider;
