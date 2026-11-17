const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const shiprocketService = require('./shiprocket.service');
const Order = require('../order/order.model');
const whatsappService = require('../whatsapp/whatsapp.service');

class ShiprocketController {
  // ─── Public & Customer Endpoints ─────────────────────────────────────────

  checkServiceability = catchAsync(async (req, res) => {
    const { pickup_postcode, delivery_postcode, weight, cod, declared_value } = req.query;
    const result = await shiprocketService.checkServiceability({
      pickupPincode: pickup_postcode,
      deliveryPincode: delivery_postcode,
      weight,
      cod: cod === '1' || cod === 'true',
      declaredValue: declared_value,
    });
    return ApiResponse.success(res, 'Pincode serviceability checked successfully', result);
  });

  trackByAwb = catchAsync(async (req, res) => {
    const awbCode = req.query.awb || req.params.awbCode;
    if (!awbCode) throw new ApiError(400, 'AWB code is required');
    const tracking = await shiprocketService.trackShipmentByAwb(awbCode);
    return ApiResponse.success(res, 'Shipment tracking details retrieved', tracking);
  });

  trackByOrderId = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const tracking = await shiprocketService.trackShipmentByOrderId(orderId);
    return ApiResponse.success(res, 'Order shipment tracking retrieved', tracking);
  });

  // ─── Webhook Receiver ────────────────────────────────────────────────────

  handleWebhook = catchAsync(async (req, res) => {
    const webhookToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
    const incomingToken =
      req.headers['x-api-key'] ||
      req.headers['authorization']?.replace(/^Bearer\s+/i, '');

    if (webhookToken && incomingToken && incomingToken !== webhookToken) {
      console.warn('[Shiprocket Webhook] Unauthorized attempt with invalid token');
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
        { orderNumber: orderNumber },
        { _id: orderNumber?.match(/^[0-9a-fA-F]{24}$/) ? orderNumber : null },
      ].filter(Boolean),
    });

    if (!order) {
      console.warn(`[Shiprocket Webhook] No matching order found for AWB: ${awb}, Order: ${orderNumber}`);
      return res.status(200).json({ message: 'Order not found, acknowledged' });
    }

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
        const total = Number(order.pricing?.total || 0);
        order.payment.status = 'paid';
        order.payment.paidAt = new Date();
        if (order.pricing) {
          order.pricing.paidAmount = total;
          order.pricing.codRemaining = 0;
        }
      }

      // WhatsApp Delivery Alert Notification
      try {
        const customerPhone = order.customer?.phone || order.shippingAddress?.phone;
        if (customerPhone && typeof whatsappService.sendTextMessage === 'function') {
          const customerName = order.customer?.firstName || 'Valued Customer';
          await whatsappService.sendTextMessage({
            to: customerPhone,
            message: `Hello ${customerName}, your luxury jewelry order ${order.orderNumber} has been delivered successfully. Thank you for choosing Neirah.`,
          }).catch(() => {});
        }
      } catch (waErr) {
        console.warn('[Shiprocket Webhook] WhatsApp notification deferred:', waErr.message);
      }
    } else if (['CANCELED', 'CANCELLED', 'RTO', 'RTO INITIATED', 'RTO DELIVERED'].includes(rawStatus)) {
      order.orderStatus = 'cancelled';
      if (!order.orderTimeline.cancelled) order.orderTimeline.cancelled = {};
      order.orderTimeline.cancelled.at = order.orderTimeline.cancelled.at || new Date();
    }

    await order.save();
    return res.status(200).send('OK');
  });

  // ─── Admin Logistics Operations ──────────────────────────────────────────

  getCourierRates = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const rates = await shiprocketService.getCourierRatesForOrder(orderId);
    return ApiResponse.success(res, 'Live courier rates retrieved', rates);
  });

  createShipment = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const options = req.body || {};
    const result = await shiprocketService.createShipmentForOrder(orderId, options);
    return ApiResponse.success(res, result.message, result);
  });

  assignAwb = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const { courierId } = req.body;
    const result = await shiprocketService.assignAwbToOrder(orderId, { courierId });
    return ApiResponse.success(res, 'AWB assigned successfully', result);
  });

  getLabel = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const result = await shiprocketService.generateShippingLabel(orderId);
    return ApiResponse.success(res, 'Shipping label generated', result);
  });

  getManifest = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const result = await shiprocketService.generateManifest(orderId);
    return ApiResponse.success(res, 'Carrier handover manifest generated', result);
  });

  trackAdminOrder = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const result = await shiprocketService.trackShipmentByOrderId(orderId);
    return ApiResponse.success(res, 'Shipment tracking retrieved', result);
  });

  cancelShipment = catchAsync(async (req, res) => {
    const { orderId } = req.body;
    const targetOrderId = orderId || req.params.orderId;
    if (!targetOrderId) throw new ApiError(400, 'Order ID is required to cancel shipment');
    const result = await shiprocketService.cancelShipment(targetOrderId);
    return ApiResponse.success(res, result.message, result);
  });

  createReturnShipment = catchAsync(async (req, res) => {
    const { returnId } = req.params;
    const options = req.body || {};
    const result = await shiprocketService.createReturnShipment(returnId, options);
    return ApiResponse.success(res, 'Reverse return shipment scheduled', result);
  });

  getReturnLabel = catchAsync(async (req, res) => {
    const { returnId } = req.params;
    const result = await shiprocketService.generateReturnLabel(returnId);
    return ApiResponse.success(res, 'Return label generated', result);
  });

  trackReturn = catchAsync(async (req, res) => {
    const { returnId } = req.params;
    const result = await shiprocketService.trackReturnShipment(returnId);
    return ApiResponse.success(res, 'Return shipment tracking retrieved', result);
  });
}

module.exports = new ShiprocketController();
