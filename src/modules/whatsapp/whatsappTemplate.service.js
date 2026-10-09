const WhatsAppTemplate = require('./whatsappTemplate.model');
const connectWhatsClient = require('./connectWhats.client');
const { getFormatter } = require('../../utils/templateFormatters');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { getValueByPath, extractTemplateVariables } = require('./whatsapp.utils');
const ApiError = require('../../utils/ApiError');

const PROVIDER = 'connectwhats';

class WhatsAppTemplateService {
  // ─── Template Variable Engine ───────────────────────────────────────

  /**
   * Extracts {{1}}, {{2}} placeholders from template body
   */
  extractTemplateVariables(bodyText) {
    return extractTemplateVariables(bodyText);
  }

  /**
   * Resolves a nested property path from an object safely
   */
  getValueByPath(obj, path) {
    return getValueByPath(obj, path);
  }

  /**
   * Resolves template variables from context strictly based on template definitions
   */
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
          val = context.appointment?.location || context.location || 'Neirah Jewels Atelier';
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

  /**
   * Interpolate parameters into template body
   */
  renderTemplatePreview(template, parameters = []) {
    if (!template || !template.body) return '';
    let rendered = template.body;
    parameters.forEach((param) => {
      const placeholder = new RegExp(`\\{\\{${param.position}\\}\\}`, 'g');
      rendered = rendered.replace(placeholder, param.text);
    });
    return rendered;
  }

  /**
   * Validates parameters against template definition
   */
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

