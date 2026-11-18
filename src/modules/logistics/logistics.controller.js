const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const logisticsService = require('./logistics.service');
const Order = require('../order/order.model');
const whatsappService = require('../whatsapp/whatsapp.service');

class LogisticsController {
  // ------------------------------- get public config ----------------------------
  getConfig = catchAsync(async (req, res) => {
    const config = logisticsService.getPublicConfig();
    return ApiResponse.success(res, config, 'Logistics configuration retrieved');
  });

  // ------------------------------- check serviceability ----------------------------
  checkServiceability = catchAsync(async (req, res) => {
    const { pickup_postcode, delivery_postcode, weight, cod, declared_value, provider } = req.query;
    const result = await logisticsService.checkServiceability(
      {
        pickupPincode: pickup_postcode,
        deliveryPincode: delivery_postcode,
        weight,
        cod: cod === '1' || cod === 'true',
        declaredValue: declared_value,
      },
      provider
    );
    return ApiResponse.success(res, result, 'Pincode serviceability checked successfully');
  });

  // ------------------------------- track by AWB ----------------------------
  trackByAwb = catchAsync(async (req, res) => {
    const awbCode = req.query.awb || req.params.awbCode;
    const { provider } = req.query;
    if (!awbCode) throw new ApiError(400, 'AWB code is required');
    const tracking = await logisticsService.trackShipmentByAwb(awbCode, provider);
    return ApiResponse.success(res, tracking, 'Shipment tracking details retrieved');
  });

