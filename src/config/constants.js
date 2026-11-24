const env = require('./env');

module.exports = {
  ...env,

  // Roles & Permissions
  ROLES: {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    USER: 'user',
  },

  // Pagination Defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  // Cache
  CACHE_TTL: 86400, // 24 hours in seconds
};
