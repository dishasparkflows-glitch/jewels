const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const appointmentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide your email address'],
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Please provide your phone number'],
      trim: true,
    },
    appointmentDate: {
      type: Date,
      required: [true, 'Please select an appointment date'],
    },
    preferredTime: {
      type: String,
      required: [true, 'Please select a preferred time slot'],
      trim: true,
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
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

appointmentSchema.index({ status: 1 });
appointmentSchema.index({ appointmentDate: 1 });
appointmentSchema.index({ email: 1 });
appointmentSchema.index({ phoneNumber: 1 });
appointmentSchema.index({ createdAt: -1 });

appointmentSchema.plugin(metaPlugin);

module.exports = mongoose.model('Appointment', appointmentSchema);
