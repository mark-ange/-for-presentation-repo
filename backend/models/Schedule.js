const mongoose = require('mongoose');

const areaScheduleSchema = new mongoose.Schema({
  areaName: {
    type: String,
    required: true,
    trim: true
  },
  appliesToAllAreas: {
    type: Boolean,
    default: false
  },
  isSample: {
    type: Boolean,
    default: true
  },
  biodegradableDays: {
    type: String,
    required: true,
    trim: true
  },
  nonBiodegradableDays: {
    type: String,
    required: true,
    trim: true
  },
  timeSlot: {
    type: String,
    required: true,
    trim: true
  },
  assignedTruck: {
    type: String,
    required: true,
    trim: true
  }
});

const scheduleSchema = new mongoose.Schema({
  barangay: {
    type: String,
    required: true,
    unique: true
  },
  biodegradableDays: {
    type: String
  },
  nonBiodegradableDays: {
    type: String
  },
  timeSlot: {
    type: String
  },
  assignedTruck: {
    type: String
  },
  areaSchedules: {
    type: [areaScheduleSchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Schedule', scheduleSchema);
