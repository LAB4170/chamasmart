const pool = require('./config/db');
const { redis, initializeRedis } = require('./config/redis');
const admin = require('./config/firebase');

async function test() {
    console.log('--- Backend Service Diagnostics ---');
    
    // 1. Test PostgreSQl
    try {
        console.log('1. Testing PostgreSQL...');
        const start = Date.now();
        const client = await pool.connect();
        const res = await client.query('SELECT NOW()');
        client.release();
        console.log('✅ PostgreSQL Connected in', Date.now() - start, 'ms');
        console.log('   Result:', res.rows[0].now);
    } catch (err) {
        console.error('❌ PostgreSQL Failed:', err.message);
    }

    // 2. Test Redis
    try {
        console.log('\n2. Testing Redis...');
        const start = Date.now();
        // The config calls initializeRedis() automatically, but let's be sure
        await initializeRedis();
        const pong = await redis.ping();
        console.log('✅ Redis Connected in', Date.now() - start, 'ms');
        console.log('   Result:', pong);
    } catch (err) {
        console.error('❌ Redis Failed:', err.message);
    }

    // 3. Test Firebase Admin
    try {
        console.log('\n3. Testing Firebase Admin...');
        const start = Date.now();
        const project = admin.app().options.projectId;
        console.log('✅ Firebase Admin Initialized for project:', project);
        // We can't easily test verifyIdToken without a real token, but we can check if it's initialized.
    } catch (err) {
        console.error('❌ Firebase Admin Failed:', err.message);
    }

    process.exit(0);
}

test();
