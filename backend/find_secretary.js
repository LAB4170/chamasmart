const pool = require('./config/db');

async function findSecretary() {
  try {
    const res = await pool.query(`
      SELECT u.phone_number, m.role, c.chama_name, c.chama_id
      FROM users u 
      JOIN chama_members m ON u.user_id = m.user_id 
      JOIN chamas c ON m.chama_id = c.chama_id 
      WHERE u.phone_number IS NOT NULL
      ORDER BY CASE WHEN m.role = 'SECRETARY' THEN 0 
                    WHEN m.role = 'CHAIRPERSON' THEN 1 
                    ELSE 2 END
      LIMIT 1;
    `);
    
    console.log(JSON.stringify(res.rows[0], null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

findSecretary();
