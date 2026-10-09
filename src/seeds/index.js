require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── Import All Models ────────────────────────────────────────────────────────
const connectDB = require('../config/db');
const User = require('../modules/user/user.model');
const Category = require('../modules/category/category.model');
const MetalType = require('../modules/metalType/metalType.model');
const MetalColor = require('../modules/metalColor/metalColor.model');
const MetalPurity = require('../modules/metalPurity/metalPurity.model');
const DiamondType = require('../modules/diamondType/diamondType.model');
const DiamondShape = require('../modules/diamondShape/diamondShape.model');
const DiamondColor = require('../modules/diamondColor/diamondColor.model');
const DiamondClarity = require('../modules/diamondClarity/diamondClarity.model');
const DiamondCut = require('../modules/diamondCut/diamondCut.model');
const CaratWeight = require('../modules/caratWeight/caratWeight.model');
const DiamondSize = require('../modules/diamondSize/diamondSize.model');
const SieveSize = require('../modules/sieveSize/sieveSize.model');
const RingSize = require('../modules/ringSize/ringSize.model');
const Size = require('../modules/size/size.model');
const Product = require('../modules/product/product.model');
const Diamond = require('../modules/diamond/diamond.model');
const CenterDiamondPrice = require('../modules/centerDiamondPrice/centerDiamondPrice.model');
const SideDiamondPrice = require('../modules/sideDiamondPrice/sideDiamondPrice.model');
const DiamondPrice = require('../modules/diamondPrice/diamondPrice.model');
const DiamondPriceNew = require('../modules/diamondPriceNew/diamondPriceNew.model');
const Banner = require('../modules/banner/banner.model');
const Featured = require('../modules/featured/featured.model');
const Coupon = require('../modules/coupon/coupon.model');
const Setting = require('../modules/setting/setting.model');
const FooterSettings = require('../modules/footerSettings/footerSettings.model');
const Review = require('../modules/review/review.model');
const Appointment = require('../modules/appointment/appointment.model');
const CustomInquiry = require('../modules/customInquiry/customInquiry.model');
const CodSequence = require('../modules/codSequence/codSequence.model');
const MenuSection = require('../modules/menuSection/menuSection.model');
const MenuItem = require('../modules/menuItem/menuItem.model');
const Birthstone = require('../modules/birthstone/birthstone.model');
const InstagramPost = require('../modules/instagramPost/instagramPost.model');
const VTOMaster = require('../modules/vtoMaster/vtoMaster.model');
const CustJewelleryBeforAfter = require('../modules/custJewelleryBeforeAfter/custJewelleryBeforeAfter.model');
const Wishlist = require('../modules/wishlist/wishlist.model');
const Cart = require('../modules/cart/cart.model');
const Notification = require('../modules/notification/notification.model');

