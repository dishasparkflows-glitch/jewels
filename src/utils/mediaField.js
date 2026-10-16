const mongoose = require('mongoose');
const { normalizeMedia } = require('./media');

const schema = new mongoose.Schema({
  url: { type: String, default: '' },
  key: { type: String, default: '' },
}, { _id: false });

module.exports = { type: schema, default: () => ({ url: '', key: '' }), set: (value) => normalizeMedia(value || '') };
