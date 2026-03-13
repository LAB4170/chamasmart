const pool = require('./config/db');

// Mock request and response
async function testConflict() {
    console.log("--- STARTING CONFLICT TEST ---");
    
    // We'll try to update a user (ID 90) with a phone number that already exists (owned by ID 2)
    const userId = 90;
    const existingPhoneNumber = '0796874205'; // Owned by user ID 2
    
    try {
        console.log(`Updating user ID ${userId} with conflicting phone number ${existingPhoneNumber}...`);
        
        // This simulates the logic inside updateProfile
        const result = await pool.query(
            `UPDATE users 
             SET first_name = $1, last_name = $2, email = $3, phone_number = $4, updated_at = NOW()
             WHERE user_id = $5
             RETURNING user_id`,
            ['Mickey', 'Mickey', 'mickey88855@gmail.com', existingPhoneNumber, userId]
        );
        
        console.log("❌ TEST FAILED: Update succeeded unexpectedly!");
    } catch (error) {
        console.log("CATCHED ERROR CODE:", error.code);
        if (error.code === '23505') {
            console.log("✅ SUCCESS: Correctly caught unique constraint violation (code 23505)");
            console.log("   Details:", error.detail);
        } else {
            console.log("❌ TEST FAILED: Caught unexpected error:", error);
        }
    } finally {
        await pool.end();
        console.log("--- TEST FINISHED ---");
    }
}

testConflict();