const seedAllData = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/jewels';
    }
    console.log(`Connecting to MongoDB: ${process.env.MONGODB_URI}...`);
    await connectDB();
    console.log('🌱 Connected to MongoDB successfully. Starting comprehensive database seed...\n');

    // ─── 0. CLEAR EXISTING COLLECTIONS ───────────────────────────────────────
    console.log('🧹 Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      MetalType.deleteMany({}),
      MetalColor.deleteMany({}),
      MetalPurity.deleteMany({}),
      DiamondType.deleteMany({}),
      DiamondShape.deleteMany({}),
      DiamondColor.deleteMany({}),
      DiamondClarity.deleteMany({}),
      DiamondCut.deleteMany({}),
      CaratWeight.deleteMany({}),
      DiamondSize.deleteMany({}),
      SieveSize.deleteMany({}),
      RingSize.deleteMany({}),
      Size.deleteMany({}),
      Product.deleteMany({}),
      Diamond.deleteMany({}),
      CenterDiamondPrice.deleteMany({}),
      SideDiamondPrice.deleteMany({}),
      DiamondPrice.deleteMany({}),
      DiamondPriceNew.deleteMany({}),
      Banner.deleteMany({}),
      Featured.deleteMany({}),
      Coupon.deleteMany({}),
      Setting.deleteMany({}),
      FooterSettings.deleteMany({}),
      Review.deleteMany({}),
      Appointment.deleteMany({}),
      CustomInquiry.deleteMany({}),
      CodSequence.deleteMany({}),
      MenuSection.deleteMany({}),
      MenuItem.deleteMany({}),
      Birthstone.deleteMany({}),
      InstagramPost.deleteMany({}),
      VTOMaster.deleteMany({}),
      CustJewelleryBeforAfter.deleteMany({}),
      Wishlist.deleteMany({}),
      Cart.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    console.log('✨ All relevant collections wiped clean.\n');

    // Drop stale index on users if it exists from older schema
    try {
      await User.collection.dropIndex('email_1');
    } catch (e) {
      // index not present, safe to continue
    }

    // ─── 1. SEED USERS ────────────────────────────────────────────────────────
    console.log('👤 Seeding Users & Customer Accounts...');
    const hashedAdminPassword = await bcrypt.hash('Admin@123', 12);
    const hashedUserPassword = await bcrypt.hash('User@123', 12);

    const userDocuments = [
      // Super Admins
      {
        profile: { firstName: 'Super', lastName: 'Admin', phone: '+91 98000 00001' },
        auth: { email: 'superadmin@jewels.com', password: hashedAdminPassword },
        role: 'super_admin',
        isActive: true,
      },
      {
        profile: { firstName: 'Super', lastName: 'Admin', phone: '+91 98000 00002' },
        auth: { email: 'admin@neirah.com', password: hashedAdminPassword },
        role: 'super_admin',
        isActive: true,
      },
      {
        profile: { firstName: 'Master', lastName: 'Admin', phone: '+91 98000 00000' },
        auth: { email: 'admin@jewels.com', password: hashedAdminPassword },
        role: 'super_admin',
        isActive: true,
      },
      // Store Admins
      {
        profile: { firstName: 'Aisha', lastName: 'Sharma', phone: '+91 98111 55443' },
        auth: { email: 'aisha.admin@jewels.com', password: hashedAdminPassword },
        role: 'admin',
        isActive: true,
      },
      {
        profile: { firstName: 'Rajesh', lastName: 'Nair', phone: '+91 98222 66778' },
        auth: { email: 'rajesh.manager@jewels.com', password: hashedAdminPassword },
        role: 'admin',
        isActive: true,
      },
      // Primary Elite Customers
      {
        profile: {
          firstName: 'Krushnakant',
          lastName: 'Jayswal',
          phone: '6353516141',
          bio: 'Connoisseur of bespoke solitaires and handcrafted jewels.',
          location: 'Ahmedabad, Gujarat',
        },
        auth: { email: 'krushnakant.jayswal@gmail.com', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 8, lifetimeValue: 185000 },
        addresses: {
          billing: {
            fullName: 'Krushnakant Jayswal',
            addressLine: 'A-402 Elegance Heights, SG Highway',
            city: 'Ahmedabad',
            state: 'Gujarat',
            pincode: '380054',
            phone: '6353516141',
          },
          shipping: {
            fullName: 'Krushnakant Jayswal',
            addressLine: 'A-402 Elegance Heights, SG Highway',
            city: 'Ahmedabad',
            state: 'Gujarat',
            pincode: '380054',
            phone: '6353516141',
          },
          saved: [
            {
              title: 'Home',
              fullName: 'Krushnakant Jayswal',
              addressLine: 'A-402 Elegance Heights, SG Highway',
              city: 'Ahmedabad',
              state: 'Gujarat',
              pincode: '380054',
              phone: '6353516141',
            },
          ],
        },
      },
      {
        profile: { firstName: 'Krushnakant', lastName: 'Jayswal', phone: '6353516141' },
        auth: { email: 'jayswalkrushnikant4444@gmail.com', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 6, lifetimeValue: 99050 },
      },
      {
        profile: { firstName: 'Disha', lastName: 'Radadiya', phone: '9825032534' },
        auth: { email: 'disharadadiya13@gmail.com', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 2, lifetimeValue: 48500 },
      },
      {
        profile: { firstName: 'Disha', lastName: 'Sparkflows', phone: '9825032534' },
        auth: { email: 'disha.sparkflows@gmail.com', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 3, lifetimeValue: 72000 },
      },
      {
        profile: { firstName: 'Priya', lastName: 'Mehta', phone: '+91 98192 87654' },
        auth: { email: 'priya.mehta@outlook.com', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 4, lifetimeValue: 125000 },
      },
      {
        profile: { firstName: 'Aarav', lastName: 'Singhania', phone: '9820011223' },
        auth: { email: 'aarav.singhania@heritage.in', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 8, lifetimeValue: 245000 },
      },
      {
        profile: { firstName: 'Meera', lastName: 'Shah', phone: '9819922334' },
        auth: { email: 'meera.shah@gmail.com', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 3, lifetimeValue: 68500 },
      },
      {
        profile: { firstName: 'Vikramaditya', lastName: 'Rathore', phone: '9821133445' },
        auth: { email: 'rathore.vikram@regal.in', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 4, lifetimeValue: 182000 },
      },
      {
        profile: { firstName: 'Ananya', lastName: 'Deshmukh', phone: '9833344556' },
        auth: { email: 'ananya.d@gmail.com', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 1, lifetimeValue: 32000 },
      },
      {
        profile: { firstName: 'Devansh', lastName: 'Kapoor', phone: '9844455667' },
        auth: { email: 'devansh.kapoor@outlook.com', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 2, lifetimeValue: 54000 },
      },
      {
        profile: { firstName: 'John', lastName: 'Doe', phone: '+1 415 555 2671' },
        auth: { email: 'user@jewels.com', password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 1, lifetimeValue: 12450 },
      },
    ];

    // Add extra luxury clients to bring total clients to 30
    const extraClients = [
      ['Keval', 'Patel', 'kevaltest@gmail.com', '6355384531'],
      ['Pooja', 'Vora', 'pooja.vora@gmail.com', '9855566778'],
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
    ];

    for (const [first, last, email, phone] of extraClients) {
      userDocuments.push({
        profile: { firstName: first, lastName: last, phone },
        auth: { email, password: hashedUserPassword },
        role: 'user',
        isActive: true,
        statistics: { ordersCount: 1, lifetimeValue: 24000 },
      });
    }

    const createdUsers = await User.insertMany(userDocuments);
    console.log(`✅ Seeded ${createdUsers.length} Users (Super Admins, Store Admins & VIP Customers)`);

    const primaryCustomer = createdUsers.find(
      (u) => u.auth.email === 'krushnakant.jayswal@gmail.com'
    ) || createdUsers[0];

    // ─── 2. SEED CATEGORIES ───────────────────────────────────────────────────
    console.log('\n💎 Seeding Categories & Subtypes...');
    const categoryData = [
      {
        name: 'Rings',
        slug: 'rings',
        type: 'category',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
            title: 'Diamond Rings',
          },
        ],
        subTypes: [
          { name: 'Solitaire Rings', code: 'SOL-RNG' },
          { name: 'Halo Rings', code: 'HALO-RNG' },
          { name: 'Three Stone Rings', code: 'THREE-RNG' },
          { name: 'Eternity Bands', code: 'ETERN-RNG' },
        ],
      },
      {
        name: 'Necklaces & Pendants',
        slug: 'necklaces',
        type: 'category',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
            title: 'Diamond Necklaces',
          },
        ],
        subTypes: [
          { name: 'Solitaire Pendants', code: 'SOL-PND' },
          { name: 'Choker Necklaces', code: 'CHOKER' },
          { name: 'Tennis Necklaces', code: 'TENNIS-NCK' },
          { name: 'Heritage Lockets', code: 'HER-LCK' },
        ],
      },
      {
        name: 'Earrings',
        slug: 'earrings',
        type: 'category',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
            title: 'Diamond Earrings',
          },
        ],
        subTypes: [
          { name: 'Stud Earrings', code: 'STUD-EAR' },
          { name: 'Drop Earrings', code: 'DROP-EAR' },
          { name: 'Huggie Hoops', code: 'HOOP-EAR' },
          { name: 'Chandeliers', code: 'CHAND-EAR' },
        ],
      },
      {
        name: 'Bangles & Bracelets',
        slug: 'bangles-bracelets',
        type: 'category',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1611591475152-478311382490?auto=format&fit=crop&w=800&q=80',
            title: 'Fine Bracelets',
          },
        ],
        subTypes: [
          { name: 'Tennis Bracelets', code: 'TENNIS-BRC' },
          { name: 'Heritage Gold Kada', code: 'KADA-BRC' },
          { name: 'Charm Bracelets', code: 'CHARM-BRC' },
          { name: 'Cuff Bangles', code: 'CUFF-BRC' },
        ],
      },
      {
        name: 'Solitaires',
        slug: 'solitaires',
        type: 'category',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
            title: 'Solitaires Collection',
          },
        ],
        subTypes: [
          { name: 'Round Solitaires', code: 'RND-SOL' },
          { name: 'Oval Solitaires', code: 'OVL-SOL' },
          { name: 'Emerald Cut Solitaires', code: 'EMR-SOL' },
        ],
      },
      {
        name: 'Royal Heritage',
        slug: 'royal-heritage',
        type: 'collection',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80',
            title: 'Royal Heritage Collection',
          },
        ],
        subTypes: [
          { name: 'Polki Sets', code: 'POLKI-SET' },
          { name: 'Kundan Chokers', code: 'KUND-CHK' },
          { name: 'Bridal Ensembles', code: 'BRD-ENS' },
        ],
      },
    ];

    const createdCategories = await Category.insertMany(categoryData);
    console.log(`✅ Seeded ${createdCategories.length} Categories`);

    const catMap = {};
    createdCategories.forEach((c) => {
      catMap[c.slug] = c;
    });

    // ─── 3. SEED METALS & PURITIES ────────────────────────────────────────────
    console.log('\n⚜️ Seeding Metals, Colors & Purities...');
    const metalTypes = await MetalType.insertMany([
      { name: '18KT Yellow Gold', karat: 18, metalColor: 'Yellow Gold' },
      { name: '18KT White Gold', karat: 18, metalColor: 'White Gold' },
      { name: '18KT Rose Gold', karat: 18, metalColor: 'Rose Gold' },
      { name: '14KT Yellow Gold', karat: 14, metalColor: 'Yellow Gold' },
      { name: '14KT White Gold', karat: 14, metalColor: 'White Gold' },
      { name: '14KT Rose Gold', karat: 14, metalColor: 'Rose Gold' },
      { name: 'Platinum 950', karat: 950, metalColor: 'Platinum' },
      { name: 'Sterling Silver 925', karat: 925, metalColor: 'Silver' },
    ]);

    const metalColors = await MetalColor.insertMany([
      { name: 'Yellow Gold', colorCode: '#E6CA65', colorCodeEnd: '#D4AF37' },
      { name: 'White Gold', colorCode: '#E5E5E5', colorCodeEnd: '#C0C0C0' },
      { name: 'Rose Gold', colorCode: '#E8A598', colorCodeEnd: '#D48175' },
      { name: 'Platinum', colorCode: '#E5E4E2', colorCodeEnd: '#CECECE' },
      { name: 'Dual Tone', colorCode: '#E6CA65', colorCodeEnd: '#E5E5E5' },
    ]);

    const metalPurities = await MetalPurity.insertMany([
      { name: '18KT Gold', metalType: 'Gold', karat: 18 },
      { name: '14KT Gold', metalType: 'Gold', karat: 14 },
      { name: '22KT Gold', metalType: 'Gold', karat: 22 },
      { name: '9KT Gold', metalType: 'Gold', karat: 9 },
      { name: '950 Platinum', metalType: 'Platinum', karat: 950 },
      { name: '925 Silver', metalType: 'Silver', karat: 925 },
    ]);
    console.log(`✅ Seeded ${metalTypes.length} Metal Types, ${metalColors.length} Colors, ${metalPurities.length} Purities`);

    // ─── 4. SEED DIAMOND ATTRIBUTES ───────────────────────────────────────────
    console.log('\n✨ Seeding Diamond Attributes (Types, Shapes, Colors, Clarities, Cuts, Weights)...');
    const diamondTypes = await DiamondType.insertMany([
      { name: 'Natural Diamond' },
      { name: 'Lab Grown Diamond' },
    ]);

    const diamondShapes = await DiamondShape.insertMany([
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
    ]);

    const diamondColors = await DiamondColor.insertMany([
      { name: 'D' },
      { name: 'E' },
      { name: 'F' },
      { name: 'G' },
      { name: 'H' },
      { name: 'I' },
      { name: 'J' },
    ]);

    const diamondClarities = await DiamondClarity.insertMany([
      { name: 'FL' },
      { name: 'IF' },
      { name: 'VVS1' },
      { name: 'VVS2' },
      { name: 'VS1' },
      { name: 'VS2' },
      { name: 'SI1' },
      { name: 'SI2' },
    ]);

    const diamondCuts = await DiamondCut.insertMany([
      { name: 'Ideal' },
      { name: 'Excellent' },
      { name: 'Very Good' },
      { name: 'Good' },
    ]);

    const caratWeights = await CaratWeight.insertMany([
      { name: '0.50 ct', weight: 0.5, order: 1 },
      { name: '0.75 ct', weight: 0.75, order: 2 },
      { name: '1.00 ct', weight: 1.0, order: 3 },
      { name: '1.50 ct', weight: 1.5, order: 4 },
      { name: '2.00 ct', weight: 2.0, order: 5 },
      { name: '2.50 ct', weight: 2.5, order: 6 },
      { name: '3.00 ct', weight: 3.0, order: 7 },
      { name: '4.00 ct', weight: 4.0, order: 8 },
      { name: '5.00 ct', weight: 5.0, order: 9 },
    ]);

    const diamondSizes = await DiamondSize.insertMany([
      { name: '0.80 - 1.00 mm (0.005 - 0.01 ct)', sizeFrom: 0.005, sizeTo: 0.01 },
      { name: '1.10 - 1.50 mm (0.01 - 0.02 ct)', sizeFrom: 0.01, sizeTo: 0.02 },
      { name: '1.60 - 2.00 mm (0.02 - 0.05 ct)', sizeFrom: 0.02, sizeTo: 0.05 },
      { name: '2.10 - 2.50 mm (0.05 - 0.10 ct)', sizeFrom: 0.05, sizeTo: 0.1 },
      { name: '2.60 - 3.20 mm (0.10 - 0.25 ct)', sizeFrom: 0.1, sizeTo: 0.25 },
      { name: '3.30 - 4.20 mm (0.25 - 0.50 ct)', sizeFrom: 0.25, sizeTo: 0.5 },
    ]);

    const sieveSizes = await SieveSize.insertMany([
      { name: '-2' },
      { name: '+2-6.5' },
      { name: '+6.5-11' },
      { name: '+11' },
    ]);
    console.log(
      `✅ Seeded Diamond Attributes: ${diamondTypes.length} Types, ${diamondShapes.length} Shapes, ${diamondColors.length} Colors, ${diamondClarities.length} Clarities, ${diamondCuts.length} Cuts, ${caratWeights.length} Carat Weights`
    );

    // ─── 5. SEED RING SIZES & GENERAL SIZES ───────────────────────────────────
    console.log('\n📏 Seeding Ring Sizes & Catalog Sizes...');
    const ringSizes = await RingSize.insertMany([
      { name: '6' },
      { name: '7' },
      { name: '8' },
      { name: '9' },
      { name: '10' },
      { name: '11' },
      { name: '12' },
      { name: '13' },
      { name: '14' },
      { name: '15' },
      { name: '16' },
      { name: '17' },
      { name: '18' },
      { name: '19' },
      { name: '20' },
    ]);

    const braceletCat = catMap['bangles-bracelets'];
    const necklaceCat = catMap['necklaces'];

    const sizes = await Size.insertMany([
      { name: '6.0 inches (Small)', category: braceletCat._id },
      { name: '6.5 inches (Standard)', category: braceletCat._id },
      { name: '7.0 inches (Medium)', category: braceletCat._id },
      { name: '7.5 inches (Large)', category: braceletCat._id },
      { name: '16 inches (Choker Length)', category: necklaceCat._id },
      { name: '18 inches (Princess Length)', category: necklaceCat._id },
      { name: '20 inches (Matinee Length)', category: necklaceCat._id },
      { name: '24 inches (Opera Length)', category: necklaceCat._id },
    ]);
    console.log(`✅ Seeded ${ringSizes.length} Ring Sizes, ${sizes.length} Sized Options`);

    // ─── 6. SEED FEATURED SECTIONS ───────────────────────────────────────────
    console.log('\n🌟 Seeding Featured Sections (Celebrate & Gifts)...');
    const featuredItems = await Featured.insertMany([
      {
        name: 'Necklace',
        placement: 'Celebrate',
        image: {
          url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
        },
        order: 1,
        position: 'top',
      },
      {
        name: 'Bangles & Bracelets',
        placement: 'Celebrate',
        image: {
          url: 'https://images.unsplash.com/photo-1611591475152-478311382490?auto=format&fit=crop&w=800&q=80',
        },
        order: 2,
        position: 'center',
      },
      {
        name: 'Earring',
        placement: 'Celebrate',
        image: {
          url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
        },
        order: 3,
        position: 'center',
      },
      {
        name: 'Ring',
        placement: 'Celebrate',
        image: {
          url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
        },
        order: 4,
        position: 'bottom',
      },
      {
        name: 'Rings for Loved Ones',
        placement: 'Gifts',
        image: {
          url: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=800&q=80',
        },
        order: 1,
        position: 'left',
      },
      {
        name: 'Pendant & Necklaces Gift Set',
        placement: 'Gifts',
        image: {
          url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80',
        },
        order: 2,
        position: 'center',
      },
      {
        name: 'Earrings Sparkle Box',
        placement: 'Gifts',
        image: {
          url: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=800&q=80',
        },
        order: 3,
        position: 'right',
      },
      {
        name: 'Heritage Solitaire Box',
        placement: 'Gifts',
        image: {
          url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
        },
        order: 4,
        position: 'right-tall',
      },
    ]);
    console.log(`✅ Seeded ${featuredItems.length} Featured Categories (Celebrate & Gifts)`);

    // ─── 7. SEED BANNERS ──────────────────────────────────────────────────────
    console.log('\n🎨 Seeding Hero & Collection Banners...');
    const banners = await Banner.insertMany([
      {
        category: catMap['necklaces']._id,
        title: 'TIMELESS BEAUTY,',
        subtitle: 'Forever You',
        link: '/shop?category=necklaces',
        image: {
          url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1600&q=85',
        },
        mediaType: 'image',
        type: 'herobanner',
        order: 1,
        position: 'hero-1',
      },
      {
        category: catMap['solitaires']._id,
        title: 'ETERNAL RADIANCE,',
        subtitle: 'The Solitaire Edition',
        link: '/shop?category=solitaires',
        image: {
          url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1600&q=85',
        },
        mediaType: 'image',
        type: 'herobanner',
        order: 2,
        position: 'hero-2',
      },
      {
        category: catMap['necklaces']._id,
        title: 'The Essence Collection',
        subtitle: 'An ode to modern symmetry and quiet luxury.',
        link: '/shop?category=necklaces',
        image: {
          url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80',
        },
        type: 'collectionbanner',
        position: 'top-left',
        order: 1,
      },
      {
        category: catMap['bangles-bracelets']._id,
        title: 'A bracelet made distinctly yours.',
        subtitle: 'Articulated links set with round brilliant diamonds.',
        link: '/shop?category=bangles-bracelets',
        image: {
          url: 'https://images.unsplash.com/photo-1611591475152-478311382490?auto=format&fit=crop&w=800&q=80',
        },
        type: 'collectionbanner',
        position: 'top-center',
        order: 2,
      },
      {
        category: catMap['rings']._id,
        title: 'Made to Shine. Made to Last.',
        subtitle: 'Discover timeless diamond rings crafted with elegance and brilliance.',
        link: '/shop?category=rings',
        image: {
          url: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=800&q=80',
        },
        type: 'collectionbanner',
        position: 'bottom-left',
        order: 3,
      },
      {
        category: catMap['earrings']._id,
        title: 'Beauty. With Intention',
        subtitle: 'Every facet is chosen to express something extraordinary.',
        link: '/shop?category=earrings',
        image: {
          url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
        },
        type: 'collectionbanner',
        position: 'right-tall',
        order: 4,
      },
    ]);
    console.log(`✅ Seeded ${banners.length} Banners`);

    // ─── 8. SEED LUXURY PRODUCTS ─────────────────────────────────────────────
    console.log('\n💍 Seeding High Jewelry Products & Catalog...');
    const yellowGold = metalColors.find((m) => m.name === 'Yellow Gold') || metalColors[0];
    const whiteGold = metalColors.find((m) => m.name === 'White Gold') || metalColors[1];
    const roseGold = metalColors.find((m) => m.name === 'Rose Gold') || metalColors[2];
    const platinumColor = metalColors.find((m) => m.name === 'Platinum') || metalColors[3];

    const purity18k = metalPurities.find((p) => p.name === '18KT Gold') || metalPurities[0];
    const purity14k = metalPurities.find((p) => p.name === '14KT Gold') || metalPurities[1];
    const purityPlat = metalPurities.find((p) => p.name === '950 Platinum') || metalPurities[4];

    const naturalDia = diamondTypes.find((d) => d.name === 'Natural Diamond') || diamondTypes[0];
    const labDia = diamondTypes.find((d) => d.name === 'Lab Grown Diamond') || diamondTypes[1];

    const roundShape = diamondShapes.find((s) => s.name === 'Round Brilliant') || diamondShapes[0];
    const ovalShape = diamondShapes.find((s) => s.name === 'Oval') || diamondShapes[1];
    const emeraldShape = diamondShapes.find((s) => s.name === 'Emerald') || diamondShapes[2];
    const cushionShape = diamondShapes.find((s) => s.name === 'Cushion') || diamondShapes[4];
    const pearShape = diamondShapes.find((s) => s.name === 'Pear') || diamondShapes[5];

    const colorE = diamondColors.find((c) => c.name === 'E') || diamondColors[1];
    const colorF = diamondColors.find((c) => c.name === 'F') || diamondColors[2];
    const colorG = diamondColors.find((c) => c.name === 'G') || diamondColors[3];

    const clarityVVS1 = diamondClarities.find((c) => c.name === 'VVS1') || diamondClarities[2];
    const clarityVS1 = diamondClarities.find((c) => c.name === 'VS1') || diamondClarities[4];

    const productsData = [
      {
        title: 'Celestial Oval Solitaire Ring',
        sku: 'NJ-RNG-001',
        description:
          'An exceptional 1.50 carat oval brilliant diamond nestled in a delicate micro-pavé band of 18K yellow gold. Designed for eternal elegance with laser-engraved IGI certification.',
        productType: 'jewelry',
        price: 92000,
        salePrice: 79644.18,
        displayPrice: 79644.18,
        costPrice: 52000,
        markupPercentage: 53.16,
        stockQty: 5,
        category: [catMap['rings']._id, catMap['solitaires']._id],
        metalColors: [yellowGold._id, whiteGold._id, roseGold._id, platinumColor._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
          {
            url: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        colorImages: [
          {
            metalColor: yellowGold._id,
            images: [
              {
                url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
                mediaType: 'image',
              },
            ],
            vtoCategory: 'hand',
          },
          {
            metalColor: whiteGold._id,
            images: [
              {
                url: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=800&q=80',
                mediaType: 'image',
              },
            ],
            vtoCategory: 'hand',
          },
        ],
        variants: [
          {
            combination: '18KT Gold - Natural Diamond - Oval',
            sku: 'NJ-RNG-001-YG18',
            price: 79644.18,
            stock: 3,
            metalPurity: purity18k._id,
            diamondType: naturalDia._id,
            diamondShape: ovalShape._id,
            metalWeight: 3.4,
            labourCharge: 4200,
            diamondClarity: clarityVVS1._id,
            diamondColor: colorE._id,
            caratWeight: 1.5,
          },
        ],
        productSpecifications: [
          { key: 'Center Diamond Carat', value: '1.50 ct (Oval Cut)' },
          { key: 'Clarity & Color', value: 'VVS1 Clarity, E Colorless' },
          { key: 'Band Metal', value: '18K Yellow Gold with 0.22ct pavé diamonds' },
          { key: 'Certification', value: 'IGI & GIA Certified with laser inscription' },
        ],
        descriptionSections: [
          {
            header: 'The Craftsmanship',
            description:
              'Forged in pure 18K gold and set by master stone-setters in Mumbai. Every facet is aligned to maximize light return and scintillating fire.',
          },
          {
            header: 'Certification & Hallmarking',
            description: 'BIS 750 Hallmarked gold and GIA diamond grading report accompany every purchase.',
          },
        ],
      },
      {
        title: 'Verdant Empress Emerald Pendant',
        sku: 'NJ-NCK-001',
        description:
          'A captivating 2.8-carat Colombian emerald encircled by a halo of brilliant round-cut diamonds, suspended from an adjustable platinum wheat chain.',
        productType: 'jewelry',
        price: 135000,
        salePrice: 118500,
        displayPrice: 118500,
        costPrice: 82000,
        stockQty: 3,
        category: [catMap['necklaces']._id],
        metalColors: [platinumColor._id, yellowGold._id, whiteGold._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        variants: [
          {
            combination: '950 Platinum - Natural Diamond - Emerald',
            sku: 'NJ-NCK-001-PL950',
            price: 118500,
            stock: 3,
            metalPurity: purityPlat._id,
            diamondType: naturalDia._id,
            diamondShape: emeraldShape._id,
            metalWeight: 5.8,
            caratWeight: 2.8,
          },
        ],
        productSpecifications: [
          { key: 'Center Stone', value: '2.80 ct Natural Colombian Emerald' },
          { key: 'Diamond Halo', value: '0.65 ct F/VS Round Diamonds' },
          { key: 'Chain', value: '18-inch Platinum Wheat Chain included' },
          { key: 'Heritage Report', value: 'SSEF Gemstone Heritage Report' },
        ],
      },
      {
        title: 'Midnight Royal Sapphire Earrings',
        sku: 'NJ-EAR-001',
        description:
          'Deep royal blue Ceylon sapphires cascading beneath bezel-set pear-shaped diamonds in an articulated 18K white gold drop setting.',
        productType: 'jewelry',
        price: 68000,
        salePrice: 59400,
        displayPrice: 59400,
        costPrice: 38000,
        stockQty: 4,
        category: [catMap['earrings']._id],
        metalColors: [whiteGold._id, platinumColor._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        productSpecifications: [
          { key: 'Total Sapphire Weight', value: '3.40 ctw' },
          { key: 'Diamonds', value: '0.45 ctw D-F Colorless Diamonds' },
          { key: 'Closure', value: 'Secure French Lever-back' },
          { key: 'Purity', value: '18K White Gold (750 Hallmarked)' },
        ],
      },
      {
        title: 'Starlight Diamond Tennis Bracelet',
        sku: 'NJ-BRC-001',
        description:
          'A timeless continuous circle of sixty-two perfectly matched round brilliant diamonds in four-prong platinum settings with a double safety security clasp.',
        productType: 'jewelry',
        price: 185000,
        salePrice: 162000,
        displayPrice: 162000,
        costPrice: 110000,
        stockQty: 2,
        category: [catMap['bangles-bracelets']._id],
        metalColors: [platinumColor._id, yellowGold._id, whiteGold._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1611591475152-478311382490?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        productSpecifications: [
          { key: 'Total Diamond Weight', value: '5.00 ctw' },
          { key: 'Clarity & Color', value: 'VS+ Clarity, F-G Color' },
          { key: 'Length', value: 'Standard 7-inch (Complimentary Resizing)' },
          { key: 'Dossier', value: 'GIA Diamond Dossier & BIS Hallmark' },
        ],
      },
      {
        title: 'Aura Vintage Diamond Band',
        sku: 'NJ-RNG-002',
        description:
          'Inspired by 1920s Parisian Art Deco architecture, alternating baguette and round diamonds bordered with intricate milgrain detailing in 18K rose gold.',
        productType: 'jewelry',
        price: 54000,
        salePrice: 46800,
        displayPrice: 46800,
        costPrice: 31000,
        stockQty: 6,
        category: [catMap['rings']._id],
        metalColors: [roseGold._id, yellowGold._id, whiteGold._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        productSpecifications: [
          { key: 'Diamond Weight', value: '0.85 ctw Baguette & Round' },
          { key: 'Clarity & Color', value: 'VVS2 Clarity, F Color' },
          { key: 'Metal', value: '18K Rose Gold' },
          { key: 'Origin', value: 'Handcrafted in Atelier Neirah' },
        ],
      },
      {
        title: 'South Sea Baroque Pearl Choker',
        sku: 'NJ-NCK-002',
        description:
          'A lustrous 14mm Australian South Sea baroque cultured pearl suspended on a hand-woven 18K yellow gold herringbone chain with lobster clasp.',
        productType: 'jewelry',
        price: 49000,
        salePrice: 42500,
        displayPrice: 42500,
        costPrice: 27000,
        stockQty: 4,
        category: [catMap['necklaces']._id],
        metalColors: [yellowGold._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        productSpecifications: [
          { key: 'Pearl Grade', value: 'AAA High Luster South Sea' },
          { key: 'Pearl Diameter', value: '14.2 mm' },
          { key: 'Chain Length', value: '16-inch Solid 18K Gold' },
          { key: 'Origin', value: 'Broome, Western Australia' },
        ],
      },
      {
        title: 'Empress Cushion Halo Diamond Ring',
        sku: 'NJ-RNG-003',
        description:
          'A magnificent 2.0-carat cushion-cut lab diamond surrounded by a micro-pavé halo on an 18K white gold cathedral band.',
        productType: 'jewelry',
        price: 110000,
        salePrice: 94500,
        displayPrice: 94500,
        costPrice: 62000,
        stockQty: 3,
        category: [catMap['rings']._id, catMap['solitaires']._id],
        metalColors: [whiteGold._id, yellowGold._id, platinumColor._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        productSpecifications: [
          { key: 'Center Stone', value: '2.00 ct Cushion Cut Lab Diamond' },
          { key: 'Clarity & Color', value: 'VVS1, E Colorless' },
          { key: 'Setting Style', value: 'Four-prong Cathedral Halo' },
        ],
      },
      {
        title: 'Constellation Diamond Stud Earrings',
        sku: 'NJ-EAR-002',
        description:
          'Classic round brilliant matching diamond studs set in three-prong martini settings in 18K yellow gold with screw backs.',
        productType: 'jewelry',
        price: 65000,
        salePrice: 56000,
        displayPrice: 56000,
        costPrice: 37000,
        stockQty: 8,
        category: [catMap['earrings']._id, catMap['solitaires']._id],
        metalColors: [yellowGold._id, whiteGold._id, platinumColor._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        productSpecifications: [
          { key: 'Total Carat Weight', value: '1.20 ctw (0.60 ct each)' },
          { key: 'Color & Clarity', value: 'F Color, VS1 Clarity' },
          { key: 'Backing', value: 'Secure Threaded Screw-back' },
        ],
      },
      {
        title: 'Imperial Handcrafted Heritage Gold Kada',
        sku: 'NJ-BRC-002',
        description:
          'Intricate 22KT antique finish gold kada adorned with uncut syndicate diamonds and fine meenakari work along the inner rim.',
        productType: 'jewelry',
        price: 215000,
        salePrice: 195000,
        displayPrice: 195000,
        costPrice: 160000,
        stockQty: 2,
        category: [catMap['bangles-bracelets']._id, catMap['royal-heritage']._id],
        metalColors: [yellowGold._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1596944924616-7b38e7cfac36?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        productSpecifications: [
          { key: 'Gold Purity', value: '22KT Solid Gold (916 Hallmarked)' },
          { key: 'Gross Weight', value: '38.5 grams' },
          { key: 'Craftsmanship', value: 'Jaipuri Hand Meenakari & Jadau' },
        ],
      },
      {
        title: 'Royal Sovereign Solitaire Diamond Ring 2.50ct',
        sku: 'NJ-SOL-001',
        description:
          'A majestic 2.50 ct round brilliant natural diamond in a platinum six-prong knife-edge solitaire setting. A masterpiece of ultimate sparkle.',
        productType: 'jewelry',
        price: 495000,
        salePrice: 445000,
        displayPrice: 445000,
        costPrice: 340000,
        stockQty: 1,
        category: [catMap['rings']._id, catMap['solitaires']._id],
        metalColors: [platinumColor._id, yellowGold._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        productSpecifications: [
          { key: 'Carat Weight', value: '2.50 ct Natural Diamond' },
          { key: 'Cut & Symmetry', value: 'Triple Excellent (3EX)' },
          { key: 'GIA Report Number', value: '2227189041' },
          { key: 'Color & Clarity', value: 'D Flawless/VVS1' },
        ],
      },
      {
        title: 'Regal Polki & Uncut Diamond Choker Set',
        sku: 'NJ-BRD-001',
        description:
          'Bridal choker set hand-set with syndicate polki diamonds, Zambian emerald beads, and natural Basra pearl drops in 22K hallmarked gold.',
        productType: 'jewelry',
        price: 580000,
        salePrice: 520000,
        displayPrice: 520000,
        costPrice: 390000,
        stockQty: 1,
        category: [catMap['necklaces']._id, catMap['royal-heritage']._id],
        metalColors: [yellowGold._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1598560917505-59a3ad559071?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        productSpecifications: [
          { key: 'Gold Purity', value: '22KT Yellow Gold (916 BIS)' },
          { key: 'Polki Weight', value: '18.40 ct Uncut Syndicate Polki' },
          { key: 'Gemstones', value: 'Natural Zambian Emeralds & Basra Pearls' },
        ],
      },
      {
        title: 'Seraphina Pear Diamond Drop Pendant',
        sku: 'NJ-NCK-004',
        description:
          'A glowing 1.10 ct pear brilliant solitaire suspended beneath a micro-bezel diamond accent, crafted in glowing 18K rose gold.',
        productType: 'jewelry',
        price: 78000,
        salePrice: 68500,
        displayPrice: 68500,
        costPrice: 45000,
        stockQty: 4,
        category: [catMap['necklaces']._id, catMap['solitaires']._id],
        metalColors: [roseGold._id, yellowGold._id, whiteGold._id],
        stockStatus: 'In Stock',
        status: 'active',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
            mediaType: 'image',
          },
        ],
        productSpecifications: [
          { key: 'Diamond Carat', value: '1.10 ct Pear Cut' },
          { key: 'Color & Clarity', value: 'E Color, VVS2' },
          { key: 'Chain Length', value: 'Adjustable 16-18 inches 18K Rose Gold' },
        ],
      },
    ];

    const createdProducts = await Product.insertMany(productsData);
    console.log(`✅ Seeded ${createdProducts.length} High Jewelry Products`);

    // ─── 9. SEED CERTIFIED SOLITAIRE DIAMONDS ─────────────────────────────────
    console.log('\n💎 Seeding Certified Solitaire Diamonds (Loose Inventory)...');
    const certifiedDiamonds = await Diamond.insertMany([
      {
        sku: 'DIA-RND-101',
        title: '1.02 ct Round Brilliant Natural Diamond',
        description: 'GIA Certified 3EX Triple Excellent cut, laser-inscribed, completely eye-clean.',
        price: 485000,
        rate: 475490,
        carat: 1.02,
        color: diamondColors.find((c) => c.name === 'D')._id,
        clarity: diamondClarities.find((c) => c.name === 'VVS1')._id,
        shape: roundShape._id,
        type: naturalDia._id,
        image: {
          url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
        },
        status: 'active',
      },
      {
        sku: 'DIA-OVL-202',
        title: '1.51 ct Oval Brilliant Natural Diamond',
        description: 'Rare E color oval diamond with elongated ratio 1.45, exceptional fire and brightness.',
        price: 675000,
        rate: 447020,
        carat: 1.51,
        color: diamondColors.find((c) => c.name === 'E')._id,
        clarity: diamondClarities.find((c) => c.name === 'VVS2')._id,
        shape: ovalShape._id,
        type: naturalDia._id,
        image: {
          url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
        },
        status: 'active',
      },
      {
        sku: 'DIA-EMR-303',
        title: '2.05 ct Emerald Cut Lab Grown Diamond',
        description: 'Flawless step-cut mirror clarity, CVD type IIa premium ethical diamond with IGI certificate.',
        price: 210000,
        rate: 102439,
        carat: 2.05,
        color: diamondColors.find((c) => c.name === 'F')._id,
        clarity: diamondClarities.find((c) => c.name === 'VS1')._id,
        shape: emeraldShape._id,
        type: labDia._id,
        image: {
          url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
        },
        status: 'active',
      },
      {
        sku: 'DIA-CSH-404',
        title: '1.25 ct Cushion Cut Lab Grown Diamond',
        description: 'Modified brilliant cushion cut with brilliant corners, maximum scintillation.',
        price: 145000,
        rate: 116000,
        carat: 1.25,
        color: diamondColors.find((c) => c.name === 'G')._id,
        clarity: diamondClarities.find((c) => c.name === 'VS2')._id,
        shape: cushionShape._id,
        type: labDia._id,
        image: {
          url: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=800&q=80',
        },
        status: 'active',
      },
      {
        sku: 'DIA-PRN-505',
        title: '0.95 ct Princess Cut Natural Diamond',
        description: 'Internally Flawless sharp corner princess cut solitaire, museum-grade purity.',
        price: 420000,
        rate: 442105,
        carat: 0.95,
        color: diamondColors.find((c) => c.name === 'D')._id,
        clarity: diamondClarities.find((c) => c.name === 'IF')._id,
        shape: diamondShapes.find((s) => s.name === 'Princess')._id,
        type: naturalDia._id,
        image: {
          url: 'https://images.unsplash.com/photo-1600003014755-ba31aa59c4b6?auto=format&fit=crop&w=800&q=80',
        },
        status: 'active',
      },
    ]);
    console.log(`✅ Seeded ${certifiedDiamonds.length} Certified Solitaire Diamonds`);

    // ─── 10. SEED DIAMOND PRICING BENCHMARKS ──────────────────────────────────
    console.log('\n📊 Seeding Diamond Price Matrices...');
    const centerPrices = [];
    const sidePrices = [];

    // Combinations for primary shapes, natural vs lab
    const testShapes = [roundShape, ovalShape, emeraldShape];
    const testClarities = [clarityVVS1, clarityVS1];
    const testColors = [colorE, colorF];

    for (const shape of testShapes) {
      for (const clar of testClarities) {
        for (const col of testColors) {
          centerPrices.push({
            diamondTypeId: naturalDia._id,
            diamondShapeId: shape._id,
            diamondClarityId: clar._id,
            diamondColorId: col._id,
            sizeFrom: 1.0,
            sizeTo: 1.99,
            priceUSD: 4500,
            priceINR: 375000,
            updatedBy: primaryCustomer._id,
          });

          centerPrices.push({
            diamondTypeId: labDia._id,
            diamondShapeId: shape._id,
            diamondClarityId: clar._id,
            diamondColorId: col._id,
            sizeFrom: 1.0,
            sizeTo: 1.99,
            priceUSD: 1200,
            priceINR: 98000,
            updatedBy: primaryCustomer._id,
          });

          sidePrices.push({
            diamondTypeId: naturalDia._id,
            diamondShapeId: shape._id,
            diamondClarityId: clar._id,
            diamondColorId: col._id,
            sizeFrom: 0.01,
            sizeTo: 0.05,
            priceUSD: 650,
            priceINR: 54000,
            updatedBy: primaryCustomer._id,
          });
        }
      }
    }

    await CenterDiamondPrice.insertMany(centerPrices);
    await SideDiamondPrice.insertMany(sidePrices);

    const diamondPriceDocs = [];
    const diamondPriceNewDocs = [];
    for (const shape of testShapes) {
      for (const clar of testClarities) {
        for (const col of testColors) {
          diamondPriceDocs.push({
            diamondTypeId: naturalDia._id,
            diamondShapeId: shape._id,
            diamondClarityId: clar._id,
            diamondColorId: col._id,
            sizeFrom: 1.0,
            sizeTo: 1.99,
            ppc: 4500,
            ratePerCarat: 375000,
            ratePerCaratUSD: 4500,
            updatedBy: primaryCustomer._id,
          });
          diamondPriceDocs.push({
            diamondTypeId: labDia._id,
            diamondShapeId: shape._id,
            diamondClarityId: clar._id,
            diamondColorId: col._id,
            sizeFrom: 1.0,
            sizeTo: 1.99,
            ppc: 1200,
            ratePerCarat: 98000,
            ratePerCaratUSD: 1200,
            updatedBy: primaryCustomer._id,
          });

          diamondPriceNewDocs.push({
            diamondTypeId: naturalDia._id,
            diamondShapeId: shape._id,
            diamondClarityId: clar._id,
            diamondColorId: col._id,
            centerDiamond: { priceUSD: 4500, priceINR: 375000 },
            sideDiamonds: [
              { sizeFrom: 0.01, sizeTo: 0.05, priceUSD: 650, priceINR: 54000 },
              { sizeFrom: 0.05, sizeTo: 0.1, priceUSD: 850, priceINR: 71000 },
            ],
            updatedBy: primaryCustomer._id,
          });
          diamondPriceNewDocs.push({
            diamondTypeId: labDia._id,
            diamondShapeId: shape._id,
            diamondClarityId: clar._id,
            diamondColorId: col._id,
            centerDiamond: { priceUSD: 1200, priceINR: 98000 },
            sideDiamonds: [
              { sizeFrom: 0.01, sizeTo: 0.05, priceUSD: 250, priceINR: 20500 },
              { sizeFrom: 0.05, sizeTo: 0.1, priceUSD: 350, priceINR: 29000 },
            ],
            updatedBy: primaryCustomer._id,
          });
        }
      }
    }

    await DiamondPrice.insertMany(diamondPriceDocs);
    await DiamondPriceNew.insertMany(diamondPriceNewDocs);
    console.log(
      `✅ Seeded ${centerPrices.length} Center Prices, ${sidePrices.length} Side Prices, ${diamondPriceDocs.length} Diamond Prices, and ${diamondPriceNewDocs.length} Diamond Prices New`
    );

    // ─── 11. SEED COD SEQUENCES ───────────────────────────────────────────────
    console.log('\n💰 Seeding COD Sequences...');
    const codSequences = await CodSequence.insertMany([
      { uptoAmount: 30000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
      { uptoAmount: 50000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
      { uptoAmount: 100000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
      { uptoAmount: 1000000, chargeType: 'Percentage', chargeValue: 15, status: 'active' },
    ]);
    console.log(`✅ Seeded ${codSequences.length} COD Sequences`);

    // ─── 12. SEED COUPONS ─────────────────────────────────────────────────────
    console.log('\n🎟️ Seeding Promotional Coupons...');
    const coupons = await Coupon.insertMany([
      {
        coupon: {
          code: 'DIWALI20',
          description: 'Special festive discount',
        },
        discount: {
          type: 'Percentage',
          value: 20,
          minimumOrderAmount: 20000,
        },
        validity: {
          startDate: new Date('2026-10-01T00:00:00.000Z'),
          endDate: new Date('2026-10-31T23:59:59.999Z'),
        },
        usage: {
          usageLimit: 100,
          usedCount: 12,
          perUserLimit: 1,
        },
        status: 'active',
      },
      {
        coupon: {
          code: 'WELCOME10',
          description: 'Flat 10% welcome discount for new luxury collectors',
        },
        discount: {
          type: 'Percentage',
          value: 10,
          minimumOrderAmount: 10000,
        },
        validity: {
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T23:59:59.999Z'),
        },
        usage: {
          usageLimit: 500,
          usedCount: 24,
          perUserLimit: 1,
        },
        status: 'active',
      },
      {
        coupon: {
          code: 'FESTIVE15',
          description: 'Special 15% festive season high jewelry discount',
        },
        discount: {
          type: 'Percentage',
          value: 15,
          minimumOrderAmount: 25000,
        },
        validity: {
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2026-11-30T23:59:59.999Z'),
        },
        usage: {
          usageLimit: 250,
          usedCount: 45,
          perUserLimit: 1,
        },
        status: 'active',
      },
      {
        coupon: {
          code: 'LUXURY5000',
          description: 'Exclusive ₹5,000 off on bridal & heritage orders',
        },
        discount: {
          type: 'Fixed',
          value: 5000,
          minimumOrderAmount: 50000,
        },
        validity: {
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T23:59:59.999Z'),
        },
        usage: {
          usageLimit: 100,
          usedCount: 8,
          perUserLimit: 1,
        },
        status: 'active',
      },
      {
        coupon: {
          code: 'SOLITAIRE20',
          description: '20% privilege savings on certified loose solitaires',
        },
        discount: {
          type: 'Percentage',
          value: 20,
          minimumOrderAmount: 100000,
        },
        validity: {
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T23:59:59.999Z'),
        },
        usage: {
          usageLimit: 50,
          usedCount: 5,
          perUserLimit: 1,
        },
        status: 'active',
      },
    ]);
    console.log(`✅ Seeded ${coupons.length} Active Coupons`);

    // ─── 13. SEED SETTINGS & BUSINESS IDENTITY ────────────────────────────────
    console.log('\n🏢 Seeding Business Settings & Banking Details...');
    const settings = await Setting.create({
      companyName: 'Neirah Fine Jewels',
      emailAddress: 'info@neirah.in',
      mobileNumber: '+91 84600-91955',
      storeAddress:
        'Sanskrut - 1 GH Road G-1, 1/2 Sector 3D plot no.1182 G-1, near Hi-Tech hospital, Gandhinagar, Gujarat 382006',
      gstCode: '24AAAAA0000A1Z5',
      panCode: 'ABCDE1234F',
      returnPeriodDays: 15,
      returnPolicy:
        'Easy 15-Day Complimentary Returns & Lifetime Exchange across all certified diamond jewelry pieces.',
      shippingPolicy:
        'Complimentary 100% Insured Priority Express Shipping via BlueDart Transit across all pin codes in India.',
      bankName: 'HDFC BANK',
      bankAccountNumber: '50200088912345',
      ifscCode: 'HDFC0000451',
    });
    console.log(`✅ Seeded Store Settings for "${settings.companyName}"`);

    // ─── 14. SEED FOOTER SETTINGS ─────────────────────────────────────────────
    console.log('\n🔗 Seeding Footer Configuration...');
    const footerSettings = await FooterSettings.create({
      shopItems: createdCategories.slice(0, 4).map((c) => ({
        itemType: 'Category',
        itemId: c._id,
        title: c.name,
      })),
      socialLinks: [
        { platform: 'Instagram', url: 'https://instagram.com/neirahjewels' },
        { platform: 'Facebook', url: 'https://facebook.com/neirahjewels' },
        { platform: 'Pinterest', url: 'https://pinterest.com/neirahjewels' },
        { platform: 'WhatsApp', url: 'https://wa.me/918460091955' },
      ],
      copyright: `© ${new Date().getFullYear()} Neirah Jewellers. All rights reserved. Handcrafted with passion.`,
    });
    console.log('✅ Seeded Footer Settings & Social Links Hub');

    // ─── 15. SEED CLIENT REVIEWS ──────────────────────────────────────────────
    console.log('\n⭐ Seeding Verified Client Reviews...');
    const reviews = await Review.insertMany([
      {
        customer: {
          name: 'Krushnakant Jayswal',
          email: 'krushnakant.jayswal@gmail.com',
        },
        review: {
          title: 'Exquisite Diamond Solitaire',
          rating: 5,
          comment:
            'I was looking for a masterfully cut solitaire engagement ring and this completely exceeded my expectations. The finishing is top-notch and it is the most exquisite diamond piece in my collection.',
          reviewDate: new Date('2026-09-22T00:00:00.000Z'),
        },
        status: 'approved',
      },
      {
        customer: {
          name: 'Disha Radadiya',
          email: 'disharadadiya13@gmail.com',
        },
        review: {
          title: 'Bespoke Tennis Bracelet Perfection',
          rating: 5,
          comment:
            'The atelier service and private consultation were truly world-class. The sparkle on the natural diamond solitaire tennis bracelet is unmatched.',
          reviewDate: new Date('2026-09-24T00:00:00.000Z'),
        },
        status: 'approved',
      },
      {
        customer: {
          name: 'Ananya Deshmukh',
          email: 'ananya.d@gmail.com',
        },
        review: {
          title: 'Prompt Delivery and Luxury Packaging',
          rating: 5,
          comment:
            'Prompt delivery, insured packaging, and certified hallmarked purity. Highly recommend Neirah Jewellers for fine heritage collections.',
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
          title: 'Heritage Craftsmanship At Its Best',
          rating: 5,
          comment:
            'The antique meenakari Kada was beyond spectacular. Heirloom jewelry that our family will treasure for generations.',
          reviewDate: new Date('2026-09-15T00:00:00.000Z'),
        },
        status: 'approved',
      },
      {
        customer: {
          name: 'Priya Mehta',
          email: 'priya.mehta@outlook.com',
        },
        review: {
          title: 'Breathtaking Oval Solitaire',
          rating: 5,
          comment:
            'Ordered the Celestial Oval ring. The sparkle under natural sunlight is mesmerizing. Received so many compliments!',
          reviewDate: new Date('2026-09-10T00:00:00.000Z'),
        },
        status: 'approved',
      },
    ]);
    console.log(`✅ Seeded ${reviews.length} Verified Customer Reviews (5/5 Stars)`);

    // ─── 16. SEED APPOINTMENTS ────────────────────────────────────────────────
    console.log('\n📅 Seeding Private Consultations & Appointments...');
    const appointments = await Appointment.insertMany([
      {
        customer: {
          name: 'Krushnakant Jayswal',
          email: 'jayswalkrushnikant4444@gmail.com',
          phone: { countryCode: '91', number: '6353516141' },
        },
        appointment: {
          date: new Date('2026-10-15T00:00:00.000Z'),
          preferredTime: '06:00 PM',
        },
        status: 'pending',
        adminNotes: 'Interested in bespoke 2ct oval solitaire engagement band.',
      },
      {
        customer: {
          name: 'Priya Sharma',
          email: 'priya.sharma@luxury.com',
          phone: { countryCode: '91', number: '9820199881' },
        },
        appointment: {
          date: new Date('2026-10-16T00:00:00.000Z'),
          preferredTime: '02:00 PM',
        },
        status: 'confirmed',
        adminNotes: 'In-store private salon viewing of bridal necklaces.',
      },
      {
        customer: {
          name: 'Vikram Malhotra',
          email: 'vikram.m@gmail.com',
          phone: { countryCode: '91', number: '9820299882' },
        },
        appointment: {
          date: new Date('2026-10-18T00:00:00.000Z'),
          preferredTime: '04:00 PM',
        },
        status: 'confirmed',
        adminNotes: 'Custom wedding band sizing and consultation.',
      },
      {
        customer: {
          name: 'Ananya Birla',
          email: 'ananya.b@gmail.com',
          phone: { countryCode: '91', number: '9820399883' },
        },
        appointment: {
          date: new Date('2026-10-20T00:00:00.000Z'),
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
          date: new Date('2026-10-21T00:00:00.000Z'),
          preferredTime: '01:00 PM',
        },
        status: 'pending',
      },
      {
        customer: {
          name: 'Harsh Vardhan',
          email: 'harsh.v@gmail.com',
          phone: { countryCode: '91', number: '9820899888' },
        },
        appointment: {
          date: new Date('2026-09-21T00:00:00.000Z'),
          preferredTime: '03:00 PM',
        },
        status: 'completed',
      },
      {
        customer: {
          name: 'Sunita Rao',
          email: 'sunita.rao@gmail.com',
          phone: { countryCode: '91', number: '9820999889' },
        },
        appointment: {
          date: new Date('2026-09-22T00:00:00.000Z'),
          preferredTime: '12:00 PM',
        },
        status: 'cancelled',
      },
    ]);
    console.log(`✅ Seeded ${appointments.length} Client Appointments`);

    // ─── 17. SEED CUSTOM INQUIRIES ────────────────────────────────────────────
    console.log('\n📝 Seeding Custom Bespoke Inquiries...');
    const customInquiries = await CustomInquiry.insertMany([
      {
        customer: {
          name: 'Krushnakant Jayswal',
          email: 'jayswalkrushnikant4444@gmail.com',
          phone: { countryCode: '91', number: '6353516141' },
        },
        requirements: {
          stoneType: 'Natural Diamond',
          metalType: '18KT Gold',
          jewelryTypes: ['RING/BAND'],
          comments: 'Looking for a solitaire engagement ring design with custom halo and hidden diamond accents.',
        },
        referenceImages: [
          { url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80' },
          { url: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=600&q=80' },
        ],
        status: 'pending',
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
          jewelryTypes: ['BRACELETS'],
          comments: 'Tennis bracelet with round brilliant diamonds in rose gold setting.',
        },
        referenceImages: [
          { url: 'https://images.unsplash.com/photo-1611591475152-478311382490?auto=format&fit=crop&w=600&q=80' },
        ],
        status: 'confirmed',
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
          comments: 'Heritage bridal choker necklace with Colombian emerald accents.',
        },
        referenceImages: [
          { url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80' },
        ],
        status: 'confirmed',
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
          comments: 'Chandelier diamond earrings for 10th anniversary celebration.',
        },
        referenceImages: [
          { url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80' },
        ],
        status: 'pending',
      },
    ]);
    console.log(`✅ Seeded ${customInquiries.length} Bespoke Design Inquiries`);

    // ─── 18. SEED MEGA MENU SECTIONS & ITEMS ──────────────────────────────────
    console.log('\n🧭 Seeding Mega Menu Sections & Navigation Items...');
    const ringSection = await MenuSection.create({
      categoryId: catMap['rings']._id,
      title: 'Shop by Style',
      status: 'active',
    });

    const necklaceSection = await MenuSection.create({
      categoryId: catMap['necklaces']._id,
      title: 'Shop by Occasion',
      status: 'active',
    });

    const menuItems = await MenuItem.insertMany([
      { menuSectionId: ringSection._id, title: 'Solitaire Rings' },
      { menuSectionId: ringSection._id, title: 'Halo Engagement Rings' },
      { menuSectionId: ringSection._id, title: 'Eternity Bands' },
      { menuSectionId: necklaceSection._id, title: 'Everyday Minimalist' },
      { menuSectionId: necklaceSection._id, title: 'Bridal Grandeur' },
      { menuSectionId: necklaceSection._id, title: 'Cocktail Statement Pendants' },
    ]);
    console.log(`✅ Seeded 2 Menu Sections and ${menuItems.length} Menu Items`);

    // ─── 19. SEED BIRTHSTONES ─────────────────────────────────────────────────
    console.log('\n🔮 Seeding Birthstones Portfolio (All 12 Months)...');
    const birthstones = await Birthstone.insertMany([
      {
        month: 'January',
        stoneName: 'Garnet',
        color: '#7B1113',
        meaning: 'Symbolizes protection, strong friendship, trust, and deep loyalty.',
        image: {
          url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'February',
        stoneName: 'Amethyst',
        color: '#9966CC',
        meaning: 'Represents peace, clarity of mind, inner serenity, and temperance.',
        image: {
          url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'March',
        stoneName: 'Aquamarine',
        color: '#7FFFD4',
        meaning: 'Known for calming waters, cooling tempers, and youthful vitality.',
        image: {
          url: 'https://images.unsplash.com/photo-1611591475152-478311382490?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'April',
        stoneName: 'Diamond',
        color: '#E0F7FA',
        meaning: 'Emblem of invincibility, eternal love, pure light, and strength.',
        image: {
          url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'May',
        stoneName: 'Emerald',
        color: '#50C878',
        meaning: 'Embodies springtime rebirth, royal wisdom, flourishing prosperity, and balance.',
        image: {
          url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'June',
        stoneName: 'Pearl & Alexandrite',
        color: '#F0EAD6',
        meaning: 'Purity of soul, natural harmony, and wondrous transformative beauty.',
        image: {
          url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'July',
        stoneName: 'Ruby',
        color: '#E0115F',
        meaning: 'The king of gems; signifies passionate devotion, high vitality, and courage.',
        image: {
          url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'August',
        stoneName: 'Peridot',
        color: '#9BB838',
        meaning: 'Associated with sunshine, divine light, healing, and joyful abundance.',
        image: {
          url: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'September',
        stoneName: 'Sapphire',
        color: '#0F52BA',
        meaning: 'Celestial truth, nobility, deep intuition, and unwavering faithfulness.',
        image: {
          url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'October',
        stoneName: 'Opal & Tourmaline',
        color: '#A8C3BC',
        meaning: 'Sparks creativity, kaleidoscopic imagination, hope, and pure confidence.',
        image: {
          url: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'November',
        stoneName: 'Topaz & Citrine',
        color: '#FFD700',
        meaning: 'Warm golden glow of optimism, personal magnetism, and radiant clarity.',
        image: {
          url: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=400&q=80',
        },
      },
      {
        month: 'December',
        stoneName: 'Tanzanite & Turquoise',
        color: '#40E0D0',
        meaning: 'Spiritual awakening, peaceful triumph, protection, and boundless good fortune.',
        image: {
          url: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=400&q=80',
        },
      },
    ]);
    console.log(`✅ Seeded ${birthstones.length} Birthstones`);

    // ─── 20. SEED INSTAGRAM POSTS ─────────────────────────────────────────────
    console.log('\n📸 Seeding Instagram Posts...');
    const instagramPosts = await InstagramPost.insertMany([
      { url: 'https://www.instagram.com/p/DAXwZ_JgK1L/', position: '1', isActive: true },
      { url: 'https://www.instagram.com/p/DAXwM1NA8xY/', position: '2', isActive: true },
      { url: 'https://www.instagram.com/p/DAXv92eA7sD/', position: '3', isActive: true },
      { url: 'https://www.instagram.com/p/DAXu3PjA4tF/', position: '4', isActive: true },
    ]);
    console.log(`✅ Seeded ${instagramPosts.length} Instagram Reel Highlights`);

    // ─── 21. SEED VIRTUAL TRY-ON (VTO) MASTERS ────────────────────────────────
    console.log('\n👓 Seeding Virtual Try-On (VTO) Body Part Masters...');
    const vtoMasters = await VTOMaster.insertMany([
      {
        bodyPart: 'hand',
        lightImage: {
          url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80',
        },
        status: 'active',
      },
      {
        bodyPart: 'neck',
        lightImage: {
          url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80',
        },
        status: 'active',
      },
      {
        bodyPart: 'ear',
        lightImage: {
          url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80',
        },
        status: 'active',
      },
      {
        bodyPart: 'wrist',
        lightImage: {
          url: 'https://images.unsplash.com/photo-1611591475152-478311382490?auto=format&fit=crop&w=600&q=80',
        },
        status: 'active',
      },
    ]);
    console.log(`✅ Seeded ${vtoMasters.length} VTO Masters (hand, neck, ear, wrist)`);

    // ─── 22. SEED CUSTOM JEWELLERY BEFORE-AFTER ───────────────────────────────
    console.log('\n✨ Seeding Custom Jewellery Before-After Showcases...');
    const beforeAfter = await CustJewelleryBeforAfter.insertMany([
      {
        beforeImage: {
          url: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=600&q=80',
          public_id: 'ba_before_1',
        },
        afterImage: {
          url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80',
          public_id: 'ba_after_1',
        },
        alt: 'Vintage Heirloom Ring Remodelled into Modern Oval Solitaire Halo',
        status: 'active',
        position: 1,
      },
      {
        beforeImage: {
          url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80',
          public_id: 'ba_before_2',
        },
        afterImage: {
          url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80',
          public_id: 'ba_after_2',
        },
        alt: 'Loose Colombian Emerald Re-mounted in Platinum Wheat Pendant',
        status: 'active',
        position: 2,
      },
    ]);
    console.log(`✅ Seeded ${beforeAfter.length} Before/After Jewellery Transformations`);

    // ─── 23. SEED WISHLIST & CART FOR TEST USER ──────────────────────────────
    console.log('\n🛒 Seeding Initial Wishlist & Cart for Test Customer...');
    const sampleProduct1 = createdProducts[0];
    const sampleProduct2 = createdProducts[3];

    await Wishlist.create({
      user: primaryCustomer._id,
      items: [
        {
          product: sampleProduct1._id,
          productId: sampleProduct1._id.toString(),
          title: sampleProduct1.title,
          price: sampleProduct1.salePrice,
          originalPrice: sampleProduct1.price,
          image: sampleProduct1.images[0]?.url,
          category: 'rings',
          slug: sampleProduct1.slug,
        },
      ],
    });

    await Cart.create({
      user: primaryCustomer._id,
      items: [
        {
          product: sampleProduct2._id,
          productId: sampleProduct2._id.toString(),
          title: sampleProduct2.title,
          price: sampleProduct2.salePrice,
          originalPrice: sampleProduct2.price,
          image: sampleProduct2.images[0]?.url,
          category: 'bangles-bracelets',
          quantity: 1,
          selectedMetal: '18K Yellow Gold',
          selectedSize: '7.0 inches',
        },
      ],
    });
    console.log(`✅ Seeded Initial Cart and Wishlist items for ${primaryCustomer.auth.email}`);

    // ─── 24. SEED NOTIFICATIONS ───────────────────────────────────────────────
    console.log('\n🔔 Seeding VIP Notifications...');
    const notifications = await Notification.insertMany([
      {
        title: 'Welcome to Neirah Jewels VIP Lounge',
        message: 'Your account has been granted VIP Haute Joaillerie access and complimentary concierge services.',
        type: 'info',
        userId: primaryCustomer._id,
        isRead: false,
      },
      {
        title: 'Private Atelier Consultation Confirmed',
        message: 'Your private salon appointment for 15th October at 06:00 PM is confirmed with our master diamantaire.',
        type: 'success',
        userId: primaryCustomer._id,
        isRead: false,
      },
      {
        title: 'Exclusive Preview: 2026 Solitaire Collection',
        message: 'Explore new triple-excellent certified loose diamonds before general release.',
        type: 'info',
        userId: primaryCustomer._id,
        isRead: true,
      },
    ]);
    console.log(`✅ Seeded ${notifications.length} Customer Notifications`);

    // ─── SUMMARY REPORT ───────────────────────────────────────────────────────
    console.log('\n========================================================================');
    console.log('🎉 DATABASE SEED COMPLETED SUCCESSFULLY!');
    console.log('========================================================================');
    console.log(`📍 Database URI:        ${process.env.MONGODB_URI}`);
    console.log(`👤 Users Total:         ${createdUsers.length}`);
    console.log(`   • Super Admins:      superadmin@jewels.com / Admin@123`);
    console.log(`                        admin@neirah.com      / Admin@123`);
    console.log(`                        admin@jewels.com      / Admin@123`);
    console.log(`   • Store Admins:      aisha.admin@jewels.com / Admin@123`);
    console.log(`   • VIP Customers:     krushnakant.jayswal@gmail.com / User@123`);
    console.log(`                        user@jewels.com / User@123`);
    console.log(`                        disharadadiya13@gmail.com / User@123`);
    console.log(`💎 Categories:          ${createdCategories.length}`);
    console.log(`💍 Luxury Products:     ${createdProducts.length}`);
    console.log(`✨ Certified Diamonds:  ${certifiedDiamonds.length}`);
    console.log(`🎨 Banners:             ${banners.length}`);
    console.log(`🌟 Featured Sections:   ${featuredItems.length}`);
    console.log(`🎟️ Active Coupons:      ${coupons.length}`);
    console.log(`⭐ Customer Reviews:    ${reviews.length}`);
    console.log(`📅 Appointments:        ${appointments.length}`);
    console.log(`📝 Custom Inquiries:    ${customInquiries.length}`);
    console.log(`🔮 Birthstones:         ${birthstones.length}`);
    console.log(`👓 VTO Masters:         ${vtoMasters.length}`);
    console.log(`💰 COD Slabs:           ${codSequences.length}`);
    console.log('========================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database seeding failed with error:', error);
    process.exit(1);
  }
};

seedAllData();
