require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../modules/user/user.model');
const connectDB = require('../config/db');

const seedUsers = [
  // ─── Super Admins ─────────────────────────────────────────
  {
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@jewels.com',
    password: 'Admin@123',
    phone: '+91 98000 00001',
    role: 'super_admin',
    isActive: true,
  },
  {
    firstName: 'Super',
    lastName: 'Admin',
    email: 'admin@neirah.com',
    password: 'Admin@123',
    phone: '+91 98000 00002',
    role: 'super_admin',
    isActive: true,
  },

  // ─── Store Admins & Managers ──────────────────────────────
  {
    firstName: 'Aisha',
    lastName: 'Sharma',
    email: 'aisha.admin@jewels.com',
    password: 'Admin@123',
    phone: '+91 98111 55443',
    role: 'admin',
    isActive: true,
  },
  {
    firstName: 'Rajesh',
    lastName: 'Nair',
    email: 'rajesh.manager@jewels.com',
    password: 'Admin@123',
    phone: '+91 98222 66778',
    role: 'admin',
    isActive: true,
  },

  // ─── High Jewelry Customers ───────────────────────────────
  {
    firstName: 'Krushnakant',
    lastName: 'Jayswal',
    email: 'krushnakant.jayswal@gmail.com',
    password: 'User@123',
    phone: '+91 98201 54321',
    role: 'user',
    isActive: true,
  },
  {
    firstName: 'Priya',
    lastName: 'Mehta',
    email: 'priya.mehta@outlook.com',
    password: 'User@123',
    phone: '+91 98192 87654',
    role: 'user',
    isActive: true,
  },
  {
    firstName: 'Rohan',
    lastName: 'Verma',
    email: 'rohan.verma@gmail.com',
    password: 'User@123',
    phone: '+91 99203 11223',
    role: 'user',
    isActive: true,
  },
  {
    firstName: 'Ananya',
    lastName: 'Patel',
    email: 'ananya.patel@yahoo.com',
    password: 'User@123',
    phone: '+91 98765 43210',
    role: 'user',
    isActive: true,
  },
  {
    firstName: 'Vikram',
    lastName: 'Malhotra',
    email: 'vikram.malhotra@luxury.com',
    password: 'User@123',
    phone: '+91 98210 99887',
    role: 'user',
    isActive: true,
  },
  {
    firstName: 'Neha',
    lastName: 'Singhania',
    email: 'neha.singhania@gmail.com',
    password: 'User@123',
    phone: '+91 97654 32109',
    role: 'user',
    isActive: true,
  },
  {
    firstName: 'Siddharth',
    lastName: 'Roy',
    email: 'siddharth.roy@icloud.com',
    password: 'User@123',
    phone: '+91 98111 22334',
    role: 'user',
    isActive: true,
  },
  {
    firstName: 'Diya',
    lastName: 'Kapoor',
    email: 'diya.kapoor@gmail.com',
    password: 'User@123',
    phone: '+91 98222 33445',
    role: 'user',
    isActive: true,
  },
  {
    firstName: 'Eleanor',
    lastName: 'Vanderbilt',
    email: 'eleanor.vanderbilt@gmail.com',
    password: 'User@123',
    phone: '+1 212 555 0192',
    role: 'user',
    isActive: true,
  },
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'user@jewels.com',
    password: 'User@123',
    phone: '+1 415 555 2671',
    role: 'user',
    isActive: true,
  },
];

const seedData = async () => {
  try {
    await connectDB();
    console.log('🌱 Starting database seed...\n');

    // ─── Clear existing users ─────────────────────────
    const deleted = await User.deleteMany({});
    console.log(`🗑️  Cleared ${deleted.deletedCount} existing users`);

    // ─── Insert all users ─────────────────────────────
    const users = await User.create(seedUsers);
    console.log(`✅ Successfully seeded ${users.length} users into MongoDB!\n`);

    console.log('📋 Seeded Accounts Summary:');
    console.log('----------------------------------------------------');
    console.log('👑 Super Admins:');
    console.log('   • superadmin@jewels.com / Admin@123');
    console.log('   • admin@neirah.com      / Admin@123');
    console.log('\n🛡️  Store Admins:');
    console.log('   • aisha.admin@jewels.com    / Admin@123');
    console.log('   • rajesh.manager@jewels.com / Admin@123');
    console.log('\n💎 Customers (Krushnakant Jayswal & more):');
    console.log('   • krushnakant.jayswal@gmail.com / User@123');
    console.log('   • priya.mehta@outlook.com       / User@123');
    console.log('   • rohan.verma@gmail.com         / User@123');
    console.log('   • ananya.patel@yahoo.com        / User@123');
    console.log('   • vikram.malhotra@luxury.com    / User@123');
    console.log('   • user@jewels.com               / User@123');
    console.log('----------------------------------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ User seed failed:', error.message);
    process.exit(1);
  }
};

seedData();
