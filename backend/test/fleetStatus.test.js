const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const Fleet = require('../models/Fleet');
const fleetRoutes = require('../routes/fleetRoutes');

const statuses = Fleet.schema.path('status').enumValues;
let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/fleet', fleetRoutes);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/fleet`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test('allows operational and dispatch lifecycle statuses in the fleet model', async () => {
  assert.deepEqual(statuses, ['Idle', 'Dispatching', 'In Transit', 'Maintenance', 'Out of Service']);

  for (const status of statuses) {
    const truck = new Fleet({
      truckId: `TRK-${status.replace(/\W/g, '').toUpperCase()}`,
      plate: 'KGA-0000',
      driver: 'Test Driver',
      status,
      location: { type: 'Point', coordinates: [124.6, 8.48] }
    });
    await assert.doesNotReject(() => truck.validate(), status);
  }

  const invalidTruck = new Fleet({
    truckId: 'TRK-INVALID',
    plate: 'KGA-0000',
    driver: 'Test Driver',
    status: 'Unknown',
    location: { type: 'Point', coordinates: [124.6, 8.48] }
  });
  await assert.rejects(invalidTruck.validate(), /is not a valid enum value/);
});

test('uses the barangay estimate when validating a status update for a truck without saved coordinates', async () => {
  const truck = new Fleet({
    truckId: 'TRK-NO-GPS',
    plate: 'KGA-0000',
    barangay: 'Balulang',
    driver: 'Test Driver',
    status: 'In Transit'
  });

  truck.status = 'Maintenance';
  await truck.validate();

  assert.equal(truck.status, 'Maintenance');
  assert.deepEqual(truck.location.toObject(), {
    type: 'Point',
    coordinates: [124.6178, 8.4491]
  });
  assert.equal(truck.locationSource, 'barangay-estimate');
});

test('places idle vehicles at the estimated Central Depot location', async () => {
  const truck = new Fleet({
    truckId: 'TRK-IDLE-DEPOT',
    plate: 'KGA-0000',
    barangay: 'Balulang',
    driver: 'Test Driver',
    status: 'Idle',
    location: { type: 'Point', coordinates: [124.6178, 8.4491] },
    locationSource: 'gps',
    locationUpdatedAt: new Date()
  });

  await truck.validate();

  assert.deepEqual(truck.location.toObject(), {
    type: 'Point',
    coordinates: [124.6427, 8.4828]
  });
  assert.equal(truck.locationSource, 'barangay-estimate');
  assert.equal(truck.locationUpdatedAt, null);
});

test('preserves a manually selected map location for an active vehicle', async () => {
  const truck = new Fleet({
    truckId: 'TRK-MANUAL-LOCATION',
    plate: 'KGA-0000',
    barangay: 'Balulang',
    driver: 'Test Driver',
    status: 'In Transit',
    location: { type: 'Point', coordinates: [124.63, 8.46] },
    locationSource: 'manual'
  });

  await truck.validate();

  assert.deepEqual(truck.location.toObject(), {
    type: 'Point',
    coordinates: [124.63, 8.46]
  });
  assert.equal(truck.locationSource, 'manual');
  assert.equal(truck.locationUpdatedAt, null);
});

test('continues to reject malformed saved vehicle coordinates', async () => {
  const truck = new Fleet({
    truckId: 'TRK-BAD-GPS',
    plate: 'KGA-0000',
    barangay: 'Balulang',
    driver: 'Test Driver',
    status: 'In Transit',
    location: { type: 'Point', coordinates: [124.6, 91] }
  });

  truck.status = 'Maintenance';
  await assert.rejects(truck.validate(), /Location coordinates must be \[longitude, latitude\] within valid ranges/);
});

test('rejects unsupported statuses at the fleet API instead of returning a database error', async () => {
  const update = await fetch(`${baseUrl}/TRK-042`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Broken' })
  });
  assert.equal(update.status, 400);

  const create = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      truckId: 'TRK-TEST',
      plate: 'KGA-0000',
      driver: 'Test Driver',
      status: 'Broken'
    })
  });
  assert.equal(create.status, 400);
});
