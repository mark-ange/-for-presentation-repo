const mongoose = require('mongoose');

const communityContentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['recycle', 'event', 'tip', 'blog'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  summary: {
    type: String,
    default: ''
  },
  body: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: ''
  },
  sourceUrl: {
    type: String,
    default: ''
  },
  images: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  eventStartAt: {
    type: String,
    default: ''
  },
  eventEndAt: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CommunityContent', communityContentSchema);
