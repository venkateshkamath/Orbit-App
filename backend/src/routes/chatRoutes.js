const { Router } = require('express');
const chatController = require('../controllers/chatController');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

router.get('/api/chat/conversations/', authMiddleware, chatController.listConversations);
router.post('/api/chat/conversations/start/', authMiddleware, chatController.startConversation);
router.get('/api/chat/conversations/:id/', authMiddleware, chatController.getConversation);
router.get('/api/chat/conversations/:id/messages/', authMiddleware, chatController.listMessages);
router.post('/api/chat/conversations/:id/messages/send/', authMiddleware, chatController.sendMessage);
router.post('/api/chat/conversations/:id/messages/read/', authMiddleware, chatController.markRead);
router.delete('/api/chat/messages/:id/delete/', authMiddleware, chatController.deleteMessage);

module.exports = router;
