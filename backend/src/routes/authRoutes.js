const { Router } = require('express');
const authController = require('../controllers/authController');
const authOtpController = require('../controllers/authOtpController');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

router.post('/api/auth/otp/send/', authOtpController.sendOtp);
router.post('/api/auth/otp/verify/', authOtpController.verifyOtp);
router.post('/api/auth/logout/', authMiddleware, authController.logout);
router.post('/api/token/refresh/', authController.refreshToken);
router.post('/api/auth/change-password/', authMiddleware, authController.changePassword);
router.get('/api/auth/interests/', authController.listInterests);

module.exports = router;
