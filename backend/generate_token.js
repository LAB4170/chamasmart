const jwt = require('jsonwebtoken');
require('dotenv').config();

const payload = {
    sub: 1,
    role: 'TREASURER'
};

const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log(token);
