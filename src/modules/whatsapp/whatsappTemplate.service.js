const WhatsAppTemplate = require('./whatsappTemplate.model');
const { escapeRegex } = require('../../utils/string');
const connectWhatsClient = require('./connectWhats.client');
const { getFormatter } = require('../../utils/templateFormatters');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { getValueByPath, extractTemplateVariables } = require('./whatsapp.utils');
const ApiError = require('../../utils/ApiError');

const PROVIDER = 'connectwhats';

class WhatsAppTemplateService {
  // ─── Template Variable Engine ───────────────────────────────────────

    // ------------------------------- extract template variables ----------------------------
  extractTemplateVariables(bodyText) {
    return extractTemplateVariables(bodyText);
  }

  getValueByPath(obj, path) {
    return getValueByPath(obj, path);
  }

    // ------------------------------- resolve template variables ----------------------------
  resolveTemplateVariables(template, context = {}) {
    if (!template || !template.variables || template.variables.length === 0) {
      return [];
    }

    const sortedVars = [...template.variables].sort((a, b) => a.position - b.position);

    return sortedVars.map((v) => {
      let val = undefined;

      // 1. Direct path lookup from context
      if (v.source) {
        val = this.getValueByPath(context, v.source);
      }

      // 2. Direct lookup by key or source at root level
      if ((val === undefined || val === null || val === '') && v.key && context[v.key] !== undefined) {
        val = context[v.key];
      }
      if ((val === undefined || val === null || val === '') && v.source && context[v.source] !== undefined) {
        val = context[v.source];
      }

      // 3. Positional array lookup
      if (val === undefined || val === null || val === '') {
        if (Array.isArray(context.variables) && context.variables[v.position - 1] !== undefined) {
          val = context.variables[v.position - 1];
        } else if (Array.isArray(context) && context[v.position - 1] !== undefined) {
          val = context[v.position - 1];
        }
      }

      // 4. Semantic fallbacks for common jewelry store contexts
      if (val === undefined || val === null || val === '') {
        if (v.source === 'customer.name') {
          val =
            context.customer?.name ||
            context.customer?.fullName ||
            context.appointment?.fullName ||
            context.appointment?.customerName ||
            context.inquiry?.name ||
            context.order?.shippingAddress?.firstName ||
            context.name;
        } else if (v.source === 'appointment.customerName') {
          val = context.appointment?.fullName || context.appointment?.customerName || context.customer?.name || context.fullName;
        } else if (v.source === 'appointment.date') {
          val = context.appointment?.appointmentDate || context.appointment?.date || context.date;
        } else if (v.source === 'appointment.time') {
          val = context.appointment?.preferredTime || context.appointment?.time || context.preferredTime || context.time;
        } else if (v.source === 'appointment.location') {
          val = context.appointment?.location || context.location;
        } else if (v.source === 'order.orderNumber') {
          val = context.order?.orderNumber || context.order?.id || context.orderId;
        } else if (v.source === 'order.totalAmount') {
          val = context.order?.totalAmount ?? context.order?.totalPrice;
        } else if (v.source === 'order.items') {
          val = context.order?.items || context.order?.orderItems;
        } else if (v.source === 'inquiry.customerName') {
          val = context.inquiry?.name || context.inquiry?.customerName || context.name;
        } else if (v.source === 'inquiry.jewelryType') {
          val = context.inquiry?.jewelryType || context.jewelryType;
        }
      }

      // 5. Fallback to exampleValue if still undefined
      if ((val === undefined || val === null || val === '') && v.exampleValue && !context.__strictNoDefaults) {
        val = v.exampleValue;
      }

      // 6. Apply formatters
      if (v.formatter) {
        const formatterFn = getFormatter(v.formatter);
        if (formatterFn) {
          val = formatterFn(val !== undefined ? val : context, context);
        }
      } else {
        if (Array.isArray(val)) {
          val = getFormatter('orderItems')(val);
        } else if (typeof val === 'number') {
          val = Number.isInteger(val) ? String(val) : val.toFixed(2);
        }
      }

      const cleanText = String(val !== undefined && val !== null ? val : '').trim();

      return {
        type: 'text',
        text: cleanText,
        position: v.position,
        key: v.key,
        label: v.label,
        allowEmpty: Boolean(v.allowEmpty),
      };
    });
  }

    // ------------------------------- render template preview ----------------------------
  renderTemplatePreview(template, parameters = []) {
    if (!template || !template.body) return '';
    let rendered = template.body;
    parameters.forEach((param) => {
      const placeholder = new RegExp(`\\{\\{${param.position}\\}\\}`, 'g');
      rendered = rendered.replace(placeholder, param.text);
    });
    return rendered;
  }

