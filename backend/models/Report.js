const mongoose = require('mongoose');
const { parseCoordinates } = require('../utils/coordinates');

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: [true, 'Report title / location description is required']
  },
  category: {
    type: String,
    default: 'Waste Collection'
  },
  barangay: {
    type: String,
    required: true,
    trim: true
  },
  district: {
    type: String,
    default: 'Unassigned'
  },
  purokZone: {
    type: String,
    default: ''
  },
  landmark: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
    default: 'Pending'
  },
  assignedAt: {
    type: Date,
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  gpsCoordinates: {
    type: String,
    default: ''
  },
  location: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: {
      type: [Number],
      validate: {
        validator: coordinates => Array.isArray(coordinates) &&
          coordinates.length === 2 &&
          coordinates[0] >= -180 && coordinates[0] <= 180 &&
          coordinates[1] >= -90 && coordinates[1] <= 90,
        message: 'Location coordinates must be [longitude, latitude] within valid ranges'
      }
    }
  },
  unitAssigned: {
    type: String,
    default: 'Unassigned'
  },
  team: {
    type: String,
    default: ''
  },
  personnel: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  reporter: {
    type: String,
    default: 'Resident Reporter'
  },
  userEmail: {
    type: String,
    default: ''
  },
  photoUrl: {
    type: String,
    default: '',
    maxlength: 5600040
  },
  media: {
    type: Boolean,
    default: false
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

reportSchema.pre('validate', function (next) {
  if (!this.location && this.gpsCoordinates) {
    this.location = parseCoordinates(this.gpsCoordinates) || undefined;
  }
  if (!this.reportId) {
    this.reportId = `#CDO-${new Date(this.createdAt || Date.now()).getFullYear()}-${this._id.toString().toUpperCase()}`;
  }
  next();
});

reportSchema.index({ createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ barangay: 1, createdAt: -1 });
reportSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Report', reportSchema);
