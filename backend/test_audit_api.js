const jwt = require('jsonwebtoken');

const token = jwt.sign({ sub: 1, id: 1, user_id: 1, role: 'CHAIRPERSON' }, '9425f9190d8761ef563d56924fbf6329dfe6006203ba94ac5f2c1194347557c9ba48763b70ab8bb8d5ca3ddaed699f56ab2caf0b5753008c935a100c2fb0c93c', { expiresIn: '1h' });

async function test() {
  try {
    const r1 = await fetch('http://127.0.0.1:5005/api/audit/chamas/1', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log("LOGS:", await r1.json());
  } catch(e) { console.error("ERR1", e.message); }

  try {
    const r2 = await fetch('http://127.0.0.1:5005/api/audit/chamas/1/summary', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log("SUMMARY:", await r2.json());
  } catch(e) { console.error("ERR2", e.message); }
}

test();
