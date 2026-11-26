const mongoose = require('mongoose');
const { encryptDatabaseUrl } = require('../../utils/encryption');

const ownerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Owner / client name is required'],
      unique: true,
      trim: true,
      index: true,
    },
    databaseUrl: {
      type: String,
      required: [true, 'Database URL is required'],
      trim: true,
    },
    websiteUrl: {
      type: String,
      trim: true,
      default: '',
    },
    allowedModules: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    versionKey: false,
    collection: 'owners',
  }
);

ownerSchema.pre('save', function encryptOwnerDatabaseUrl() {
  if (this.isModified('databaseUrl') && this.databaseUrl) {
    this.databaseUrl = encryptDatabaseUrl(this.databaseUrl);
  }
});

module.exports = mongoose.model('Owner', ownerSchema, 'owners');
