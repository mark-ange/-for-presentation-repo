const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Report = require('../models/Report');
const Barangay = require('../models/Barangay');
const User = require('../models/User');
const Notification = require('../models/Notification');
const memoryStore = require('../config/memoryStore');
const {
  apiLimiter,
  reportSubmissionLimiter,
  sanitizeMongoDB,
  validateInput
} = require('../middleware/securityMiddleware');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { parseCoordinates } = require('../utils/coordinates');
const { ensureBarangayForReport, normalizeBarangayName } = require('../utils/barangaySync');

const REPORT_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
const DEFAULT_REPORT_PAGE_SIZE = 1000;
const MAX_REPORT_PAGE_SIZE = 1000;
const MAX_REPORT_PHOTO_BASE64_LENGTH = 5600000;

async function notifyResidentReportUpdate(report, previous) {
  const statusChanged = report.status !== previous.status;
  const assignmentChanged = (report.unitAssigned || report.team || '') !== previous.assignment;
  const notesChanged = report.notes !== previous.notes;
  if (!statusChanged && !assignmentChanged && !notesChanged) return;

  try {
    const recipient = report.user
      ? await User.findById(report.user).select('_id')
      : report.userEmail
        ? await User.findOne({ email: report.userEmail.trim().toLowerCase() }).select('_id')
        : null;
    if (!recipient) return;

    const status = String(report.status || 'PENDING').toUpperCase().replace(/[\s-]+/g, '_');
    const statusLabels = {
      PENDING: 'pending review',
      ASSIGNED: 'assigned',
      IN_PROGRESS: 'in progress',
      RESOLVED: 'resolved',
      REJECTED: 'rejected'
    };
    const title = statusChanged
      ? `Your report was ${statusLabels[status] || status.toLowerCase().replace(/_/g, ' ')}`
      : assignmentChanged
        ? 'Your report was assigned'
        : 'CLENRO updated your report';
    const currentAssignment = report.unitAssigned || report.team || '';
    const body = report.notes?.trim() ||
      (assignmentChanged && currentAssignment
        ? `Assigned to ${currentAssignment}.`
        : `The status of "${report.title}" is now ${statusLabels[status] || status.toLowerCase().replace(/_/g, ' ')}.`);

    await Notification.create({
      user: recipient._id,
      title,
      body,
      type: 'REPORT_UPDATE'
    });
  } catch (error) {
    console.error('Report was updated, but its resident notification could not be created:', error.message);
  }
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toReportPhotoDataUrl = (photoBase64) => {
  if (!photoBase64) return '';
  if (photoBase64.length > MAX_REPORT_PHOTO_BASE64_LENGTH ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(photoBase64)) {
    return null;
  }

  const buffer = Buffer.from(photoBase64, 'base64');
  if (!buffer.length || buffer.length > 4 * 1024 * 1024 || buffer.toString('base64') !== photoBase64) {
    return null;
  }

  let contentType;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    contentType = 'image/jpeg';
  } else if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    contentType = 'image/png';
  } else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    contentType = 'image/webp';
  } else {
    return null;
  }

  return `data:${contentType};base64,${photoBase64}`;
};

const normalizeStatus = (status) => {
  const normalized = String(status || 'PENDING').toUpperCase().replace(/[\s-]+/g, '_');
  return REPORT_STATUSES.includes(normalized) ? normalized : 'PENDING';
};

const normalizeStatusCounts = (counts) => {
  const result = Object.fromEntries(REPORT_STATUSES.map(status => [status, 0]));
  counts.forEach(({ _id, count }) => {
    const status = normalizeStatus(_id);
    result[status] += count;
  });
  return result;
};

