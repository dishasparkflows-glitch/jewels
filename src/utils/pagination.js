const { PAGINATION } = require('../config/constants');

/**
 * Build pagination query params from request
 * @param {Object} query - req.query object
 * @returns {{ page, limit, skip }}
 */
const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    Math.max(1, parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT),
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Build pagination meta for response
 */
const getPaginationMeta = (totalDocs, page, limit) => {
  const totalPages = Math.ceil(totalDocs / limit);
  return {
    currentPage: page,
    totalPages,
    totalDocs,
    limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

module.exports = { getPagination, getPaginationMeta };
