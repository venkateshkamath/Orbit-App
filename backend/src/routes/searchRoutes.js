const { Router } = require('express');
const searchController = require('../controllers/searchController');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

router.get('/api/search', authMiddleware, searchController.search);

module.exports = router;
