const whatsappService = require('./whatsapp.service');
const whatsappTemplateService = require('./whatsappTemplate.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class WhatsAppController {
  // ─── Integration Management ────────────────────────────────────────

  connectIntegration = catchAsync(async (req, res) => {
    const result = await whatsappService.connectIntegration(req.body);
    ApiResponse.success(res, result, 'ConnectWhats WhatsApp integration connected successfully.');
  });

  getIntegrationStatus = catchAsync(async (req, res) => {
    const result = await whatsappService.getIntegrationStatus();
    ApiResponse.success(res, result, 'Integration status retrieved');
  });

  disconnectIntegration = catchAsync(async (req, res) => {
    const result = await whatsappService.disconnectIntegration();
    ApiResponse.success(res, result, 'WhatsApp integration disconnected successfully.');
  });

  // ─── Messaging ─────────────────────────────────────────────────────

  sendTextMessage = catchAsync(async (req, res) => {
    const { to, message } = req.body;
    const result = await whatsappService.sendTextMessage(to, message);
    ApiResponse.success(res, result, 'WhatsApp text message dispatched successfully');
  });

  sendTemplateMessage = catchAsync(async (req, res) => {
    const { to, recipientPhone, templateName, language, variables, context } = req.body;
    const phone = to || recipientPhone;
    const result = await whatsappService.sendTemplateMessage({
      to: phone,
      templateName,
      language,
      variables,
      context,
    });
    ApiResponse.success(res, result, 'WhatsApp template message dispatched successfully');
  });

  sendTestMessage = catchAsync(async (req, res) => {
    const { to, message } = req.body;
    const result = await whatsappService.sendTestMessage(to, message);
    ApiResponse.success(res, result, 'Test message sent successfully');
  });

  getMessageHistory = catchAsync(async (req, res) => {
    const { items, pagination } = await whatsappService.getMessageHistory(req.query);
    ApiResponse.paginated(res, items, pagination, 'WhatsApp messages retrieved successfully');
  });

  getMessageDetails = catchAsync(async (req, res) => {
    const result = await whatsappService.getMessageDetails(req.params.id);
    ApiResponse.success(res, result, 'Message details retrieved successfully');
  });

  // ─── Templates ─────────────────────────────────────────────────────

  getTemplates = catchAsync(async (req, res) => {
    const { items, pagination } = await whatsappTemplateService.getTemplates(req.query);
    ApiResponse.paginated(res, items, pagination, 'WhatsApp templates retrieved successfully');
  });

  getTemplateById = catchAsync(async (req, res) => {
    const template = await whatsappTemplateService.getTemplateById(req.params.id);
    ApiResponse.success(res, template, 'Template retrieved successfully');
  });

  createTemplate = catchAsync(async (req, res) => {
    const template = await whatsappTemplateService.createTemplate(req.body, req.user?._id);
    ApiResponse.created(res, template, 'WhatsApp template created successfully');
  });

  updateTemplate = catchAsync(async (req, res) => {
    const template = await whatsappTemplateService.updateTemplate(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, template, 'WhatsApp template updated successfully');
  });

  updateTemplateStatus = catchAsync(async (req, res) => {
    const template = await whatsappTemplateService.updateTemplateStatus(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, template, 'Template status updated successfully');
  });

  previewTemplate = catchAsync(async (req, res) => {
    const preview = await whatsappTemplateService.previewTemplate(req.params.id, req.body?.context);
    ApiResponse.success(res, preview, 'Template preview generated successfully');
  });

  getProviderTemplates = catchAsync(async (req, res) => {
    const templates = await whatsappTemplateService.getProviderTemplates();
    ApiResponse.success(res, templates?.data || templates, 'Provider templates retrieved');
  });

  syncProviderTemplates = catchAsync(async (req, res) => {
    const result = await whatsappTemplateService.syncProviderTemplates();
    ApiResponse.success(res, result, `Synced ${result.synced} templates with ConnectWhats`);
  });

  deleteTemplate = catchAsync(async (req, res) => {
    const result = await whatsappTemplateService.deleteTemplate(req.params.id);
    ApiResponse.success(res, result, 'Template deleted successfully');
  });

  // ─── Webhook ───────────────────────────────────────────────────────

  handleWebhook = async (req, res) => {
    try {
      const result = await whatsappService.handleWebhook(req.body);
      res.status(200).json({ success: true, result });
    } catch (err) {
      console.error('[WhatsApp Webhook Error]:', err.message);
      res.status(200).json({ success: false, error: err.message });
    }
  };
}

module.exports = new WhatsAppController();
