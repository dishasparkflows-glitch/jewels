require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const CodSequence = require('../modules/codSequence/codSequence.model');
const User = require('../modules/user/user.model');
const Appointment = require('../modules/appointment/appointment.model');
const CustomInquiry = require('../modules/customInquiry/customInquiry.model');
const Review = require('../modules/review/review.model');

// ─── 1. COD SEQUENCES (Matches Screenshot 1) ─────────────────
const codSequences = [
  { uptoAmount: 30000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
  { uptoAmount: 50000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
  { uptoAmount: 100000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
  { uptoAmount: 1000000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
];

// ─── 2. CUSTOMERS (Matches Screenshot 2: 29 Total Clients, 2 High Spenders, 0.8 Avg Orders) ───
const customers = [
  {
    firstName: 'Krushnakant',
    lastName: 'Jayswal',
    email: 'jayswalkrushnikant4444@gmail.com',
    password: 'User@123',
    phone: '6353516141',
    ordersCount: 6,
    lifetimeValue: 99050,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date('2026-09-01T10:00:00Z') },
  },
  {
    firstName: 'Keval',
    lastName: 'Patel',
    email: 'kevaltest@gmail.com',
    password: 'User@123',
    phone: '6355384531',
    ordersCount: 0,
    lifetimeValue: 0,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date('2026-09-05T12:30:00Z') },
  },
  {
    firstName: 'Disha',
    lastName: 'Radadiya',
    email: 'disharadadiya13@gmail.com',
    password: 'User@123',
    phone: '9825032534',
    ordersCount: 0,
    lifetimeValue: 0,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date('2026-09-10T14:15:00Z') },
  },
  {
    firstName: 'Customer',
    lastName: 'User',
    email: 'customer101@gmail.com',
    password: 'User@123',
    phone: '9876543299',
    ordersCount: 0,
    lifetimeValue: 0,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date('2026-09-12T16:00:00Z') },
  },
  {
    firstName: 'Aarav',
    lastName: 'Singhania',
    email: 'aarav.singhania@heritage.in',
    password: 'User@123',
    phone: '9820011223',
    ordersCount: 8,
    lifetimeValue: 245000,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date('2026-09-14T09:00:00Z') },
  },
  {
    firstName: 'Meera',
    lastName: 'Shah',
    email: 'meera.shah@gmail.com',
    password: 'User@123',
    phone: '9819922334',
    ordersCount: 3,
    lifetimeValue: 68500,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date('2026-09-15T11:00:00Z') },
  },
  {
    firstName: 'Vikramaditya',
    lastName: 'Rathore',
    email: 'rathore.vikram@regal.in',
    password: 'User@123',
    phone: '9821133445',
    ordersCount: 4,
    lifetimeValue: 182000,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date('2026-09-16T15:00:00Z') },
  },
  {
    firstName: 'Ananya',
    lastName: 'Deshmukh',
    email: 'ananya.d@gmail.com',
    password: 'User@123',
    phone: '9833344556',
    ordersCount: 1,
    lifetimeValue: 32000,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date('2026-09-18T10:00:00Z') },
  },
  {
    firstName: 'Devansh',
    lastName: 'Kapoor',
    email: 'devansh.kapoor@outlook.com',
    password: 'User@123',
    phone: '9844455667',
    ordersCount: 2,
    lifetimeValue: 54000,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date('2026-09-19T13:00:00Z') },
  },
  {
    firstName: 'Pooja',
    lastName: 'Vora',
    email: 'pooja.vora@gmail.com',
    password: 'User@123',
    phone: '9855566778',
    ordersCount: 0,
    lifetimeValue: 0,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date('2026-09-20T17:00:00Z') },
  },
];

