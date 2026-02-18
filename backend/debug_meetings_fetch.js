const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:1234@localhost:5432/chamasmart',
});

async function debugFetchMeetings() {
    try {
        await client.connect();
        console.log('Connected to DB');

        const chamaId = 1; // Assuming chama ID 1 exists
        const limitNum = 20;
        const offset = 0;

        // 1. Check schemas
        console.log('Checking meetings table...');
        const meetingsCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'meetings'");
        console.log('Meetings columns:', meetingsCols.rows.map(r => r.column_name));

        console.log('Checking meeting_attendance table...');
        const attCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'meeting_attendance'");
        console.log('Attendance columns:', attCols.rows.map(r => r.column_name));

        // 2. Run the main query
        console.log('Running fetch query...');
        const params = [chamaId, limitNum, offset];

        // Note: I'm reproducing the query from controller
        const whereClause = 'WHERE m.chama_id = $1';

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

        const res = await client.query(query, params);
        console.log('Query successful. Rows:', res.rowCount);
        console.log('First row:', res.rows[0]);

    } catch (err) {
        console.error('DEBUG ERROR:', err);
    } finally {
        await client.end();
    }
}

debugFetchMeetings();
