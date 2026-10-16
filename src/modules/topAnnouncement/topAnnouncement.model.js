const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

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
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
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

topAnnouncementSchema.plugin(metaPlugin);

const topAnnouncementSettingSchema = new mongoose.Schema(
  {
    isEnabled: {
      type: Boolean,
      default: true,
    },
    autoplayInterval: {
      type: Number,
      default: 4000,
    },
  },
  {
    versionKey: false,
    collection: 'top_announcement_settings',
  }
);

topAnnouncementSettingSchema.plugin(metaPlugin);

const TopAnnouncement = mongoose.model('TopAnnouncement', topAnnouncementSchema, 'top_announcements');
const TopAnnouncementSetting = mongoose.model('TopAnnouncementSetting', topAnnouncementSettingSchema, 'top_announcement_settings');

module.exports = {
  TopAnnouncement,
  TopAnnouncementSetting,
};