  // ------------------------------- track by order ID ----------------------------
  trackByOrderId = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const { provider } = req.query;
    const tracking = await logisticsService.trackShipmentByOrderId(orderId, provider);
    return ApiResponse.success(res, tracking, 'Order shipment tracking retrieved');
  });

  // ------------------------------- handle carrier webhook ----------------------------
  handleWebhook = catchAsync(async (req, res) => {
    const webhookToken = process.env.SHIPROCKET_WEBHOOK_TOKEN || process.env.LOGISTICS_WEBHOOK_TOKEN;
    const incomingToken =
      req.headers['x-api-key'] ||
      req.headers['authorization']?.replace(/^Bearer\s+/i, '');

    if (webhookToken && incomingToken && incomingToken !== webhookToken) {
      console.warn('[Logistics Webhook] Unauthorized attempt with invalid token');
      return res.status(401).json({ message: 'Unauthorized webhook request' });
    }

    const payload = req.body || {};
    const awb = payload.awb || payload.awb_code;
    const orderNumber = payload.order_id || payload.orderNumber;
    const rawStatus = (payload.current_status || payload.status || '').toUpperCase();

    if (!awb && !orderNumber) {
      return res.status(200).json({ message: 'No AWB or order ID provided in payload' });
    }

    // Find Order in DB
    const order = await Order.findOne({
      $or: [
        { 'shiprocketInfo.awbCode': awb },
        { 'logisticsInfo.awbCode': awb },
        { orderNumber: orderNumber },
        { _id: orderNumber?.match(/^[0-9a-fA-F]{24}$/) ? orderNumber : null },
      ].filter(Boolean),
    });

    if (!order) {
      console.warn(`[Logistics Webhook] No matching order found for AWB: ${awb}, Order: ${orderNumber}`);
      return res.status(200).json({ message: 'Order not found, acknowledged' });
    }

    if (!order.orderTimeline) {
      order.orderTimeline = {
        placed: { at: order.meta?.createdAt || new Date(), by: order.userId || null },
        accepted: { at: null, by: null },
        cancelled: { at: null, by: null },
        shipped: { at: null, by: null },
        delivered: { at: null, by: null },
      };
    }

    // Status Evaluation
    if (['SHIPPED', 'IN TRANSIT'].includes(rawStatus)) {
      if (order.orderStatus !== 'shipped' && order.orderStatus !== 'delivered') {
        order.orderStatus = 'shipped';
        if (!order.orderTimeline.shipped) order.orderTimeline.shipped = {};
        order.orderTimeline.shipped.at = order.orderTimeline.shipped.at || new Date();
      }
    } else if (['OUT FOR DELIVERY'].includes(rawStatus)) {
      if (order.orderStatus !== 'delivered') {
        order.orderStatus = 'out_for_delivery';
      }
    } else if (['DELIVERED'].includes(rawStatus)) {
      order.orderStatus = 'delivered';
      if (!order.orderTimeline.delivered) order.orderTimeline.delivered = {};
      order.orderTimeline.delivered.at = order.orderTimeline.delivered.at || new Date();

      // Financial Reconciliation for COD orders
      if (order.payment?.method === 'cod') {
        order.payment.status = 'paid';
        order.payment.paidAt = order.payment.paidAt || new Date();
        if (order.pricing) {
          order.pricing.paidAmount = order.pricing.total;
          order.pricing.codDueNow = 0;
        }
      }
    }

    await order.save();

    // Trigger WhatsApp status notification
    if (order.customer?.phone) {
      try {
        await whatsappService.sendOrderStatusUpdate(order);
      } catch (waErr) {
        console.warn('[Logistics Webhook] WhatsApp dispatch deferred:', waErr.message);
      }
    }

    return res.status(200).json({ success: true, message: 'Carrier event processed' });
  });

  // ------------------------------- get courier rates for order ----------------------------
  getCourierRates = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const { provider } = req.query;
    const rates = await logisticsService.getCourierRatesForOrder(orderId, provider);
    return ApiResponse.success(res, rates, 'Courier rates retrieved successfully');
  });

  // ------------------------------- create shipment ----------------------------
  createShipment = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const { provider, ...options } = req.body;
    const result = await logisticsService.createShipmentForOrder(orderId, options, provider);
    return ApiResponse.success(res, result, 'Shipment created successfully');
  });

  // ------------------------------- assign AWB ----------------------------
  assignAwb = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const { courierId, courier_id, provider } = req.body;
    const result = await logisticsService.assignAwbToOrder(orderId, { courierId: courierId || courier_id }, provider);
    return ApiResponse.success(res, result, 'AWB assigned successfully');
  });

  // ------------------------------- get shipping label ----------------------------
  getLabel = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const { provider } = req.query;
    const result = await logisticsService.generateShippingLabel(orderId, provider);
    return ApiResponse.success(res, result, 'Shipping label generated');
  });

  // ------------------------------- get manifest ----------------------------
  getManifest = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const { provider } = req.query;
    const result = await logisticsService.generateManifest(orderId, provider);
    return ApiResponse.success(res, result, 'Manifest generated');
  });

  // ------------------------------- track admin order ----------------------------
  trackAdminOrder = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const { provider } = req.query;
    const result = await logisticsService.trackShipmentByOrderId(orderId, provider);
    return ApiResponse.success(res, result, 'Shipment tracking data retrieved');
  });

  // ------------------------------- create return shipment ----------------------------
  createReturnShipment = catchAsync(async (req, res) => {
    const { returnId } = req.params;
    const { provider, ...options } = req.body;
    const result = await logisticsService.createReturnShipment(returnId, options, provider);
    return ApiResponse.success(res, result, 'Return shipment created successfully');
  });

  // ------------------------------- get return label ----------------------------
  getReturnLabel = catchAsync(async (req, res) => {
    const { returnId } = req.params;
    const { provider } = req.query;
    const result = await logisticsService.generateReturnLabel(returnId, provider);
    return ApiResponse.success(res, result, 'Return label generated');
  });

  // ------------------------------- track return ----------------------------
  trackReturn = catchAsync(async (req, res) => {
    const { returnId } = req.params;
    const { provider } = req.query;
    const result = await logisticsService.trackReturnShipment(returnId, provider);
    return ApiResponse.success(res, result, 'Return tracking data retrieved');
  });

  // ------------------------------- cancel shipment ----------------------------
  cancelShipment = catchAsync(async (req, res) => {
    const { orderId, provider } = req.body;
    if (!orderId) throw new ApiError(400, 'Order ID is required to cancel shipment');
    const result = await logisticsService.cancelShipment(orderId, provider);
    return ApiResponse.success(res, result, result.message);
  });
}

module.exports = new LogisticsController();
