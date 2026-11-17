const Order = require('../order/order.model');
const Return = require('../return/return.model');
const ApiError = require('../../utils/ApiError');
const { shiprocketRequest } = require('./integrationToken.service');

const WAREHOUSE_PINCODE = process.env.SHIPROCKET_PICKUP_PINCODE || '382006'; // Gandhinagar
const PICKUP_LOCATION = process.env.SHIPROCKET_PICKUP_LOCATION || 'work';

class ShiprocketService {
  /**
   * Checks destination pincode serviceability and fetches courier options
   */
  async checkServiceability({
    pickupPincode,
    pickupPostcode,
    deliveryPincode,
    deliveryPostcode,
    weight = 0.5,
    cod = 0,
    declaredValue = 5000,
  }) {
    const finalPickup = pickupPincode || pickupPostcode || WAREHOUSE_PINCODE;
    const finalDelivery = deliveryPincode || deliveryPostcode;

    if (!finalDelivery) {
      throw new ApiError(400, 'Destination delivery pincode is required');
    }

    try {
      const params = {
        pickup_postcode: finalPickup,
        delivery_postcode: finalDelivery,
        weight: Number(weight) || 0.5,
        cod: cod ? 1 : 0,
        declared_value: Number(declaredValue) || 5000,
      };

      const response = await shiprocketRequest('GET', '/courier/serviceability/', null, params);
      const rawCouriers = response?.data?.available_courier_companies || [];

      const availableCouriers = rawCouriers.map((c) => ({
        courierId: c.courier_company_id,
        courierName: c.courier_name,
        rating: c.rating || 4.0,
        etd: c.etd || '3-4 Days',
        rate: Number(c.rate) || 0,
        codAvailable: Boolean(c.cod),
        isAir: Boolean(c.is_air),
      }));

      // Sort couriers by price (rate) ascending: lowest to highest
      availableCouriers.sort((a, b) => Number(a.rate || 0) - Number(b.rate || 0));

      return {
        pickupPincode,
        deliveryPincode,
        availableCouriers,
      };
    } catch (error) {
      console.error('[Shiprocket Serviceability Error]:', error.response?.data || error.message);
      throw new ApiError(500, `Shiprocket Serviceability check failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetches live courier rates specifically calculated for a registered Order
   */
  async getCourierRatesForOrder(orderId) {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    const deliveryPincode =
      order.shippingAddress?.postalCode || order.shippingAddress?.pincode;
    if (!deliveryPincode) {
      throw new ApiError(400, 'Order shipping address missing postal/pincode');
    }

    const isCod = order.payment?.method === 'cod';
    const totalValue = order.pricing?.total || 5000;

    return this.checkServiceability({
      pickupPincode: WAREHOUSE_PINCODE,
      deliveryPincode,
      weight: 0.5,
      cod: isCod ? 1 : 0,
      declaredValue: totalValue,
    });
  }

  /**
   * End-to-End Forward Dispatch Workflow:
   * 1. Calculates Partial-COD collectable amount
   * 2. Registers Order via POST /orders/create/adhoc
   * 3. Awaits 1.5s Shiprocket microservice indexing
   * 4. Allocates AWB via POST /courier/assign/awb
   * 5. Requests Carrier Pickup & generates Thermal Label PDF
   * 6. Updates Order with shiprocketInfo & moves orderStatus to 'processing'
   */
  async createShipmentForOrder(orderId, options = {}) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    if (order.shiprocketInfo?.status === 'success' && order.shiprocketInfo?.awbCode) {
      throw new ApiError(400, `Shipment already generated with AWB: ${order.shiprocketInfo.awbCode}`);
    }

    // Mark as creating
    order.shiprocketInfo = order.shiprocketInfo || {};
    order.shiprocketInfo.status = 'creating';
    order.shiprocketInfo.creatingSince = new Date();
    await order.save();

    try {
      // 1. Partial COD & Pricing calculations
      const paymentMethod = order.payment?.method || 'online';
      const amountPaid = Number(order.pricing?.paidAmount || 0);
      const totalOrderPrice = Number(order.pricing?.total || 0);
      const currentUnpaidBalance = Math.max(0, Number((totalOrderPrice - amountPaid).toFixed(2)));
      const isCodShipment = paymentMethod === 'cod' && currentUnpaidBalance > 0;

      const baseDiscount = Number(order.pricing?.discount || 0);
      const advancePaidCredit = isCodShipment ? amountPaid : 0;
      const totalDiscountForCourier = Number((baseDiscount + advancePaidCredit).toFixed(2));

      // 2. Prepare Order Items
      const orderItems = (order.items || []).map((item, idx) => ({
        name: item.title || 'Fine Jewellery Piece',
        sku: item.sku || `SKU-ITEM-${idx + 1}`,
        units: Math.max(1, Number(item.quantity) || 1),
        selling_price: Number(item.price) || 1,
        discount: 0,
        tax: 0,
        hsn: 7113, // Standard HSN code for Indian jewelry of precious metal
      }));

      const pickupLocation = options.pickupLocation || PICKUP_LOCATION;
      const length = options.length || 10;
      const breadth = options.breadth || 10;
      const height = options.height || 10;
      const weight = options.weight || 0.5;

      const customerName = (
        order.shippingAddress?.fullName ||
        `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
        'Customer'
      );
      const nameParts = customerName.split(' ');
      const firstName = nameParts[0] || 'Valued';
      const lastName = nameParts.slice(1).join(' ') || 'Customer';

      const customerPhone =
        order.shippingAddress?.phone || order.customer?.phone || '9825032534';
      const customerEmail =
        order.shippingAddress?.email || order.customer?.email || 'customer@example.com';

      // Live Shiprocket adhoc order creation payload
      const shiprocketOrderData = {
        order_id: `${order.orderNumber || 'ORD'}_${order._id.toString()}_${Date.now()}`,
        order_date: new Date(order.createdAt || Date.now()).toISOString().split('T')[0],
        pickup_location: pickupLocation,
        billing_customer_name: firstName,
        billing_last_name: lastName,
        billing_address: order.shippingAddress?.addressLine || 'Address',
        billing_address_2: order.shippingAddress?.apartment || '',
        billing_city: order.shippingAddress?.city || 'Surat',
        billing_pincode: order.shippingAddress?.postalCode || '395006',
        billing_state: order.shippingAddress?.state || 'Gujarat',
        billing_country: order.shippingAddress?.country || 'India',
        billing_email: customerEmail,
        billing_phone: customerPhone,
        shipping_is_billing: true,
        order_items: orderItems,
        payment_method: isCodShipment ? 'COD' : 'Prepaid',
        sub_total: Number(order.pricing?.subtotal || order.pricing?.total || 1),
        total_discount: totalDiscountForCourier,
        length,
        breadth,
        height,
        weight,
      };

      // Step 1: Create Order in Shiprocket
      const createRes = await shiprocketRequest('POST', '/orders/create/adhoc', shiprocketOrderData);
      const srOrderId = String(createRes.order_id);
      const srShipmentId = String(createRes.shipment_id);

      order.shiprocketInfo.shiprocketOrderId = srOrderId;
      order.shiprocketInfo.shiprocketShipmentId = srShipmentId;

      // Step 2: Indexing Sleep (1.8s) for Shiprocket microservices
      await new Promise((resolve) => setTimeout(resolve, 1800));

      // Step 3: Assign AWB
      const assignAwbPayload = { shipment_id: srShipmentId };
      if (options.courierId) {
        assignAwbPayload.courier_id = options.courierId;
      }

      let awbCode = '';
      let courierName = '';
      try {
        const awbRes = await shiprocketRequest('POST', '/courier/assign/awb', assignAwbPayload);
        awbCode = awbRes?.response?.data?.awb_code || awbRes?.awb_code || '';
        courierName = awbRes?.response?.data?.courier_name || awbRes?.courier_name || 'Assigned Courier';
      } catch (awbErr) {
        console.warn('[Shiprocket] Initial AWB allocation deferred:', awbErr.response?.data || awbErr.message);
      }

      // Step 4: Generate Label & Pickup
      let labelUrl = '';
      if (awbCode) {
        try {
          const labelRes = await shiprocketRequest('POST', '/courier/generate/label', {
            shipment_id: [srShipmentId],
          });
          labelUrl = labelRes?.label_url || '';
        } catch (labelErr) {
          console.warn('[Shiprocket] Label pre-generation deferred:', labelErr.message);
        }

        try {
          await shiprocketRequest('POST', '/courier/generate/pickup', {
            shipment_id: [srShipmentId],
          });
        } catch (pickupErr) {
          console.warn('[Shiprocket] Pickup schedule deferred:', pickupErr.message);
        }
      }

      order.logisticsProvider = 'Shiprocket';
      order.shiprocketInfo.status = 'success';
      order.shiprocketInfo.awbCode = awbCode;
      order.shiprocketInfo.courierName = courierName;
      order.shiprocketInfo.courierId = options.courierId || null;
      order.shiprocketInfo.labelUrl = labelUrl;
      order.shiprocketInfo.lastError = null;

      if (order.orderStatus === 'pending') {
        order.orderStatus = 'processing';
      }
      await order.save();

      return {
        success: true,
        message: 'Shipment created successfully',
        shiprocketInfo: order.shiprocketInfo,
      };
    } catch (error) {
      console.error('[Shiprocket Create Shipment Error]:', error.response?.data || error.message);
      order.shiprocketInfo.status = 'failed';
      order.shiprocketInfo.lastError = error.response?.data?.message || error.message;
      await order.save();
      throw new ApiError(500, `Shiprocket Shipment creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Re-assign AWB or select specific courier
   */
  async assignAwbToOrder(orderId, { courierId }) {
    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const shipmentId = order.shiprocketInfo?.shiprocketShipmentId;
    if (!shipmentId) throw new ApiError(400, 'Order does not have a registered Shiprocket Shipment ID');

    const payload = { shipment_id: shipmentId };
    if (courierId) payload.courier_id = courierId;

    const awbRes = await shiprocketRequest('POST', '/courier/assign/awb', payload);
    const awbCode = awbRes?.response?.data?.awb_code || awbRes?.awb_code || '';
    const courierName = awbRes?.response?.data?.courier_name || awbRes?.courier_name || '';

    order.shiprocketInfo.awbCode = awbCode;
    order.shiprocketInfo.courierName = courierName;
    order.shiprocketInfo.courierId = courierId;
    order.shiprocketInfo.status = 'success';
    await order.save();

    return { success: true, shiprocketInfo: order.shiprocketInfo };
  }

  /**
   * Generates or fetches printable thermal shipping label PDF
   */
  async generateShippingLabel(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const shipmentId = order.shiprocketInfo?.shiprocketShipmentId;
    if (!shipmentId) throw new ApiError(400, 'Order does not have a Shiprocket shipment');

    const response = await shiprocketRequest('POST', '/courier/generate/label', {
      shipment_id: [shipmentId],
    });

    const labelUrl = response?.label_url || order.shiprocketInfo?.labelUrl || '';
    if (labelUrl) {
      order.shiprocketInfo.labelUrl = labelUrl;
      await order.save();
    }

    return { labelUrl };
  }

  /**
   * Generates handover manifest document
   */
  async generateManifest(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const shipmentId = order.shiprocketInfo?.shiprocketShipmentId;
    if (!shipmentId) throw new ApiError(400, 'Order does not have a Shiprocket shipment');

    const response = await shiprocketRequest('POST', '/manifests/generate', {
      shipment_id: [shipmentId],
    });

    const manifestUrl = response?.manifest_url || '';
    if (manifestUrl) {
      order.shiprocketInfo.manifestUrl = manifestUrl;
      await order.save();
    }

    return { manifestUrl };
  }

  /**
   * Live tracking by AWB code
   */
  async trackShipmentByAwb(awbCode) {
    if (!awbCode) throw new ApiError(400, 'AWB code is required');

    try {
      const response = await shiprocketRequest('GET', `/courier/track/awb/${awbCode}`);
      const trackData = response?.tracking_data || {};
      const trackHeader = trackData?.track_status || 0;
      const shipmentTrack = trackData?.shipment_track?.[0] || {};
      const scans = trackData?.shipment_track_activities || [];

      return {
        awb: awbCode,
        currentStatus: shipmentTrack.current_status || 'IN TRANSIT',
        currentStatusId: trackHeader,
        courierName: shipmentTrack.courier_name || 'Carrier',
        origin: shipmentTrack.origin || 'Warehouse',
        destination: shipmentTrack.destination || '',
        etd: shipmentTrack.edd || '',
        scans: scans.map((s) => ({
          date: s.date,
          activity: s.activity,
          location: s.location,
          status: s['sr-status-label'] || s.activity,
        })),
      };
    } catch (error) {
      console.error('[Shiprocket Track AWB Error]:', error.message);
      throw new ApiError(500, `Shipment tracking failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Live tracking by Order ID
   */
  async trackShipmentByOrderId(orderId) {
    const order = await Order.findById(orderId).lean();
    if (!order) throw new ApiError(404, 'Order not found');

    const awbCode = order.shiprocketInfo?.awbCode;
    if (!awbCode) {
      return {
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        hasShipment: false,
        message: 'Order shipment has not been allocated an AWB yet.',
      };
    }

    const tracking = await this.trackShipmentByAwb(awbCode);
    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      hasShipment: true,
      ...tracking,
    };
  }

  /**
   * Cancels shipment in Shiprocket
   */
  async cancelShipment(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const awb = order.shiprocketInfo?.awbCode;
    if (!awb) throw new ApiError(400, 'Order does not have an active AWB');

    await shiprocketRequest('POST', '/orders/cancel/shipment/awbs', {
      awbs: [awb],
    }).catch((e) => {
      console.warn('[Shiprocket] Cancel API warning:', e.message);
    });

    order.shiprocketInfo.status = 'cancelled';
    await order.save();

    return {
      success: true,
      message: `Shipment with AWB ${awb} cancelled successfully.`,
    };
  }

  /**
   * Reverse Logistics: Creates doorstep pickup return shipment
   * Origin: Customer address
   * Destination: Neirah Gandhinagar warehouse
   */
  async createReturnShipment(returnId, options = {}) {
    const returnDoc = await Return.findById(returnId);
    if (!returnDoc) throw new ApiError(404, 'Return record not found');

    if (returnDoc.shiprocketReturnInfo?.status === 'success' && returnDoc.shiprocketReturnInfo?.awbCode) {
      throw new ApiError(400, `Return shipment already active with AWB: ${returnDoc.shiprocketReturnInfo.awbCode}`);
    }

    try {
      const pickupAddress = returnDoc.pickupAddress;
      const customerName = pickupAddress?.fullName || 'Customer';
      const nameParts = customerName.split(' ');
      const firstName = nameParts[0] || 'Customer';
      const lastName = nameParts.slice(1).join(' ') || '';

      const returnPayload = {
        order_id: `${returnDoc.returnNumber}_${Date.now()}`,
        order_date: new Date().toISOString().split('T')[0],
        pickup_customer_name: firstName,
        pickup_last_name: lastName,
        pickup_address: pickupAddress?.addressLine || 'Address',
        pickup_address_2: pickupAddress?.apartment || '',
        pickup_city: pickupAddress?.city || 'Surat',
        pickup_state: pickupAddress?.state || 'Gujarat',
        pickup_country: pickupAddress?.country || 'India',
        pickup_pincode: pickupAddress?.postalCode || '395006',
        pickup_email: returnDoc.customer?.email || 'customer@example.com',
        pickup_phone: pickupAddress?.phone || returnDoc.customer?.phone || '9999999999',
        shipping_customer_name: 'Neirah Luxury Warehouse',
        shipping_address: 'Plot 102, GIDC Electronic Estate',
        shipping_city: 'Gandhinagar',
        shipping_state: 'Gujarat',
        shipping_country: 'India',
        shipping_pincode: WAREHOUSE_PINCODE,
        shipping_phone: '9825032534',
        order_items: (returnDoc.items || []).map((it) => ({
          name: it.title || 'Return Jewellery Piece',
          sku: it.sku || 'RET-SKU',
          units: it.quantity || 1,
          selling_price: it.price || 1,
        })),
        sub_total: returnDoc.refund?.amount || 1000,
        length: 10,
        breadth: 10,
        height: 10,
        weight: 0.5,
      };

      const res = await shiprocketRequest('POST', '/orders/create/return', returnPayload);
      const srOrderId = String(res.order_id);
      const srShipmentId = String(res.shipment_id);

      // Assign reverse AWB
      let awbCode = '';
      let courierName = '';
      try {
        const awbRes = await shiprocketRequest('POST', '/courier/assign/awb', { shipment_id: srShipmentId });
        awbCode = awbRes?.response?.data?.awb_code || awbRes?.awb_code || '';
        courierName = awbRes?.response?.data?.courier_name || 'Reverse Courier';
      } catch (e) {
        console.warn('[Shiprocket] Reverse AWB assign deferred:', e.message);
      }

      returnDoc.shiprocketReturnInfo = {
        shiprocketOrderId: srOrderId,
        shiprocketShipmentId: srShipmentId,
        awbCode,
        courierName,
        labelUrl: '',
        status: awbCode ? 'scheduled' : 'pending',
        pickupScheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastError: null,
      };
      returnDoc.status = 'pickup_scheduled';
      await returnDoc.save();

      return {
        success: true,
        shiprocketReturnInfo: returnDoc.shiprocketReturnInfo,
      };
    } catch (error) {
      console.error('[Shiprocket Return Error]:', error.response?.data || error.message);
      returnDoc.shiprocketReturnInfo.status = 'failed';
      returnDoc.shiprocketReturnInfo.lastError = error.response?.data?.message || error.message;
      await returnDoc.save();
      throw new ApiError(500, `Return shipment creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Tracks reverse return shipment
   */
  async trackReturnShipment(returnId) {
    const returnDoc = await Return.findById(returnId).lean();
    if (!returnDoc) throw new ApiError(404, 'Return record not found');

    const awb = returnDoc.shiprocketReturnInfo?.awbCode;
    if (!awb) throw new ApiError(400, 'Return does not have an active AWB');

    return this.trackShipmentByAwb(awb);
  }

  /**
   * Generates reverse return label
   */
  async generateReturnLabel(returnId) {
    const returnDoc = await Return.findById(returnId);
    if (!returnDoc) throw new ApiError(404, 'Return record not found');

    const shipmentId = returnDoc.shiprocketReturnInfo?.shiprocketShipmentId;
    if (!shipmentId) throw new ApiError(400, 'Return does not have a shipment ID');

    const response = await shiprocketRequest('POST', '/courier/generate/label', {
      shipment_id: [shipmentId],
    });

    const labelUrl = response?.label_url || '';
    if (labelUrl) {
      returnDoc.shiprocketReturnInfo.labelUrl = labelUrl;
      await returnDoc.save();
    }

    return { labelUrl };
  }
}

module.exports = new ShiprocketService();
