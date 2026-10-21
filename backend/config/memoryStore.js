// In-memory runtime storage fallback used ONLY when MongoDB server is offline
const { getBarangayLocation } = require('../utils/coordinates');

const memoryStore = {
  users: [
    {
      _id: 'usr_admin_001',
      fullName: 'CLENRO Central Admin',
      email: 'admin@clenro-cdo.gov.ph',
      phoneNumber: '0917-123-4567',
      barangay: 'Central District',
      purokZone: 'City Hall Complex',
      password: 'admin123',
      securityPin: '1234',
      role: 'CLENRO Central Admin'
    },
    {
      _id: 'usr_staff_002',
      fullName: 'CLENRO Staff Officer',
      email: 'staff@clenro-cdo.gov.ph',
      phoneNumber: '0917-987-6543',
      barangay: 'Central District',
      purokZone: 'CLENRO Operations Desk',
      password: 'staff123',
      securityPin: '1234',
      role: 'CLENRO Staff'
    }
  ],

  barangays: [
    { _id: 'bg_1', name: 'Carmen', district: 'District 1', teams: 3, status: 'Active' },
    { _id: 'bg_2', name: 'Lapasan', district: 'District 1', teams: 2, status: 'Active' },
    { _id: 'bg_3', name: 'Macasandig', district: 'District 1', teams: 2, status: 'Active' },
    { _id: 'bg_4', name: 'Balulang', district: 'District 2', teams: 2, status: 'Active' },
    { _id: 'bg_5', name: 'Lumbia', district: 'District 3', teams: 1, status: 'Active' },
    { _id: 'bg_6', name: 'Bulua', district: 'District 1', teams: 2, status: 'Active' },
    { _id: 'bg_7', name: 'Nazareth', district: 'District 2', teams: 2, status: 'Active' },
    { _id: 'bg_8', name: 'Kauswagan', district: 'District 1', teams: 2, status: 'Active' }
  ],

  fleet: [
    {
      _id: 'fl_1',
      truckId: 'TRK-042',
      plate: 'KGA-9042',
      barangay: 'Carmen',
      driver: 'Mateo Reyes',
      status: 'In Transit',
      location: getBarangayLocation('Carmen'),
      locationSource: 'barangay-estimate',
      position: { top: '30%', left: '48%' }
    },
    {
      _id: 'fl_2',
      truckId: 'TRK-015',
      plate: 'KGA-8832',
      barangay: 'Lapasan',
      driver: 'Juanito Luna',
      status: 'Idle',
      location: getBarangayLocation('Lapasan'),
      locationSource: 'barangay-estimate',
      position: { top: '42%', left: '61%' }
    },
    {
      _id: 'fl_3',
      truckId: 'TRK-008',
      plate: 'KGA-7104',
      barangay: 'Balulang',
      driver: 'Danilo Cruz',
      status: 'In Transit',
      location: getBarangayLocation('Balulang'),
      locationSource: 'barangay-estimate',
      position: { top: '65%', left: '38%' }
    },
    {
      _id: 'fl_4',
      truckId: 'TRK-029',
      plate: 'KGA-6321',
      barangay: 'Macasandig',
      driver: 'Ricardo Tan',
      status: 'Idle',
      location: getBarangayLocation('Macasandig'),
      locationSource: 'barangay-estimate',
      position: { top: '55%', left: '52%' }
    },
    {
      _id: 'fl_5',
      truckId: 'TRK-011',
      plate: 'KGA-5509',
      barangay: 'Central Depot',
      driver: 'Pedro Flores',
      status: 'Maintenance',
      location: getBarangayLocation('Central Depot'),
      locationSource: 'barangay-estimate',
      position: { top: '20%', left: '30%' }
    }
  ],

  reports: [],

  schedules: [
    {
      _id: 'sch_1',
      barangay: 'Carmen',
      biodegradableDays: 'Monday, Wednesday, Friday',
      nonBiodegradableDays: 'Tuesday, Thursday, Saturday',
      timeSlot: '06:00 AM - 10:00 AM',
      assignedTruck: 'CLENRO Truck #4'
    },
    {
      _id: 'sch_2',
      barangay: 'Lapasan',
      biodegradableDays: 'Tuesday, Friday',
      nonBiodegradableDays: 'Monday, Thursday',
      timeSlot: '05:00 AM - 09:00 AM',
      assignedTruck: 'CLENRO Truck #1'
    },
    {
      _id: 'sch_3',
      barangay: 'Balulang',
      biodegradableDays: 'Monday, Thursday',
      nonBiodegradableDays: 'Wednesday, Saturday',
      timeSlot: '07:00 AM - 11:00 AM',
      assignedTruck: 'CLENRO Truck #2'
    },
    {
      _id: 'sch_4',
      barangay: 'Macasandig',
      biodegradableDays: 'Tuesday, Thursday, Saturday',
      nonBiodegradableDays: 'Monday, Wednesday, Friday',
      timeSlot: '06:00 AM - 10:00 AM',
      assignedTruck: 'CLENRO Truck #3'
    },
    {
      _id: 'sch_5',
      barangay: 'Lumbia',
      biodegradableDays: 'Wednesday, Saturday',
      nonBiodegradableDays: 'Tuesday, Friday',
      timeSlot: '08:00 AM - 12:00 PM',
      assignedTruck: 'CLENRO Truck #5'
    }
  ]
};

const sampleCollectionSchedules = require('../data/sampleCollectionSchedules');
sampleCollectionSchedules.forEach(sampleSchedule => {
  const existing = memoryStore.schedules.find(schedule =>
    schedule.barangay.toLowerCase() === sampleSchedule.barangay.toLowerCase()
  );

  if (!existing) {
    memoryStore.schedules.push(sampleSchedule);
    return;
  }

  const hasSampleFallback = (existing.areaSchedules || []).some(areaSchedule =>
    areaSchedule.appliesToAllAreas &&
    areaSchedule.isSample &&
    areaSchedule.areaName === 'Barangay-wide sample route'
  );
  if (!hasSampleFallback) {
    existing.areaSchedules = [
      ...(existing.areaSchedules || []),
      sampleSchedule.areaSchedules[0]
    ];
  }
});

module.exports = memoryStore;
