const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const appointmentSchema = new mongoose.Schema(
  {
    // 1. Customer Details
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

    // 2. Appointment Details
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
        default: 'Jewellery Viewing',
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
  },
  {
    versionKey: false,
    strict: false,
  }
);

appointmentSchema.index({ 'appointment.date': 1 });
appointmentSchema.index({ 'customer.email': 1 });
appointmentSchema.index({ 'customer.phone.number': 1 });
appointmentSchema.index({ status: 1, 'meta.createdAt': -1 });

appointmentSchema.plugin(metaPlugin);

module.exports = mongoose.model('Appointment', appointmentSchema);

