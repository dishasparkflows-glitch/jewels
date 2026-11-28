const mongoose = require('mongoose');

const topAnnouncementSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: [true, 'Please provide an announcement message'],
      trim: true,
    },
    link: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['inactive', 'active'],
      default: 'active',
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    date: {
      _id: false,
      start: {
        type: Date,
        default: null,
      },
      end: {
        type: Date,
        default: null,
      },
    },
    hasNoEndDate: {
      type: Boolean,
      default: true,
    },
  },
  {
    versionKey: false,
    collection: 'top_announcements',
  }
);

const TopAnnouncement = mongoose.model('TopAnnouncement', topAnnouncementSchema, 'top_announcements');

module.exports = {
  TopAnnouncement,
};