// Helper to format report object for Vue frontend and Android client
const formatReport = (report, includePhoto = true) => {
  const doc = report.toObject ? report.toObject() : report;
  const created = new Date(doc.createdAt || Date.now());

  const dateStr = created.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const timeStr = created.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return {
    _id: doc._id,
    id: doc.reportId || `#CDO-2026-${String(doc._id).slice(-4)}`,
    reportId: doc.reportId || `#CDO-2026-${String(doc._id).slice(-4)}`,
    title: doc.title,
    date: dateStr,
    time: timeStr,
    location: doc.title || `Brgy. ${doc.barangay}, ${doc.purokZone || 'Zone 1'}`,
    district: doc.district || 'Unassigned',
    barangay: normalizeBarangayName(doc.barangay),
    purok: doc.purokZone || '',
    purokZone: doc.purokZone || '',
    gps: doc.gpsCoordinates || '',
    gpsCoordinates: doc.gpsCoordinates || '',
    geoLocation: doc.location || parseCoordinates(doc.gpsCoordinates),
    landmark: doc.landmark || '',
    category: doc.category || 'Waste Collection',
    media: Boolean(doc.photoUrl || doc.media),
    photoUrl: includePhoto ? (doc.photoUrl || '') : '',
    imageUrl: includePhoto ? (doc.photoUrl || '') : '',
    hasPhoto: Boolean(doc.photoUrl),
    status: (doc.status || 'PENDING').toUpperCase(),
    reporter: doc.reporter || 'Civic Resident',
    userEmail: doc.userEmail || '',
    description: doc.description || '',
    team: doc.team || '',
    personnel: doc.personnel || '',
    unitAssigned: doc.unitAssigned || doc.team || 'Unassigned',
    notes: doc.notes || '',
    createdAt: doc.createdAt
  };
};


