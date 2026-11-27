const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { NODE_ENV, URL, JWT } = require('../config/constants');
const User = require('../modules/user/user.model');

async function verifySocketUser(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || !JWT?.SECRET) return null;
  const cleanToken = rawToken.replace(/^Bearer\s+/i, '').trim();
  if (!cleanToken) return null;
  try {
    const decoded = jwt.verify(cleanToken, JWT.SECRET);
    if (!decoded?.id) return null;
    const user = await User.findOne({ _id: decoded.id, 'meta.deletedAt': null, isActive: true })
      .select('_id')
      .lean();
    return user ? String(user._id) : null;
  } catch {
    return null;
  }
}

// In-memory state of live viewer counts per product
// Map<string, { count: number, sockets: Set<string>, timer: NodeJS.Timeout | null, cleanupTimer: NodeJS.Timeout | null }>
const productStates = new Map();

let ioInstance = null;

const MIN_VIEWERS = 25;
const MAX_VIEWERS = 60;

function getInitialSeed(productId) {
  if (!productId) return 32;
  const str = String(productId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  // Maps to 28 - 45 for realistic starting point
  return MIN_VIEWERS + 3 + (Math.abs(hash) % 18);
}

function calculateNextCount(current) {
  let delta = 0;

  if (current <= 28) {
    // Near lower bound (25), push upwards (+3 to +9)
    delta = Math.floor(Math.random() * 7) + 3;
  } else if (current >= 56) {
    // Near upper bound (60), push downwards (-3 to -8)
    delta = -(Math.floor(Math.random() * 6) + 3);
  } else {
    // Dynamic realistic jumps
    // Jumps can be moderate (+2 to +9) or moderate declines (-2 to -6)
    const jumps = [
      -5, -4, -3, -2, -1,
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    ];
    delta = jumps[Math.floor(Math.random() * jumps.length)];
  }

  let next = current + delta;
  if (next < MIN_VIEWERS) next = MIN_VIEWERS + Math.floor(Math.random() * 4);
  if (next > MAX_VIEWERS) next = MAX_VIEWERS - Math.floor(Math.random() * 4);

  return next;
}

function scheduleProductTick(productId) {
  const state = productStates.get(productId);
  if (!state || state.sockets.size === 0) return;

  if (state.timer) clearTimeout(state.timer);

  // Interval varies organically between 4.2s and 7.8s
  const nextDelayMs = Math.floor(4200 + Math.random() * 3600);

  state.timer = setTimeout(() => {
    if (!productStates.has(productId)) return;
    const currentState = productStates.get(productId);
    if (!currentState || currentState.sockets.size === 0) return;

    currentState.count = calculateNextCount(currentState.count);

    if (ioInstance) {
      ioInstance.to(`product:${productId}`).emit('live_viewers_update', {
        productId,
        count: currentState.count,
        timestamp: Date.now(),
      });
    }

    // Schedule subsequent tick
    scheduleProductTick(productId);
  }, nextDelayMs);
}

function getOrCreateProductState(productId) {
  const pid = String(productId).trim();
  if (!productStates.has(pid)) {
    const initial = getInitialSeed(pid);
    productStates.set(pid, {
      count: initial,
      sockets: new Set(),
      timer: null,
      cleanupTimer: null,
    });
  }
  const state = productStates.get(pid);
  if (state.cleanupTimer) {
    clearTimeout(state.cleanupTimer);
    state.cleanupTimer = null;
  }
  return state;
}

function getProductViewerCount(productId) {
  if (!productId) return 32;
  const state = getOrCreateProductState(productId);
  return state.count;
}

function initViewerSocket(server) {
  const allowedOrigins = [
    URL.ADMIN_URL,
    URL.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
  ].filter(Boolean);

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || NODE_ENV === 'development') {
          return callback(null, true);
        }
        return callback(new Error(`Socket CORS blocked: Origin ${origin} is not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance = io;

  // Attach verified userId when a valid JWT is present in handshake (public viewers stay unauthenticated)
  io.use(async (socket, next) => {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization || '';
    const verifiedUserId = await verifySocketUser(rawToken);
    if (verifiedUserId) {
      socket.data.userId = verifiedUserId;
    }
    next();
  });

  io.on('connection', (socket) => {
    let currentJoinedProduct = null;

    socket.on('join_product', ({ productId }) => {
      if (!productId) return;
      const pid = String(productId).trim();

      // If already in a room, leave previous room
      if (currentJoinedProduct && currentJoinedProduct !== pid) {
        leaveProduct(socket, currentJoinedProduct);
      }

      currentJoinedProduct = pid;
      socket.join(`product:${pid}`);

      const state = getOrCreateProductState(pid);
      state.sockets.add(socket.id);

      // Send initial count immediately
      socket.emit('live_viewers_update', {
        productId: pid,
        count: state.count,
        timestamp: Date.now(),
      });

      // Ensure tick cycle is running
      if (!state.timer) {
        scheduleProductTick(pid);
      }
    });

    socket.on('leave_product', ({ productId }) => {
      if (!productId) return;
      const pid = String(productId).trim();
      leaveProduct(socket, pid);
      if (currentJoinedProduct === pid) {
        currentJoinedProduct = null;
      }
    });

    socket.on('join_user', async ({ userId, sessionId, token } = {}) => {
      if (token && !socket.data.userId) {
        const verifiedUserId = await verifySocketUser(token);
        if (verifiedUserId) {
          socket.data.userId = verifiedUserId;
        }
      }

      const verifiedId = socket.data.userId;
      if (userId) {
        if (!verifiedId || String(userId) !== verifiedId) {
          socket.emit('socket_error', { message: 'Unauthorized user room join attempt' });
          return;
        }
        socket.join(`user:${verifiedId}`);
      } else if (verifiedId) {
        socket.join(`user:${verifiedId}`);
      }

      if (sessionId && typeof sessionId === 'string') {
        socket.join(`session:${sessionId.trim()}`);
      }
    });

    socket.on('leave_user', ({ sessionId } = {}) => {
      if (socket.data.userId) {
        socket.leave(`user:${socket.data.userId}`);
      }
      if (sessionId && typeof sessionId === 'string') {
        socket.leave(`session:${sessionId.trim()}`);
      }
    });

    socket.on('disconnect', () => {
      if (currentJoinedProduct) {
        leaveProduct(socket, currentJoinedProduct);
      }
    });
  });

  function leaveProduct(socket, pid) {
    socket.leave(`product:${pid}`);
    const state = productStates.get(pid);
    if (!state) return;

    state.sockets.delete(socket.id);

    // If no more clients viewing this product, schedule cleanup
    if (state.sockets.size === 0) {
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      // Keep state cached for 5 minutes before deleting
      state.cleanupTimer = setTimeout(() => {
        if (state.sockets.size === 0) {
          productStates.delete(pid);
        }
      }, 5 * 60 * 1000);
    }
  }

  console.log('⚡ Live Viewers & Realtime Sync Socket initialized');
  return io;
}

function emitWishlistUpdate({ userId, wishlistCount, refId, itemType, isWishlisted }) {
  if (!ioInstance) return;
  const payload = {
    wishlistCount: Number(wishlistCount) || 0,
    refId: refId ? String(refId) : null,
    itemType: itemType || 'product',
    isWishlisted: Boolean(isWishlisted),
    timestamp: Date.now(),
  };
  if (userId) {
    ioInstance.to(`user:${String(userId)}`).emit('wishlist_count_updated', payload);
  }
}

function emitCartUpdate({ userId, sessionId, cartCount, totalItems }) {
  if (!ioInstance) return;
  const count = Number(totalItems ?? cartCount ?? 0);
  const payload = {
    cartCount: count,
    totalItems: count,
    timestamp: Date.now(),
  };
  if (userId) {
    ioInstance.to(`user:${String(userId)}`).emit('cart_count_updated', payload);
  }
  if (sessionId) {
    ioInstance.to(`session:${String(sessionId)}`).emit('cart_count_updated', payload);
  }
}

module.exports = {
  initViewerSocket,
  getProductViewerCount,
  emitWishlistUpdate,
  emitCartUpdate,
};
