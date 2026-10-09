const WhatsAppMessage = require('./whatsappMessage.model');
const WhatsAppTemplate = require('./whatsappTemplate.model');
const IntegrationToken = require('./integrationToken.model');
const connectWhatsClient = require('./connectWhats.client');
const whatsappTemplateService = require('./whatsappTemplate.service');
const { normalizeUrl, normalizePhoneNumber } = require('./whatsapp.utils');
const { encryptToken } = require('../../utils/encryption');
const { getFormatter } = require('../../utils/templateFormatters');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const ApiError = require('../../utils/ApiError');

const PROVIDER = 'connectwhats';
const ACCOUNT_KEY = 'default';

class WhatsAppService {
  // ─── Integration Management ────────────────────────────────────────

  /**
   * Connects / Re-validates ConnectWhats integration and stores encrypted token in DB
   */
  async connectIntegration(customParams = {}) {
    const envConfig = connectWhatsClient.getEnvConfig();
    const apiKey = customParams.apiKey || envConfig.apiKey;
    const apiUrl = normalizeUrl(customParams.apiUrl || envConfig.apiUrl);
    const phoneNumberId =
      customParams.phoneNumberId ||
      envConfig.phoneNumberId ||
      customParams.instanceId ||
      envConfig.instanceId;
    const phoneNumber = customParams.phoneNumber || envConfig.phoneNumber;
    const instanceId = customParams.instanceId || envConfig.instanceId;
    const wabaId = customParams.wabaId || envConfig.wabaId;

    if (!apiKey) {
      throw new ApiError(400, 'ConnectWhats credentials missing. Please provide API key/token.');
    }

    // 1. Validate connection via test API call
    try {
      const endpoint = phoneNumberId
        ? `/api/v2/whatsapp-business/templates/${phoneNumberId}`
        : '/api/v2/whatsapp-business/templates';
      await connectWhatsClient.makeRequest({
        method: 'GET',
        endpoint,
        token: apiKey,
        baseUrl: apiUrl,
      });
    } catch (err) {
      if (
        process.env.NODE_ENV === 'development' &&
        (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED'))
      ) {
        console.warn('[ConnectWhats] Network unreachable in dev; connection accepted via config.');
      } else if (err.statusCode === 401 || err.statusCode === 403) {
        throw new ApiError(401, 'Invalid ConnectWhats credentials. Authentication failed.');
      }
    }

    // 2. Encrypt and upsert record in DB
    const accessTokenEncrypted = encryptToken(apiKey);
    const metadata = {
      apiUrl,
      phoneNumber,
      phoneNumberId,
      instanceId,
      wabaId,
    };

    const tokenDoc = await IntegrationToken.findOneAndUpdate(
      { provider: PROVIDER, accountKey: ACCOUNT_KEY },
      {
        $set: {
          accessTokenEncrypted,
          status: 'connected',
          metadata,
          lastAuthenticatedAt: new Date(),
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
          refreshAfter: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
        },
        $unset: { lastAuthError: 1 },
      },
      { upsert: true, new: true }
    );

    return {
      provider: PROVIDER,
      status: 'connected',
      phoneNumber,
      phoneNumberId,
      wabaId,
      instanceId,
      lastAuthenticatedAt: tokenDoc.lastAuthenticatedAt,
    };
  }

  /**
   * Retrieves safe integration status
   */
  async getIntegrationStatus() {
    const envConfig = connectWhatsClient.getEnvConfig();
    const dbToken = await IntegrationToken.findOne({ provider: PROVIDER, accountKey: ACCOUNT_KEY });

    const metadata = dbToken?.metadata || {};
    const status = dbToken ? dbToken.status : envConfig.isConfigured ? 'connected' : 'disconnected';

    return {
      provider: PROVIDER,
      status: status || 'disconnected',
      phoneNumber: metadata.phoneNumber || envConfig.phoneNumber || '',
      phoneNumberId: metadata.phoneNumberId || envConfig.phoneNumberId || '',
      wabaId: metadata.wabaId || envConfig.wabaId || '',
      instanceId: metadata.instanceId || envConfig.instanceId || '',
      lastAuthenticatedAt: dbToken?.lastAuthenticatedAt || null,
    };
  }

  /**
   * Disconnects the ConnectWhats integration locally
   */
  async disconnectIntegration() {
    await IntegrationToken.findOneAndUpdate(
      { provider: PROVIDER, accountKey: ACCOUNT_KEY },
      { $set: { status: 'disconnected' } }
    );
    return { provider: PROVIDER, status: 'disconnected' };
  }

  // ─── Messaging ─────────────────────────────────────────────────────

  /**
   * Sends a plain text WhatsApp message
   */
  async sendTextMessage(to, message) {
    if (!to || !message) {
      throw new ApiError(400, 'Recipient phone number and message are required');
    }

    const creds = await connectWhatsClient.getActiveCredentials();
    if (creds.status === 'disconnected') {
      throw new ApiError(400, 'WhatsApp integration is currently disconnected');
    }

    const normalizedTo = normalizePhoneNumber(to);
    const normalizedSender = (creds.phoneNumber || '').replace(/\D/g, '');

    if (normalizedTo && normalizedSender && normalizedTo === normalizedSender) {
      throw new ApiError(400, 'Cannot send WhatsApp message to the sender business phone number.');
    }

    // Create queued message record
    const messageRecord = await WhatsAppMessage.create({
      integrationTokenId: creds.dbTokenId,
      provider: PROVIDER,
      to: normalizedTo,
      from: creds.phoneNumber,
      type: 'text',
      message: message.trim(),
      renderedPreview: message.trim(),
      status: 'queued',
    });

    try {
      const phoneNoId = creds.phoneNumberId || creds.instanceId;
      const payload = {
        to: normalizedTo,
        phoneNoId: String(phoneNoId),
        type: 'text',
        text: message.trim(),
      };

      const result = await connectWhatsClient.makeRequest({
        method: 'POST',
        endpoint: '/api/v2/whatsapp-business/messages',
        data: payload,
        token: creds.token,
        baseUrl: creds.apiUrl,
      });

      const externalMessageId =
        result?.id ||
        result?.messageId ||
        result?.data?.id ||
        `cw_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      messageRecord.status = 'sent';
      messageRecord.externalMessageId = externalMessageId;
      messageRecord.providerMessageId = externalMessageId;
      messageRecord.sentAt = new Date();
      await messageRecord.save();

      return {
        success: true,
        externalMessageId,
        messageId: messageRecord._id,
        data: result,
      };
    } catch (err) {
      messageRecord.status = 'failed';
      messageRecord.failedAt = new Date();
      messageRecord.failureReason = err.message;
      messageRecord.error = {
        code: String(err.statusCode || 'SEND_ERROR'),
        message: err.message,
      };
      await messageRecord.save();
      throw err;
    }
  }

  /**
   * Sends a test message
   */
  async sendTestMessage(to, message = 'Neirah Jewellery WhatsApp integration test message.') {
    return this.sendTextMessage(to, message);
  }

  /**
   * Sends a business template WhatsApp message
   */
  async sendTemplateMessage({ to, templateName, language = 'en_US', variables = [], context = null }) {
    if (!to || !templateName) {
      throw new ApiError(400, 'Recipient phone number and templateName are required');
    }

    const creds = await connectWhatsClient.getActiveCredentials();
    if (creds.status === 'disconnected') {
      throw new ApiError(400, 'WhatsApp integration is currently disconnected');
    }

    const normalizedTo = normalizePhoneNumber(to);

    // 1. Look up template
    const template = await WhatsAppTemplate.findOne({
      name: templateName.trim().toLowerCase(),
      isDeleted: false,
    });

    if (!template) {
      throw new ApiError(404, `WhatsApp template '${templateName}' not found`);
    }

    if (!template.isActive) {
      throw new ApiError(400, `WhatsApp template '${template.displayName || template.name}' is currently disabled.`);
    }

    // 2. Resolve parameters dynamically via template service
    let parameters = [];
    if (context && typeof context === 'object') {
      parameters = whatsappTemplateService.resolveTemplateVariables(template, context);
      whatsappTemplateService.validateTemplateParameters(template, parameters);
    } else if (Array.isArray(variables) && variables.length > 0) {
      parameters = variables.map((v, idx) => ({
        type: 'text',
        text: String(v ?? ''),
        position: idx + 1,
      }));
    } else {
      parameters = whatsappTemplateService.resolveTemplateVariables(template, {});
    }

    const renderedPreview = whatsappTemplateService.renderTemplatePreview(template, parameters);
    const plainVariables = parameters.map((p) => p.text);
    const templateLang = template.language || language || 'en_US';
    const providerTemplateName = template.provider?.templateName || template.name;

    // 3. Create queued message record
    const messageRecord = await WhatsAppMessage.create({
      integrationTokenId: creds.dbTokenId,
      provider: PROVIDER,
      to: normalizedTo,
      from: creds.phoneNumber,
      type: 'template',
      templateName: template.name,
      templateLanguage: templateLang,
      variables: plainVariables,
      parameters,
      expectedParameterCount: (template.variables || []).length,
      actualParameterCount: parameters.length,
      renderedPreview,
      status: 'queued',
    });

    // 4. Dispatch via ConnectWhats
    try {
      const phoneNoId = creds.phoneNumberId || creds.instanceId;
      const payload = {
        to: normalizedTo,
        phoneNoId: String(phoneNoId),
        type: 'template',
        name: providerTemplateName,
        language: templateLang,
      };

      if (plainVariables.length > 0) {
        payload.bodyParams = plainVariables;
      }

      const result = await connectWhatsClient.makeRequest({
        method: 'POST',
        endpoint: '/api/v2/whatsapp-business/messages',
        data: payload,
        token: creds.token,
        baseUrl: creds.apiUrl,
      });

      const externalMessageId =
        result?.id ||
        result?.messageId ||
        result?.data?.id ||
        `cw_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      messageRecord.status = 'sent';
      messageRecord.externalMessageId = externalMessageId;
      messageRecord.providerMessageId = externalMessageId;
      messageRecord.sentAt = new Date();
      await messageRecord.save();

      return {
        success: true,
        externalMessageId,
        messageId: messageRecord._id,
        renderedPreview,
        templateName: template.name,
        data: result,
      };
    } catch (err) {
      messageRecord.status = 'failed';
      messageRecord.failedAt = new Date();
      messageRecord.failureReason = err.message;
      messageRecord.error = {
        code: String(err.statusCode || 'TEMPLATE_ERROR'),
        message: err.message,
      };
      await messageRecord.save();
      throw err;
    }
  }

  /**
   * Retrieves message logs with pagination and filtering
   */
  async getMessageHistory(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.type) {
      filter.type = queryParams.type;
    }
    if (queryParams.to) {
      filter.to = new RegExp(queryParams.to.replace(/\D/g, ''), 'i');
    }
    if (queryParams.search) {
      filter.$or = [
        { to: new RegExp(queryParams.search, 'i') },
        { templateName: new RegExp(queryParams.search, 'i') },
        { message: new RegExp(queryParams.search, 'i') },
        { renderedPreview: new RegExp(queryParams.search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      WhatsAppMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WhatsAppMessage.countDocuments(filter),
    ]);

    return {
      items,
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  /**
   * Retrieves single message details
   */
  async getMessageDetails(id) {
    const message = await WhatsAppMessage.findById(id).lean();
    if (!message) {
      throw new ApiError(404, 'WhatsApp message record not found');
    }
    return message;
  }

  /**
   * Handles delivery callbacks from ConnectWhats webhook
   */
  async handleWebhook(payload) {
    if (!payload) return { handled: false };

    const messageId = payload.id || payload.messageId || payload.externalMessageId || payload.msgId;
    const status = (payload.status || payload.event || '').toLowerCase();

    if (!messageId && !payload.to) {
      return { handled: false, reason: 'No identifier found in webhook payload' };
    }

    const update = {};
    if (['sent', 'delivered', 'read', 'failed'].includes(status)) {
      update.status = status;
      if (status === 'delivered') update.deliveredAt = new Date();
      if (status === 'read') update.readAt = new Date();
      if (status === 'failed') {
        update.failedAt = new Date();
        update.failureReason = payload.reason || payload.error?.message || 'Delivery failed';
      }
    }

    if (Object.keys(update).length > 0) {
      const filter = messageId
        ? { $or: [{ externalMessageId: messageId }, { providerMessageId: messageId }] }
        : { to: normalizePhoneNumber(payload.to) };

      await WhatsAppMessage.findOneAndUpdate(filter, { $set: update });
    }

    return { handled: true, status };
  }

  // ─── Business Notification Helpers ─────────────────────────────────

  /**
   * Dispatches WhatsApp appointment notification
   */
  async sendAppointmentNotification(appointment) {
    try {
      const { fullName, phoneNumber, appointmentDate, preferredTime, status } = appointment;
      if (!phoneNumber) return;

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const dateStr = getFormatter('date')(appointmentDate);

      const tmpl = await WhatsAppTemplate.findOne({
        name: status === 'confirmed' ? 'neirah_appointment_confirmed' : 'neirah_appointment_request',
        isActive: true,
        'provider.status': 'APPROVED',
        isDeleted: false,
      });

      if (tmpl) {
        await this.sendTemplateMessage({
          to: normalizedPhone,
          templateName: tmpl.name,
          context: {
            customer: { name: fullName },
            appointment: {
              customerName: fullName,
              date: dateStr,
              time: preferredTime,
              location: 'Neirah Jewels Atelier, Gandhinagar, Gujarat',
            },
          },
        });
        return;
      }

      let msg = '';
      if (status === 'confirmed') {
        msg = `💍 *NEIRAH: CONSULTATION CONFIRMED* ✨\n\nHello ${fullName},\nYour jewelry consultation has been officially *CONFIRMED*!\n\n📅 Date: ${dateStr}\n⏰ Time: ${preferredTime}\n📍 Location: Neirah Jewels Atelier\n\nWe look forward to welcoming you! ✨`;
      } else {
        msg = `💍 *NEIRAH: APPOINTMENT REQUEST RECEIVED* ✨\n\nHello ${fullName},\nWe have received your appointment request.\n\n📅 Date: ${dateStr}\n⏰ Time: ${preferredTime}\n⏳ Status: Under Review\n\nOur stylists will confirm your slot shortly. ✨`;
      }

      await this.sendTextMessage(normalizedPhone, msg);
    } catch (err) {
      console.error('[WhatsAppService] Failed to send appointment notification:', err.message);
    }
  }

  /**
   * Dispatches WhatsApp custom inquiry notification
   */
  async sendCustomInquiryNotification(inquiry) {
    try {
      const { name, phoneNumber, stoneType, metalType, budget, jewelryType, status } = inquiry;
      if (!phoneNumber) return;

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      let msg = '';

      if (status === 'confirmed') {
        msg = `💍 *NEIRAH: CUSTOM DESIGN CONFIRMED* ✨\n\nHello ${name},\nYour custom jewelry consultation is *CONFIRMED*. Our jewelry designers will contact you shortly to review CAD drafts. 💍`;
      } else {
        msg = `💍 *NEIRAH: CUSTOM INQUIRY RECEIVED* ✨\n\nHello ${name},\nThank you for reaching out for a bespoke jewelry design!\n\n💎 Stone: ${stoneType || 'Custom'}\n👑 Metal: ${metalType || 'Gold'}\n💰 Budget: ₹${budget || 'Custom'}\n\nOur styling team will contact you shortly. ✨`;
      }

      await this.sendTextMessage(normalizedPhone, msg);
    } catch (err) {
      console.error('[WhatsAppService] Failed to send custom inquiry notification:', err.message);
    }
  }

  // ─── Forwarded Template Operations (Backward Compatibility) ────────
  getTemplates(queryParams) {
    return whatsappTemplateService.getTemplates(queryParams);
  }
  getTemplateById(id) {
    return whatsappTemplateService.getTemplateById(id);
  }
  createTemplate(data, userId) {
    return whatsappTemplateService.createTemplate(data, userId);
  }
  updateTemplate(id, data, userId) {
    return whatsappTemplateService.updateTemplate(id, data, userId);
  }
  updateTemplateStatus(id, statusData, userId) {
    return whatsappTemplateService.updateTemplateStatus(id, statusData, userId);
  }
  previewTemplate(id, context) {
    return whatsappTemplateService.previewTemplate(id, context);
  }
  deleteTemplate(id) {
    return whatsappTemplateService.deleteTemplate(id);
  }
  getProviderTemplates() {
    return whatsappTemplateService.getProviderTemplates();
  }
  syncProviderTemplates() {
    return whatsappTemplateService.syncProviderTemplates();
  }
}

module.exports = new WhatsAppService();