// @route   GET /api/reports
// @desc    Get all incident waste reports with filtering and search
// @access  Public
router.get('/', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const userEmail = typeof req.query.userEmail === 'string' ? req.query.userEmail.trim() : '';
    const district = typeof req.query.district === 'string' ? req.query.district.trim() : '';
    const barangay = typeof req.query.barangay === 'string' ? req.query.barangay.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      MAX_REPORT_PAGE_SIZE,
      Math.max(1, Number.parseInt(req.query.limit, 10) || DEFAULT_REPORT_PAGE_SIZE)
    );

    if (mongoose.connection.readyState === 1) {
      let query = {};
      if (userEmail) query.userEmail = new RegExp(`^${escapeRegex(userEmail)}$`, 'i');
      if (barangay) {
        const normalizedBarangay = normalizeBarangayName(barangay);
        query.barangay = new RegExp(`^(?:brgy\\.?\\s*)?${escapeRegex(normalizedBarangay)}$`, 'i');
      }
      if (district) query.district = new RegExp(`^${escapeRegex(district)}$`, 'i');
      if (category) query.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
      if (status) {
        const normalizedStatus = normalizeStatus(status);
        query.status = normalizedStatus === 'IN_PROGRESS'
          ? /^in[\s_-]?progress$/i
          : new RegExp(`^${escapeRegex(normalizedStatus)}$`, 'i');
      }

      if (search) {
        const term = new RegExp(escapeRegex(search), 'i');
        query.$or = [
          { reportId: term },
          { title: term },
          { description: term },
          { barangay: term },
          { landmark: term },
          { reporter: term },
          { userEmail: term },
          { category: term },
          { gpsCoordinates: term },
          { unitAssigned: term }
        ];
      }

      const [reports, total, statusGroups, filteredStatusGroups, categories] = await Promise.all([
        Report.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Report.countDocuments(query),
        Report.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Report.aggregate([{ $match: query }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Report.distinct('category')
      ]);
      const formatted = reports.map(report => formatReport(report, false));
      return res.json({
        success: true,
        count: formatted.length,
        total,
        filteredTotal: total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        statusCounts: normalizeStatusCounts(statusGroups),
        filteredStatusCounts: normalizeStatusCounts(filteredStatusGroups),
        categories: categories.filter(Boolean).sort(),
        data: formatted
      });
    }

    // Fallback if MongoDB is offline
    let list = memoryStore.reports;
    if (userEmail) {
      list = list.filter(r => (r.userEmail || '').toLowerCase() === userEmail.toLowerCase());
    }
    if (barangay) {
      const normalizedBarangay = normalizeBarangayName(barangay).toLowerCase();
      list = list.filter(r =>
        normalizeBarangayName(r.barangay).toLowerCase() === normalizedBarangay
      );
    }
    if (district) {
      list = list.filter(r => (r.district || '').toLowerCase() === district.toLowerCase());
    }
    if (category) {
      list = list.filter(r => (r.category || '').toLowerCase() === category.toLowerCase());
    }
    if (status) {
      list = list.filter(r => normalizeStatus(r.status) === normalizeStatus(status));
    }
    if (search) {
      const term = search.toLowerCase();
      list = list.filter(r =>
        (r.reportId || '').toLowerCase().includes(term) ||
        (r.title || '').toLowerCase().includes(term) ||
        (r.description || '').toLowerCase().includes(term) ||
        (r.barangay || '').toLowerCase().includes(term) ||
        (r.userEmail || '').toLowerCase().includes(term) ||
        (r.reporter || '').toLowerCase().includes(term)
      );
    }

    const start = (page - 1) * limit;
    const formatted = list
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(start, start + limit)
      .map(report => formatReport(report, false));
    const statusCounts = list.reduce((counts, report) => {
      const normalizedStatus = normalizeStatus(report.status);
      counts[normalizedStatus] += 1;
      return counts;
    }, Object.fromEntries(REPORT_STATUSES.map(value => [value, 0])));
    res.json({
      success: true,
      count: formatted.length,
      total: list.length,
      filteredTotal: list.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(list.length / limit)),
      statusCounts,
      filteredStatusCounts: statusCounts,
      categories: [...new Set(memoryStore.reports.map(report => report.category).filter(Boolean))].sort(),
      data: formatted
    });
  } catch (error) {
    console.error('Fetch Reports Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/reports/:id
// @desc    Get single report details
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;

    if (mongoose.connection.readyState === 1) {
      const reportQuery = mongoose.isValidObjectId(param)
        ? { $or: [{ _id: param }, { reportId: param }] }
        : { reportId: param };
      const report = await Report.findOne(reportQuery);
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
      return res.json({ success: true, data: formatReport(report) });
    }

    const report = memoryStore.reports.find(r => r.reportId === param || r._id === param);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: formatReport(report) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/reports
// @desc    Create a new incident report (Mobile App & Web Portal)
// @access  Public
router.post('/',
  reportSubmissionLimiter,
  sanitizeMongoDB,
  validateInput([
    body('reportId').optional().isString().trim().isLength({ min: 1, max: 64 }).matches(/^#?CDO-[A-Za-z0-9-]+$/),
    body('title').optional().isString().trim().escape(),
    body('category').optional().isString().trim().escape(),
    body('barangay').optional().isString().trim().escape(),
    body('district').optional().isString().trim().escape(),
    body('purokZone').optional().isString().trim().escape(),
    body('landmark').optional().isString().trim().escape(),
    body('description').optional().isString().trim().escape(),
    body('gpsCoordinates').optional().isString().trim(),
    body('location').optional().isObject(),
    body('coordinates').optional().isObject(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('photoUrl').optional().isString().trim().isLength({ max: 2048 }).matches(/^https?:\/\/\S+$/i),
    body('imageUrl').optional().isString().trim().isLength({ max: 2048 }).matches(/^https?:\/\/\S+$/i),
    body('photoEvidenceUrl').optional().isString().trim().isLength({ max: 2048 }).matches(/^https?:\/\/\S+$/i),
    body('photoBase64').optional().isString().isLength({ min: 1, max: MAX_REPORT_PHOTO_BASE64_LENGTH }),
    body('media').optional().isBoolean().toBoolean(),
    body('reporter').optional().isString().trim().escape(),
    body('userEmail').optional().isEmail().normalizeEmail(),
    body('email').optional().isEmail().normalizeEmail()
  ]),
  async (req, res) => {
    try {
      const {
        reportId, title, category, barangay, district, purokZone,
        landmark, description, gpsCoordinates, photoUrl, imageUrl,
        photoEvidenceUrl, photoBase64, media, reporter, userEmail, email,
        location, coordinates, latitude, longitude
      } = req.body;
      const normalizedBarangay = normalizeBarangayName(barangay);
      if (!normalizedBarangay) {
        return res.status(400).json({
          success: false,
          message: 'Barangay is required. Select the area where the incident was reported.'
        });
      }

      const hasCoordinateInput = location !== undefined ||
        coordinates !== undefined ||
        latitude !== undefined ||
        longitude !== undefined ||
        gpsCoordinates !== undefined;
      const coordinateInput = location || coordinates ||
        (latitude !== undefined || longitude !== undefined ? { latitude, longitude } : gpsCoordinates);
      const parsedLocation = coordinateInput === undefined ? null : parseCoordinates(coordinateInput);
      if (hasCoordinateInput && !parsedLocation) {
        return res.status(400).json({
          success: false,
          message: 'Location must contain valid latitude/longitude or GeoJSON Point coordinates.'
        });
      }

      const normalizedEmail = userEmail || email || '';
      const uploadedPhoto = toReportPhotoDataUrl(photoBase64);
      if (uploadedPhoto === null) {
        return res.status(400).json({
          success: false,
          message: 'Photo must be a valid JPEG, PNG, or WebP image no larger than 4 MB.'
        });
      }

      if (reportId && mongoose.connection.readyState === 1) {
        await ensureBarangayForReport(Barangay, normalizedBarangay, district);
        const existingReport = await Report.findOne({ reportId });
        if (existingReport) {
          if (existingReport.userEmail.toLowerCase() !== normalizedEmail.toLowerCase()) {
            return res.status(409).json({
              success: false,
              message: 'This report ID is already in use'
            });
          }
          if (uploadedPhoto && !existingReport.photoUrl) {
            existingReport.photoUrl = uploadedPhoto;
            existingReport.media = true;
            if (parsedLocation && !existingReport.location) {
              existingReport.location = parsedLocation;
              if (typeof gpsCoordinates === 'string') existingReport.gpsCoordinates = gpsCoordinates;
            }
            await existingReport.save();
          }
          return res.json({
            success: true,
            persisted: true,
            message: 'Report was already submitted',
            data: formatReport(existingReport, false)
          });
        }
      }

      const evidenceUrl = uploadedPhoto || photoUrl || imageUrl || photoEvidenceUrl || '';

      const reportData = {
        ...(reportId ? { reportId } : {}),
        title: title || `Brgy. ${normalizedBarangay}${purokZone ? `, ${purokZone}` : ''}`,
        category: category || 'Waste Collection',
        barangay: normalizedBarangay,
        district: district || 'Unassigned',
        purokZone: purokZone || '',
        landmark: landmark || '',
        status: 'Pending',
        description: description || 'Civic issue reported by resident.',
        gpsCoordinates: typeof gpsCoordinates === 'string'
          ? gpsCoordinates
          : parsedLocation
            ? `${parsedLocation.coordinates[1]}, ${parsedLocation.coordinates[0]}`
            : '',
        ...(parsedLocation ? { location: parsedLocation } : {}),
        unitAssigned: 'Unassigned',
        team: '',
        personnel: '',
        notes: '',
        photoUrl: evidenceUrl,
        media: Boolean(evidenceUrl || media),
        reporter: reporter || 'Resident Reporter',
        userEmail: normalizedEmail,
        createdAt: new Date()
      };

      if (mongoose.connection.readyState === 1) {
        await ensureBarangayForReport(Barangay, normalizedBarangay, district);
        const newReport = await Report.create({
          ...reportData,
          user: req.user ? req.user._id : null
        });
        return res.status(201).json({
          success: true,
          persisted: true,
          message: 'Report submitted successfully to CLENRO',
          data: formatReport(newReport, false)
        });
      }

      const memDoc = { _id: `rep_${Date.now()}`, ...reportData };
      memoryStore.reports.unshift(memDoc);
      res.status(201).json({
        success: true,
        persisted: false,
        message: 'Report submitted successfully to CLENRO',
        data: formatReport(memDoc, false)
      });
    } catch (error) {
      console.error('Create Report Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

// @route   PUT /api/reports/:id/dispatch
// @desc    Dispatch team and personnel to an incident report
// @access  Public
router.put('/:id/dispatch',
  apiLimiter,
  sanitizeMongoDB,
  validateInput([
    body('team').optional().isString().trim().escape(),
    body('personnel').optional().isString().trim().escape(),
    body('notes').optional().isString().trim().escape(),
    body('status').optional().isIn(['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'])
  ]),
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const param = req.params.id;
      const { team, personnel, notes, status } = req.body;

      if (mongoose.connection.readyState === 1) {
        const report = await Report.findOne({
          $or: [{ _id: param }, { reportId: param }]
        });

        if (!report) {
          return res.status(404).json({ success: false, message: 'Report not found' });
        }

        const previous = {
          status: report.status,
          assignment: report.unitAssigned || report.team || '',
          notes: report.notes
        };
        if (team !== undefined) report.team = team;
        if (personnel !== undefined) report.personnel = personnel;
        if (notes !== undefined) report.notes = notes;
        if (team) report.unitAssigned = team;
        report.status = status || 'Assigned';
        if (!report.assignedAt && ['assigned', 'in progress'].includes(report.status.toLowerCase().replace(/_/g, ' '))) {
          report.assignedAt = new Date();
        }

        await report.save();
        await notifyResidentReportUpdate(report, previous);

        return res.json({
          success: true,
          message: 'Dispatch assignment saved successfully',
          data: formatReport(report)
        });
      }

      const report = memoryStore.reports.find(r => r.reportId === param || r._id === param);
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

      if (team !== undefined) report.team = team;
      if (personnel !== undefined) report.personnel = personnel;
      if (notes !== undefined) report.notes = notes;
      if (team) report.unitAssigned = team;
      report.status = status || 'Assigned';
      if (!report.assignedAt && ['assigned', 'in progress'].includes(report.status.toLowerCase().replace(/_/g, ' '))) {
        report.assignedAt = new Date();
      }

      res.json({
        success: true,
        message: 'Dispatch assignment saved successfully',
        data: formatReport(report)
      });
    } catch (error) {
      console.error('Dispatch Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

// @route   PUT /api/reports/:id/status
// @desc    Update report status and assignment
// @access  Public
router.put('/:id/status',
  apiLimiter,
  sanitizeMongoDB,
  validateInput([
    body('status').optional().isIn(['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']),
    body('unitAssigned').optional().isString().trim().escape(),
    body('team').optional().isString().trim().escape(),
    body('personnel').optional().isString().trim().escape(),
    body('notes').optional().isString().trim().escape()
  ]),
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const rawParam = req.params.id;
      const decodedParam = decodeURIComponent(rawParam);
      const queryIds = Array.from(new Set([
        rawParam,
        decodedParam,
        `#${rawParam.replace(/^#/, '')}`,
        `#${decodedParam.replace(/^#/, '')}`,
        rawParam.replace(/^#/, ''),
        decodedParam.replace(/^#/, '')
      ]));

      const { status, unitAssigned, team, personnel, notes } = req.body;

      if (mongoose.connection.readyState === 1) {
        const orClauses = queryIds.map(qid => ({ reportId: qid }));
        if (mongoose.isValidObjectId(rawParam)) orClauses.push({ _id: rawParam });

        const report = await Report.findOne({ $or: orClauses });

        if (!report) {
          return res.status(404).json({ success: false, message: `Report "${rawParam}" not found` });
        }

        const previous = {
          status: report.status,
          assignment: report.unitAssigned || report.team || '',
          notes: report.notes
        };
        if (status) report.status = status;
        if (!report.assignedAt && status && ['assigned', 'in progress'].includes(status.toLowerCase().replace(/_/g, ' '))) {
          report.assignedAt = new Date();
        }
        if (unitAssigned !== undefined) {
          report.unitAssigned = unitAssigned;
          report.team = unitAssigned;
        }
        if (team !== undefined) {
          report.team = team;
          if (unitAssigned === undefined) report.unitAssigned = team;
        }
        if (personnel !== undefined) report.personnel = personnel;
        if (notes !== undefined) report.notes = notes;

        await report.save();
        await notifyResidentReportUpdate(report, previous);

        return res.json({
          success: true,
          message: 'Report status updated',
          data: formatReport(report)
        });
      }

      const report = memoryStore.reports.find(r =>
        queryIds.includes(r.reportId) || queryIds.includes(r._id)
      );
      if (!report) return res.status(404).json({ success: false, message: `Report "${rawParam}" not found` });

      if (status) report.status = status;
      if (!report.assignedAt && status && ['assigned', 'in progress'].includes(status.toLowerCase().replace(/_/g, ' '))) {
        report.assignedAt = new Date();
      }
      if (unitAssigned !== undefined) {
        report.unitAssigned = unitAssigned;
        report.team = unitAssigned;
      }
      if (team !== undefined) {
        report.team = team;
        if (unitAssigned === undefined) report.unitAssigned = team;
      }
      if (personnel !== undefined) report.personnel = personnel;
      if (notes !== undefined) report.notes = notes;


      res.json({
        success: true,
        message: 'Report status updated',
        data: formatReport(report)
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

// @route   DELETE /api/reports/:id
// @desc    Delete or reject a report
// @access  Public
router.delete('/:id',
  apiLimiter,
  sanitizeMongoDB,
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const param = req.params.id;

      if (mongoose.connection.readyState === 1) {
        const report = await Report.findOneAndDelete({
          $or: [{ _id: param }, { reportId: param }]
        });

        if (!report) {
          return res.status(404).json({ success: false, message: 'Report not found' });
        }

        return res.json({ success: true, message: 'Report deleted successfully' });
      }

      const idx = memoryStore.reports.findIndex(r => r.reportId === param || r._id === param);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Report not found' });
      memoryStore.reports.splice(idx, 1);
      res.json({ success: true, message: 'Report deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

module.exports = router;
