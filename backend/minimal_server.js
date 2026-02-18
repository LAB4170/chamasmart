const originalExit = process.exit;
process.exit = function (code) {
  if (code !== 0) {
    console.error('FORCE EXIT CALLED WITH CODE:', code);
    console.error(new Error('Exit Stack Trace').stack);
  }
  return originalExit.apply(process, arguments);
};

console.log('STARTUP: Init');
const express = require('express');
const http = require('http');
require('dotenv').config();

console.log('STARTUP: Creating app');
const app = express();
const server = http.createServer(app);
const PORT = 5005;

console.log('STARTUP: Requiring logger');
const logger = require('./utils/logger');

console.log('STARTUP: Logger required');

console.log('STARTUP: Requiring DB');
require('./config/db');

console.log('STARTUP: DB required');

app.get('/health', (req, res) => res.json({ status: 'ok' }));

console.log('STARTUP: Starting listen');
server.listen(PORT, () => {
  console.log('STARTUP: Server listening on', PORT);
});

process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', reason => {
  console.error('UNHANDLED REJECTION:', reason);
});
