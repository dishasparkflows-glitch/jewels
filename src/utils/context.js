const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

const requestContextMiddleware = (req, res, next) => {
  const store = new Map();
  asyncLocalStorage.run(store, () => {
    if (req.user?._id) {
      store.set('userId', req.user._id);
    }
    next();
  });
};

function getRequestContext(key) {
  const store = asyncLocalStorage.getStore();
  return store ? store.get(key) : undefined;
}

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
