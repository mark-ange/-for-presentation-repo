const sampleCollectionSchedules = [
  {
    barangay: 'Iponan',
    biodegradableDays: 'Monday, Thursday',
    nonBiodegradableDays: 'Tuesday, Friday',
    timeSlot: '07:00 AM - 10:00 AM',
    assignedTruck: 'CLENRO Sample Truck #1',
    areaSchedules: [{
      areaName: 'Barangay-wide sample route',
      appliesToAllAreas: true,
      isSample: true,
      biodegradableDays: 'Monday, Thursday',
      nonBiodegradableDays: 'Tuesday, Friday',
      timeSlot: '07:00 AM - 10:00 AM',
      assignedTruck: 'CLENRO Sample Truck #1'
    }]
  },
  {
    barangay: 'Bulua',
    biodegradableDays: 'Monday, Wednesday, Friday',
    nonBiodegradableDays: 'Tuesday, Thursday, Saturday',
    timeSlot: '06:00 AM - 09:00 AM',
    assignedTruck: 'CLENRO Sample Truck #2',
    areaSchedules: [{
      areaName: 'Barangay-wide sample route',
      appliesToAllAreas: true,
      isSample: true,
      biodegradableDays: 'Monday, Wednesday, Friday',
      nonBiodegradableDays: 'Tuesday, Thursday, Saturday',
      timeSlot: '06:00 AM - 09:00 AM',
      assignedTruck: 'CLENRO Sample Truck #2'
    }]
  },
  {
    barangay: 'Canitoan',
    biodegradableDays: 'Tuesday, Friday',
    nonBiodegradableDays: 'Monday, Thursday',
    timeSlot: '07:00 AM - 10:00 AM',
    assignedTruck: 'CLENRO Sample Truck #3',
    areaSchedules: [{
      areaName: 'Barangay-wide sample route',
      appliesToAllAreas: true,
      isSample: true,
      biodegradableDays: 'Tuesday, Friday',
      nonBiodegradableDays: 'Monday, Thursday',
      timeSlot: '07:00 AM - 10:00 AM',
      assignedTruck: 'CLENRO Sample Truck #3'
    }]
  },
  {
    barangay: 'Carmen',
    biodegradableDays: 'Monday, Wednesday, Friday',
    nonBiodegradableDays: 'Tuesday, Thursday, Saturday',
    timeSlot: '06:00 AM - 10:00 AM',
    assignedTruck: 'CLENRO Sample Truck #4',
    areaSchedules: [{
      areaName: 'Barangay-wide sample route',
      appliesToAllAreas: true,
      isSample: true,
      biodegradableDays: 'Monday, Wednesday, Friday',
      nonBiodegradableDays: 'Tuesday, Thursday, Saturday',
      timeSlot: '06:00 AM - 10:00 AM',
      assignedTruck: 'CLENRO Sample Truck #4'
    }]
  },
  {
    barangay: 'Patag',
    biodegradableDays: 'Tuesday, Thursday, Saturday',
    nonBiodegradableDays: 'Monday, Wednesday, Friday',
    timeSlot: '07:00 AM - 11:00 AM',
    assignedTruck: 'CLENRO Sample Truck #5',
    areaSchedules: [{
      areaName: 'Barangay-wide sample route',
      appliesToAllAreas: true,
      isSample: true,
      biodegradableDays: 'Tuesday, Thursday, Saturday',
      nonBiodegradableDays: 'Monday, Wednesday, Friday',
      timeSlot: '07:00 AM - 11:00 AM',
      assignedTruck: 'CLENRO Sample Truck #5'
    }]
  },
  {
    barangay: 'Kauswagan',
    biodegradableDays: 'Monday, Thursday',
    nonBiodegradableDays: 'Tuesday, Saturday',
    timeSlot: '05:00 AM - 09:00 AM',
    assignedTruck: 'CLENRO Sample Truck #6',
    areaSchedules: [{
      areaName: 'Barangay-wide sample route',
      appliesToAllAreas: true,
      isSample: true,
      biodegradableDays: 'Monday, Thursday',
      nonBiodegradableDays: 'Tuesday, Saturday',
      timeSlot: '05:00 AM - 09:00 AM',
      assignedTruck: 'CLENRO Sample Truck #6'
    }]
  }
];

module.exports = sampleCollectionSchedules;
