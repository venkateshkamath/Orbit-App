const { Router } = require('express');
const connectionsController = require('../controllers/connectionsController');
const { authMiddleware } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = Router();

const connectionRequestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per user
  // Key by authenticated user ID, not IP.
  // Mobile users behind carrier-grade NAT share IPs — keying by IP
  // would throttle unrelated users sharing the same exit node.
  // Fallback to req.ip in case of future route restructure that moves this
  // limiter above authMiddleware — should never fire in practice.
  keyGenerator: (req) => String(req.user?._id ?? req.ip),
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Too many connection requests. Please wait before sending more.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/api/connections/request/:targetUserId', authMiddleware, connectionRequestLimiter, connectionsController.sendRequest);
router.put('/api/connections/respond/:requestId', authMiddleware, connectionsController.respondToRequest);

module.exports = router;
