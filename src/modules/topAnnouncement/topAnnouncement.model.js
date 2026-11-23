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
    isActive: {
      type: Boolean,
      default: true,
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
