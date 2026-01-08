const fs = require('fs');
const path = require('path');

process.on('uncaughtException', (err) => {
    fs.writeFileSync('crash.log', 'UNCAUGHT EXCEPTION:\n' + err.stack);
    console.error('UNCAUGHT EXCEPTION:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    fs.writeFileSync('crash.log', 'UNHANDLED REJECTION:\n' + (reason.stack || reason));
    console.error('UNHANDLED REJECTION:', reason);
    process.exit(1);
});

console.log('Loading server...');
try {
    const app = require('./server');
    console.log('Server module loaded.');
} catch (err) {
    fs.writeFileSync('crash.log', 'REQUIRE ERROR:\n' + err.stack);
    console.error('REQUIRE ERROR:', err);
    process.exit(1);
}
