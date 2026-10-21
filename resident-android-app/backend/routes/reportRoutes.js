const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Report = require('../models/Report');
const User = require('../models/User');
const Notification = require('../models/Notification');

function requireDatabase(res) {
  if (Report.db.readyState === 1) return true;

  res.status(503).json({
    success: false,
    persisted: false,
    message: 'Report storage is unavailable. The report was not saved; retry when the database is online.'
  });
  return false;
}

// @route   GET /api/reports
// @desc    Get all incident waste reports
// @access  Public or Protected
router.get('/', async (req, res) => {
  if (!requireDatabase(res)) return;

  try {
    const { barangay, status, userEmail } = req.query;
    const filter = {};
    if (barangay) filter.barangay = barangay;
    if (status) filter.status = status;
    if (userEmail) filter.userEmail = userEmail.toLowerCase().trim();

    const reports = await Report.find(filter).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error('Failed to load reports from MongoDB:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load reports from the database.' });
  }
});

// @route   POST /api/reports
// @desc    Create a new incident report
// @access  Public or Protected
router.post('/', async (req, res) => {
  if (!requireDatabase(res)) return;

  try {
    const {
      title,
      category,
      barangay,
      purokZone,
      landmark,
      description,
      gpsCoordinates,
      photoUrl,
      userEmail,
      reportId
    } = req.body;
    const generatedId = reportId || `#CDO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const existingReport = await Report.findOne({ reportId: generatedId });
    if (existingReport) {
      return res.status(200).json({
        success: true,
        persisted: true,
        message: 'Report has already been saved',
        data: existingReport
      });
    }

    const report = await Report.create({
      reportId: generatedId,
      title: title || `Brgy. ${barangay || 'Carmen'}, ${purokZone || 'Zone 1'}`,
      category: category || 'Illegal Dump Site',
      barangay: barangay || 'Carmen',
      purokZone: purokZone || '',
      landmark: landmark || '',
      status: 'PENDING',
      description: description || 'Uncollected waste report from resident.',
      gpsCoordinates: gpsCoordinates || '8.4822° N, 124.6175° E',
      unitAssigned: 'Unassigned',
      photoUrl: photoUrl || '',
      userEmail: userEmail ? userEmail.toLowerCase().trim() : '',
      user: req.user ? req.user._id : null
    });

    return res.status(201).json({
      success: true,
      persisted: true,
      message: 'Report submitted successfully to CLENRO',
      data: report
    });
  } catch (error) {
    if (error.code === 11000 && req.body.reportId) {
      try {
        const existingReport = await Report.findOne({ reportId: req.body.reportId });
        if (existingReport) {
          return res.status(200).json({
            success: true,
            persisted: true,
            message: 'Report has already been saved',
            data: existingReport
          });
        }
      } catch (lookupError) {
        console.error('Failed to verify an existing report in MongoDB:', lookupError.message);
      }
    }

    console.error('Failed to save report to MongoDB:', error.message);
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      persisted: false,
      message: statusCode === 400 ? error.message : 'Failed to save report to the database.'
    });
  }
});

// @route   PUT /api/reports/:id/status
// @desc    Update report status and assigned unit
// @access  Public / Admin
router.put('/:id/status', async (req, res) => {
  if (!requireDatabase(res)) return;

  try {
    const { status, unitAssigned, notes } = req.body;
    const reportId = req.params.id;
    const filter = mongoose.isValidObjectId(reportId)
      ? { $or: [{ _id: reportId }, { reportId }] }
      : { reportId };
    const report = await Report.findOne(filter);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const previousStatus = report.status;
    const previousUnitAssigned = report.unitAssigned;
    if (status) report.status = status;
    if (unitAssigned) report.unitAssigned = unitAssigned;
    if (typeof notes === 'string') report.notes = notes;
    await report.save();

    const statusChanged = report.status !== previousStatus;
    const assignmentChanged = report.unitAssigned !== previousUnitAssigned;
    if (statusChanged || assignmentChanged) {
      const recipient = report.user
        ? await User.findById(report.user).select('_id')
        : report.userEmail
          ? await User.findOne({ email: report.userEmail.trim().toLowerCase() }).select('_id')
          : null;

      if (recipient) {
        const statusLabels = {
          REJECTED: 'rejected',
          ASSIGNED: 'assigned',
          IN_PROGRESS: 'in progress',
          RESOLVED: 'resolved',
          PENDING: 'updated'
        };
        const statusLabel = statusLabels[report.status] || report.status.toLowerCase().replace(/_/g, ' ');
        const title = statusChanged
          ? `Your report was ${statusLabel}`
          : 'Your report was assigned';
        const detail = report.notes?.trim() ||
          (report.unitAssigned && report.unitAssigned !== 'Unassigned'
            ? `Assigned to ${report.unitAssigned}.`
            : `The status of "${report.title}" is now ${statusLabel}.`);

        await Notification.create({
          user: recipient._id,
          title,
          body: detail,
          type: 'REPORT_UPDATE'
        });
      }
    }

    return res.json({ success: true, persisted: true, message: 'Report status updated', data: report });
  } catch (error) {
    console.error('Failed to update report in MongoDB:', error.message);
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? error.message : 'Failed to update report in the database.'
    });
  }
});

module.exports = router;
