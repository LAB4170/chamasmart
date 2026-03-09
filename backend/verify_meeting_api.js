const pool = require('./config/db');

async function verify() {
    try {
        const chamaRes = await pool.query('SELECT chama_id FROM chamas LIMIT 1');
        if (chamaRes.rows.length === 0) {
            console.log('No chamas found');
            process.exit(0);
        }
        const chamaId = chamaRes.rows[0].chama_id;

        let meetingId;
        const meetingRes = await pool.query('SELECT meeting_id FROM meetings WHERE chama_id = $1 LIMIT 1', [chamaId]);
        
        const memberRes = await pool.query('SELECT user_id FROM chama_members WHERE chama_id = $1 LIMIT 1', [chamaId]);
        const userId = memberRes.rows[0].user_id;

        if (meetingRes.rows.length === 0) {
            console.log(`Creating test meeting for chama ${chamaId}`);
            const createRes = await pool.query(
                `INSERT INTO meetings (chama_id, title, scheduled_date, location, created_by) 
                 VALUES ($1, $2, NOW(), $3, $4) RETURNING meeting_id`,
                [chamaId, 'Test Verification Meeting', 'Virtual', userId]
            );
            meetingId = createRes.rows[0].meeting_id;
        } else {
            meetingId = meetingRes.rows[0].meeting_id;
        }

        console.log(`Testing with Chama: ${chamaId}, Meeting: ${meetingId}`);

        // We can't easily trigger the API with auth here without a token, 
        // but we can at least check if the controller logic would work 
        // by simulating the params.
        
        const { getMeetingById } = require('./controllers/meetingController');
        const req = {
            params: { chamaId, meetingId },
            user: { user_id: (await pool.query('SELECT user_id FROM chama_members WHERE chama_id = $1 LIMIT 1', [chamaId])).rows[0].user_id }
        };
        const res = {
            json: (data) => {
                console.log('API Response Success:', data.success);
                console.log('Meeting Title:', data.data.meeting.title);
                process.exit(0);
            },
            status: (code) => ({
                json: (data) => {
                    console.log(`API Response Error (${code}):`, data.message);
                    process.exit(1);
                }
            })
        };
        const next = (err) => {
            console.error('Next called with error:', err);
            process.exit(1);
        };

        await getMeetingById(req, res, next);
    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
}

verify();
