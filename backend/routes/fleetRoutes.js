const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body } = require('express-validator');
const Fleet = require('../models/Fleet');
const FLEET_STATUSES = Fleet.schema.path('status').enumValues;
const memoryStore = require('../config/memoryStore');
const { apiLimiter, sanitizeMongoDB, validateInput } = require('../middleware/securityMiddleware');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  formatDistance,
  getBarangayLocation,
  haversineDistanceMeters,
  parseCoordinates
} = require('../utils/coordinates');
const Report = require('../models/Report');

const truckLocation = (truck) => {
  if (truck.status === 'Idle') {
    return {
      location: getBarangayLocation('Central Depot'),
      locationSource: 'barangay-estimate'
    };
  }

  const storedLocation = parseCoordinates(truck.location);
  return {
    location: storedLocation || getBarangayLocation(truck.barangay),
    locationSource: storedLocation ? (truck.locationSource || 'barangay-estimate') : 'barangay-estimate'
  };
};

const formatTruck = (truck) => {
  const { location, locationSource } = truckLocation(truck);
  return {
    _id: truck._id,
    id: truck.truckId,
    truckId: truck.truckId,
    plate: truck.plate,
    barangay: truck.barangay,
    driver: truck.driver,
    status: truck.status,
    position: truck.position,
    location,
    locationSource,
    locationUpdatedAt: truck.locationUpdatedAt || null
  };
};

const findReport = async (reportId) => {
  if (mongoose.connection.readyState !== 1) {
    return memoryStore.reports.find(report =>
      report.reportId === reportId || report._id === reportId
    );
  }
  const filters = [{ reportId }];
  if (mongoose.isValidObjectId(reportId)) filters.push({ _id: reportId });
  return Report.findOne({ $or: filters });
};

