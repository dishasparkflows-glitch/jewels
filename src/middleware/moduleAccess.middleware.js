const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { JWT } = require('../config/constants');
const Owner = require('../modules/owner/owner.model');
const { getModulesForApiPath } = require('../modules/owner/owner.modules');

// Endpoints that are always reachable regardless of owner module selection
const ALWAYS_ALLOWED_PREFIXES = ['/auth', '/otp', '/common', '/notifications', '/owners/access', '/owners/modules'];

/**
 * Enforces owner-level module access restrictions when an owner context is active
 * (via x-owner-id header or user.ownerId in JWT).
 */
const moduleAccessMiddleware = async (req, res, next) => {
  try {
    const reqPath = '/' + String(req.path || '').replace(/^\/+/, '').toLowerCase();

    if (ALWAYS_ALLOWED_PREFIXES.some((p) => reqPath === p || reqPath.startsWith(`${p}/`))) {
      return next();
    }

    let ownerId = req.headers['x-owner-id'] || null;

    if (!ownerId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.split(' ')[1], JWT.SECRET);
          if (decoded?.ownerId) {
            ownerId = decoded.ownerId;
          }
        } catch {
          // Auth middleware will handle invalid/expired tokens on protected routes
        }
      }
    }

    if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) {
      return next();
    }

    const owner = await Owner.findOne({ _id: ownerId, 'meta.deletedAt': null })
      .select('name status allowedModules')
      .lean();

    if (!owner || owner.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Client portal is inactive or access is revoked.',
      });
    }

    // Owners management endpoints themselves require explicit 'owners' permission (disabled by default for clients)
    if (reqPath === '/owners' || reqPath.startsWith('/owners/')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Client accounts cannot manage system owners.',
      });
    }

    const matchingModules = getModulesForApiPath(reqPath);
    if (matchingModules.length === 0) {
      return next();
    }

    const allowedSet = new Set(Array.isArray(owner.allowedModules) ? owner.allowedModules : []);
    const isPermitted = matchingModules.some((modId) => allowedSet.has(modId));

    if (!isPermitted) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This module is not enabled for ${owner.name}.`,
      });
    }

    req.ownerAccess = owner;
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = moduleAccessMiddleware;
