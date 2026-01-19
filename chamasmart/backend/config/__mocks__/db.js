// Mock database pool for testing
console.log("[MOCK] Loading mocked database");

const testDB = {
  users: {},
  chamas: {},
  joinRequests: {},
  loans: {},
  proposals: {},
  roscaCycles: {},
  ascaGroups: {},
  notifications: {},
};

let userCounter = 1000;

const mockQuery = jest.fn(async (text, values) => {
  console.log("[MOCK_DB] Query called with text:", text.substring(0, 50));
  
  try {
    // Handle different query types
    if (text.includes("SELECT * FROM users WHERE email = $1")) {
      const email = values[0].toLowerCase();
      const user = Object.values(testDB.users).find(u => u.email === email);
      const result = { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      console.log("[MOCK_DB] SELECT user by email result:", result);
      return result;
    }
    
    if (text.includes("SELECT * FROM users WHERE email = $1 OR phone_number = $2")) {
      const email = values[0].toLowerCase();
      const phone = values[1];
      const user = Object.values(testDB.users).find(u => u.email === email || u.phone_number === phone);
      const result = { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      console.log("[MOCK_DB] SELECT user by email/phone result:", result);
      return result;
    }
    
    if (text.includes("INSERT INTO users")) {
      const userId = userCounter++;
      const user = {
        user_id: userId,
        email: values[0],
        password_hash: values[1],
        first_name: values[2],
        last_name: values[3],
        phone_number: values[4],
        national_id: values[5],
        created_at: new Date(),
        email_verification_token: null,
        email_verified: false,
        phone_verified: false,
        phone_verification_code: null,
        email_verification_last_sent_at: null,
        phone_verification_last_sent_at: null,
      };
      testDB.users[userId] = user;
      const result = { 
        rows: [{
          user_id: user.user_id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone_number: user.phone_number,
          created_at: user.created_at,
        }],
        rowCount: 1 
      };
      console.log("[MOCK_DB] INSERT user result:", result);
      return result;
    }
    
    if (text.includes("UPDATE users") && text.includes("email_verification_token")) {
      const userId = values[values.length - 1];
      if (testDB.users[userId]) {
        testDB.users[userId].email_verification_token = values[0];
        testDB.users[userId].email_verification_expires_at = new Date(Date.now() + 24*60*60*1000);
        testDB.users[userId].email_verification_last_sent_at = new Date();
      }
      const result = { rowCount: 1 };
      console.log("[MOCK_DB] UPDATE email token result:", result);
      return result;
    }
    
    if (text.includes("UPDATE users") && text.includes("phone_verification_code")) {
      const userId = values[values.length - 1];
      if (testDB.users[userId]) {
        testDB.users[userId].phone_verification_code = values[0];
        testDB.users[userId].phone_verification_expires_at = new Date(Date.now() + 10*60*1000);
        testDB.users[userId].phone_verification_attempts = 0;
        testDB.users[userId].phone_verification_last_sent_at = new Date();
      }
      const result = { rowCount: 1 };
      console.log("[MOCK_DB] UPDATE phone code result:", result);
      return result;
    }
    
    // Default: return empty result
    console.log("[MOCK_DB] Unhandled query, returning empty result");
    return { rows: [], rowCount: 0 };
  } catch (err) {
    console.error("MOCK_DB_ERROR:", err.message, err.stack);
    throw err;
  }
});

const mockClientQuery = jest.fn();
const mockConnect = jest.fn(async () => ({
  query: mockClientQuery,
  release: jest.fn(),
}));

module.exports = {
  query: mockQuery,
  connect: mockConnect,
  end: jest.fn(),
  on: jest.fn(),
  __mockQuery: mockQuery,
  __mockClientQuery: mockClientQuery,
};
