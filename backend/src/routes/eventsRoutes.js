const { Router } = require('express');
const eventsController = require('../controllers/eventsController');
const { authMiddleware } = require('../middleware/auth');
const { uploadEvent } = require('../middleware/upload');

const router = Router();

router.get('/api/events/location-search/', authMiddleware, eventsController.locationSearch);
router.get('/api/events/feed/',             authMiddleware, eventsController.listEvents);
router.get('/api/events/nearby/',          authMiddleware, eventsController.nearbyEvents);
router.post('/api/events/',                authMiddleware, uploadEvent.single('image'), eventsController.createEvent);
router.get('/api/events/:id/',             authMiddleware, eventsController.getEvent);
router.post('/api/events/:id/join/',        authMiddleware, eventsController.joinEvent);
router.delete('/api/events/:id/',          authMiddleware, eventsController.deleteEvent);

module.exports = router;
