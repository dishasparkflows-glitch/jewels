const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Middleware to initialize request context
 */
const requestContextMiddleware = (req, res, next) => {
  const store = new Map();
  asyncLocalStorage.run(store, () => {
    if (req.user?._id) {
      store.set('userId', req.user._id);
    }
    next();
  });
};

/**
 * Get a value from the active request context
 * @param {string} key
 * @returns {any}
 */
function getRequestContext(key) {
  const store = asyncLocalStorage.getStore();
  return store ? store.get(key) : undefined;
}

/**
 * Set a value in the active request context
 * @param {string} key
 * @param {any} value
 */
function setRequestContext(key, value) {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.set(key, value);
  }
}

module.exports = {
  requestContextMiddleware,
  getRequestContext,
  setRequestContext,
  asyncLocalStorage,
};
