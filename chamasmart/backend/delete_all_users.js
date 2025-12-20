const pool = require("./config/db");

async function deleteAllUsers() {
    const client = await pool.connect();

    try {
        console.log("⚠️  WARNING: This will delete ALL users and related data!");
        console.log("🔄 Starting deletion process...\n");

        await client.query("BEGIN");

        // Delete in order to respect foreign key constraints

        // 1. Delete notifications
        const notificationsResult = await client.query("DELETE FROM notifications");
        console.log(`✅ Deleted ${notificationsResult.rowCount} notifications`);

        // 2. Delete join requests
        const joinRequestsResult = await client.query("DELETE FROM join_requests");
        console.log(`✅ Deleted ${joinRequestsResult.rowCount} join requests`);

        // 3. Delete loan repayments
        const repaymentResult = await client.query("DELETE FROM loan_repayments");
        console.log(`✅ Deleted ${repaymentResult.rowCount} loan repayments`);

        // 4. Delete loans
        const loansResult = await client.query("DELETE FROM loans");
        console.log(`✅ Deleted ${loansResult.rowCount} loans`);

        // 5. Delete payouts
        const payoutsResult = await client.query("DELETE FROM payouts");
        console.log(`✅ Deleted ${payoutsResult.rowCount} payouts`);

        // 6. Delete meeting attendance
        const attendanceResult = await client.query("DELETE FROM meeting_attendance");
        console.log(`✅ Deleted ${attendanceResult.rowCount} attendance records`);

        // 7. Delete meetings
        const meetingsResult = await client.query("DELETE FROM meetings");
        console.log(`✅ Deleted ${meetingsResult.rowCount} meetings`);

        // 8. Delete contributions
        const contributionsResult = await client.query("DELETE FROM contributions");
        console.log(`✅ Deleted ${contributionsResult.rowCount} contributions`);

        // 9. Delete invites
        const invitesResult = await client.query("DELETE FROM chama_invites");
        console.log(`✅ Deleted ${invitesResult.rowCount} invites`);

        // 10. Delete chama members
        const membersResult = await client.query("DELETE FROM chama_members");
        console.log(`✅ Deleted ${membersResult.rowCount} chama members`);

        // 11. Delete chamas
        const chamasResult = await client.query("DELETE FROM chamas");
        console.log(`✅ Deleted ${chamasResult.rowCount} chamas`);

        // 12. Delete users
        const usersResult = await client.query("DELETE FROM users");
        console.log(`✅ Deleted ${usersResult.rowCount} users`);

        await client.query("COMMIT");

        console.log("\n🎉 All user accounts and related data deleted successfully!");
        console.log("✨ Database is now clean. You can create new accounts.");

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Error deleting users:", error);
        console.error("Error details:", {
            message: error.message,
            code: error.code,
            detail: error.detail,
        });
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the deletion
deleteAllUsers();
