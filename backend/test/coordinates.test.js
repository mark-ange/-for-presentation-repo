const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const mongoose = require('mongoose');
const memoryStore = require('../config/memoryStore');
const fleetRoutes = require('../routes/fleetRoutes');
const reportRoutes = require('../routes/reportRoutes');
const {
  formatDistance,
  haversineDistanceMeters,
  parseCoordinates
} = require('../utils/coordinates');

test('parses decimal GPS strings, including compass directions', () => {
  assert.deepEqual(parseCoordinates('8.4822, 124.6175'), {
    type: 'Point',
    coordinates: [124.6175, 8.4822]
  });
  assert.deepEqual(parseCoordinates('8.4822° N, 124.6175° E'), {
    type: 'Point',
    coordinates: [124.6175, 8.4822]
  });
  assert.deepEqual(parseCoordinates('8.4822° S, 124.6175° W'), {
    type: 'Point',
    coordinates: [-124.6175, -8.4822]
  });
});

test('parses numeric and GeoJSON coordinate formats and rejects invalid values', () => {
  assert.deepEqual(parseCoordinates({ latitude: 8.5, longitude: 124.6 }), {
    type: 'Point',
    coordinates: [124.6, 8.5]
  });
  assert.deepEqual(parseCoordinates({ type: 'Point', coordinates: [124.6, 8.5] }), {
    type: 'Point',
    coordinates: [124.6, 8.5]
  });
  assert.deepEqual(parseCoordinates(8.5, 124.6), {
    type: 'Point',
    coordinates: [124.6, 8.5]
  });
  assert.equal(parseCoordinates('8.5 north, 124.6 east'), null);
  assert.equal(parseCoordinates('', 124.6), null);
  assert.equal(parseCoordinates([124.6, null]), null);
  assert.equal(parseCoordinates({ latitude: 91, longitude: 124.6 }), null);
  assert.equal(parseCoordinates({ latitude: 8.5 }), null);
});

test('calculates spherical distance and formats meter/kilometer labels', () => {
  const origin = parseCoordinates({ latitude: 8.48, longitude: 124.64 });
  const nearby = parseCoordinates({ latitude: 8.49, longitude: 124.64 });
  const distance = haversineDistanceMeters(origin, nearby);
  assert.ok(distance > 1100 && distance < 1120);
  assert.equal(formatDistance(850), '850 m away');
  assert.equal(formatDistance(1400), '1.4 km away');
});

let baseUrl;
let server;
let originalConnectionState;

before(async () => {
  originalConnectionState = mongoose.connection.readyState;
  if (originalConnectionState !== 0) {
    throw new Error('Memory-store API test requires MongoDB to be disconnected.');
  }

  const app = express();
  app.use(express.json());
  app.use('/api/fleet', fleetRoutes);
  app.use('/api/reports', reportRoutes);
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

test('serves fleet coordinates and nearest active trucks from memory data', async () => {
  const fleetResponse = await fetch(baseUrl);
  const fleet = await fleetResponse.json();
  assert.equal(fleetResponse.status, 200);
  assert.ok(fleet.data.every(truck => truck.location?.type === 'Point'));
  assert.equal(fleet.data.find(truck => truck.truckId === 'TRK-042').locationSource, 'barangay-estimate');

  const report = memoryStore.reports[0];
  const response = await fetch(`${baseUrl}/closest?reportId=${encodeURIComponent(report.reportId)}`);
  const nearest = await response.json();
  assert.equal(response.status, 200);
  assert.ok(nearest.data.length > 0);
  assert.equal(nearest.data[0].truckId, 'TRK-042');
  assert.equal(nearest.data[0].distanceMeters, 0);
  assert.ok(nearest.data.every(truck => truck.status !== 'Maintenance'));
  assert.ok(nearest.data[0].distanceMeters <= nearest.data[1].distanceMeters);
  assert.match(nearest.data[0].distanceLabel, /(?:m|km) away/);
});

test('rejects invalid closest coordinates and unauthenticated GPS updates', async () => {
  const invalid = await fetch(`${baseUrl}/closest?latitude=99&longitude=124.6`);
  assert.equal(invalid.status, 400);

  const update = await fetch(`${baseUrl}/TRK-042/location`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: 8.5, longitude: 124.6 })
  });
  assert.equal(update.status, 401);
});

test('accepts legacy GPS strings, numeric coordinates, and GeoJSON report locations', async () => {
  const reportIds = ['#CDO-GIS-STRING', '#CDO-GIS-NUMERIC', '#CDO-GIS-GEOJSON'];
  const submissions = [
    {
      reportId: reportIds[0],
      gpsCoordinates: '8.4822° N, 124.6175° E'
    },
    {
      reportId: reportIds[1],
      latitude: 8.4822,
      longitude: 124.6175
    },
    {
      reportId: reportIds[2],
      location: { type: 'Point', coordinates: [124.6175, 8.4822] }
    }
  ];

  try {
    for (const submission of submissions) {
      const response = await fetch(`${baseUrl.replace('/fleet', '/reports')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission)
      });
      const result = await response.json();
      assert.equal(response.status, 201, result.message);
      assert.deepEqual(result.data.geoLocation, {
        type: 'Point',
        coordinates: [124.6175, 8.4822]
      });
    }
  } finally {
    memoryStore.reports = memoryStore.reports.filter(report => !reportIds.includes(report.reportId));
  }
});

test('tracks cloud image availability separately from media flags and serves stored evidence', async () => {
  const missingPhotoId = '#CDO-GIS-NO-PHOTO';
  const storedPhotoId = '#CDO-GIS-WITH-PHOTO';
  const photoBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');

  try {
    const missingResponse = await fetch(`${baseUrl.replace('/fleet', '/reports')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: missingPhotoId, media: true })
    });
    const missing = await missingResponse.json();
    assert.equal(missing.data.media, true);
    assert.equal(missing.data.hasPhoto, false);

    const storedResponse = await fetch(`${baseUrl.replace('/fleet', '/reports')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportId: storedPhotoId,
        media: true,
        photoBase64,
        userEmail: 'evidence-test@example.com'
      })
    });
    const stored = await storedResponse.json();
    assert.equal(storedResponse.status, 201);
    assert.equal(stored.data.hasPhoto, true);
    assert.equal(stored.data.photoUrl, '');

    const listResponse = await fetch(`${baseUrl.replace('/fleet', '/reports')}?search=${encodeURIComponent(storedPhotoId)}`);
    const list = await listResponse.json();
    assert.equal(list.data[0].hasPhoto, true);
    assert.equal(list.data[0].photoUrl, '');

    const detailResponse = await fetch(`${baseUrl.replace('/fleet', '/reports')}/${encodeURIComponent(storedPhotoId)}`);
    const detail = await detailResponse.json();
    assert.equal(detail.data.hasPhoto, true);
    assert.ok(detail.data.photoUrl.startsWith('data:image/jpeg;base64,'));
  } finally {
    memoryStore.reports = memoryStore.reports.filter(report =>
      ![missingPhotoId, storedPhotoId].includes(report.reportId)
    );
  }
});
