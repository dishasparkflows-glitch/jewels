require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

// Import all 39 models
const User = require('../modules/user/user.model');
const Category = require('../modules/category/category.model');
const MetalType = require('../modules/metalType/metalType.model');
const MetalPurity = require('../modules/metalPurity/metalPurity.model');
const MetalColor = require('../modules/metalColor/metalColor.model');
const DiamondType = require('../modules/diamondType/diamondType.model');
const DiamondShape = require('../modules/diamondShape/diamondShape.model');
const DiamondColor = require('../modules/diamondColor/diamondColor.model');
const DiamondClarity = require('../modules/diamondClarity/diamondClarity.model');
const DiamondCut = require('../modules/diamondCut/diamondCut.model');
const DiamondSize = require('../modules/diamondSize/diamondSize.model');
const CaratWeight = require('../modules/caratWeight/caratWeight.model');
const SieveSize = require('../modules/sieveSize/sieveSize.model');
const RingSize = require('../modules/ringSize/ringSize.model');
const Size = require('../modules/size/size.model');
const Birthstone = require('../modules/birthstone/birthstone.model');
const Product = require('../modules/product/product.model');
const Diamond = require('../modules/diamond/diamond.model');
const CenterDiamondPrice = require('../modules/centerDiamondPrice/centerDiamondPrice.model');
const SideDiamondPrice = require('../modules/sideDiamondPrice/sideDiamondPrice.model');
const DiamondPrice = require('../modules/diamondPrice/diamondPrice.model');
const DiamondPriceNew = require('../modules/diamondPriceNew/diamondPriceNew.model');
const Banner = require('../modules/banner/banner.model');
const Featured = require('../modules/featured/featured.model');
const MenuSection = require('../modules/menuSection/menuSection.model');
const MenuItem = require('../modules/menuItem/menuItem.model');
const Setting = require('../modules/setting/setting.model');
const FooterSettings = require('../modules/footerSettings/footerSettings.model');
const CodSequence = require('../modules/codSequence/codSequence.model');
const Appointment = require('../modules/appointment/appointment.model');
const CustomInquiry = require('../modules/customInquiry/customInquiry.model');
const Review = require('../modules/review/review.model');
const Coupon = require('../modules/coupon/coupon.model');
const InstagramPost = require('../modules/instagramPost/instagramPost.model');
const CustJewelleryBeforAfter = require('../modules/custJewelleryBeforeAfter/custJewelleryBeforeAfter.model');
const VTOMaster = require('../modules/vtoMaster/vtoMaster.model');
const Notification = require('../modules/notification/notification.model');
const Cart = require('../modules/cart/cart.model');
const Wishlist = require('../modules/wishlist/wishlist.model');

