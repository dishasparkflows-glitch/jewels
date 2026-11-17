const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = require('../config/db');
require('../modules/product/product.model');
const Order = require('../modules/order/order.model');

async function seedDeliveredOrder() {
  await connectDB();

  const userId = new mongoose.Types.ObjectId('6ae966462440e64e21b5f919'); // Disha Radadiya
  const productId = new mongoose.Types.ObjectId('91341f2bac21a4022f5e4c67'); // Round Cut Lab Grown Diamond Tennis Cuff Bangle

  const deliveredOrderData = {
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
    billingAddress: {
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
        productId: productId,
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
        },
      },
    ],
    pricing: {
      subtotal: 126026,
      shipping: 0,
      tax: 3780.78,
      discount: 12602.6,
      total: 117204.18,
      codDueNow: 0,
      codRemaining: 0,
      paidAmount: 117204.18,
    },
    coupon: {
      code: 'FIRSTORDER',
      discountAmount: 12602.6,
    },
    payment: {
      method: 'online',
      provider: 'razorpay',
      status: 'paid',
      transactionId: 'pay_test_RzP1003Delivered',
      gatewayOrderId: 'order_test_RzP1003GwOrder',
      signature: 'sig_test_mock_razorpay_signature_delivered',
      paymentMode: 'UPI',
      paidAt: new Date(Date.now() - 3600 * 1000 * 72),
      paymentDetails: {
        method: 'upi',
        vpa: 'disharadadiya11@okhdfcbank',
        bank: 'HDFC',
      },
    },
    orderStatus: 'delivered',
    logisticsProvider: 'Shiprocket',
    shiprocketInfo: {
      status: 'success',
      shiprocketOrderId: 'SR_ORD_1794860000003',
      shiprocketShipmentId: 'SR_SHP_1794860000003',
      awbCode: 'AWB-SR-9988776655',
      courierName: 'Blue Dart Air Express',
      courierId: 1,
      pickupScheduledDate: new Date(Date.now() - 3600 * 1000 * 48),
    },
    orderTimeline: {
      placed: { at: new Date(Date.now() - 3600 * 1000 * 72), by: user._id },
      accepted: { at: new Date(Date.now() - 3600 * 1000 * 70), by: null },
      packed: { at: new Date(Date.now() - 3600 * 1000 * 60) },
      shipped: { at: new Date(Date.now() - 3600 * 1000 * 48), by: null },
      delivered: { at: new Date(Date.now() - 3600 * 1000 * 2), by: null },
    },
    notes: 'Dummy delivered order for verified customer review workflow testing',
  };

  const order = new Order(deliveredOrderData);
  await order.save();

  console.log('✅ Successfully created dummy delivered order!');
  console.log('Order ID:', order._id.toString());
  console.log('Order Number:', order.orderNumber);
  console.log('Order Status:', order.orderStatus);
  console.log('Delivered At:', order.orderTimeline?.delivered?.at);

  await mongoose.disconnect();
}

seedDeliveredOrder().catch((err) => {
  console.error('❌ Failed to seed delivered order:', err);
  process.exit(1);
});
