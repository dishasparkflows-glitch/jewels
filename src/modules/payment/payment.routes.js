const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { optionalAuth } = require('../../middleware/auth.middleware');

// Public gateway configuration (which providers are active and public keys)
router.get('/config', paymentController.getConfig);

// Initiate payment for an order
router.post('/initiate', optionalAuth, paymentController.initiatePayment);

// Razorpay signature verification from frontend checkout modal
router.post('/razorpay/verify', optionalAuth, paymentController.verifyRazorpay);

// CCAvenue user redirect callback (POSTed by CCAvenue gateway upon completion)
router.post('/ccavenue/response', paymentController.handleCCAvenueResponse);
router.get('/ccavenue/response', paymentController.handleCCAvenueResponse);

// Razorpay Webhook endpoint
router.post('/razorpay/webhook', paymentController.handleRazorpayWebhook);

// CCAvenue S2S Webhook endpoint
router.post('/ccavenue/webhook', paymentController.handleCCAvenueWebhook);

module.exports = router;

