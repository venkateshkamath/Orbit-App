const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const notificationsController = require('../controllers/notificationsController');

const router = Router();

router.get('/api/notifications/', authMiddleware, notificationsController.listNotifications);
router.patch(
  '/api/notifications/:id/read/',
  authMiddleware,
  notificationsController.markNotificationRead
);
router.post(
  '/api/notifications/read-all/',
  authMiddleware,
  notificationsController.markAllRead
);

module.exports = router;