const seedAll = async () => {
  try {
    await connectDB();
    console.log('🌟 ========================================================');
    console.log('💎 NEIRAH JEWELLERS - MASTER DATABASE SEEDER INITIALIZING');
    console.log('🌟 ========================================================\n');

    // ─── 0. CLEAR EXISTING DATA ──────────────────────────────────────────
    console.log('🧹 Purging old records from all 39 collections...');
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      MetalType.deleteMany({}),
      MetalPurity.deleteMany({}),
      MetalColor.deleteMany({}),
      DiamondType.deleteMany({}),
      DiamondShape.deleteMany({}),
      DiamondColor.deleteMany({}),
      DiamondClarity.deleteMany({}),
      DiamondCut.deleteMany({}),
      DiamondSize.deleteMany({}),
      CaratWeight.deleteMany({}),
      SieveSize.deleteMany({}),
      RingSize.deleteMany({}),
      Size.deleteMany({}),
      Birthstone.deleteMany({}),
      Product.deleteMany({}),
      Diamond.deleteMany({}),
      CenterDiamondPrice.deleteMany({}),
      SideDiamondPrice.deleteMany({}),
      DiamondPrice.deleteMany({}),
      DiamondPriceNew.deleteMany({}),
      Banner.deleteMany({}),
      Featured.deleteMany({}),
      MenuSection.deleteMany({}),
      MenuItem.deleteMany({}),
      Setting.deleteMany({}),
      FooterSettings.deleteMany({}),
      CodSequence.deleteMany({}),
      Appointment.deleteMany({}),
      CustomInquiry.deleteMany({}),
      Review.deleteMany({}),
      Coupon.deleteMany({}),
      InstagramPost.deleteMany({}),
      CustJewelleryBeforAfter.deleteMany({}),
      VTOMaster.deleteMany({}),
      Notification.deleteMany({}),
      Cart.deleteMany({}),
      Wishlist.deleteMany({}),
    ]);
    console.log('✅ All collections successfully reset!\n');

    // ─── 1. SEED USERS (Admins + 29 Elite Clients) ──────────────────────
    console.log('👤 [1/24] Seeding Users (Super Admins, Store Admins, and Clients)...');
    const adminPasswordHash = await bcrypt.hash('Admin@123', 12);
    const userPasswordHash = await bcrypt.hash('User@123', 12);

    const rawUsers = [
      // Super Admins
      {
        role: 'super_admin',
        isActive: true,
        profile: { firstName: 'Super', lastName: 'Admin', phone: '+91 98000 00001', location: 'Ahmedabad' },
        auth: { email: 'superadmin@jewels.com', password: adminPasswordHash },
      },
      {
        role: 'super_admin',
        isActive: true,
        profile: { firstName: 'Super', lastName: 'Admin', phone: '+91 98000 00002', location: 'Gandhinagar' },
        auth: { email: 'admin@neirah.com', password: adminPasswordHash },
      },
      // Store Admins
      {
        role: 'admin',
        isActive: true,
        profile: { firstName: 'Aisha', lastName: 'Sharma', phone: '+91 98111 55443', location: 'Mumbai' },
        auth: { email: 'aisha.admin@jewels.com', password: adminPasswordHash },
      },
      {
        role: 'admin',
        isActive: true,
        profile: { firstName: 'Rajesh', lastName: 'Nair', phone: '+91 98222 66778', location: 'Bengaluru' },
        auth: { email: 'rajesh.manager@jewels.com', password: adminPasswordHash },
      },
      // 29 Elite Clients
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Krushnakant', lastName: 'Jayswal', phone: '6353516141', location: 'Surat' },
        auth: { email: 'jayswalkrushnikant4444@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 6, lifetimeValue: 99050 },
        meta: { createdAt: new Date('2026-09-01T10:00:00Z') },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Keval', lastName: 'Patel', phone: '6355384531', location: 'Ahmedabad' },
        auth: { email: 'kevaltest@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
        meta: { createdAt: new Date('2026-09-05T12:30:00Z') },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Disha', lastName: 'Radadiya', phone: '9825032534', location: 'Rajkot' },
        auth: { email: 'disharadadiya13@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
        meta: { createdAt: new Date('2026-09-10T14:15:00Z') },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Customer', lastName: 'User', phone: '9876543299', location: 'Delhi' },
        auth: { email: 'customer101@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
        meta: { createdAt: new Date('2026-09-12T16:00:00Z') },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Aarav', lastName: 'Singhania', phone: '9820011223', location: 'Mumbai' },
        auth: { email: 'aarav.singhania@heritage.in', password: userPasswordHash },
        statistics: { ordersCount: 8, lifetimeValue: 245000 },
        meta: { createdAt: new Date('2026-09-14T09:00:00Z') },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Meera', lastName: 'Shah', phone: '9819922334', location: 'Vadodara' },
        auth: { email: 'meera.shah@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 3, lifetimeValue: 68500 },
        meta: { createdAt: new Date('2026-09-15T11:00:00Z') },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Vikramaditya', lastName: 'Rathore', phone: '9821133445', location: 'Jaipur' },
        auth: { email: 'rathore.vikram@regal.in', password: userPasswordHash },
        statistics: { ordersCount: 4, lifetimeValue: 182000 },
        meta: { createdAt: new Date('2026-09-16T15:00:00Z') },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Ananya', lastName: 'Deshmukh', phone: '9833344556', location: 'Pune' },
        auth: { email: 'ananya.d@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 1, lifetimeValue: 32000 },
        meta: { createdAt: new Date('2026-09-18T10:00:00Z') },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Devansh', lastName: 'Kapoor', phone: '9844455667', location: 'Chandigarh' },
        auth: { email: 'devansh.kapoor@outlook.com', password: userPasswordHash },
        statistics: { ordersCount: 2, lifetimeValue: 54000 },
        meta: { createdAt: new Date('2026-09-19T13:00:00Z') },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Pooja', lastName: 'Vora', phone: '9855566778', location: 'Surat' },
        auth: { email: 'pooja.vora@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
        meta: { createdAt: new Date('2026-09-20T17:00:00Z') },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Rhea', lastName: 'Sen', phone: '9866677889', location: 'Kolkata' },
        auth: { email: 'rhea.sen@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 1, lifetimeValue: 25000 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Kabir', lastName: 'Bhatia', phone: '9877788990', location: 'Delhi' },
        auth: { email: 'kabir.b@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Tara', lastName: 'Sutaria', phone: '9888899001', location: 'Mumbai' },
        auth: { email: 'tara.sutaria@outlook.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Arjun', lastName: 'Mehra', phone: '9899900112', location: 'Gurugram' },
        auth: { email: 'arjun.mehra@live.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Ishaan', lastName: 'Nanda', phone: '9811122330', location: 'Noida' },
        auth: { email: 'ishaan.nanda@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 1, lifetimeValue: 28000 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Sanya', lastName: 'Malhotra', phone: '9822233441', location: 'Hyderabad' },
        auth: { email: 'sanya.m@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Zoya', lastName: 'Akhtar', phone: '9833344552', location: 'Goa' },
        auth: { email: 'zoya.a@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Rohan', lastName: 'Verma', phone: '9844455663', location: 'Bengaluru' },
        auth: { email: 'rohan.verma@luxury.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Diya', lastName: 'Merchant', phone: '9855566774', location: 'Mumbai' },
        auth: { email: 'diya.merchant@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 1, lifetimeValue: 35000 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Aditya', lastName: 'Roy', phone: '9866677885', location: 'Lucknow' },
        auth: { email: 'aditya.roy@yahoo.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Natasha', lastName: 'Poonawalla', phone: '9877788996', location: 'Pune' },
        auth: { email: 'natasha.p@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 2, lifetimeValue: 120000 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Samir', lastName: 'Jain', phone: '9888899007', location: 'Delhi' },
        auth: { email: 'samir.jain@jainco.in', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Kavita', lastName: 'Krishnan', phone: '9899900118', location: 'Chennai' },
        auth: { email: 'kavita.k@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Varun', lastName: 'Dhawan', phone: '9810111219', location: 'Mumbai' },
        auth: { email: 'varun.d@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 1, lifetimeValue: 18500 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Tanvi', lastName: 'Shah', phone: '9820222320', location: 'Ahmedabad' },
        auth: { email: 'tanvi.shah@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Neel', lastName: 'Kashyap', phone: '9830333421', location: 'Bhopal' },
        auth: { email: 'neel.k@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Gauri', lastName: 'Khan', phone: '9840444522', location: 'Mumbai' },
        auth: { email: 'gauri.design@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 3, lifetimeValue: 175000 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Manish', lastName: 'Malhotra', phone: '9850555623', location: 'Mumbai' },
        auth: { email: 'manish.couture@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 2, lifetimeValue: 145000 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'Siddharth', lastName: 'Malhotra', phone: '9860666724', location: 'Delhi' },
        auth: { email: 'sid.malhotra@gmail.com', password: userPasswordHash },
        statistics: { ordersCount: 0, lifetimeValue: 0 },
      },
      {
        role: 'user',
        isActive: true,
        profile: { firstName: 'John', lastName: 'Doe', phone: '+1 415 555 2671', location: 'San Francisco' },
        auth: { email: 'user@jewels.com', password: userPasswordHash },
        statistics: { ordersCount: 1, lifetimeValue: 24000 },
      },
    ];

    const seededUsers = await User.insertMany(rawUsers);
    console.log(`✅ Seeded ${seededUsers.length} Users successfully.`);

    const primaryAdmin = seededUsers.find((u) => u.role === 'super_admin');
    const primaryCustomer = seededUsers.find((u) => u.auth.email.includes('jayswalkrushn'));

    // ─── 2. SEED CATEGORIES WITH SUBTYPES ───────────────────────────────
    console.log('📁 [2/24] Seeding Categories & Sub-Types...');
    const categoriesData = [
      {
        name: 'Rings',
        slug: 'rings',
        type: 'category',
        images: [{ url: '/featured/ring.jpg', title: 'Diamond Rings' }],
        subTypes: [
          { name: 'Solitaire Rings', code: 'SOLR' },
          { name: 'Engagement Rings', code: 'ENGR' },
          { name: 'Band Rings', code: 'BNDR' },
          { name: 'Halo Rings', code: 'HALR' },
          { name: 'Eternity Bands', code: 'ETNB' },
        ],
      },
      {
        name: 'Earrings',
        slug: 'earrings',
        type: 'category',
        images: [{ url: '/featured/earring.jpg', title: 'Luxury Earrings' }],
        subTypes: [
          { name: 'Stud Earrings', code: 'STDE' },
          { name: 'Drop Earrings', code: 'DRPE' },
          { name: 'Hoop Earrings', code: 'HOPE' },
          { name: 'Chandelier Earrings', code: 'CHDE' },
        ],
      },
      {
        name: 'Pendant & Necklaces',
        slug: 'pendant',
        type: 'category',
        images: [{ url: '/featured/necklace.jpg', title: 'Fine Pendants' }],
        subTypes: [
          { name: 'Solitaire Pendants', code: 'SOLP' },
          { name: 'Choker Necklaces', code: 'CHKN' },
          { name: 'Tennis Necklaces', code: 'TNNN' },
          { name: 'Mangalsutra', code: 'MGST' },
        ],
      },
      {
        name: 'Bangles & Bracelets',
        slug: 'bangles-bracelets',
        type: 'category',
        images: [{ url: '/featured/bangles.jpg', title: 'Bracelets & Bangles' }],
        subTypes: [
          { name: 'Tennis Bracelets', code: 'TNBR' },
          { name: 'Cuffs', code: 'CUFF' },
          { name: 'Kada & Bangles', code: 'KDAB' },
          { name: 'Charm Bracelets', code: 'CHMB' },
        ],
      },
      {
        name: 'Collection',
        slug: 'collection',
        type: 'collection',
        images: [{ url: '/promos/essence_necklace.jpg', title: 'Curated Collection' }],
        subTypes: [
          { name: 'Solitaire Empress', code: 'SEMP' },
          { name: 'Heritage Bridal', code: 'HBDL' },
          { name: 'Contemporary Dailywear', code: 'CDLW' },
        ],
      },
      {
        name: 'Silver Collection',
        slug: 'silver-collection',
        type: 'collection',
        images: [{ url: '/promos/bracelet_stone.jpg', title: '925 Silver Jewellery' }],
        subTypes: [
          { name: '925 Sterling Rings', code: 'STLR' },
          { name: 'Silver Pendants', code: 'SLVP' },
          { name: 'Silver Bracelets', code: 'SLVB' },
        ],
      },
    ];

    const seededCategories = await Category.insertMany(categoriesData);
    console.log(`✅ Seeded ${seededCategories.length} Categories with embedded Sub-Types.`);

    const catMap = {};
    seededCategories.forEach((c) => {
      catMap[c.slug] = c;
    });

    // ─── 3. SEED METAL TYPES, PURITIES & COLORS ─────────────────────────
    console.log('🥇 [3/24] Seeding Metal Types, Purities & Colors...');
    const metalTypesData = [
      { name: '18KT Yellow Gold', karat: 18, metalColor: 'Yellow Gold' },
      { name: '18KT White Gold', karat: 18, metalColor: 'White Gold' },
      { name: '18KT Rose Gold', karat: 18, metalColor: 'Rose Gold' },
      { name: '14KT Yellow Gold', karat: 14, metalColor: 'Yellow Gold' },
      { name: 'Platinum 950', karat: 95, metalColor: 'Platinum' },
      { name: '925 Sterling Silver', karat: 92.5, metalColor: 'Silver' },
    ];
    const seededMetalTypes = await MetalType.insertMany(metalTypesData);

    const metalPuritiesData = [
      { name: '24KT Gold', metalType: 'Gold', karat: 24 },
      { name: '22KT Gold', metalType: 'Gold', karat: 22 },
      { name: '18KT Gold', metalType: 'Gold', karat: 18 },
      { name: '14KT Gold', metalType: 'Gold', karat: 14 },
      { name: '9KT Gold', metalType: 'Gold', karat: 9 },
      { name: '950 Platinum', metalType: 'Platinum', karat: 95 },
      { name: '925 Silver', metalType: 'Silver', karat: 92.5 },
    ];
    const seededMetalPurities = await MetalPurity.insertMany(metalPuritiesData);

    const metalColorsData = [
      { name: 'Yellow Gold', colorCode: '#E5C07B', colorCodeEnd: '#D4AF37' },
      { name: 'White Gold', colorCode: '#F3F4F6', colorCodeEnd: '#E5E7EB' },
      { name: 'Rose Gold', colorCode: '#E8B4B8', colorCodeEnd: '#B76E79' },
    ];
    const seededMetalColors = await MetalColor.insertMany(metalColorsData);
    console.log(`✅ Seeded ${seededMetalTypes.length} Metal Types, ${seededMetalPurities.length} Purities, ${seededMetalColors.length} Colors.`);

    // ─── 4. SEED DIAMOND MASTERS ────────────────────────────────────────
    console.log('💎 [4/24] Seeding Diamond Types, Shapes, Colors, Clarities, Cuts & Sizes...');
    const diamondTypesData = [
      { name: 'Natural Diamond' },
      { name: 'Lab Grown Diamond' },
    ];
    const seededDiamondTypes = await DiamondType.insertMany(diamondTypesData);

    const diamondShapesData = [
      { name: 'Round Brilliant' },
      { name: 'Oval' },
      { name: 'Emerald' },
      { name: 'Princess' },
      { name: 'Cushion' },
      { name: 'Pear' },
      { name: 'Radiant' },
      { name: 'Marquise' },
      { name: 'Asscher' },
      { name: 'Heart' },
    ];
    const seededDiamondShapes = await DiamondShape.insertMany(diamondShapesData);

    const diamondColorsData = [
      { name: 'D' }, { name: 'E' }, { name: 'F' },
      { name: 'G' }, { name: 'H' }, { name: 'I' }, { name: 'J' },
    ];
    const seededDiamondColors = await DiamondColor.insertMany(diamondColorsData);

    const diamondClaritiesData = [
      { name: 'FL' }, { name: 'IF' }, { name: 'VVS1' },
      { name: 'VVS2' }, { name: 'VS1' }, { name: 'VS2' },
      { name: 'SI1' }, { name: 'SI2' },
    ];
    const seededDiamondClarities = await DiamondClarity.insertMany(diamondClaritiesData);

    const diamondCutsData = [
      { name: 'Ideal' },
      { name: 'Excellent' },
      { name: 'Very Good' },
      { name: 'Good' },
    ];
    const seededDiamondCuts = await DiamondCut.insertMany(diamondCutsData);

    const diamondSizesData = [
      { name: '0.01 - 0.05 ct', sizeFrom: 0.01, sizeTo: 0.05 },
      { name: '0.05 - 0.10 ct', sizeFrom: 0.05, sizeTo: 0.10 },
      { name: '0.10 - 0.20 ct', sizeFrom: 0.10, sizeTo: 0.20 },
      { name: '0.20 - 0.30 ct', sizeFrom: 0.20, sizeTo: 0.30 },
      { name: '0.30 - 0.50 ct', sizeFrom: 0.30, sizeTo: 0.50 },
      { name: '0.50 - 0.70 ct', sizeFrom: 0.50, sizeTo: 0.70 },
      { name: '0.70 - 1.00 ct', sizeFrom: 0.70, sizeTo: 1.00 },
      { name: '1.00 - 1.50 ct', sizeFrom: 1.00, sizeTo: 1.50 },
      { name: '1.50 - 2.00 ct', sizeFrom: 1.50, sizeTo: 2.00 },
      { name: '2.00 - 3.00 ct', sizeFrom: 2.00, sizeTo: 3.00 },
    ];
    const seededDiamondSizes = await DiamondSize.insertMany(diamondSizesData);

    const caratWeightsData = [
      { name: '0.50 Carat', weight: 0.5, order: 1 },
      { name: '0.75 Carat', weight: 0.75, order: 2 },
      { name: '1.00 Carat', weight: 1.0, order: 3 },
      { name: '1.50 Carat', weight: 1.5, order: 4 },
      { name: '2.00 Carat', weight: 2.0, order: 5 },
      { name: '2.50 Carat', weight: 2.5, order: 6 },
      { name: '3.00 Carat', weight: 3.0, order: 7 },
      { name: '5.00 Carat', weight: 5.0, order: 8 },
    ];
    const seededCaratWeights = await CaratWeight.insertMany(caratWeightsData);

    const sieveSizesData = [
      { name: '-2' },
      { name: '+2-6.5' },
      { name: '+6.5-11' },
      { name: '+11-14' },
      { name: '+14' },
    ];
    const seededSieveSizes = await SieveSize.insertMany(sieveSizesData);

    const ringSizesData = [
      8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
    ].map((num) => ({ name: `Size ${num} (Indian)` }));
    const seededRingSizes = await RingSize.insertMany(ringSizesData);

    console.log(`✅ Seeded Diamond Masters: ${seededDiamondTypes.length} Types, ${seededDiamondShapes.length} Shapes, ${seededDiamondColors.length} Colors, ${seededDiamondClarities.length} Clarities, ${seededDiamondCuts.length} Cuts, ${seededDiamondSizes.length} Sizes, ${seededCaratWeights.length} Carats, ${seededSieveSizes.length} Sieves, ${seededRingSizes.length} Ring Sizes.`);

    // ─── 5. SEED CATEGORY SIZES (Size model) ────────────────────────────
    console.log('📏 [5/24] Seeding Category Sizes (Ring Sizes, Bangle Diameters, Chain Lengths)...');
    const ringCat = catMap['rings'];
    const bangleCat = catMap['bangles-bracelets'];
    const pendantCat = catMap['pendant'];

    const sizesData = [
      // Ring Sizes
      ...[10, 12, 14, 16, 18, 20].map((s) => ({
        name: `Ring Size ${s}`,
        category: ringCat._id,
      })),
      // Bangle / Bracelet Sizes
      ...['2.2 (54mm)', '2.4 (57mm)', '2.6 (60mm)', '2.8 (64mm)', '7.0 Inch', '7.5 Inch'].map((s) => ({
        name: `Bangle Size ${s}`,
        category: bangleCat._id,
      })),
      // Pendant Chains
      ...['16 Inch (Choker)', '18 Inch (Princess)', '20 Inch (Matinee)', '22 Inch (Opera)'].map((s) => ({
        name: `Chain Length ${s}`,
        category: pendantCat._id,
      })),
    ];
    const seededSizes = await Size.insertMany(sizesData);
    console.log(`✅ Seeded ${seededSizes.length} Category-linked Sizes.`);

    // ─── 6. SEED BIRTHSTONES (12 Months) ────────────────────────────────
    console.log('🔮 [6/24] Seeding 12 Months of Birthstones...');
    const birthstonesData = [
      { month: 'January', stoneName: 'Garnet', color: 'Deep Red', meaning: 'Constancy, loyalty, and unwavering devotion.' },
      { month: 'February', stoneName: 'Amethyst', color: 'Royal Purple', meaning: 'Peace, tranquility, and clarity of mind.' },
      { month: 'March', stoneName: 'Aquamarine', color: 'Ocean Blue', meaning: 'Courage, serenity, and harmony.' },
      { month: 'April', stoneName: 'Diamond', color: 'Brilliant Colorless', meaning: 'Eternal love, strength, and invincibility.' },
      { month: 'May', stoneName: 'Emerald', color: 'Vivid Green', meaning: 'Rebirth, prosperity, and timeless wisdom.' },
      { month: 'June', stoneName: 'Alexandrite & Pearl', color: 'Color-Changing / Iridescent', meaning: 'Purity, good fortune, and grace.' },
      { month: 'July', stoneName: 'Ruby', color: 'Pigeon Blood Red', meaning: 'Passion, nobility, and vitality.' },
      { month: 'August', stoneName: 'Peridot', color: 'Lime Green', meaning: 'Beauty, light, and protection.' },
      { month: 'September', stoneName: 'Sapphire', color: 'Deep Celestial Blue', meaning: 'Truth, nobility, and faithfulness.' },
      { month: 'October', stoneName: 'Tourmaline & Opal', color: 'Multi-Color Radiance', meaning: 'Creativity, wonder, and inspiration.' },
      { month: 'November', stoneName: 'Citrine & Topaz', color: 'Golden Amber', meaning: 'Joy, abundance, and warmth.' },
      { month: 'December', stoneName: 'Blue Zircon & Tanzanite', color: 'Velvet Indigo', meaning: 'Wisdom, honor, and spiritual dignity.' },
    ];
    const seededBirthstones = await Birthstone.insertMany(birthstonesData);
    console.log(`✅ Seeded ${seededBirthstones.length} Birthstones.`);

    // ─── 7. SEED FEATURED ITEMS (Placement: Celebrate & Gifts) ──────────
    console.log('🎁 [7/24] Seeding Featured Modules (Celebrate & Gifts)...');
    const featuredData = [
      // Placement: Celebrate
      { name: 'Necklace', placement: 'Celebrate', image: { url: '/featured/necklace.jpg' }, order: 1, productCount: 18 },
      { name: 'Bangles & Bracelets', placement: 'Celebrate', image: { url: '/featured/bangles.jpg' }, order: 2, productCount: 14 },
      { name: 'Earring', placement: 'Celebrate', image: { url: '/featured/earring.jpg' }, order: 3, productCount: 22 },
      { name: 'Ring', placement: 'Celebrate', image: { url: '/featured/ring.jpg' }, order: 4, productCount: 35 },
      // Placement: Gifts
      { name: 'Rings for Loved Ones', placement: 'Gifts', image: { url: '/featured/ring.jpg' }, order: 1, productCount: 12 },
      { name: 'Pendant & Necklaces Gift Set', placement: 'Gifts', image: { url: '/featured/necklace.jpg' }, order: 2, productCount: 8 },
      { name: 'Earrings Sparkle Box', placement: 'Gifts', image: { url: '/featured/earring.jpg' }, order: 3, productCount: 16 },
      { name: 'Heritage Solitaire Box', placement: 'Gifts', image: { url: '/featured/bangles.jpg' }, order: 4, productCount: 6 },
    ];
    const seededFeatured = await Featured.insertMany(featuredData);
    console.log(`✅ Seeded ${seededFeatured.length} Featured cards.`);

    // ─── 8. SEED BANNERS (Hero Banners & Collection Banners) ─────────────
    console.log('🖼️ [8/24] Seeding Hero & Curated Collection Banners...');
    const bannersData = [
      // Hero Banners
      {
        title: 'TIMELESS BEAUTY,',
        subtitle: 'Forever You',
        category: pendantCat._id,
        link: '/shop?category=pendant',
        image: { url: '/banners/hero_timeless.jpg' },
        type: 'herobanner',
        order: 1,
        status: 'active',
      },
      {
        title: 'THE ROYAL SOLITAIRE ATELIER',
        subtitle: 'Crowning Moments of Life',
        category: ringCat._id,
        link: '/shop?category=rings',
        image: { url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1600&q=80' },
        type: 'herobanner',
        order: 2,
        status: 'active',
      },
      // Collection Banners (Matching Home.jsx Screen 2)
      {
        title: 'The Essence Collection',
        subtitle: 'Delicate neckwear crafted with rare gemstones.',
        category: pendantCat._id,
        link: '/shop?category=pendant',
        image: { url: '/promos/essence_necklace.jpg' },
        type: 'collectionbanner',
        position: 'top-left',
        order: 1,
        status: 'active',
      },
      {
        title: 'A bracelet made distinctly yours.',
        subtitle: 'Hand-set diamond tennis bracelets and cuffs.',
        category: bangleCat._id,
        link: '/shop?category=bangles-bracelets',
        image: { url: '/promos/bracelet_stone.jpg' },
        type: 'collectionbanner',
        position: 'top-center',
        order: 2,
        status: 'active',
      },
      {
        title: 'Made to Shine. Made to Last.',
        subtitle: 'Discover timeless diamond rings crafted with elegance, brilliance and sophistication.',
        category: ringCat._id,
        link: '/shop?category=rings',
        image: { url: '/featured/ring.jpg' },
        type: 'collectionbanner',
        position: 'bottom-left',
        order: 3,
        status: 'active',
      },
      {
        title: 'Beauty. With Intention',
        subtitle: 'Every facet is chosen to express something extraordinary.',
        category: catMap['earrings']._id,
        link: '/shop?category=earrings',
        image: { url: '/banners/hero_timeless.jpg' },
        type: 'collectionbanner',
        position: 'right-tall',
        order: 4,
        status: 'active',
      },
    ];
    const seededBanners = await Banner.insertMany(bannersData);
    console.log(`✅ Seeded ${seededBanners.length} Banners.`);

    // ─── 9. SEED MENU SECTIONS & MENU ITEMS ──────────────────────────────
    console.log('📑 [9/24] Seeding Navigation Menu Sections & Items...');
    const menuSectionsData = [
      { categoryId: ringCat._id, title: 'Shop By Style' },
      { categoryId: ringCat._id, title: 'Shop By Metal' },
      { categoryId: catMap['earrings']._id, title: 'Earring Styles' },
      { categoryId: pendantCat._id, title: 'Necklace Styles' },
      { categoryId: bangleCat._id, title: 'Bangle & Bracelet Styles' },
    ];
    const seededSections = await MenuSection.insertMany(menuSectionsData);

    const ringStyleSection = seededSections.find((s) => s.title === 'Shop By Style');
    const ringMetalSection = seededSections.find((s) => s.title === 'Shop By Metal');
    const earringStyleSection = seededSections.find((s) => s.title === 'Earring Styles');

    const menuItemsData = [
      { menuSectionId: ringStyleSection._id, title: 'Solitaire Rings' },
      { menuSectionId: ringStyleSection._id, title: 'Halo Engagement Rings' },
      { menuSectionId: ringStyleSection._id, title: 'Eternity Bands' },
      { menuSectionId: ringStyleSection._id, title: 'Vintage Three-Stone' },
      { menuSectionId: ringMetalSection._id, title: '18KT Yellow Gold' },
      { menuSectionId: ringMetalSection._id, title: '18KT White Gold' },
      { menuSectionId: ringMetalSection._id, title: 'Platinum 950' },
      { menuSectionId: earringStyleSection._id, title: 'Classic Solitaire Studs' },
      { menuSectionId: earringStyleSection._id, title: 'Chandelier Drop Earrings' },
      { menuSectionId: earringStyleSection._id, title: 'Diamond Huggies & Hoops' },
    ];
    const seededMenuItems = await MenuItem.insertMany(menuItemsData);
    console.log(`✅ Seeded ${seededSections.length} Menu Sections and ${seededMenuItems.length} Menu Items.`);

    // ─── 10. SEED PRODUCTS (High Jewelry Catalog) ───────────────────────
    console.log('💍 [10/24] Seeding High Jewelry Product Catalog...');
    const yellowGold = seededMetalColors.find((c) => c.name === 'Yellow Gold');
    const whiteGold = seededMetalColors.find((c) => c.name === 'White Gold');
    const roseGold = seededMetalColors.find((c) => c.name === 'Rose Gold');

    const p18k = seededMetalPurities.find((p) => p.name === '18KT Gold');
    const natDia = seededDiamondTypes.find((d) => d.name === 'Natural Diamond');
    const labDia = seededDiamondTypes.find((d) => d.name === 'Lab Grown Diamond');
    const roundShape = seededDiamondShapes.find((s) => s.name === 'Round Brilliant');
    const ovalShape = seededDiamondShapes.find((s) => s.name === 'Oval');
    const emeraldShape = seededDiamondShapes.find((s) => s.name === 'Emerald');
    const dColor = seededDiamondColors.find((c) => c.name === 'D');
    const eColor = seededDiamondColors.find((c) => c.name === 'E');
    const vvs1Clarity = seededDiamondClarities.find((c) => c.name === 'VVS1');
    const vs1Clarity = seededDiamondClarities.find((c) => c.name === 'VS1');

    const productsData = [
      {
        title: 'Celestial Oval Solitaire Ring',
        slug: 'celestial-oval-solitaire-ring',
        sku: 'NJ-RNG-001',
        category: [ringCat._id],
        subType: ringCat.subTypes[0]._id,
        price: 390000,
        salePrice: 345000,
        costPrice: 280000,
        stockQty: 8,
        description: 'An exceptional 1.50 carat oval brilliant diamond nestled in a delicate micro-pavé band of 18K yellow gold. Designed for eternal elegance.',
        metalColors: [yellowGold._id, whiteGold._id, roseGold._id],
        images: [
          { url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80' },
          { url: '/featured/ring.jpg' },
        ],
        centerDiamondRows: [{
          diamondType: natDia._id,
          diamondShape: ovalShape._id,
          diamondColor: eColor._id,
          diamondClarity: vvs1Clarity._id,
          caratWeight: 1.5,
          pricePerCarat: 200000,
        }],
        variants: [{
          combination: '18K Yellow Gold / 1.50ct Oval / E VVS1',
          sku: 'NJ-RNG-001-YG',
          price: 345000,
          stock: 4,
          metalPurity: p18k._id,
          diamondType: natDia._id,
          diamondShape: ovalShape._id,
          diamondColor: eColor._id,
          diamondClarity: vvs1Clarity._id,
        }],
        productSpecifications: [
          { key: 'Center Stone', value: '1.50 Carat Oval Cut Natural Diamond' },
          { key: 'Diamond Color & Clarity', value: 'E / VVS1 (GIA Certified)' },
          { key: 'Gold Purity', value: '18KT Hallmarked Purity (750)' },
          { key: 'Gross Weight', value: '4.85 grams' },
        ],
        descriptionSections: [
          { header: 'The Atelier Design', description: 'Handcrafted in Mumbai using Italian master micro-pavé prongs.' },
          { header: 'Certification', description: 'Laser-inscribed GIA Report No. 24891024 with worldwide warranty.' },
        ],
      },
      {
        title: 'Verdant Empress Emerald Pendant',
        slug: 'verdant-empress-emerald-pendant',
        sku: 'NJ-PND-002',
        category: [pendantCat._id],
        subType: pendantCat.subTypes[0]._id,
        price: 520000,
        salePrice: 480000,
        costPrice: 390000,
        stockQty: 5,
        description: 'A captivating 2.8-carat Colombian emerald encircled by a halo of brilliant round-cut diamonds, suspended from an adjustable 18K white gold chain.',
        metalColors: [whiteGold._id, yellowGold._id],
        images: [
          { url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80' },
          { url: '/featured/necklace.jpg' },
        ],
        productSpecifications: [
          { key: 'Center Stone', value: '2.80 Carat Natural Zambian Emerald' },
          { key: 'Halo Diamonds', value: '0.65 ctw Round Brilliant F/VS' },
          { key: 'Chain Length', value: '18-inch Adjustable Wheat Chain' },
        ],
      },
      {
        title: 'Midnight Royal Sapphire Earrings',
        slug: 'midnight-royal-sapphire-earrings',
        sku: 'NJ-EAR-003',
        category: [catMap['earrings']._id],
        subType: catMap['earrings'].subTypes[1]._id,
        price: 320000,
        salePrice: 289000,
        costPrice: 220000,
        stockQty: 7,
        description: 'Deep royal blue Ceylon sapphires cascading beneath bezel-set pear-shaped diamonds in an articulated 18K white gold drop setting.',
        metalColors: [whiteGold._id],
        images: [
          { url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80' },
          { url: '/featured/earring.jpg' },
        ],
        productSpecifications: [
          { key: 'Sapphire Weight', value: '3.40 ctw Royal Blue' },
          { key: 'Diamond Accent', value: '0.45 ctw D-F Colorless' },
          { key: 'Closure', value: 'Secure French Lever-back' },
        ],
      },
      {
        title: 'Starlight Diamond Tennis Bracelet',
        slug: 'starlight-diamond-tennis-bracelet',
        sku: 'NJ-BRC-004',
        category: [bangleCat._id],
        subType: bangleCat.subTypes[0]._id,
        price: 680000,
        salePrice: 620000,
        costPrice: 490000,
        stockQty: 4,
        description: 'A timeless continuous circle of sixty-two perfectly matched round brilliant diamonds in four-prong settings with double safety clasp.',
        metalColors: [whiteGold._id, yellowGold._id, roseGold._id],
        images: [
          { url: 'https://images.unsplash.com/photo-1611591475152-478311382490?auto=format&fit=crop&w=800&q=80' },
          { url: '/featured/bangles.jpg' },
        ],
        productSpecifications: [
          { key: 'Total Diamond Weight', value: '5.00 ctw (62 Stones)' },
          { key: 'Color & Clarity', value: 'F-G / VS+' },
          { key: 'Length', value: 'Standard 7-inch (Complimentary resizing)' },
        ],
      },
      {
        title: 'Aura Vintage Diamond Band',
        slug: 'aura-vintage-diamond-band',
        sku: 'NJ-RNG-005',
        category: [ringCat._id],
        subType: ringCat.subTypes[2]._id,
        price: 240000,
        salePrice: 215000,
        costPrice: 170000,
        stockQty: 10,
        description: 'Inspired by 1920s Parisian Art Deco architecture, alternating baguette and round diamonds bordered with intricate milgrain detailing.',
        metalColors: [roseGold._id, yellowGold._id, whiteGold._id],
        images: [
          { url: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=800&q=80' },
          { url: '/featured/ring.jpg' },
        ],
        productSpecifications: [
          { key: 'Diamonds', value: '0.85 ctw Baguette & Round' },
          { key: 'Gold Purity', value: '18KT Rose Gold' },
        ],
      },
      {
        title: 'South Sea Baroque Pearl Choker',
        slug: 'south-sea-baroque-pearl-choker',
        sku: 'NJ-PND-006',
        category: [pendantCat._id],
        subType: pendantCat.subTypes[1]._id,
        price: 220000,
        salePrice: 198000,
        costPrice: 150000,
        stockQty: 6,
        description: 'A lustrous 14mm Australian South Sea baroque cultured pearl suspended on a hand-woven 18K yellow gold herringbone chain.',
        metalColors: [yellowGold._id],
        images: [
          { url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80' },
          { url: '/promos/essence_necklace.jpg' },
        ],
        productSpecifications: [
          { key: 'Pearl Grade', value: 'AAA High Luster Australian Pearl' },
          { key: 'Chain', value: '16-inch Solid 18K Gold' },
        ],
      },
      {
        title: 'Round Diamond Engagement Ring with Diamond Accent',
        slug: 'round-diamond-engagement-ring-with-diamond-accent',
        sku: 'NJ-RNG-007',
        category: [ringCat._id],
        subType: ringCat.subTypes[1]._id,
        price: 92000,
        salePrice: 79644.18,
        costPrice: 62000,
        stockQty: 12,
        description: 'Captivating round brilliant center diamond with micro-pavé shoulders that catch light from every dimension.',
        metalColors: [yellowGold._id, whiteGold._id],
        images: [{ url: '/featured/ring.jpg' }],
        productSpecifications: [
          { key: 'Center Diamond', value: '0.80 ct Round Brilliant' },
          { key: 'Accents', value: '0.24 ctw Round Diamonds' },
        ],
      },
      {
        title: 'Round Diamond Solitaire Ring with Multi Diamond Band',
        slug: 'round-diamond-solitaire-ring-with-multi-diamond-band',
        sku: 'NJ-RNG-008',
        category: [ringCat._id],
        subType: ringCat.subTypes[0]._id,
        price: 52000,
        salePrice: 44117.40,
        costPrice: 35000,
        stockQty: 15,
        description: 'Classic 4-prong solitaire with three rows of hand-set pavé diamonds across the curved shank.',
        metalColors: [yellowGold._id, whiteGold._id, roseGold._id],
        images: [{ url: '/featured/ring.jpg' }],
      },
      {
        title: 'Round Diamond Solitaire Ring with Multi Sculpted Gold Band',
        slug: 'round-diamond-solitaire-ring-with-multi-sculpted-gold-band',
        sku: 'NJ-RNG-009',
        category: [ringCat._id],
        subType: ringCat.subTypes[0]._id,
        price: 49000,
        salePrice: 41833.62,
        costPrice: 32000,
        stockQty: 14,
        description: 'Sculptural ribbons of high-polish 18K gold cradling a fiery round center stone.',
        metalColors: [yellowGold._id],
        images: [{ url: '/featured/ring.jpg' }],
      },
      {
        title: 'Round Diamond Solitaire Ring with Multi Band Design',
        slug: 'round-diamond-solitaire-ring-with-multi-band-design',
        sku: 'NJ-RNG-010',
        category: [ringCat._id],
        subType: ringCat.subTypes[2]._id,
        price: 50000,
        salePrice: 42738.43,
        costPrice: 33000,
        stockQty: 11,
        description: 'Contemporary crossover multi-shank band setting that creates an illusion of layered luxury.',
        metalColors: [whiteGold._id, yellowGold._id],
        images: [{ url: '/featured/ring.jpg' }],
      },
      {
        title: 'Round Diamond Solitaire Ring with Half Diamond Gold Band',
        slug: 'round-diamond-solitaire-ring-with-half-diamond-gold-band',
        sku: 'NJ-RNG-011',
        category: [ringCat._id],
        subType: ringCat.subTypes[0]._id,
        price: 58000,
        salePrice: 50556.40,
        costPrice: 38000,
        stockQty: 9,
        description: 'Half-eternity channel setting merging into an elevated cathedral solitaire basket.',
        metalColors: [yellowGold._id, roseGold._id],
        images: [{ url: '/featured/ring.jpg' }],
      },
      {
        title: 'Light Weight Fancy Cut Stone Curve Pendant Dokiya',
        slug: 'light-weight-fancy-cut-stone-curve-pendant-dokiya',
        sku: 'NJ-SLV-012',
        category: [catMap['silver-collection']._id],
        subType: catMap['silver-collection'].subTypes[1]._id,
        price: 8989,
        salePrice: 4080,
        costPrice: 2800,
        stockQty: 25,
        description: 'Handcrafted 925 sterling silver dokiya curve pendant with Austrian diamond sparkles for everyday lightweight wear.',
        metalColors: [whiteGold._id],
        images: [{ url: '/featured/necklace.jpg' }],
        productSpecifications: [
          { key: 'Silver Purity', value: '92.5 Sterling Silver' },
          { key: 'Plating', value: 'Rhodium Anti-Tarnish Finish' },
        ],
      },
      {
        title: '92.5 Sterling Silver Heritage Tennis Bracelet',
        slug: '92-5-sterling-silver-heritage-tennis-bracelet',
        sku: 'NJ-SLV-013',
        category: [catMap['silver-collection']._id],
        subType: catMap['silver-collection'].subTypes[2]._id,
        price: 6500,
        salePrice: 4529,
        costPrice: 3100,
        stockQty: 20,
        description: 'Artisanal 925 hallmarked silver bracelet with high-brilliance bezel set zirconia stones.',
        metalColors: [whiteGold._id],
        images: [{ url: '/promos/bracelet_stone.jpg' }],
      },
      {
        title: 'The Empress Heritage Diamond Choker',
        slug: 'the-empress-heritage-diamond-choker',
        sku: 'NJ-COL-014',
        category: [catMap['collection']._id, pendantCat._id],
        subType: catMap['collection'].subTypes[1]._id,
        price: 1250000,
        salePrice: 1120000,
        costPrice: 850000,
        stockQty: 2,
        description: 'Opulent bridal heritage necklace boasting 14.5 carats of certified round and marquise diamonds with emerald accents.',
        metalColors: [yellowGold._id],
        images: [
          { url: '/promos/essence_necklace.jpg' },
          { url: '/banners/hero_timeless.jpg' },
        ],
      },
    ];

    const seededProducts = await Product.insertMany(productsData);
    console.log(`✅ Seeded ${seededProducts.length} Luxury Fine Jewelry Products.`);

    // ─── 11. SEED LOOSE CERTIFIED DIAMONDS ──────────────────────────────
    console.log('💎 [11/24] Seeding Loose Certified Solitaire Diamonds...');
    const looseDiamondsData = [
      {
        sku: 'DIA-RD-101',
        title: '1.01 Carat Round Brilliant Solitaire',
        description: 'Flawless proportions, triple excellent polish and symmetry with hearts and arrows pattern.',
        price: 385000,
        rate: 381188,
        carat: 1.01,
        color: dColor._id,
        clarity: vvs1Clarity._id,
        shape: roundShape._id,
        type: natDia._id,
        image: { url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80' },
      },
      {
        sku: 'DIA-OV-152',
        title: '1.52 Carat Oval Brilliant Solitaire',
        description: 'Elongated silhouette with minimal bow-tie effect and maximum finger coverage.',
        price: 520000,
        rate: 342105,
        carat: 1.52,
        color: eColor._id,
        clarity: vs1Clarity._id,
        shape: ovalShape._id,
        type: natDia._id,
        image: { url: '/featured/ring.jpg' },
      },
      {
        sku: 'DIA-EM-205',
        title: '2.05 Carat Emerald Cut Solitaire',
        description: 'Mesmerizing hall-of-mirrors step cuts with crystal clear optical transparency.',
        price: 890000,
        rate: 434146,
        carat: 2.05,
        color: dColor._id,
        clarity: vvs1Clarity._id,
        shape: emeraldShape._id,
        type: natDia._id,
        image: { url: '/featured/ring.jpg' },
      },
      {
        sku: 'DIA-LAB-120',
        title: '1.20 Carat Lab-Grown CVD Round Solitaire',
        description: 'Eco-conscious chemically pure Type IIa diamond with zero fluorescence.',
        price: 95000,
        rate: 79166,
        carat: 1.20,
        color: eColor._id,
        clarity: vvs1Clarity._id,
        shape: roundShape._id,
        type: labDia._id,
        image: { url: '/featured/ring.jpg' },
      },
    ];
    const seededDiamonds = await Diamond.insertMany(looseDiamondsData);
    console.log(`✅ Seeded ${seededDiamonds.length} Certified Loose Diamonds.`);

    // ─── 12. SEED DIAMOND PRICING MATRICES ───────────────────────────────
    console.log('💹 [12/24] Seeding Diamond Price Matrices (Center, Side & Composite)...');
    const centerPricesData = [];
    const sidePricesData = [];
    const diamondPricesData = [];
    const diamondPricesNewData = [];

    // Seed matrix entries for common shape + color + clarity
    const shapesToPrice = [roundShape, ovalShape, emeraldShape];
    const colorsToPrice = [dColor, eColor];

    shapesToPrice.forEach((shape) => {
      colorsToPrice.forEach((col) => {
        centerPricesData.push({
          diamondTypeId: natDia._id,
          diamondShapeId: shape._id,
          diamondClarityId: vvs1Clarity._id,
          diamondColorId: col._id,
          sizeFrom: 0.50,
          sizeTo: 0.99,
          priceUSD: 1800,
          priceINR: 155000,
          updatedBy: primaryAdmin._id,
        });

        sidePricesData.push({
          diamondTypeId: natDia._id,
          diamondShapeId: shape._id,
          diamondClarityId: vvs1Clarity._id,
          diamondColorId: col._id,
          sizeFrom: 0.01,
          sizeTo: 0.05,
          priceUSD: 450,
          priceINR: 38000,
          updatedBy: primaryAdmin._id,
        });

        diamondPricesData.push({
          diamondTypeId: natDia._id,
          diamondShapeId: shape._id,
          diamondClarityId: vvs1Clarity._id,
          diamondColorId: col._id,
          sizeFrom: 0.50,
          sizeTo: 0.99,
          ppc: 155000,
          ratePerCarat: 155000,
          ratePerCaratUSD: 1800,
          updatedBy: primaryAdmin._id,
        });

        diamondPricesNewData.push({
          diamondTypeId: natDia._id,
          diamondShapeId: shape._id,
          diamondClarityId: vvs1Clarity._id,
          diamondColorId: col._id,
          centerDiamond: { priceUSD: 1800, priceINR: 155000 },
          sideDiamonds: [
            { sizeFrom: 0.01, sizeTo: 0.05, priceUSD: 450, priceINR: 38000 },
            { sizeFrom: 0.05, sizeTo: 0.10, priceUSD: 520, priceINR: 44000 },
          ],
          updatedBy: primaryAdmin._id,
        });
      });
    });

    await CenterDiamondPrice.insertMany(centerPricesData);
    await SideDiamondPrice.insertMany(sidePricesData);
    await DiamondPrice.insertMany(diamondPricesData);
    await DiamondPriceNew.insertMany(diamondPricesNewData);
    console.log(`✅ Seeded ${centerPricesData.length} Center Diamond Prices, ${sidePricesData.length} Side Prices, ${diamondPricesData.length} PPC Prices, and ${diamondPricesNewData.length} Composite Diamond Price tables.`);

    // ─── 13. SEED SETTINGS (Neirah Brand Identity & Settlement) ─────────
    console.log('⚙️ [13/24] Seeding Store Settings & Branding...');
    await Setting.create({
      companyName: 'Neirah Jewellers',
      emailAddress: 'info@neirah.in',
      mobileNumber: '+91 84600-91955',
      storeAddress: 'Sanskrut - 1 GH Road G-1, 1/2 Sector 3D plot no.1182 G-1, near Hi-Tech hospital, Gandhinagar, Gujarat',
      gstCode: '24AAAAA0000A1Z5',
      panCode: 'ABCDE1234F',
      returnPeriodDays: 15,
      returnPolicy: 'Easy 15-Day Returns & 100% Lifetime Exchange on Natural Diamonds',
      shippingPolicy: 'Complimentary Insured Express Delivery across India via BlueDart Apex Vault',
      bankName: 'HDFC BANK',
      bankAccountNumber: '50200012345678',
      ifscCode: 'HDFC0000451',
    });
    console.log('✅ Seeded Brand Identity and Settlement Settings.');

    // ─── 14. SEED FOOTER SETTINGS ───────────────────────────────────────
    console.log('🦶 [14/24] Seeding Footer Navigation & Social Links...');
    await FooterSettings.create({
      shopItems: [
        { itemType: 'Category', itemId: ringCat._id, title: 'Engagement Rings' },
        { itemType: 'Category', itemId: catMap['earrings']._id, title: 'Diamond Earrings' },
        { itemType: 'Category', itemId: pendantCat._id, title: 'Pendants & Necklaces' },
        { itemType: 'Category', itemId: bangleCat._id, title: 'Tennis Bracelets' },
        { itemType: 'Category', itemId: catMap['silver-collection']._id, title: '925 Silver Atelier' },
      ],
      socialLinks: [
        { platform: 'Instagram', url: 'https://instagram.com/neirahjewelsofficial' },
        { platform: 'Facebook', url: 'https://facebook.com/neirahjewels' },
        { platform: 'WhatsApp', url: 'https://wa.me/918460091955?text=Hi%20Neirah%20Jewels' },
        { platform: 'Pinterest', url: 'https://pinterest.com/neirahjewels' },
        { platform: 'YouTube', url: 'https://youtube.com/@neirahjewels' },
      ],
      copyright: '© 2026 Neirah Jewellers. All rights reserved. Handcrafted Luxury Fine Jewellery.',
    });
    console.log('✅ Seeded Footer Settings.');

    // ─── 15. SEED COD SEQUENCES ─────────────────────────────────────────
    console.log('💳 [15/24] Seeding Cash on Delivery Rules (Matches Screenshot 1)...');
    const codSequencesData = [
      { uptoAmount: 30000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
      { uptoAmount: 50000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
      { uptoAmount: 100000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
      { uptoAmount: 1000000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
    ];
    const seededCod = await CodSequence.insertMany(codSequencesData);
    console.log(`✅ Seeded ${seededCod.length} COD Sequence Thresholds.`);

    // ─── 16. SEED APPOINTMENTS ──────────────────────────────────────────
    console.log('📅 [16/24] Seeding Appointments (12 Pending, 2 Cancelled - Screenshot 3)...');
    const appointmentsData = [
      { fullName: 'Krushnakant Jayswal', email: 'jayswalkrushnikant4444@gmail.com', phoneNumber: '6353516141', appointmentDate: new Date('2026-09-28'), preferredTime: '06:00 PM', status: 'pending' },
      { fullName: 'Krushnakant Jayswal', email: 'jayswalkrushnikant4444@gmail.com', phoneNumber: '6353516141', appointmentDate: new Date('2026-09-26'), preferredTime: '06:00 PM', status: 'pending' },
      { fullName: 'Krushnakant Jayswal', email: 'jayswalkrushnikant4444@gmail.com', phoneNumber: '6353516141', appointmentDate: new Date('2026-09-26'), preferredTime: '06:00 PM', status: 'pending' },
      { fullName: 'Test mobile', email: 'testi@gmail.com', phoneNumber: '9848484848', appointmentDate: new Date('2026-09-24'), preferredTime: '05:00 PM', status: 'pending' },
      { fullName: 'Test Demo', email: 'testi@gmail.com', phoneNumber: '9193838388', appointmentDate: new Date('2026-09-25'), preferredTime: '05:00 PM', status: 'pending' },
      { fullName: 'Priya Sharma', email: 'priya.sharma@luxury.com', phoneNumber: '9820199881', appointmentDate: new Date('2026-09-29'), preferredTime: '02:00 PM', status: 'pending' },
      { fullName: 'Vikram Malhotra', email: 'vikram.m@gmail.com', phoneNumber: '9820299882', appointmentDate: new Date('2026-09-29'), preferredTime: '04:00 PM', status: 'pending' },
      { fullName: 'Ananya Birla', email: 'ananya.b@gmail.com', phoneNumber: '9820399883', appointmentDate: new Date('2026-09-30'), preferredTime: '11:00 AM', status: 'pending' },
      { fullName: 'Rohan Mehra', email: 'rohan.m@gmail.com', phoneNumber: '9820499884', appointmentDate: new Date('2026-09-30'), preferredTime: '01:00 PM', status: 'pending' },
      { fullName: 'Devika Singhania', email: 'devika.s@gmail.com', phoneNumber: '9820599885', appointmentDate: new Date('2026-10-01'), preferredTime: '03:00 PM', status: 'pending' },
      { fullName: 'Karan Johar', email: 'karan.j@gmail.com', phoneNumber: '9820699886', appointmentDate: new Date('2026-10-02'), preferredTime: '05:00 PM', status: 'pending' },
      { fullName: 'Ritu Kumar', email: 'ritu.k@gmail.com', phoneNumber: '9820799887', appointmentDate: new Date('2026-10-03'), preferredTime: '04:30 PM', status: 'pending' },
      // 2 Cancelled
      { fullName: 'Harsh Vardhan', email: 'harsh.v@gmail.com', phoneNumber: '9820899888', appointmentDate: new Date('2026-09-21'), preferredTime: '03:00 PM', status: 'cancelled' },
      { fullName: 'Sunita Rao', email: 'sunita.rao@gmail.com', phoneNumber: '9820999889', appointmentDate: new Date('2026-09-22'), preferredTime: '12:00 PM', status: 'cancelled' },
    ];
    const seededAppointments = await Appointment.insertMany(appointmentsData);
    console.log(`✅ Seeded ${seededAppointments.length} Appointments.`);

    // ─── 17. SEED CUSTOM INQUIRIES ──────────────────────────────────────
    console.log('✍️ [17/24] Seeding Custom Design Inquiries (3 Pending, 2 Confirmed - Screenshot 4)...');
    const customInquiriesData = [
      {
        name: 'Krushnakant Jayswal',
        email: 'jayswalkrushnikant4444@gmail.com',
        phoneNumber: '6353516141',
        stoneType: 'Natural Diamond',
        metalType: '18KT Gold',
        jewelryType: ['RING/BAND'],
        budget: 'Above ₹5,00,000+',
        comments: 'Looking for a solitaire engagement ring design with custom halo and hidden diamond bridge.',
        status: 'pending',
        createdAt: new Date('2026-09-26T14:30:00Z'),
      },
      {
        name: 'Test Mobile',
        email: 'test@gmail.com',
        phoneNumber: '9393939933',
        stoneType: 'Lab Grown Diamond',
        metalType: '9KT Gold',
        jewelryType: ['RING/BAND'],
        budget: '₹2,00,000 - ₹2,50,000',
        comments: 'Minimalist band with baguette cut diamonds.',
        status: 'pending',
        createdAt: new Date('2026-09-25T11:20:00Z'),
      },
      {
        name: 'Disha Radadiya',
        email: 'disha.sparkflows@gmail.com',
        phoneNumber: '9825032534',
        stoneType: 'Natural Diamond',
        metalType: '14KT Gold',
        jewelryType: ['BRACELETS', 'OTHER'],
        budget: '₹1,00,000 - ₹2,00,000',
        comments: 'Tennis bracelet with round brilliant diamonds in rose gold.',
        status: 'pending',
        createdAt: new Date('2026-09-24T16:45:00Z'),
      },
      {
        name: 'Aarav Singhania',
        email: 'aarav.singhania@heritage.in',
        phoneNumber: '9820011223',
        stoneType: 'Natural Diamond',
        metalType: '18KT Gold',
        jewelryType: ['NECKLACES'],
        budget: 'Above ₹5,00,000+',
        comments: 'Heritage bridal choker necklace with emerald accents.',
        status: 'confirmed',
        createdAt: new Date('2026-09-20T10:00:00Z'),
      },
      {
        name: 'Meera Shah',
        email: 'meera.shah@gmail.com',
        phoneNumber: '9819922334',
        stoneType: 'Lab Grown Diamond',
        metalType: '18KT Gold',
        jewelryType: ['EARRINGS'],
        budget: '₹2,50,000 - ₹5,00,000',
        comments: 'Chandelier diamond earrings for anniversary celebration.',
        status: 'confirmed',
        createdAt: new Date('2026-09-18T12:00:00Z'),
      },
    ];
    const seededInquiries = await CustomInquiry.insertMany(customInquiriesData);
    console.log(`✅ Seeded ${seededInquiries.length} Custom Inquiries.`);

    // ─── 18. SEED CUSTOMER REVIEWS ──────────────────────────────────────
    console.log('⭐ [18/24] Seeding Verified Customer Reviews (Screenshot 5)...');
    const reviewsData = [
      {
        clientName: 'Disha',
        rating: 5,
        status: 'approved',
        reviewDate: new Date('2026-09-24'),
        comment: 'I was looking for a budget-friendly jewellery set and this completely exceeded my expectations. The finishing is top-notch and it is the best handcrafted set I have ever bought.',
      },
      {
        clientName: 'Krushnakant Jayswal',
        rating: 5,
        status: 'approved',
        reviewDate: new Date('2026-09-22'),
        comment: 'I was looking for a budget-friendly jewellery set and this completely exceeded my expectations. The finishing is top-notch and it is the most exquisite diamond piece in my collection.',
      },
      {
        clientName: 'Ananya Deshmukh',
        rating: 5,
        status: 'approved',
        reviewDate: new Date('2026-09-19'),
        comment: 'The atelier service and private consultation were truly world-class. The sparkle on the natural diamond solitaire is unmatched.',
      },
      {
        clientName: 'Vikramaditya Rathore',
        rating: 5,
        status: 'approved',
        reviewDate: new Date('2026-09-15'),
        comment: 'Prompt delivery, insured packaging, and certified hallmarked purity. Highly recommend Neirah Jewellers for fine heritage collections.',
      },
    ];
    const seededReviews = await Review.insertMany(reviewsData);
    console.log(`✅ Seeded ${seededReviews.length} Verified Customer Reviews.`);

    // ─── 19. SEED COUPONS ───────────────────────────────────────────────
    console.log('🏷️ [19/24] Seeding Promotional Coupons...');
    const couponsData = [
      {
        couponcode: 'WELCOME10',
        description: 'Enjoy 10% discount on your first bespoke purchase.',
        discounttype: 'Percentage',
        discountvalue: 10,
        minimumorderamount: 15000,
        startdate: new Date('2026-01-01'),
        enddate: new Date('2026-12-31'),
        usagelimit: 1000,
        peruserlimit: 1,
        status: 'active',
      },
      {
        couponcode: 'ROYALTY15',
        description: 'Elite VIP client privilege 15% off.',
        discounttype: 'Percentage',
        discountvalue: 15,
        minimumorderamount: 50000,
        startdate: new Date('2026-01-01'),
        enddate: new Date('2026-12-31'),
        usagelimit: 200,
        peruserlimit: 1,
        status: 'active',
      },
      {
        couponcode: 'FESTIVE5000',
        description: 'Instant ₹5,000 festive reduction on solitaire orders.',
        discounttype: 'Fixed',
        discountvalue: 5000,
        minimumorderamount: 75000,
        startdate: new Date('2026-01-01'),
        enddate: new Date('2026-12-31'),
        usagelimit: 500,
        peruserlimit: 1,
        status: 'active',
      },
      {
        couponcode: 'NEIRAH20',
        description: 'Exclusive 20% off high jewelry bridal collections.',
        discounttype: 'Percentage',
        discountvalue: 20,
        minimumorderamount: 100000,
        startdate: new Date('2026-01-01'),
        enddate: new Date('2026-12-31'),
        usagelimit: 100,
        peruserlimit: 1,
        status: 'active',
      },
    ];
    const seededCoupons = await Coupon.insertMany(couponsData);
    console.log(`✅ Seeded ${seededCoupons.length} Active Promotional Coupons.`);

    // ─── 20. SEED INSTAGRAM POSTS ───────────────────────────────────────
    console.log('📸 [20/24] Seeding Curated Instagram Feed...');
    const instagramPostsData = [
      { url: 'https://instagram.com/p/DA_post1', isActive: true, position: '1' },
      { url: 'https://instagram.com/p/DA_post2', isActive: true, position: '2' },
      { url: 'https://instagram.com/p/DA_post3', isActive: true, position: '3' },
      { url: 'https://instagram.com/p/DA_post4', isActive: true, position: '4' },
    ];
    const seededInstagram = await InstagramPost.insertMany(instagramPostsData);
    console.log(`✅ Seeded ${seededInstagram.length} Instagram Posts.`);

    // ─── 21. SEED BEFORE/AFTER TRANSFORMATION PIECES ────────────────────
    console.log('🔄 [21/24] Seeding Custom Jewellery Before & After Showcases...');
    const beforeAfterData = [
      {
        beforeImage: { url: '/promos/essence_necklace.jpg', public_id: 'sample_before_1' },
        afterImage: { url: '/banners/hero_timeless.jpg', public_id: 'sample_after_1' },
        alt: 'Vintage Ancestral Polki redesigned into Contemporary Solitaire Choker',
        status: 'active',
        position: 1,
      },
      {
        beforeImage: { url: '/promos/bracelet_stone.jpg', public_id: 'sample_before_2' },
        afterImage: { url: '/featured/bangles.jpg', public_id: 'sample_after_2' },
        alt: 'Traditional Gold Kada transformed into Art Deco Diamond Cuff',
        status: 'active',
        position: 2,
      },
    ];
    const seededBeforeAfter = await CustJewelleryBeforAfter.insertMany(beforeAfterData);
    console.log(`✅ Seeded ${seededBeforeAfter.length} Before/After Showcases.`);

    // ─── 22. SEED VIRTUAL TRY-ON (VTO) MASTERS ──────────────────────────
    console.log('🕶️ [22/24] Seeding Virtual Try-On (VTO) Body Part Masters...');
    const vtoData = [
      { bodyPart: 'hand', status: 'active', lightImage: { url: '/featured/ring.jpg' } },
      { bodyPart: 'neck', status: 'active', lightImage: { url: '/featured/necklace.jpg' } },
      { bodyPart: 'ear', status: 'active', lightImage: { url: '/featured/earring.jpg' } },
      { bodyPart: 'wrist', status: 'active', lightImage: { url: '/featured/bangles.jpg' } },
    ];
    const seededVto = await VTOMaster.insertMany(vtoData);
    console.log(`✅ Seeded ${seededVto.length} Virtual Try-On Masters.`);

    // ─── 23. SEED SYSTEM NOTIFICATIONS ──────────────────────────────────
    console.log('🔔 [23/24] Seeding Notifications for Admin and Client Users...');
    const notificationsData = [
      {
        title: 'New Online Order #ORD-8CB4',
        message: 'Krushnakant Jayswal placed an order for Celestial Oval Solitaire Ring (₹3,45,000).',
        type: 'success',
        userId: primaryAdmin._id,
        isRead: false,
      },
      {
        title: 'New VIP Appointment Booked',
        message: 'Krushnakant Jayswal requested an in-store viewing appointment for 28 Sep at 06:00 PM.',
        type: 'info',
        userId: primaryAdmin._id,
        isRead: false,
      },
      {
        title: 'Custom Inquiry Submitted',
        message: 'Aarav Singhania submitted an inquiry for Heritage Bridal Choker.',
        type: 'info',
        userId: primaryAdmin._id,
        isRead: true,
      },
      {
        title: 'Welcome to Neirah Atelier',
        message: 'Explore handcrafted luxury fine jewellery certified with GIA & IGI laser inscriptions.',
        type: 'info',
        userId: primaryCustomer._id,
        isRead: false,
      },
    ];
    const seededNotifications = await Notification.insertMany(notificationsData);
    console.log(`✅ Seeded ${seededNotifications.length} Notifications.`);

    // ─── 24. SEED SAMPLE CART & WISHLIST ────────────────────────────────
    console.log('🛒 [24/24] Seeding Active Cart & Wishlist for Demo Client...');
    const sampleProduct1 = seededProducts[0];
    const sampleProduct2 = seededProducts[1];

    await Cart.create({
      user: primaryCustomer._id,
      items: [
        {
          product: sampleProduct1._id,
          productId: sampleProduct1._id.toString(),
          title: sampleProduct1.title,
          price: sampleProduct1.salePrice,
          originalPrice: sampleProduct1.price,
          image: sampleProduct1.images?.[0]?.url || '/featured/ring.jpg',
          category: 'Rings',
          quantity: 1,
          selectedMetal: '18K Yellow Gold',
          selectedSize: 'Ring Size 14',
        },
      ],
    });

    await Wishlist.create({
      user: primaryCustomer._id,
      items: [
        {
          product: sampleProduct2._id,
          productId: sampleProduct2._id.toString(),
          title: sampleProduct2.title,
          price: sampleProduct2.salePrice,
          originalPrice: sampleProduct2.price,
          image: sampleProduct2.images?.[0]?.url || '/featured/necklace.jpg',
          category: 'Pendant & Necklaces',
          slug: sampleProduct2.slug,
        },
      ],
    });
    console.log('✅ Seeded Client Cart and Wishlist items.');

    // ─── FINAL AUDIT & SUMMARY ──────────────────────────────────────────
    console.log('\n========================================================');
    console.log('🎉 DATABASE SEEDING COMPLETED WITH ZERO ERRORS!');
    console.log('========================================================');
    console.log('📊 COLLECTIONS SUMMARY:');
    console.log(`   • Users:                   ${seededUsers.length}`);
    console.log(`   • Categories:              ${seededCategories.length}`);
    console.log(`   • Products:                ${seededProducts.length}`);
    console.log(`   • Metal Types / Purities:  ${seededMetalTypes.length} / ${seededMetalPurities.length}`);
    console.log(`   • Metal Colors:            ${seededMetalColors.length}`);
    console.log(`   • Diamond Masters:         ${seededDiamondTypes.length} Types, ${seededDiamondShapes.length} Shapes, ${seededDiamondColors.length} Colors, ${seededDiamondClarities.length} Clarities`);
    console.log(`   • Loose Solitaires:        ${seededDiamonds.length}`);
    console.log(`   • Diamond Price Tables:    ${centerPricesData.length + sidePricesData.length + diamondPricesData.length + diamondPricesNewData.length} records`);
    console.log(`   • Banners:                 ${seededBanners.length}`);
    console.log(`   • Featured Cards:          ${seededFeatured.length}`);
    console.log(`   • Navigation Menu:         ${seededSections.length} sections / ${seededMenuItems.length} items`);
    console.log(`   • Appointments:            ${seededAppointments.length}`);
    console.log(`   • Custom Inquiries:        ${seededInquiries.length}`);
    console.log(`   • Customer Reviews:        ${seededReviews.length}`);
    console.log(`   • Coupons:                 ${seededCoupons.length}`);
    console.log(`   • COD Sequence Tiers:      ${seededCod.length}`);
    console.log(`   • Birthstones:             ${seededBirthstones.length}`);
    console.log(`   • Sizes (Category-linked): ${seededSizes.length}`);
    console.log(`   • VTO Masters:             ${seededVto.length}`);
    console.log(`   • Notifications:           ${seededNotifications.length}`);
    console.log('--------------------------------------------------------');
    console.log('🔑 Credentials Reference:');
    console.log('   👑 Super Admin: superadmin@jewels.com / Admin@123');
    console.log('   👑 Super Admin: admin@neirah.com      / Admin@123');
    console.log('   🛡️ Store Admin: aisha.admin@jewels.com / Admin@123');
    console.log('   💎 Elite Client: jayswalkrushnikant4444@gmail.com / User@123');
    console.log('   💎 Elite Client: customer101@gmail.com           / User@123');
    console.log('========================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database seeding failed with error:', error);
    process.exit(1);
  }
};

seedAll();
