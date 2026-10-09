const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const appointmentSchema = new mongoose.Schema(
  {
    // 1. Customer Details
    customer: {
      name: {
        type: String,
        required: [true, 'Please provide your name'],
        trim: true,
      },
      email: {
        type: String,
        required: [true, 'Please provide your email address'],
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
          required: [true, 'Please provide your phone number'],
          trim: true,
        },
      },
    },

    // 2. Appointment Details
    appointment: {
      date: {
        type: Date,
        required: [true, 'Please select an appointment date'],
      },
      preferredTime: {
        type: String,
        required: [true, 'Please select a preferred time slot'],
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
  }
);

appointmentSchema.index({ 'appointment.date': 1 });
appointmentSchema.index({ 'customer.email': 1 });
appointmentSchema.index({ 'customer.phone.number': 1 });
appointmentSchema.index({ status: 1, 'meta.createdAt': -1 });

appointmentSchema.plugin(metaPlugin);

module.exports = mongoose.model('Appointment', appointmentSchema);
