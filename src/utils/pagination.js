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
const getPaginationMeta = (totalDocsOrObj, pageArg, limitArg) => {
  let totalDocs = totalDocsOrObj;
  let page = pageArg;
  let limit = limitArg;

  if (typeof totalDocsOrObj === 'object' && totalDocsOrObj !== null) {
    totalDocs = totalDocsOrObj.totalDocs ?? totalDocsOrObj.total ?? 0;
    page = totalDocsOrObj.page ?? pageArg ?? 1;
    limit = totalDocsOrObj.limit ?? limitArg ?? PAGINATION.DEFAULT_LIMIT;
  }

  const safeLimit = Math.max(1, parseInt(limit) || PAGINATION.DEFAULT_LIMIT);
  const safeTotalDocs = Math.max(0, parseInt(totalDocs) || 0);
  const safePage = Math.max(1, parseInt(page) || 1);
  const totalPages = Math.ceil(safeTotalDocs / safeLimit) || 1;

  return {
    currentPage: safePage,
    totalPages,
    totalDocs: safeTotalDocs,
    limit: safeLimit,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
};

module.exports = { getPagination, getPaginationMeta };
