const mongoose = require('mongoose');
const { getBarangayLocation, parseCoordinates } = require('../utils/coordinates');

const FLEET_STATUSES = ['Idle', 'Dispatching', 'In Transit', 'Maintenance', 'Out of Service'];

const fleetSchema = new mongoose.Schema({
  truckId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  plate: {
    type: String,
    required: true,
    trim: true
  },
  barangay: {
    type: String,
    default: 'Carmen'
  },
  driver: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: FLEET_STATUSES,
    default: 'Idle'
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
  locationSource: {
    type: String,
    enum: ['gps', 'barangay-estimate'],
    default: 'barangay-estimate'
  },
  locationUpdatedAt: {
    type: Date,
    default: null
  },
  position: {
    top: { type: String, default: '35%' },
    left: { type: String, default: '50%' }
  }
}, {
  timestamps: true
});

fleetSchema.pre('validate', function (next) {
  const coordinates = this.get('location.coordinates');
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    this.location = getBarangayLocation(this.barangay) || undefined;
    this.locationSource = 'barangay-estimate';
  } else {
    const parsedLocation = parseCoordinates(this.location);
    if (!parsedLocation) {
      this.invalidate('location', 'Location must contain valid [longitude, latitude] coordinates.');
    } else {
      this.location = parsedLocation;
    }
    if (this.locationSource === 'gps' && !this.locationUpdatedAt) {
      this.locationUpdatedAt = new Date();
    }
  }
  next();
});

fleetSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Fleet', fleetSchema);
