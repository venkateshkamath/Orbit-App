const { Router } = require('express');
const usersController = require('../controllers/usersController');
const { authMiddleware } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

const router = Router();

router.get('/api/users/me/', authMiddleware, usersController.getMe);
router.patch('/api/users/me/', authMiddleware, uploadAvatar.single('avatar'), usersController.patchMe);
router.delete('/api/users/me/avatar/', authMiddleware, usersController.deleteAvatar);
router.post('/api/users/me/location/', authMiddleware, usersController.updateLocation);
router.put('/api/users/location', authMiddleware, usersController.updateLocation);
router.post(
  '/api/users/me/expo-push-token/',
  authMiddleware,
  usersController.registerExpoPushToken
);
router.get('/api/users/search', authMiddleware, usersController.searchUsers);
router.post('/api/users/me/presence/', authMiddleware, usersController.updatePresence);
router.get('/api/users/:id/profile/', authMiddleware, usersController.getPublicProfile);
router.get('/api/users/:id/', authMiddleware, usersController.getUserById);

module.exports = router;
