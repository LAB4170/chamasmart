const fs = require('fs');
const http = require('http');

// Let's read the latest errors from the log files or make a direct query if possible
try {
    const logs = fs.readFileSync('C:/Users/Eobord/Desktop/chamasmart/backend/startup.log', 'utf8');
    const lines = logs.split('\n');
    const lastLines = lines.slice(-200);
    
    // filter out lines that have 'error' or 'Exception'
    const errorLines = lastLines.filter(line => line.toLowerCase().includes('error') || line.toLowerCase().includes('fail') || line.includes('stack'));
    
    console.log("Recent Error Lines:");
    console.log(errorLines.join('\n'));
} catch (e) {
    console.log(e);
}
