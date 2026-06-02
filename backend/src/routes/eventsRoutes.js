const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const eventsController = require('../controllers/eventsController');
const { authMiddleware } = require('../middleware/auth');
const { uploadEvent } = require('../middleware/upload');

const router = Router();
const createCatchupLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.user?._id || rateLimit.ipKeyGenerator(req.ip)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You can create up to 10 catchups per day.', code: 'CATCHUP_RATE_LIMITED' },
});

router.get('/api/events/location-search/', authMiddleware, eventsController.locationSearch);
router.get('/api/events/feed/',             authMiddleware, eventsController.listEvents);
router.get('/api/events/nearby/',          authMiddleware, eventsController.nearbyEvents);
router.post('/api/events/',                authMiddleware, uploadEvent.single('image'), eventsController.createEvent);
router.get('/api/events/:id/',             authMiddleware, eventsController.getEvent);
router.post('/api/events/:id/join/',        authMiddleware, eventsController.joinEvent);
router.delete('/api/events/:id/',          authMiddleware, eventsController.deleteEvent);

router.get('/api/locations/search', authMiddleware, eventsController.locationSearch);
router.post('/api/locations/parse-gmaps', authMiddleware, eventsController.parseGoogleMaps);
router.get('/api/categories', authMiddleware, eventsController.listCategories);
router.post(
  '/api/catchups',
  authMiddleware,
  createCatchupLimiter,
  uploadEvent.array('photos', 5),
  eventsController.createCatchup
);
router.get('/api/catchups/:id', authMiddleware, eventsController.getEvent);
router.put('/api/catchups/:id', authMiddleware, uploadEvent.array('photos', 5), eventsController.updateCatchup);
router.post('/api/catchups/:id/join', authMiddleware, eventsController.joinEvent);
router.delete('/api/catchups/:id/join', authMiddleware, eventsController.leaveEvent);
router.delete('/api/catchups/:id', authMiddleware, eventsController.deleteCatchup);

module.exports = router;