// Fill up to 29 active clients
const extraNames = [
  ['Rhea', 'Sen', 'rhea.sen@gmail.com', '9866677889'],
  ['Kabir', 'Bhatia', 'kabir.b@gmail.com', '9877788990'],
  ['Tara', 'Sutaria', 'tara.sutaria@outlook.com', '9888899001'],
  ['Arjun', 'Mehra', 'arjun.mehra@live.com', '9899900112'],
  ['Ishaan', 'Nanda', 'ishaan.nanda@gmail.com', '9811122330'],
  ['Sanya', 'Malhotra', 'sanya.m@gmail.com', '9822233441'],
  ['Zoya', 'Akhtar', 'zoya.a@gmail.com', '9833344552'],
  ['Rohan', 'Verma', 'rohan.verma@luxury.com', '9844455663'],
  ['Diya', 'Merchant', 'diya.merchant@gmail.com', '9855566774'],
  ['Aditya', 'Roy', 'aditya.roy@yahoo.com', '9866677885'],
  ['Natasha', 'Poonawalla', 'natasha.p@gmail.com', '9877788996'],
  ['Samir', 'Jain', 'samir.jain@jainco.in', '9888899007'],
  ['Kavita', 'Krishnan', 'kavita.k@gmail.com', '9899900118'],
  ['Varun', 'Dhawan', 'varun.d@gmail.com', '9810111219'],
  ['Tanvi', 'Shah', 'tanvi.shah@gmail.com', '9820222320'],
  ['Neel', 'Kashyap', 'neel.k@gmail.com', '9830333421'],
  ['Gauri', 'Khan', 'gauri.design@gmail.com', '9840444522'],
  ['Manish', 'Malhotra', 'manish.couture@gmail.com', '9850555623'],
  ['Siddharth', 'Malhotra', 'sid.malhotra@gmail.com', '9860666724'],
];

extraNames.forEach(([first, last, email, phone], i) => {
  customers.push({
    firstName: first,
    lastName: last,
    email: email,
    password: 'User@123',
    phone: phone,
    ordersCount: i % 4 === 0 ? 1 : 0,
    lifetimeValue: i % 4 === 0 ? 25000 : 0,
    role: 'user',
    isActive: true,
    meta: { createdAt: new Date(`2026-09-${(15 + (i % 12)).toString().padStart(2, '0')}T10:00:00Z`) },
  });
});

// ─── 3. APPOINTMENTS (Matches Screenshot 3: 14 Total, 12 Pending, 0 Completed, 2 Cancelled) ───
const appointments = [
  {
    customer: {
      name: 'Krushnakant',
      email: 'jayswalkrushnikant4444@gmail.com',
      phone: { countryCode: '91', number: '6353516141' },
    },
    appointment: {
      date: new Date('2026-09-28'),
      preferredTime: '06:00 PM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Krushnakant',
      email: 'jayswalkrushnikant4444@gmail.com',
      phone: { countryCode: '91', number: '6353516141' },
    },
    appointment: {
      date: new Date('2026-09-26'),
      preferredTime: '06:00 PM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Krushnakant',
      email: 'jayswalkrushnikant4444@gmail.com',
      phone: { countryCode: '91', number: '6353516141' },
    },
    appointment: {
      date: new Date('2026-09-26'),
      preferredTime: '06:00 PM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Test mobile',
      email: 'testi@gmail.com',
      phone: { countryCode: '91', number: '9848484848' },
    },
    appointment: {
      date: new Date('2026-09-24'),
      preferredTime: '05:00 PM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Test Demo',
      email: 'testi@gmail.com',
      phone: { countryCode: '91', number: '9193838388' },
    },
    appointment: {
      date: new Date('2026-09-25'),
      preferredTime: '05:00 PM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Priya Sharma',
      email: 'priya.sharma@luxury.com',
      phone: { countryCode: '91', number: '9820199881' },
    },
    appointment: {
      date: new Date('2026-09-29'),
      preferredTime: '02:00 PM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Vikram Malhotra',
      email: 'vikram.m@gmail.com',
      phone: { countryCode: '91', number: '9820299882' },
    },
    appointment: {
      date: new Date('2026-09-29'),
      preferredTime: '04:00 PM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Ananya Birla',
      email: 'ananya.b@gmail.com',
      phone: { countryCode: '91', number: '9820399883' },
    },
    appointment: {
      date: new Date('2026-09-30'),
      preferredTime: '11:00 AM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Rohan Mehra',
      email: 'rohan.m@gmail.com',
      phone: { countryCode: '91', number: '9820499884' },
    },
    appointment: {
      date: new Date('2026-09-30'),
      preferredTime: '01:00 PM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Devika Singhania',
      email: 'devika.s@gmail.com',
      phone: { countryCode: '91', number: '9820599885' },
    },
    appointment: {
      date: new Date('2026-10-01'),
      preferredTime: '03:00 PM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Karan Johar',
      email: 'karan.j@gmail.com',
      phone: { countryCode: '91', number: '9820699886' },
    },
    appointment: {
      date: new Date('2026-10-02'),
      preferredTime: '05:00 PM',
    },
    status: 'pending',
  },
  {
    customer: {
      name: 'Ritu Kumar',
      email: 'ritu.k@gmail.com',
      phone: { countryCode: '91', number: '9820799887' },
    },
    appointment: {
      date: new Date('2026-10-03'),
      preferredTime: '04:30 PM',
    },
    status: 'pending',
  },
  // 2 Cancelled appointments
  {
    customer: {
      name: 'Harsh Vardhan',
      email: 'harsh.v@gmail.com',
      phone: { countryCode: '91', number: '9820899888' },
    },
    appointment: {
      date: new Date('2026-09-21'),
      preferredTime: '03:00 PM',
    },
    status: 'cancelled',
  },
  {
    customer: {
      name: 'Sunita Rao',
      email: 'sunita.rao@gmail.com',
      phone: { countryCode: '91', number: '9820999889' },
    },
    appointment: {
      date: new Date('2026-09-22'),
      preferredTime: '12:00 PM',
    },
    status: 'cancelled',
  },
];

