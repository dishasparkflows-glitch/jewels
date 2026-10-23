const { Server } = require('socket.io');

// In-memory state of live viewer counts per product
// Map<string, { count: number, sockets: Set<string>, timer: NodeJS.Timeout | null, cleanupTimer: NodeJS.Timeout | null }>
const productStates = new Map();

let ioInstance = null;

const MIN_VIEWERS = 25;
const MAX_VIEWERS = 60;

/**
 * Generate a deterministic yet realistic seed count for a product
 */
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

/**
 * Calculate the next natural viewer count step
 * Mimics organic traffic with realistic ups and downs (e.g. 25 -> 32 -> 30 -> 40 -> 35 -> 50)
 */
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

/**
 * Schedule next natural update tick for a specific product
 */
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

/**
 * Ensure product state exists and return it
 */
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

/**
 * Get current live viewer count for API routes or initial SSR
 */
function getProductViewerCount(productId) {
  if (!productId) return 32;
  const state = getOrCreateProductState(productId);
  return state.count;
}

/**
 * Initialize Socket.io on existing HTTP server
 */
function initViewerSocket(server) {
  const allowedOrigins = [
    process.env.ADMIN_URL,
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ].filter(Boolean);

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        return callback(null, true); // Permissive in dev/local
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance = io;

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
      leaveProduct(socket, String(productId).trim());
      if (currentJoinedProduct === productId) {
        currentJoinedProduct = null;
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

  console.log('⚡ Live Viewers Socket initialized');
  return io;
}

module.exports = {
  initViewerSocket,
  getProductViewerCount,
};
