const jwt = require('jsonwebtoken');
const { JWT } = require('../config/constants');
const User = require('../modules/user/user.model');
const { setRequestContext, asyncLocalStorage } = require('../utils/context');

/**
 * Decodes the Bearer JWT from req.headers.authorization.
 */
function decodeTokenFromRequest(req) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { hasToken: false, decoded: null, error: null };
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT.SECRET);
    return { hasToken: true, decoded, error: null };
  } catch (error) {
    return { hasToken: true, decoded: null, error };
  }
}

/**
 * Resolves the authenticated user from req.headers.authorization
 * using a lean User query.
 */
async function resolveUserFromHeader(req) {
  const { hasToken, decoded, error } = decodeTokenFromRequest(req);
  if (!hasToken) {
    return { statusCode: 401, message: 'Access denied. No token provided.', user: null, decoded: null };
  }
  if (error) {
    const msg = error.name === 'TokenExpiredError'
      ? 'Token expired. Please login again.'
      : 'Invalid token.';
    return { statusCode: 401, message: msg, user: null, decoded: null };
  }

  const user = await User.findById(decoded.id)
    .select('-auth.password -password')
    .lean();
  if (!user) {
    return { statusCode: 401, message: 'Invalid token. User not found.', user: null, decoded };
  }
  if (!user.isActive) {
    return { statusCode: 403, message: 'Account is deactivated. Contact admin.', user: null, decoded };
  }

  return { statusCode: 200, message: null, user, decoded };
}

function runWithUserContext(user, next) {
  if (asyncLocalStorage.getStore()) {
    setRequestContext('userId', user._id);
    return next();
  }
  return asyncLocalStorage.run(new Map([['userId', user._id]]), next);
}

// Authenticate JWT token from Authorization header
const authenticate = async (req, res, next) => {
  try {
    const { user, statusCode, message } = await resolveUserFromHeader(req);
    if (!user) {
      return res.status(statusCode).json({
        success: false,
        message,
      });
    }

    req.user = user;
    return runWithUserContext(user, next);
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
};

// Authorize by role(s)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
    }

    next();
  };
};

// Optional JWT token authentication - does not block guests
const optionalAuth = async (req, res, next) => {
  try {
    const { user } = await resolveUserFromHeader(req);
    if (user) {
      req.user = user;
      return runWithUserContext(user, next);
    }
  } catch {
    // Ignore error for optional authentication
  }
  return next();
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  decodeTokenFromRequest,
  resolveUserFromHeader,
};