// ─── 4. CUSTOM DESIGN INQUIRIES (Matches Screenshot 4: 5 Total, 3 Pending) ───
const customInquiries = [
  {
    customer: {
      name: 'Krushnakant',
      email: 'jayswalkrushnikant4444@gmail.com',
      phone: { countryCode: '91', number: '6353516141' },
    },
    requirements: {
      stoneType: 'Natural Diamond',
      metalType: '18KT Gold',
      jewelryTypes: ['RING/BAND'],
      comments: 'Looking for a solitaire engagement ring design with custom halo.',
    },
    status: 'pending',
    meta: { createdAt: new Date('2026-09-26T14:30:00Z') },
  },
  {
    customer: {
      name: 'Test Mobile',
      email: 'test@gmail.com',
      phone: { countryCode: '91', number: '9393939933' },
    },
    requirements: {
      stoneType: 'Lab Grown Diamond',
      metalType: '9KT Gold',
      jewelryTypes: ['RING/BAND'],
      comments: 'Minimalist band with baguette cut diamonds.',
    },
    status: 'pending',
    meta: { createdAt: new Date('2026-09-25T11:20:00Z') },
  },
  {
    customer: {
      name: 'Disha Radadiya',
      email: 'disha.sparkflows@gmail.com',
      phone: { countryCode: '91', number: '9825032534' },
    },
    requirements: {
      stoneType: 'Natural Diamond',
      metalType: '14KT Gold',
      jewelryTypes: ['BRACELETS', 'OTHER'],
      comments: 'Tennis bracelet with round brilliant diamonds in rose gold.',
    },
    status: 'pending',
    meta: { createdAt: new Date('2026-09-24T16:45:00Z') },
  },
  {
    customer: {
      name: 'Aarav Singhania',
      email: 'aarav.singhania@heritage.in',
      phone: { countryCode: '91', number: '9820011223' },
    },
    requirements: {
      stoneType: 'Natural Diamond',
      metalType: '18KT Gold',
      jewelryTypes: ['NECKLACES'],
      comments: 'Heritage bridal choker necklace with emerald accents.',
    },
    status: 'confirmed',
    meta: { createdAt: new Date('2026-09-20T10:00:00Z') },
  },
  {
    customer: {
      name: 'Meera Shah',
      email: 'meera.shah@gmail.com',
      phone: { countryCode: '91', number: '9819922334' },
    },
    requirements: {
      stoneType: 'Lab Grown Diamond',
      metalType: '18KT Gold',
      jewelryTypes: ['EARRINGS'],
      comments: 'Chandelier diamond earrings for anniversary celebration.',
    },
    status: 'confirmed',
    meta: { createdAt: new Date('2026-09-18T12:00:00Z') },
  },
];

