const logger = require('./utils/logger');
try {
    console.log("Starting server wrap...");
    const app = require('./server');
    const http = require('http');
    const server = http.createServer(app);
    const PORT = 5001;
    server.listen(PORT, () => {
        console.log(`Debug server listening on ${PORT}`);
    });
} catch (error) {
    console.error("CATCHED ERROR:", error);
    logger.error("WRAPPER ERROR:", { error: error.message, stack: error.stack });
}
