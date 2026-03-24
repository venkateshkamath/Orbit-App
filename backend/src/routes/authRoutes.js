const { Router } = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

router.post('/api/auth/register/', authController.register);
router.post('/api/auth/login/', authController.login);
router.post('/api/auth/logout/', authMiddleware, authController.logout);
router.post('/api/token/refresh/', authController.refreshToken);
router.post('/api/auth/change-password/', authMiddleware, authController.changePassword);
router.get('/api/auth/interests/', authController.listInterests);

module.exports = router;
