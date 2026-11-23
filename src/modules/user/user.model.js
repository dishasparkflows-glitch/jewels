const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
      avatar: require('../../utils/mediaField'),
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
      countryCode: {
        type: String,
        default: '+91',
        trim: true,
      },
      isPhoneVerified: {
        type: Boolean,
        default: false,
      },
      location: {
        type: String,
        default: '',
        trim: true,
      },
      themeColor: {
        type: String,
        default: 'default',
        trim: true,
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
        required: false,
        default: null,
        validate: {
          validator: function (v) {
            if (v === null || v === undefined || v === '') return true;
            return typeof v === 'string' && v.length >= 6;
          },
          message: 'Password must be at least 6 characters',
        },
        select: false,
      },
      passwordResetTokenHash: { type: String, select: false },
      passwordResetExpires: { type: Date, select: false },
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
    versionKey: false,
  }
);

// Clean phone and normalize countryCode before saving
userSchema.pre('save', function (next) {
  if (this.profile) {
    if (this.profile.phone) {
      const phoneStr = String(this.profile.phone).trim();
      const match = phoneStr.match(/^(\+\d{1,4})[\s.-]?(\d+)$/);
      if (match) {
        if (!this.profile.countryCode || this.profile.countryCode === '+91') {
          this.profile.countryCode = match[1];
        }
        this.profile.phone = match[2];
      } else {
        this.profile.phone = phoneStr.replace(/^\+\d{1,4}\s*/, '').replace(/\s+/g, '');
      }
    }
    if (this.profile.countryCode) {
      const codeStr = String(this.profile.countryCode).trim();
      this.profile.countryCode = codeStr.startsWith('+') ? codeStr : `+${codeStr}`;
    }
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.auth) this.auth = {};

  if (!this.isModified('auth.password')) return next();

  const pwd = this.auth.password;
  if (!pwd || typeof pwd !== 'string' || !pwd.trim()) {
    this.auth.password = null;
    return next();
  }

  // If already hashed with bcrypt ($2a$, $2b$, or $2y$), skip
  if (/^\$2[aby]\$\d{2}\$/.test(pwd)) return next();

  this.auth.password = await bcrypt.hash(pwd, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  const currentPassword = this.auth?.password;
  if (!currentPassword) return false;

  return bcrypt.compare(candidatePassword, currentPassword);
};

userSchema.index({ 'profile.phone': 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);
