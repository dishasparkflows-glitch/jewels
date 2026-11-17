const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = require('../config/db');
const Order = require('../modules/order/order.model');

async function seedTestOrder() {
  await connectDB();

  // Reference existing user or default ObjectId
  const userId = new mongoose.Types.ObjectId('6ae966462440e64e21b5f919'); // Disha Radadiya
  const productId1 = new mongoose.Types.ObjectId('91341f2bac21a4022f5e4c67'); // Round Cut Lab Grown Diamond Tennis Cuff Bangle
  const productId2 = new mongoose.Types.ObjectId('6ae192d18cf796085658ca85'); // 92.5 Dokiyu Pure Silver Solitaire Pendant
  const couponId = new mongoose.Types.ObjectId('6adb48a9d91d1ceed77355ad'); // FIRSTORDER coupon

  const testOrderData = {
    // orderNumber will be auto-generated sequentially (e.g. RJ/ORD-0002) via pre('validate')
    userId,
    customer: {
      firstName: 'Disha',
      lastName: 'Radadiya',
      email: 'disharadadiya11@gmail.com',
      phone: '9825032534',
      countryCode: '+91',
    },
    shippingAddress: {
      firstName: 'Disha',
      lastName: 'Radadiya',
      fullName: 'Disha Radadiya',
      email: 'disharadadiya11@gmail.com',
      phone: '9825032534',
      countryCode: '+91',
      addressLine: '402, Royal Diamond Plaza, Mini Bazar',
      apartment: 'Wing B, 4th Floor',
      city: 'Surat',
      state: 'Gujarat',
      postalCode: '395006',
      country: 'India',
    },
    items: [
      {
        productId: productId1,
        title: 'Round Cut Lab Grown Diamond Tennis Cuff Bangle Bracelet in Gold | Neirah',
        sku: 'RJBRL2-98',
        price: 126026,
        quantity: 1,
        totalItemPrice: 126026,
        selectedMetal: '18KT Yellow Gold',
        selectedSize: '7 In',
        selectedAttributes: {
          metalPurity: '18KT Gold',
          metalColor: 'Yellow Gold',
          diamondType: 'Lab Grown Diamond',
          diamondShape: 'Round Brilliant',
          diamondClarity: 'VVS1',
          diamondColor: 'E-F',
          caratWeight: 2.31,
          size: '7 In',
          sizeRange: '7 In',
        },
      },
      {
        productId: productId2,
        title: '92.5 Dokiyu Pure Silver Solitaire Pendant | Neirah',
        sku: '925PD/138',
        price: 3824,
        quantity: 1,
        totalItemPrice: 3824,
        selectedMetal: '925 Sterling Silver',
        selectedSize: 'Standard',
        selectedAttributes: {
          metalPurity: '92.5 Silver',
          metalColor: 'White Rhodium',
          stoneType: 'Zirconia / Solitaire',
          chainLength: '18 inches',
        },
      },
    ],
    pricing: {
      subtotal: 129850,
      shipping: 0,
      tax: 3895.5,
      discount: 12985,
      total: 120760.5,
      codDueNow: 0,
      codRemaining: 0,
      paidAmount: 120760.5,
    },
    coupon: {
      code: 'FIRSTORDER',
      discountAmount: 12985,
      couponId: couponId,
    },
    payment: {
      method: 'online',
      provider: 'razorpay',
      status: 'paid',
      transactionId: 'pay_test_RzP1002Txn987654',
      gatewayOrderId: 'order_test_RzP1002GwOrder1234',
      signature: 'sig_test_mock_razorpay_signature_abcdef1234567890',
      paymentMode: 'UPI',
      paidAt: new Date(),
      paymentDetails: {
        method: 'upi',
        vpa: 'disharadadiya11@okhdfcbank',
        bank: 'HDFC',
        acquirer_data: { rrn: '632598741025' },
        fee: 0,
        tax: 0,
      },
      failureReason: null,
    },
    orderStatus: 'shipped',
    logisticsProvider: 'Shiprocket',
    shiprocketInfo: {
      status: 'success',
      creatingSince: new Date(Date.now() - 3600 * 1000 * 4),
      shiprocketOrderId: 'SR_ORD_1794860000002',
      shiprocketShipmentId: 'SR_SHP_1794860000002',
      awbCode: 'AWB-SR-8102938475',
      courierName: 'Blue Dart Air Express',
      courierId: 1,
      labelUrl: 'https://apiv2.shiprocket.in/mock-labels/SR_SHP_1794860000002.pdf',
      manifestUrl: 'https://apiv2.shiprocket.in/mock-manifests/SR_SHP_1794860000002.pdf',
      pickupScheduledDate: new Date(Date.now() + 86400 * 1000),
      lastError: null,
    },
    orderTimeline: {
      placed: { at: new Date(Date.now() - 3600 * 1000 * 24), by: user._id },
      accepted: { at: new Date(Date.now() - 3600 * 1000 * 20), by: null },
      packed: { at: new Date(Date.now() - 3600 * 1000 * 10) },
      shipped: { at: new Date(Date.now() - 3600 * 1000 * 2), by: null },
      delivered: { at: null, by: null },
      cancelled: { at: null, by: null },
    },
    notes: 'Test order record created with all fields populated for end-to-end verification',
  };

  const order = new Order(testOrderData);
  await order.save();

  console.log('✅ Successfully created test order!');
  console.log('Order ID:', order._id.toString());
  console.log('Order Number:', order.orderNumber);
  console.log('Order Status:', order.orderStatus);
  console.log('Payment Status:', order.payment.status);
  console.log('Full Order Document:');
  console.dir(order.toObject(), { depth: null, colors: true });

  await mongoose.disconnect();
}

seedTestOrder().catch((err) => {
  console.error('❌ Failed to seed test order:', err);
  process.exit(1);
});
