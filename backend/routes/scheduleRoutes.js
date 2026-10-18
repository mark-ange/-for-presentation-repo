const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body } = require('express-validator');
const Schedule = require('../models/Schedule');
const memoryStore = require('../config/memoryStore');
const { apiLimiter, sanitizeMongoDB, validateInput } = require('../middleware/securityMiddleware');
const { protect, adminOnly } = require('../middleware/authMiddleware');

function isValidAreaSchedules(areaSchedules) {
  if (!Array.isArray(areaSchedules) || areaSchedules.length > 200) return false;

  const areaNames = new Set();
  return areaSchedules.every(areaSchedule => {
    if (!areaSchedule || typeof areaSchedule !== 'object') return false;
    const requiredFields = [
      'areaName',
      'biodegradableDays',
      'nonBiodegradableDays',
      'timeSlot',
      'assignedTruck'
    ];
    if (requiredFields.some(field => (
      typeof areaSchedule[field] !== 'string' ||
      !areaSchedule[field].trim() ||
      areaSchedule[field].length > (field === 'areaName' ? 160 : 300)
    ))) {
      return false;
    }

    if (areaSchedule.isSample !== undefined && typeof areaSchedule.isSample !== 'boolean') return false;
    if (areaSchedule.appliesToAllAreas !== undefined &&
        typeof areaSchedule.appliesToAllAreas !== 'boolean') return false;

    const normalizedName = areaSchedule.areaName.trim().toLocaleLowerCase();
    if (areaNames.has(normalizedName)) return false;
    areaNames.add(normalizedName);
    return true;
  });
}

// @route   GET /api/schedules
// @desc    Get waste collection schedules
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { barangay } = req.query;
    if (mongoose.connection.readyState === 1) {
      const query = barangay && barangay.trim()
        ? { barangay: new RegExp(`^${barangay.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        : {};
      const schedules = await Schedule.find(query).sort({ barangay: 1 });
      return res.json({
        success: true,
        count: schedules.length,
        data: schedules
      });
    }

    let list = memoryStore.schedules || [];
    if (barangay && barangay.trim()) {
      list = list.filter(s => (s.barangay || '').toLowerCase() === barangay.trim().toLowerCase());
    }

    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/schedules
// @desc    Create a new waste collection schedule
// @access  Public
router.post('/', 
  apiLimiter,
  sanitizeMongoDB,
  validateInput([
    body('barangay').notEmpty().isString().trim().escape().withMessage('Barangay name is required'),
    body('biodegradableDays').optional().isString().trim().escape(),
    body('nonBiodegradableDays').optional().isString().trim().escape(),
    body('timeSlot').optional().isString().trim().escape(),
    body('assignedTruck').optional().isString().trim().escape(),
    body('areaSchedules').optional().isArray({ max: 200 }).bail().custom(isValidAreaSchedules)
      .withMessage('Area schedules must have unique area names and complete collection details.')
  ]),
  protect,
  adminOnly,
  async (req, res) => {
  try {
    const {
      barangay,
      biodegradableDays,
      nonBiodegradableDays,
      timeSlot,
      assignedTruck,
      areaSchedules = []
    } = req.body;

    if (!barangay) {
      return res.status(400).json({ success: false, message: 'Barangay name is required' });
    }
    const baseScheduleValues = [biodegradableDays, nonBiodegradableDays, timeSlot, assignedTruck];
    const hasBaseSchedule = baseScheduleValues.some(value => value !== undefined && value !== '');
    if ((hasBaseSchedule && baseScheduleValues.some(value => !value)) ||
        (!hasBaseSchedule && areaSchedules.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Provide a complete barangay-wide schedule or at least one complete area schedule.'
      });
    }

    const existing = await Schedule.findOne({ barangay: new RegExp(`^${barangay.trim()}$`, 'i') });
    if (existing) {
      return res.status(409).json({ success: false, message: `Schedule for ${barangay} already exists.` });
    }

    const created = await Schedule.create({
      barangay: barangay.trim(),
      ...(hasBaseSchedule ? {
        biodegradableDays,
        nonBiodegradableDays,
        timeSlot,
        assignedTruck
      } : {}),
      areaSchedules: areaSchedules.map(areaSchedule => ({
        ...areaSchedule,
        isSample: areaSchedule.isSample !== false
      }))
    });

    res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: created
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/schedules/:id
// @desc    Update an existing collection schedule
// @access  Public
router.put('/:id', 
  apiLimiter,
  sanitizeMongoDB,
  validateInput([
    body('biodegradableDays').optional().isString().trim().escape(),
    body('nonBiodegradableDays').optional().isString().trim().escape(),
    body('timeSlot').optional().isString().trim().escape(),
    body('assignedTruck').optional().isString().trim().escape(),
    body('areaSchedules').optional().isArray({ max: 200 }).bail().custom(isValidAreaSchedules)
      .withMessage('Area schedules must have unique area names and complete collection details.')
  ]),
  protect,
  adminOnly,
  async (req, res) => {
  try {
    const { biodegradableDays, nonBiodegradableDays, timeSlot, assignedTruck, areaSchedules } = req.body;
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    if (biodegradableDays !== undefined) schedule.biodegradableDays = biodegradableDays;
    if (nonBiodegradableDays !== undefined) schedule.nonBiodegradableDays = nonBiodegradableDays;
    if (timeSlot !== undefined) schedule.timeSlot = timeSlot;
    if (assignedTruck !== undefined) schedule.assignedTruck = assignedTruck;
    if (areaSchedules !== undefined) {
      schedule.areaSchedules = areaSchedules.map(areaSchedule => ({
        ...areaSchedule,
        isSample: areaSchedule.isSample !== false
      }));
    }

    await schedule.save();

    res.json({
      success: true,
      message: 'Schedule updated successfully',
      data: schedule
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/schedules/:id
// @desc    Delete a schedule
// @access  Public
router.delete('/:id', 
  apiLimiter,
  sanitizeMongoDB,
  protect,
  adminOnly,
  async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }
    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
