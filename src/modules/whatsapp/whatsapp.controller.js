const whatsappService = require('./whatsapp.service');
const whatsappTemplateService = require('./whatsappTemplate.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class WhatsAppController {
  // ─── Integration Management ────────────────────────────────────────

    // ------------------------------- connect whatsapp integration ----------------------------
  connectIntegration = catchAsync(async (req, res) => {
    const result = await whatsappService.connectIntegration(req.body);
    ApiResponse.success(res, result, 'ConnectWhats WhatsApp integration connected successfully.');
  });

    // ------------------------------- get whatsapp integration status ----------------------------
  getIntegrationStatus = catchAsync(async (req, res) => {
    const result = await whatsappService.getIntegrationStatus();
    ApiResponse.success(res, null, 'Integration status retrieved');
  });

    // ------------------------------- disconnect whatsapp integration ----------------------------
  disconnectIntegration = catchAsync(async (req, res) => {
    const result = await whatsappService.disconnectIntegration();
    ApiResponse.success(res, result, 'WhatsApp integration disconnected successfully.');
  });

  // ─── Messaging ─────────────────────────────────────────────────────

    // ------------------------------- send whatsapp text message ----------------------------
  sendTextMessage = catchAsync(async (req, res) => {
    const { to, message } = req.body;
    const result = await whatsappService.sendTextMessage(to, message);
    ApiResponse.success(res, result, 'WhatsApp text message dispatched successfully');
  });

    // ------------------------------- send whatsapp template message ----------------------------
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

    // ------------------------------- send whatsapp test message ----------------------------
  sendTestMessage = catchAsync(async (req, res) => {
    const { to, message } = req.body;
    const result = await whatsappService.sendTestMessage(to, message);
    ApiResponse.success(res, result, 'Test message sent successfully');
  });

    // ------------------------------- get whatsapp message history ----------------------------
  getMessageHistory = catchAsync(async (req, res) => {
    const { items, pagination } = await whatsappService.getMessageHistory(req.query);
    ApiResponse.paginated(res, items, pagination, 'WhatsApp messages retrieved successfully');
  });

    // ------------------------------- get whatsapp message details ----------------------------
  getMessageDetails = catchAsync(async (req, res) => {
    const result = await whatsappService.getMessageDetails(req.params.id);
    ApiResponse.success(res, result, 'Message details retrieved successfully');
  });

  // ─── Templates ─────────────────────────────────────────────────────

    // ------------------------------- get whatsapp templates ----------------------------
  getTemplates = catchAsync(async (req, res) => {
    const { items, pagination } = await whatsappTemplateService.getTemplates(req.query);
    ApiResponse.paginated(res, items, pagination, 'WhatsApp templates retrieved successfully');
  });

    // ------------------------------- get whatsapp template by id ----------------------------
  getTemplateById = catchAsync(async (req, res) => {
    const template = await whatsappTemplateService.getTemplateById(req.params.id);
    ApiResponse.success(res, template, 'Template retrieved successfully');
  });

    // ------------------------------- create whatsapp template ----------------------------
  createTemplate = catchAsync(async (req, res) => {
    const template = await whatsappTemplateService.createTemplate(req.body, req.user?._id);
    ApiResponse.created(res, null, 'WhatsApp template created successfully');
  });

    // ------------------------------- update whatsapp template ----------------------------
  updateTemplate = catchAsync(async (req, res) => {
    const template = await whatsappTemplateService.updateTemplate(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, null, 'WhatsApp template updated successfully');
  });

    // ------------------------------- update whatsapp template status ----------------------------
  updateTemplateStatus = catchAsync(async (req, res) => {
    const template = await whatsappTemplateService.updateTemplateStatus(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, null, 'Template status updated successfully');
  });

    // ------------------------------- preview whatsapp template ----------------------------
  previewTemplate = catchAsync(async (req, res) => {
    const preview = await whatsappTemplateService.previewTemplate(req.params.id, req.body?.context);
    ApiResponse.success(res, preview, 'Template preview generated successfully');
  });

    // ------------------------------- get provider whatsapp templates ----------------------------
  getProviderTemplates = catchAsync(async (req, res) => {
    const templates = await whatsappTemplateService.getProviderTemplates();
    ApiResponse.success(res, templates?.data || templates, 'Provider templates retrieved');
  });

    // ------------------------------- sync provider whatsapp templates ----------------------------
  syncProviderTemplates = catchAsync(async (req, res) => {
    const result = await whatsappTemplateService.syncProviderTemplates();
    ApiResponse.success(res, result, `Synced ${result.synced} templates with ConnectWhats`);
  });

    // ------------------------------- delete whatsapp template ----------------------------
  deleteTemplate = catchAsync(async (req, res) => {
    const result = await whatsappTemplateService.deleteTemplate(req.params.id);
    ApiResponse.success(res, null, 'Template deleted successfully');
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
