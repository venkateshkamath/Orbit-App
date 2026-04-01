const { Router } = require('express');
const postsController = require('../controllers/postsController');
const { authMiddleware } = require('../middleware/auth');
const { uploadPost } = require('../middleware/upload');

const router = Router();

router.get('/api/posts/feed/', authMiddleware, postsController.feed);
router.get('/api/posts/my/', authMiddleware, postsController.myPosts);
router.get('/api/posts/user/:userId/', authMiddleware, postsController.userPosts);
router.post('/api/posts/', authMiddleware, uploadPost.single('image'), postsController.createPost);
router.get('/api/posts/:id/', authMiddleware, postsController.getPost);
router.patch('/api/posts/:id/', authMiddleware, postsController.patchPost);
router.delete('/api/posts/:id/', authMiddleware, postsController.deletePost);
router.post('/api/posts/:id/like/', authMiddleware, postsController.toggleLike);
router.get('/api/posts/:id/comments/', authMiddleware, postsController.listComments);
router.post('/api/posts/:id/comments/', authMiddleware, postsController.createComment);
router.delete('/api/posts/comments/:id/', authMiddleware, postsController.deleteComment);

module.exports = router;
