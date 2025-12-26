const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { searchUser } = require('../controllers/userController');

router.use(protect);

router.get('/search', searchUser);

module.exports = router;
