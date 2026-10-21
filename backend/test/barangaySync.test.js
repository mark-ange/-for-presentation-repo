const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ensureBarangayForReport,
  normalizeBarangayName
} = require('../utils/barangaySync');

test('normalizes barangay labels from resident reports', () => {
  assert.equal(normalizeBarangayName('  Brgy.   Opol  '), 'Opol');
  assert.equal(normalizeBarangayName('Barangay Carmen'), 'Carmen');
  assert.equal(normalizeBarangayName('Lapasan'), 'Lapasan');
  assert.equal(normalizeBarangayName('  '), '');
});

test('reuses an existing barangay without changing its admin settings', async () => {
  const existing = { name: 'Opol', district: 'District 2', teams: 4 };
  let createCalled = false;
  const Barangay = {
    findOne: async query => {
      assert.ok(query.name.test('opol'));
      return existing;
    },
    create: async () => {
      createCalled = true;
    }
  };

  assert.equal(await ensureBarangayForReport(Barangay, 'Brgy. Opol'), existing);
  assert.equal(createCalled, false);
});

test('creates a missing barangay from a resident report without inventing a district', async () => {
  let createdRecord;
  const Barangay = {
    findOne: async () => null,
    create: async record => {
      createdRecord = record;
      return record;
    }
  };

  const created = await ensureBarangayForReport(Barangay, 'Brgy. Opol');
  assert.equal(created.name, 'Opol');
  assert.equal(createdRecord.district, 'Unassigned');
  assert.equal(createdRecord.teams, 0);
  assert.equal(createdRecord.status, 'Active');
});

test('rejects a missing barangay name instead of assigning a fake default', async () => {
  await assert.rejects(
    ensureBarangayForReport({ findOne: async () => null }, ''),
    /Barangay name is required/
  );
});