  /**
   * Validates template schema before saving
   */
  validateTemplateConfig({ name, body, language, category, variables, header, buttons }) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'Template name is required.');
    }
    if (!body || typeof body !== 'string' || !body.trim()) {
      throw new ApiError(400, 'Template body is required.');
    }
    if (!language || typeof language !== 'string' || !language.trim()) {
      throw new ApiError(400, 'Template language is required.');
    }
    if (category && !['UTILITY', 'MARKETING', 'AUTHENTICATION'].includes(category.toUpperCase())) {
      throw new ApiError(400, 'Category must be UTILITY, MARKETING, or AUTHENTICATION.');
    }

    const vars = Array.isArray(variables) ? variables : [];
    const bodyPositions = this.extractTemplateVariables(body);
    const configuredPositions = vars.map((v) => v.position);

    // Duplicate positions check
    const uniquePositions = new Set(configuredPositions);
    if (uniquePositions.size !== configuredPositions.length) {
      throw new ApiError(400, 'Duplicate variable positions detected in template configuration.');
    }

    // Sequential positions check (1..N)
    const sortedPositions = [...configuredPositions].sort((a, b) => a - b);
    for (let i = 0; i < sortedPositions.length; i++) {
      if (sortedPositions[i] !== i + 1) {
        throw new ApiError(
          400,
          `Invalid variable positions: expected consecutive positions 1 to ${sortedPositions.length}, but found ${sortedPositions[i]}.`
        );
      }
    }

    // Body variables match configured variables
    if (
      bodyPositions.length !== sortedPositions.length ||
      !bodyPositions.every((pos, idx) => pos === sortedPositions[idx])
    ) {
      throw new ApiError(
        400,
        `Body variables [${bodyPositions.join(', ')}] do not match configured variables [${sortedPositions.join(', ')}].`
      );
    }

    // Formatter validation
    for (const v of vars) {
      if (v.formatter && !getFormatter(v.formatter)) {
        throw new ApiError(
          400,
          `Invalid formatter '${v.formatter}'. Valid options: orderItems, currency, date, time, address.`
        );
      }
    }
  }

  // ─── Template CRUD Operations ──────────────────────────────────────

  /**
   * Get all templates
   */
  async getTemplates(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.category) filter.category = queryParams.category;
    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.isActive !== undefined) filter.isActive = queryParams.isActive === 'true';
    if (queryParams.search) {
      filter.$or = [
        { name: new RegExp(queryParams.search, 'i') },
        { displayName: new RegExp(queryParams.search, 'i') },
        { body: new RegExp(queryParams.search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      WhatsAppTemplate.find(filter)
        .sort({ isSystemTemplate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WhatsAppTemplate.countDocuments(filter),
    ]);

    return {
      items,
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  /**
   * Get single template by ID or Name
   */
  async getTemplateById(id) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const template = isObjectId
      ? await WhatsAppTemplate.findOne({ _id: id, isDeleted: false })
      : await WhatsAppTemplate.findOne({ name: id.toLowerCase(), isDeleted: false });

    if (!template) {
      throw new ApiError(404, `WhatsApp template '${id}' not found`);
    }
    return template;
  }

  /**
   * Create custom template
   */
  async createTemplate(data, userId) {
    const { name, displayName, category = 'UTILITY', language = 'en_US', body, header, buttons, variables, provider } = data;

    this.validateTemplateConfig({ name, displayName, category, language, body, variables, header, buttons });

    const existing = await WhatsAppTemplate.findOne({ name: name.trim().toLowerCase(), isDeleted: false });
    if (existing) {
      throw new ApiError(400, `Template with name '${name}' already exists.`);
    }

    return await WhatsAppTemplate.create({
      name: name.trim().toLowerCase(),
      displayName: displayName.trim(),
      category: category.toUpperCase(),
      language: language.trim(),
      body: body.trim(),
      header: header || { type: 'NONE' },
      buttons: buttons || [],
      variables: variables || [],
      provider: {
        name: PROVIDER,
        templateName: provider?.templateName || name.trim().toLowerCase(),
        templateId: provider?.templateId || '',
        status: provider?.status || 'PENDING',
      },
      isSystemTemplate: false,
      isActive: true,
      createdBy: userId,
    });
  }

  /**
   * Update template
   */
  async updateTemplate(id, data, userId) {
    const template = await WhatsAppTemplate.findOne({ _id: id, isDeleted: false });
    if (!template) {
      throw new ApiError(404, 'Template not found');
    }

    const updatedBody = data.body !== undefined ? data.body : template.body;
    const updatedVars = data.variables !== undefined ? data.variables : template.variables;
    const updatedLang = data.language !== undefined ? data.language : template.language;
    const updatedCat = data.category !== undefined ? data.category : template.category;

    this.validateTemplateConfig({
      name: template.name,
      displayName: data.displayName || template.displayName,
      category: updatedCat,
      language: updatedLang,
      body: updatedBody,
      variables: updatedVars,
      header: data.header || template.header,
      buttons: data.buttons || template.buttons,
    });

    const allowed = ['displayName', 'category', 'language', 'body', 'header', 'buttons', 'variables', 'provider', 'isActive', 'status'];
    allowed.forEach((field) => {
      if (data[field] !== undefined) {
        template[field] = data[field];
      }
    });

    template.updatedBy = userId;
    return await template.save();
  }

  /**
   * Update template status
   */
  async updateTemplateStatus(id, { isActive, status, providerStatus, providerTemplateId }, userId) {
    const template = await WhatsAppTemplate.findOne({ _id: id, isDeleted: false });
    if (!template) {
      throw new ApiError(404, 'Template not found');
    }

    if (isActive !== undefined) template.isActive = Boolean(isActive);
    if (status) template.status = status;
    if (providerStatus) template.provider.status = providerStatus;
    if (providerTemplateId) template.provider.templateId = providerTemplateId;

    template.updatedBy = userId;
    return await template.save();
  }

  /**
   * Preview template with rendered parameters
   */
  async previewTemplate(id, customContext = null) {
    const template = await this.getTemplateById(id);

    const sampleContext = customContext || {
      customer: { name: 'Prit' },
      appointment: {
        customerName: 'Prit',
        date: 'Monday, 12 October 2026',
        time: '04:00 PM',
        location: 'Neirah Jewels Atelier, Gandhinagar, Gujarat',
      },
      order: {
        orderNumber: 'NJ-8921',
        totalAmount: 18450,
        items: [{ name: 'Solitaire Diamond Ring', quantity: 1, price: 18450 }],
      },
      inquiry: {
        customerName: 'Prit',
        jewelryType: 'Custom Solitaire Ring',
      },
    };

    const parameters = this.resolveTemplateVariables(template, sampleContext);
    const renderedText = this.renderTemplatePreview(template, parameters);

    return {
      templateName: template.name,
      displayName: template.displayName,
      category: template.category,
      parameters,
      renderedText,
      header: template.header,
      buttons: template.buttons,
    };
  }

  /**
   * Delete template (System templates protected)
   */
  async deleteTemplate(id) {
    const template = await WhatsAppTemplate.findOne({ _id: id, isDeleted: false });
    if (!template) {
      throw new ApiError(404, 'Template not found');
    }
    if (template.isSystemTemplate) {
      throw new ApiError(403, 'System templates cannot be deleted.');
    }

    template.isDeleted = true;
    await template.save();
    return { id, message: 'Template deleted successfully' };
  }

  // ─── Provider Sync ─────────────────────────────────────────────────

  /**
   * Fetch approved templates directly from ConnectWhats provider
   */
  async getProviderTemplates() {
    return await connectWhatsClient.getProviderTemplates();
  }

  /**
   * Sync local templates status with ConnectWhats remote templates
   */
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

      const local = await WhatsAppTemplate.findOne({ name: remoteName, isDeleted: false });
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
          name: local.name,
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
