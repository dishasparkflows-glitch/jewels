/**
 * Wrap async route handlers to catch errors automatically
 * @param {Function} fn - Async function to wrap
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;
