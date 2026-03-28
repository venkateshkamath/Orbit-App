const { Router } = require('express');
const usersController = require('../controllers/usersController');
const { authMiddleware } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = Router();

router.get('/api/users/me/', authMiddleware, usersController.getMe);
router.patch('/api/users/me/', authMiddleware, upload.single('avatar'), usersController.patchMe);
router.delete('/api/users/me/avatar/', authMiddleware, usersController.deleteAvatar);
router.post('/api/users/me/location/', authMiddleware, usersController.updateLocation);
router.post(
  '/api/users/me/expo-push-token/',
  authMiddleware,
  usersController.registerExpoPushToken
);
router.get('/api/users/:id/profile/', authMiddleware, usersController.getPublicProfile);
router.get('/api/users/:id/', authMiddleware, usersController.getUserById);

module.exports = router;