// ─── 5. CUSTOMER REVIEWS (Matches Screenshot 5) ──────────────
const reviews = [
  {
    customer: {
      name: 'Disha',
      email: 'disharadadiya13@gmail.com',
    },
    review: {
      title: 'Exceeded Expectations',
      rating: 5,
      comment: 'I was looking for a budget-friendly jewellery set and this completely exceeded my expectations. The finishing is top-notch and it is the best handcrafted set I have ever bought.',
      reviewDate: new Date('2026-09-24T00:00:00.000Z'),
    },
    status: 'approved',
  },
  {
    customer: {
      name: 'Krushnakant Jayswal',
      email: 'krushnakant.jayswal@gmail.com',
    },
    review: {
      title: 'Exquisite Diamond Solitaire',
      rating: 5,
      comment: 'I was looking for a masterfully cut solitaire engagement ring and this completely exceeded my expectations. The finishing is top-notch and it is the most exquisite diamond piece in my collection.',
      reviewDate: new Date('2026-09-22T00:00:00.000Z'),
    },
    status: 'approved',
  },
  {
    customer: {
      name: 'Ananya Deshmukh',
      email: 'ananya.d@gmail.com',
    },
    review: {
      title: 'World-Class Atelier Service',
      rating: 5,
      comment: 'The atelier service and private consultation were truly world-class. The sparkle on the natural diamond solitaire is unmatched.',
      reviewDate: new Date('2026-09-19T00:00:00.000Z'),
    },
    status: 'approved',
  },
  {
    customer: {
      name: 'Vikramaditya Rathore',
      email: 'rathore.vikram@regal.in',
    },
    review: {
      title: 'Certified Hallmarked Purity',
      rating: 5,
      comment: 'Prompt delivery, insured packaging, and certified hallmarked purity. Highly recommend Neirah Jewellers for fine heritage collections.',
      reviewDate: new Date('2026-09-15T00:00:00.000Z'),
    },
    status: 'approved',
  },
];

const seedScreenshotModules = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding Screenshot Data into Database...\n');

    // 1. Seed COD Sequences
    await CodSequence.deleteMany({});
    const insertedCod = await CodSequence.insertMany(codSequences);
    console.log(`✅ Seeded ${insertedCod.length} COD Sequences`);

    // 2. Seed Customers (retain super_admin and admin users, update or add customer users)
    await User.deleteMany({ role: 'user' });
    const bcrypt = require('bcryptjs');
    const hashedCustomers = await Promise.all(
      customers.map(async (c) => ({
        role: c.role || 'user',
        isActive: c.isActive !== false,
        profile: {
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone || '',
          avatar: null,
          bio: '',
          location: '',
        },
        auth: {
          email: c.email,
          password: await bcrypt.hash(c.password || 'User@123', 12),
          lastLogin: null,
        },
        addresses: {
          billing: {},
          shipping: {},
          saved: [],
        },
        statistics: {
          ordersCount: c.ordersCount || 0,
          lifetimeValue: c.lifetimeValue || 0,
        },
        meta: {
          createdAt: c.meta?.createdAt || new Date(),
          updatedAt: c.meta?.createdAt || new Date(),
        },
      }))
    );
    const insertedUsers = await User.insertMany(hashedCustomers);
    console.log(`✅ Seeded ${insertedUsers.length} Customers (Total 29 active elite clients)`);

    // 3. Seed Appointments
    await Appointment.deleteMany({});
    const insertedAppointments = await Appointment.insertMany(appointments);
    console.log(`✅ Seeded ${insertedAppointments.length} Appointments (12 Pending, 2 Cancelled)`);

    // 4. Seed Custom Inquiries
    await CustomInquiry.deleteMany({});
    const insertedInquiries = await CustomInquiry.insertMany(customInquiries);
    console.log(`✅ Seeded ${insertedInquiries.length} Custom Inquiries (3 Pending, 2 Confirmed)`);

    // 5. Seed Reviews
    await Review.deleteMany({});
    const insertedReviews = await Review.insertMany(reviews);
    console.log(`✅ Seeded ${insertedReviews.length} Customer Reviews (Approved 5/5 stars)`);

    console.log('\n🎉 Database Seed Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedScreenshotModules();
