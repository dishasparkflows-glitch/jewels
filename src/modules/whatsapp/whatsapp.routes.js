const express = require('express');
const router = express.Router();
const whatsappController = require('./whatsapp.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

const adminOnly = [authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN)];

// ─── Public Webhook ────────────────────────────────────────────────
router.post('/webhook', whatsappController.handleWebhook);

// ─── Integration Management ────────────────────────────────────────
router.get('/integration', ...adminOnly, whatsappController.getIntegrationStatus);
router.post('/integration/connect', ...adminOnly, whatsappController.connectIntegration);
router.delete('/integration', ...adminOnly, whatsappController.disconnectIntegration);

// ─── Template Management ───────────────────────────────────────────
router.get('/templates', ...adminOnly, whatsappController.getTemplates);
router.post('/templates', ...adminOnly, whatsappController.createTemplate);
router.post('/templates/sync', ...adminOnly, whatsappController.syncProviderTemplates);
router.get('/templates/provider', ...adminOnly, whatsappController.getProviderTemplates);
router.get('/templates/:id', ...adminOnly, whatsappController.getTemplateById);
router.put('/templates/:id', ...adminOnly, whatsappController.updateTemplate);
router.patch('/templates/:id', ...adminOnly, whatsappController.updateTemplate);
router.patch('/templates/:id/status', ...adminOnly, whatsappController.updateTemplateStatus);
router.post('/templates/:id/preview', ...adminOnly, whatsappController.previewTemplate);
router.delete('/templates/:id', ...adminOnly, whatsappController.deleteTemplate);

// ─── Messaging ─────────────────────────────────────────────────────
router.post('/messages/send-text', ...adminOnly, whatsappController.sendTextMessage);
router.post('/messages/send-template', ...adminOnly, whatsappController.sendTemplateMessage);
router.post('/messages/test', ...adminOnly, whatsappController.sendTestMessage);
router.get('/messages', ...adminOnly, whatsappController.getMessageHistory);
router.get('/messages/:id', ...adminOnly, whatsappController.getMessageDetails);

module.exports = router;
