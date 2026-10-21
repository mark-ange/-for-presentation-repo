const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const User = require('./models/User');
const Barangay = require('./models/Barangay');
const Fleet = require('./models/Fleet');
const Schedule = require('./models/Schedule');
const { getBarangayLocation } = require('./utils/coordinates');

const seedData = async (shouldExit = true) => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/citycare_db';
    console.log(`Connecting to MongoDB at: ${mongoUri}...`);

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }

    console.log('Clearing existing collections to seed fresh database records...');
    await User.deleteMany();
    await Barangay.deleteMany();
    await Fleet.deleteMany();
    await Schedule.deleteMany();

    console.log('Seeding Administrator Accounts...');
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const staffPassword = await bcrypt.hash('staff123', salt);

    await User.create({
      fullName: 'CLENRO Central Admin',
      email: 'admin@clenro-cdo.gov.ph',
      phoneNumber: '0917-123-4567',
      barangay: 'Central District',
      purokZone: 'City Hall Complex',
      password: adminPassword,
      securityPin: '1234',
      role: 'CLENRO Central Admin'
    });

    await User.create({
      fullName: 'CLENRO Staff Officer',
      email: 'staff@clenro-cdo.gov.ph',
      phoneNumber: '0917-987-6543',
      barangay: 'Central District',
      purokZone: 'CLENRO Operations Desk',
      password: staffPassword,
      securityPin: '1234',
      role: 'CLENRO Staff'
    });

    console.log('Seeding Cagayan de Oro Barangays...');
    const barangays = await Barangay.insertMany([
      { name: 'Carmen', district: 'District 1', teams: 3, status: 'Active' },
      { name: 'Lapasan', district: 'District 1', teams: 2, status: 'Active' },
      { name: 'Macasandig', district: 'District 1', teams: 2, status: 'Active' },
      { name: 'Balulang', district: 'District 2', teams: 2, status: 'Active' },
      { name: 'Lumbia', district: 'District 3', teams: 1, status: 'Active' },
      { name: 'Bulua', district: 'District 1', teams: 2, status: 'Active' },
      { name: 'Nazareth', district: 'District 2', teams: 2, status: 'Active' },
      { name: 'Kauswagan', district: 'District 1', teams: 2, status: 'Active' }
    ]);

    console.log('Seeding Fleet Vehicles & Drivers...');
    await Fleet.insertMany([
      {
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
        truckId: 'TRK-011',
        plate: 'KGA-5509',
        barangay: 'Central Depot',
        driver: 'Pedro Flores',
        status: 'Maintenance',
        location: getBarangayLocation('Central Depot'),
        locationSource: 'barangay-estimate',
        position: { top: '20%', left: '30%' }
      }
    ]);

    console.log('Seeding Waste Collection Schedules...');
    await Schedule.insertMany([
      {
        barangay: 'Carmen',
        biodegradableDays: 'Monday, Wednesday, Friday',
        nonBiodegradableDays: 'Tuesday, Thursday, Saturday',
        timeSlot: '06:00 AM - 10:00 AM',
        assignedTruck: 'CLENRO Truck #4'
      },
      {
        barangay: 'Lapasan',
        biodegradableDays: 'Tuesday, Friday',
        nonBiodegradableDays: 'Monday, Thursday',
        timeSlot: '05:00 AM - 09:00 AM',
        assignedTruck: 'CLENRO Truck #1'
      },
      {
        barangay: 'Balulang',
        biodegradableDays: 'Monday, Thursday',
        nonBiodegradableDays: 'Wednesday, Saturday',
        timeSlot: '07:00 AM - 11:00 AM',
        assignedTruck: 'CLENRO Truck #2'
      },
      {
        barangay: 'Macasandig',
        biodegradableDays: 'Tuesday, Thursday, Saturday',
        nonBiodegradableDays: 'Monday, Wednesday, Friday',
        timeSlot: '06:00 AM - 10:00 AM',
        assignedTruck: 'CLENRO Truck #3'
      },
      {
        barangay: 'Lumbia',
        biodegradableDays: 'Wednesday, Saturday',
        nonBiodegradableDays: 'Tuesday, Friday',
        timeSlot: '08:00 AM - 12:00 PM',
        assignedTruck: 'CLENRO Truck #5'
      }
    ]);

    console.log('✅ Database Seeding Completed Successfully in MongoDB!');
    console.log('Default Admin Account:');
    console.log('  Email: admin@clenro-cdo.gov.ph');
    console.log('  Password: admin123');
    console.log('  PIN: 1234');
    console.log('  Role: CLENRO Central Admin');

    if (shouldExit) {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Database Seeding Failed:', error.message);
    if (shouldExit) {
      process.exit(1);
    }
  }
};

// Run if called directly
if (require.main === module) {
  seedData(true);
}

module.exports = seedData;
