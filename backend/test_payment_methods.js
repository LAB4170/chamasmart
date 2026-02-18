const pool = require('./config/db');

async function test() {
    const chamaId = 1; // Testing on Chama 1
    const testPaymentMethods = {
        type: "TILL",
        tillNumber: "789012",
        businessNumber: "",
        accountNumber: "",
        phoneNumber: ""
    };

    console.log(`Testing payment methods update for Chama ${chamaId}...`);

    try {
        // 1. Update
        await pool.query(
            "UPDATE chamas SET payment_methods = $1 WHERE chama_id = $2",
            [JSON.stringify(testPaymentMethods), chamaId]
        );
        console.log("Update successful.");

        // 2. Retrieve
        const res = await pool.query(
            "SELECT payment_methods FROM chamas WHERE chama_id = $1",
            [chamaId]
        );
        console.log("Retrieved payment methods:", res.rows[0].payment_methods);

        if (res.rows[0].payment_methods.tillNumber === "789012") {
            console.log("SUCCESS: Payment methods persisted correctly.");
        } else {
            console.log("FAILURE: Data mismatch.");
        }

    } catch (err) {
        console.error("Test failed:", err.message);
    } finally {
        await pool.end();
    }
}

test();
