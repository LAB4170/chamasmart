const { createNotification } = require('./utils/notificationService');
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '1234', database: 'chamasmart' });

async function verify() {
  try {
    console.log('--- START FINAL VERIFICATION ---');
    // User 2 is the Chairperson of Chama 1
    const res = await createNotification(null, {
      userId: 2,
      type: 'JOIN_REQUEST',
      title: 'Final Integration Test',
      message: 'Schema alignment verified.',
      link: '/chamas/1/join-requests',
      entityType: 'JOIN_REQUEST',
      entityId: 888
    });
    
    if (res) {
      console.log('RESULT_SUCCESS');
      console.log('V_ID:' + res.notification_id);
    } else {
      console.log('RESULT_FAILURE: createNotification returned null');
    }
  } catch (e) {
    console.log('V_ERR:' + e.message);
  } finally {
    await pool.end();
    console.log('--- END FINAL VERIFICATION ---');
  }
}

verify();
