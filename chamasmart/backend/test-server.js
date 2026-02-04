const express = require('express');
const app = express();
const PORT = process.env.PORT || 5005;

app.get('/', (req, res) => {
  res.send('Test server is running!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});

// Handle errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
