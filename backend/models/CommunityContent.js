const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 110
  },
  mimeType: {
    type: String,
    required: true,
    enum: ['image/jpeg', 'image/png', 'image/webp']
  },
  size: {
    type: Number,
    required: true,
    min: 1,
    max: 2 * 1024 * 1024
  },
  data: {
    type: Buffer,
    required: true,
    select: false
  }
}, {
  _id: true,
  id: false
});

const communityContentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['recycle', 'event', 'tip', 'blog'],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 140
  },
  summary: {
    type: String,
    default: '',
    maxlength: 300
  },
  body: {
    type: String,
    required: true,
    maxlength: 12000
  },
  imageUrl: {
    type: String,
    default: '',
    maxlength: 2048
  },
  sourceUrl: {
    type: String,
    default: '',
    maxlength: 2048
  },
  images: {
    type: [galleryImageSchema],
    default: [],
    validate: {
      validator: (images) => {
        const totalBytes = images.reduce((sum, image) => sum + image.size, 0);
        return images.length <= 5 && totalBytes <= 8 * 1024 * 1024;
      },
      message: 'Content galleries may contain at most 5 images and 8 MB total.'
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
    index: true
  },
  eventStartAt: {
    type: Date,
    default: null,
    required: function () {
      return this.type === 'event';
    }
  },
  eventEndAt: {
    type: Date,
    default: null,
    validate: {
      validator: function (value) {
        return !value || this.type !== 'event' || !this.eventStartAt || value >= this.eventStartAt;
      },
      message: 'Event end time must be after its start time.'
    }
  },
  location: {
    type: String,
    default: '',
    maxlength: 240,
    required: function () {
      return this.type === 'event';
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

communityContentSchema.index({ type: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('CommunityContent', communityContentSchema);
