const express = require('express');
const validateChatRequest = require('../middleware/validateChatRequest');
const { handleChat } = require('../controllers/chatController');

const router = express.Router();

router.post('/', validateChatRequest, handleChat);

module.exports = router;
