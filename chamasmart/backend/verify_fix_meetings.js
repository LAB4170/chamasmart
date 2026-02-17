const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:1234@localhost:5432/chamasmart',
});

async function verifyFix() {
    try {
        await client.connect();
        console.log('Connected to DB');

        const chamaId = 1;
        const limitNum = 20;
        const offset = 0;
        const params = [chamaId];

        // Simulate the controller logic
        const whereClause = 'WHERE m.chama_id = $1';

        // 1. Logic that replaced getTotal
        console.log('Testing Count Query...');
        const countQuery = `SELECT COUNT(*) as count FROM meetings m ${whereClause}`;
        const countResult = await client.query(countQuery, params);
        const totalCount = parseInt(countResult.rows[0].count);
        console.log('Total Count:', totalCount);

        // 2. Logic for main query
        console.log('Testing Main Query...');
        const query = `
      SELECT m.*, 
             u.first_name || ' ' || u.last_name as created_by_name,
             (SELECT COUNT(*) FROM meeting_attendance 
              WHERE meeting_id = m.meeting_id AND attended = true) as attendees_count
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.user_id
      ${whereClause}
      ORDER BY m.scheduled_date DESC, m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
        const mainParams = [chamaId, limitNum, offset];
        const res = await client.query(query, mainParams);
        console.log('Main Query Rows:', res.rowCount);

        console.log('Verification SUCCESS');

    } catch (err) {
        console.error('Verification FAILED:', err);
    } finally {
        await client.end();
    }
}

verifyFix();
