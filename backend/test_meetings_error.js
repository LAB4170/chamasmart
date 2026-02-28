const pool = require('./config/db');

async function test() {
  try {
    const q1 = `SELECT COUNT(*) as count FROM meetings m WHERE m.chama_id = $1`;
    const res1 = await pool.query(q1, [1]);
    console.log("Count Success:", res1.rows);

    const q = `
      SELECT m.*, 
             u.first_name || ' ' || u.last_name as created_by_name,
             (SELECT COUNT(*) FROM meeting_attendance 
              WHERE meeting_id = m.meeting_id AND attended = true) as attendees_count
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.user_id
      WHERE m.chama_id = $1
      ORDER BY m.scheduled_date DESC, m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const res = await pool.query(q, [1, 20, 0]);
    console.log("Query Success:", res.rows);
  } catch (err) {
    console.error("Query Error:", err.message);
  } finally {
    pool.end();
  }
}
test();
