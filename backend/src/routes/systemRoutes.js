const { Router } = require('express');
const adminController = require('../controllers/adminController');

const router = Router();

router.get('/health', adminController.health);
router.post('/admin/dev-reset', adminController.devReset);

module.exports = router;
