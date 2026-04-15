const { Router } = require('express');
const discoveryController = require('../controllers/discoveryController');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

router.get('/api/discovery', authMiddleware, discoveryController.getDiscoveryFeed);
router.get('/api/discovery/nearby', authMiddleware, discoveryController.getNearbyUsers);
// Legacy routes
router.get('/api/discover/nearby/', authMiddleware, discoveryController.nearby);
router.get('/api/discover/next/', authMiddleware, discoveryController.next);
router.post('/api/discover/like/:userId/', authMiddleware, discoveryController.likeUser);
router.post('/api/discover/pass/:userId/', authMiddleware, discoveryController.passUser);
router.get('/api/discover/matches/', authMiddleware, discoveryController.listMatches);
router.delete('/api/discover/matches/:matchId/', authMiddleware, discoveryController.deleteMatch);
router.get('/api/discover/likes-received/', authMiddleware, discoveryController.likesReceived);

module.exports = router;
