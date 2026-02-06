try {
    console.log('Attempting to require server.js...');
    const app = require('./server');
    console.log('Server.js required successfully!');
} catch (err) {
    console.error('FAILED to require server.js');
    console.error(err);
    process.exit(1);
}
