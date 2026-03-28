const { Router } = require('express');

const router = Router();

router.use(require('./systemRoutes'));
router.use(require('./authRoutes'));
router.use(require('./usersRoutes'));
router.use(require('./discoveryRoutes'));
router.use(require('./postsRoutes'));
router.use(require('./chatRoutes'));
router.use(require('./notificationsRoutes'));

module.exports = router;