// @route   GET /api/fleet
// @desc    Get all vehicles and drivers with status summary
// @access  Public
router.get('/', async (req, res) => {
  try {
    let trucks = [];

    if (mongoose.connection.readyState === 1) {
      trucks = await Fleet.find().sort({ truckId: 1 });
    } else {
      trucks = memoryStore.fleet;
    }

    const inTransit = trucks.filter(t => ['Dispatching', 'In Transit'].includes(t.status)).length;
    const idle = trucks.filter(t => t.status === 'Idle').length;
    const maintenance = trucks.filter(t => t.status === 'Maintenance').length;
    const outOfService = trucks.filter(t => t.status === 'Out of Service').length;

    const formattedTrucks = trucks.map(formatTruck);

    res.json({
      success: true,
      stats: {
        inTransit,
        idle,
        maintenance,
        outOfService,
        total: trucks.length
      },
      data: formattedTrucks
    });
  } catch (error) {
    console.error('Fetch Fleet Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/fleet/closest?reportId=... or ?latitude=...&longitude=...
// @desc    Find available trucks by spherical distance from a report/location
router.get('/closest', async (req, res) => {
  try {
    let target;
    if (typeof req.query.reportId === 'string') {
      const report = await findReport(req.query.reportId);
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
      target = parseCoordinates(report.location) || parseCoordinates(report.gpsCoordinates);
    } else {
      target = parseCoordinates(req.query) ||
        parseCoordinates(req.query.gpsCoordinates);
    }

    if (!target) {
      return res.status(400).json({
        success: false,
        message: 'Provide a reportId or valid GPS coordinates to find the closest truck.'
      });
    }

    let trucks;
    if (mongoose.connection.readyState === 1) {
      await Fleet.init();
      const located = await Fleet.aggregate([
        {
          $geoNear: {
            near: target,
            key: 'location',
            distanceField: 'distanceMeters',
            spherical: true,
            query: { status: { $nin: ['Maintenance', 'Out of Service'] } }
          }
        },
        { $limit: 100 }
      ]);
      const locatedWithIdleDepotLocations = located.map(truck => {
        if (truck.status !== 'Idle') return truck;
        const { location } = truckLocation(truck);
        return location
          ? { ...truck, location, distanceMeters: haversineDistanceMeters(target, location) }
          : null;
      }).filter(Boolean);
      const unlocated = await Fleet.find({
        status: { $nin: ['Maintenance', 'Out of Service'] },
        $or: [{ location: { $exists: false } }, { location: null }]
      }).lean();

      trucks = [
        ...locatedWithIdleDepotLocations,
        ...unlocated.map(truck => {
          const { location } = truckLocation(truck);
          return location
            ? { ...truck, location, distanceMeters: haversineDistanceMeters(target, location) }
            : null;
        }).filter(Boolean)
      ];
    } else {
      trucks = memoryStore.fleet
        .filter(truck => !['Maintenance', 'Out of Service'].includes(truck.status))
        .map(truck => {
          const { location } = truckLocation(truck);
          return location
            ? { ...truck, location, distanceMeters: haversineDistanceMeters(target, location) }
            : null;
        }).filter(Boolean);
    }

    const nearest = trucks
      .sort((first, second) => first.distanceMeters - second.distanceMeters)
      .map(truck => ({
        ...formatTruck(truck),
        distanceMeters: Math.round(truck.distanceMeters),
        distanceKm: Number((truck.distanceMeters / 1000).toFixed(2)),
        distanceLabel: formatDistance(truck.distanceMeters)
      }));

    res.json({ success: true, data: nearest });
  } catch (error) {
    console.error('Find Closest Truck Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/fleet/:id/location
// @desc    Update a truck's live GPS location (administrator authenticated)
router.put('/:id/location',
  apiLimiter,
  sanitizeMongoDB,
  validateInput([
    body('location').optional().isObject(),
    body('coordinates').optional().isObject(),
    body('gpsCoordinates').optional().isString().trim(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 })
  ]),
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const { location, coordinates, gpsCoordinates, latitude, longitude } = req.body;
      const coordinateInput = location || coordinates ||
        (latitude !== undefined || longitude !== undefined ? { latitude, longitude } : gpsCoordinates);
      const point = parseCoordinates(coordinateInput);
      if (!point) {
        return res.status(400).json({
          success: false,
          message: 'Provide valid latitude/longitude or GeoJSON Point coordinates.'
        });
      }

      const identifier = req.params.id;
      const truckQuery = mongoose.isValidObjectId(identifier)
        ? { $or: [{ _id: identifier }, { truckId: identifier }] }
        : { truckId: identifier };
      const truck = mongoose.connection.readyState === 1
        ? await Fleet.findOne(truckQuery)
        : memoryStore.fleet.find(item => item.truckId === identifier || item._id === identifier);

      if (!truck) return res.status(404).json({ success: false, message: 'Vehicle not found' });

      truck.location = point;
      truck.locationSource = 'gps';
      truck.locationUpdatedAt = new Date();
      if (mongoose.connection.readyState === 1) await truck.save();

      res.json({
        success: true,
        message: 'Vehicle location updated successfully',
        data: formatTruck(truck)
      });
    } catch (error) {
      console.error('Update Fleet Location Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

// @route   POST /api/fleet
// @desc    Add a new vehicle and driver
// @access  Public
router.post('/',
  apiLimiter,
  sanitizeMongoDB,
  validateInput([
    body('plate').notEmpty().isString().trim().escape().withMessage('License plate is required'),
    body('driver').notEmpty().isString().trim().escape().withMessage('Driver name is required'),
    body('barangay').optional().isString().trim().escape(),
    body('status').optional().isString().trim().isIn(FLEET_STATUSES)
      .withMessage(`Status must be one of: ${FLEET_STATUSES.join(', ')}`),
    body('truckId').optional().isString().trim().escape(),
    body('position').optional().isObject()
  ]),
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const { id, truckId, plate, barangay, driver, status, position } = req.body;
      const resolvedId = (id || truckId || `TRK-${Math.floor(100 + Math.random() * 900)}`).trim();

      if (!plate || !driver) {
        return res.status(400).json({ success: false, message: 'License plate and driver name are required' });
      }

      const existing = await Fleet.findOne({ truckId: resolvedId });
      if (existing) {
        return res.status(409).json({ success: false, message: `Truck ID "${resolvedId}" already exists.` });
      }

      const created = await Fleet.create({
        truckId: resolvedId,
        plate: plate.trim(),
        barangay: (barangay || 'Carmen').trim(),
        driver: driver.trim(),
        status: status || 'Idle',
        position: position || {
          top: `${Math.floor(25 + Math.random() * 45)}%`,
          left: `${Math.floor(30 + Math.random() * 40)}%`
        }
      });

      res.status(201).json({
        success: true,
        message: 'Vehicle added successfully',
        data: {
          _id: created._id,
          id: created.truckId,
          truckId: created.truckId,
          plate: created.plate,
          barangay: created.barangay,
          driver: created.driver,
          status: created.status,
          position: created.position,
          location: created.location,
          locationSource: created.locationSource,
          locationUpdatedAt: created.locationUpdatedAt
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

// @route   PUT /api/fleet/:id
// @desc    Update vehicle status or assignment
// @access  Public
router.put('/:id',
  apiLimiter,
  sanitizeMongoDB,
  validateInput([
    body('status').optional().isString().trim().isIn(FLEET_STATUSES)
      .withMessage(`Status must be one of: ${FLEET_STATUSES.join(', ')}`),
    body('driver').optional().isString().trim().escape(),
    body('barangay').optional().isString().trim().escape(),
    body('plate').optional().isString().trim().escape(),
    body('position').optional().isObject(),
    body('location').optional().isObject()
  ]),
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const param = req.params.id;
      const { status, driver, barangay, plate, position, location } = req.body;

      const truckQuery = mongoose.isValidObjectId(param)
        ? { $or: [{ _id: param }, { truckId: param }] }
        : { truckId: param };
      const truck = await Fleet.findOne(truckQuery);

      if (!truck) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }

      const selectedLocation = location === undefined ? null : parseCoordinates(location);
      if (location !== undefined && !selectedLocation) {
        return res.status(400).json({
          success: false,
          message: 'Provide a valid map location using latitude and longitude.'
        });
      }

      if (status) {
        if (!selectedLocation && truck.status === 'Idle' && status !== 'Idle' && truck.locationSource !== 'gps') {
          truck.location = getBarangayLocation(truck.barangay) || undefined;
          truck.locationSource = 'barangay-estimate';
          truck.locationUpdatedAt = null;
        }
        truck.status = status;
      }
      if (selectedLocation) {
        truck.location = selectedLocation;
        truck.locationSource = 'manual';
        truck.locationUpdatedAt = null;
      }
      if (driver) truck.driver = driver.trim();
      if (barangay) truck.barangay = barangay.trim();
      if (plate) truck.plate = plate.trim();
      if (position) truck.position = position;

      await truck.save();

      res.json({
        success: true,
        message: 'Vehicle updated successfully',
        data: {
          _id: truck._id,
          id: truck.truckId,
          truckId: truck.truckId,
          plate: truck.plate,
          barangay: truck.barangay,
          driver: truck.driver,
          status: truck.status,
          position: truck.position,
          location: truck.location,
          locationSource: truck.locationSource,
          locationUpdatedAt: truck.locationUpdatedAt
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

// @route   DELETE /api/fleet/:id
// @desc    Delete vehicle
// @access  Public
router.delete('/:id',
  apiLimiter,
  sanitizeMongoDB,
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const param = req.params.id;
      const truckQuery = mongoose.isValidObjectId(param)
        ? { $or: [{ _id: param }, { truckId: param }] }
        : { truckId: param };
      const truck = await Fleet.findOneAndDelete(truckQuery);

      if (!truck) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }

      res.json({ success: true, message: 'Vehicle deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

module.exports = router;
