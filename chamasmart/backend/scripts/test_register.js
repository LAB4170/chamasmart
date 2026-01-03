require("dotenv").config();
const { register } = require("./controllers/authController");

// Mock Req/Res
const req = {
    body: {
        firstName: "Test",
        lastName: "User",
        email: "testuser" + Date.now() + "@example.com", // Unique email
        phoneNumber: "07" + Math.floor(10000000 + Math.random() * 90000000), // Random phone
        password: "Password123",
        confirmPassword: "Password123"
    }
};

const res = {
    status: function (code) {
        this.statusCode = code;
        return this;
    },
    json: function (data) {
        console.log(`Response [${this.statusCode}]:`, JSON.stringify(data, null, 2));
        if (this.statusCode === 500) {
            console.error("❌ 500 ERROR CAUSE:", data.error); // authController returns error message in data.error
        }
    }
};

console.log("Testing Registration with:", req.body);
register(req, res).then(() => {
    console.log("Test execution finished. (Wait for DB connection close or force exit)");
    setTimeout(() => process.exit(0), 2000);
}).catch(err => {
    console.error("Checking wrapper catch:", err);
    process.exit(1);
});
