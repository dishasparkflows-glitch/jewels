const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const appointmentSchema = new mongoose.Schema(
  {
    // Direct top-level fields (as stored in DB)
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: '',
    },
    appointmentDate: {
      type: Date,
      default: null,
    },
    preferredTime: {
      type: String,
      trim: true,
      default: '',
    },
    serviceType: {
      type: String,
      trim: true,
      default: 'Jewellery Viewing',
    },

    // 1. Nested Customer Details (for compatibility)
    customer: {
      name: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      phone: {
        countryCode: {
          type: String,
          default: '91',
        },
        number: {
          type: String,
          trim: true,
        },
      },
    },

    // 2. Nested Appointment Details (for compatibility)
    appointment: {
      date: {
        type: Date,
      },
      preferredTime: {
        type: String,
        trim: true,
      },
      serviceType: {
        type: String,
        trim: true,
      },
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    adminNotes: {
      type: String,
      default: '',
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    versionKey: false,
    strict: false,
  }
);

appointmentSchema.index({ appointmentDate: 1 });
appointmentSchema.index({ email: 1 });
appointmentSchema.index({ phoneNumber: 1 });
appointmentSchema.index({ 'appointment.date': 1 });
appointmentSchema.index({ 'customer.email': 1 });
appointmentSchema.index({ 'customer.phone.number': 1 });
appointmentSchema.index({ status: 1, 'meta.createdAt': -1 });

appointmentSchema.plugin(metaPlugin);

module.exports = mongoose.model('Appointment', appointmentSchema);

