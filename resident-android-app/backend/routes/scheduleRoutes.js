const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const mockSchedules = [
  {
    barangay: 'Carmen',
    biodegradableDays: 'Monday, Wednesday, Friday',
    nonBiodegradableDays: 'Tuesday, Thursday, Saturday',
    timeSlot: '06:00 AM - 10:00 AM',
    assignedTruck: 'CLENRO Truck #4'
  },
  {
    barangay: 'Bulua',
    biodegradableDays: 'Monday, Thursday',
    nonBiodegradableDays: 'Wednesday, Saturday',
    timeSlot: '07:00 AM - 11:00 AM',
    assignedTruck: 'CLENRO Truck #2'
  },
  {
    barangay: 'Lapasan',
    biodegradableDays: 'Tuesday, Friday',
    nonBiodegradableDays: 'Monday, Wednesday',
    timeSlot: '05:00 AM - 09:00 AM',
    assignedTruck: 'CLENRO Truck #1'
  }
];

// @route   GET /api/schedules
// @desc    Get waste collection schedule by barangay
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { barangay } = req.query;
    let schedules = [];

    const escapedBarangay = typeof barangay === 'string'
      ? barangay.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : '';
    const filter = escapedBarangay
      ? { barangay: { $regex: `^${escapedBarangay}$`, $options: 'i' } }
      : {};
    const storedScheduleCount = await Schedule.countDocuments();
    if (storedScheduleCount > 0) {
      schedules = await Schedule.find(filter).sort({ barangay: 1 });
    } else {
      if (barangay) {
        schedules = mockSchedules.filter(
          s => s.barangay.toLowerCase() === String(barangay).trim().toLowerCase()
        );
      } else {
        schedules = [...mockSchedules].sort((a, b) => a.barangay.localeCompare(b.barangay));
      }
    }

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:barangay', protect, adminOnly, async (req, res) => {
  try {
    const barangay = req.params.barangay.trim();
    if (!barangay) {
      return res.status(400).json({ success: false, message: 'Barangay is required.' });
    }

    const allowedFields = ['biodegradableDays', 'nonBiodegradableDays', 'timeSlot', 'assignedTruck'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== 'string' || !req.body[field].trim()) {
          return res.status(400).json({ success: false, message: `${field} must be a non-empty string.` });
        }
        updates[field] = req.body[field].trim();
      }
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'Provide at least one schedule field to update.' });
    }

    const escapedBarangay = barangay.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let schedule = await Schedule.findOne({
      barangay: { $regex: `^${escapedBarangay}$`, $options: 'i' }
    });
    const changed = !schedule || Object.entries(updates).some(([field, value]) => schedule[field] !== value);

    if (schedule) {
      Object.assign(schedule, updates);
    } else {
      schedule = new Schedule({ barangay, ...updates });
    }
    await schedule.save();

    if (changed) {
      const residents = await User.find({
        role: 'resident',
        barangay: { $regex: `^${escapedBarangay}$`, $options: 'i' }
      }).select('_id').lean();
      if (residents.length) {
        const changedFields = Object.keys(updates).join(', ');
        await Notification.insertMany(residents.map(resident => ({
          user: resident._id,
          title: 'Collection schedule updated',
          body: `The waste collection schedule for ${schedule.barangay} changed (${changedFields}). Check the Schedule page for details.`,
          type: 'COLLECTION_SCHEDULE'
        })));
      }
    }

    return res.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Failed to update collection schedule:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to update collection schedule.' });
  }
});

module.exports = router;