    // ------------------------------- validate template parameters ----------------------------
  validateTemplateParameters(template, parameters = []) {
    if (!template) {
      throw new ApiError(404, 'WhatsApp template not found.');
    }

    const configuredVars = template.variables || [];
    if (parameters.length < configuredVars.length) {
      throw new ApiError(
        400,
        `Expected ${configuredVars.length} parameters for template '${template.name}', but received ${parameters.length}.`
      );
    }

    for (const p of parameters) {
      if (!p.allowEmpty && (!p.text || !p.text.trim())) {
        throw new ApiError(400, `Template variable '${p.label || p.key || p.position}' cannot be empty.`);
      }
    }
    return true;
  }

    // ------------------------------- validate template config ----------------------------
  validateTemplateConfig({ name, displayName, body, language, category }) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'Template name is required.');
    }
    if (!body || typeof body !== 'string' || !body.trim()) {
      throw new ApiError(400, 'Template body is required.');
    }
    if (category && !['UTILITY', 'MARKETING', 'AUTHENTICATION'].includes(category.toUpperCase())) {
      throw new ApiError(400, 'Category must be UTILITY, MARKETING, or AUTHENTICATION.');
    }
  }

  // ─── Template CRUD Operations ──────────────────────────────────────

    // ------------------------------- get whatsapp templates ----------------------------
  async getTemplates(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.category && queryParams.category !== 'All Categories') {
      const cat = queryParams.category.toUpperCase();
      filter.$or = [
        { 'template.category': cat },
        { category: cat },
      ];
    }
    if (queryParams.status && queryParams.status !== 'All Status') {
      filter.status = queryParams.status;
    }
    if (queryParams.search) {
      const term = escapeRegex(queryParams.search.trim());
      filter.$or = [
        { 'template.name': new RegExp(term, 'i') },
        { 'template.displayName': new RegExp(term, 'i') },
        { 'template.body': new RegExp(term, 'i') },
        { name: new RegExp(term, 'i') },
        { displayName: new RegExp(term, 'i') },
        { body: new RegExp(term, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      WhatsAppTemplate.find(filter)
        .sort({ 'meta.createdAt': -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WhatsAppTemplate.countDocuments(filter),
    ]);

    const formattedItems = items.map((doc) => {
      const t = doc.template || {};
      const meta = doc.meta || {};
      return {
        ...doc,
        name: t.name || doc.name,
        displayName: t.displayName || doc.displayName || t.name || doc.name,
        category: t.category || doc.category || 'UTILITY',
        language: t.language || doc.language || 'English',
        body: t.body || doc.body || '',
        variables: doc.variables || [],
        createdAt: meta.createdAt || doc.createdAt,
        updatedAt: meta.updatedAt || doc.updatedAt,
      };
    });

    return {
      items: formattedItems,
      pagination: getPaginationMeta(total, page, limit),
    };
  }

    // ------------------------------- get whatsapp template by id ----------------------------
  async getTemplateById(id) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const template = isObjectId
      ? await WhatsAppTemplate.findOne({ _id: id })
      : await WhatsAppTemplate.findOne({
          $or: [
            { 'template.name': id.toLowerCase() },
            { name: id.toLowerCase() },
          ],
        });

    if (!template) {
      throw new ApiError(404, `WhatsApp template '${id}' not found`);
    }

    const doc = template.toObject ? template.toObject() : template;
    const t = doc.template || {};
    const meta = doc.meta || {};
    return {
      ...doc,
      name: t.name || doc.name,
      displayName: t.displayName || doc.displayName || t.name || doc.name,
      category: t.category || doc.category || 'UTILITY',
      language: t.language || doc.language || 'English',
      body: t.body || doc.body || '',
      createdAt: meta.createdAt || doc.createdAt,
      updatedAt: meta.updatedAt || doc.updatedAt,
    };
  }

    // ------------------------------- create whatsapp template ----------------------------
  async createTemplate(data, userId) {
    const raw = data.template || data;
    const name = (raw.name || '').trim().toLowerCase();
    const displayName = (raw.displayName || raw.name || '').trim();
    const category = (raw.category || 'UTILITY').toUpperCase();
    const language = (raw.language || 'English').trim();
    const body = (raw.body || '').trim();

    this.validateTemplateConfig({ name, displayName, category, language, body });

    const existing = await WhatsAppTemplate.findOne({
      $or: [{ 'template.name': name }, { name }],
      'meta.deletedAt': null,
    });
    if (existing) {
      throw new ApiError(400, `Template with name '${name}' already exists.`);
    }

    return await WhatsAppTemplate.create({
      template: {
        name,
        displayName,
        category,
        language,
        body,
      },
      variables: Array.isArray(data.variables) ? data.variables : [],
      status: data.status || 'APPROVED',
      meta: {
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      createdBy: userId,
    });
  }

    // ------------------------------- update whatsapp template ----------------------------
  async updateTemplate(id, data, userId) {
    const template = await WhatsAppTemplate.findOne({ _id: id });
    if (!template) {
      throw new ApiError(404, 'Template not found');
    }

    const raw = data.template || data;
    const currentTmpl = template.template || {};

    const updatedName = raw.name !== undefined ? raw.name.trim().toLowerCase() : (currentTmpl.name || template.name);
    const updatedDisplayName = raw.displayName !== undefined ? raw.displayName.trim() : (currentTmpl.displayName || template.displayName || updatedName);
    const updatedCategory = raw.category !== undefined ? raw.category.toUpperCase() : (currentTmpl.category || template.category || 'UTILITY');
    const updatedLanguage = raw.language !== undefined ? raw.language.trim() : (currentTmpl.language || template.language || 'English');
    const updatedBody = raw.body !== undefined ? raw.body.trim() : (currentTmpl.body || template.body);

    this.validateTemplateConfig({
      name: updatedName,
      displayName: updatedDisplayName,
      category: updatedCategory,
      language: updatedLanguage,
      body: updatedBody,
    });

    template.template = {
      name: updatedName,
      displayName: updatedDisplayName,
      category: updatedCategory,
      language: updatedLanguage,
      body: updatedBody,
    };

    if (data.variables !== undefined) {
      template.variables = Array.isArray(data.variables) ? data.variables : [];
    }
    if (data.status !== undefined) template.status = data.status;
    template.updatedBy = userId;
    return await template.save();
  }

    // ------------------------------- update whatsapp template status ----------------------------
  async updateTemplateStatus(id, { status }, userId) {
    const template = await WhatsAppTemplate.findOne({ _id: id });
    if (!template) {
      throw new ApiError(404, 'Template not found');
    }

    if (status) template.status = status;

    template.updatedBy = userId;
    return await template.save();
  }

    // ------------------------------- preview whatsapp template ----------------------------
  async previewTemplate(id, customContext = null) {
    const template = await this.getTemplateById(id);
    const sampleContext = { ...(customContext || {}), __strictNoDefaults: true };
    const parameters = this.resolveTemplateVariables(template, sampleContext);
    const renderedText = this.renderTemplatePreview(template, parameters);

    return {
      templateName: template.name,
      displayName: template.displayName,
      category: template.category,
      parameters,
      renderedText,
    };
  }

    // ------------------------------- delete whatsapp template ----------------------------
  async deleteTemplate(id) {
    const template = await WhatsAppTemplate.findOne({ _id: id });
    if (!template) {
      throw new ApiError(404, 'Template not found');
    }

    template.meta = template.meta || {};
    template.meta.deletedAt = new Date();
    await template.save();
    return { id, message: 'Template deleted successfully' };
  }

  // ─── Provider Sync ─────────────────────────────────────────────────

    // ------------------------------- get provider templates ----------------------------
  async getProviderTemplates() {
    return await connectWhatsClient.getProviderTemplates();
  }

    // ------------------------------- sync provider templates ----------------------------
  async syncProviderTemplates() {
    const remoteResult = await connectWhatsClient.getProviderTemplates();

    const remoteTemplates = remoteResult?.data || remoteResult || [];
    if (!Array.isArray(remoteTemplates)) {
      return { synced: 0, updates: [] };
    }

    const updates = [];
    for (const remote of remoteTemplates) {
      const remoteName = (remote.name || '').trim().toLowerCase();
      const remoteStatus = (remote.status || '').toUpperCase();
      const remoteId = String(remote.id || '');

      if (!remoteName) continue;

      const local = await WhatsAppTemplate.findOne({
        $or: [{ 'template.name': remoteName }, { name: remoteName }],
      });
      if (local) {
        const prevStatus = local.provider?.status;
        local.provider.templateId = remoteId || local.provider.templateId;
        local.provider.templateName = remote.name;
        local.provider.status =
          remoteStatus === 'APPROVED' ? 'APPROVED' : remoteStatus === 'REJECTED' ? 'REJECTED' : 'PENDING';
        if (remoteStatus === 'APPROVED') {
          local.status = 'APPROVED';
        }
        await local.save();

        updates.push({
          name: local.template?.name || local.name,
          previousStatus: prevStatus,
          currentStatus: local.provider.status,
          templateId: remoteId,
        });
      }
    }

    return {
      synced: updates.length,
      updates,
      remoteCount: remoteTemplates.length,
    };
  }
}

module.exports = new WhatsAppTemplateService();
