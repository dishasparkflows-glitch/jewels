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
        required: [true, 'Password is required'],
        minlength: 6,
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

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.auth) this.auth = {};

  if (!this.isModified('auth.password')) return next();

  const pwd = this.auth.password;
  if (!pwd) return next();

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


module.exports = mongoose.model('User', userSchema);
