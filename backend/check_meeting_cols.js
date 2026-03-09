const pool = require('./config/db');

const query = `
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'meetings';
`;

pool.query(query)
    .then(res => {
        console.log(JSON.stringify(res.rows.map(r => r.column_name)));
        process.exit(0);
    })
    .catch(err => {
        console.error('Error checking columns:', err);
        process.exit(1);
    });
