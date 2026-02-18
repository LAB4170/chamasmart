const admin = require('firebase-admin');
const logger = require('./utils/logger');
require('dotenv').config();

async function testFirebaseConnection() {
  try {
    console.log('Testing Firebase Admin initialization...');
    
    // The Firebase Admin SDK should already be initialized in firebase.js
    // But we'll test it explicitly here
    const firebaseConfig = {
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    };

    // Initialize a new app instance for testing
    const testApp = admin.initializeApp(firebaseConfig, 'test-app');
    
    console.log('✅ Firebase Admin initialized successfully');
    
    // Test authentication
    try {
      const auth = testApp.auth();
      console.log('✅ Firebase Auth service initialized');
      
      // List users (first 10) - this requires admin privileges
      const listUsersResult = await auth.listUsers(1);
      console.log('✅ Successfully connected to Firebase Auth');
      console.log(`ℹ️  Found ${listUsersResult.users.length} user(s) in the system`);
      
      // Test Firestore if needed
      try {
        const db = testApp.firestore();
        console.log('✅ Firestore service initialized');
        
        // Try a simple read operation
        const settingsRef = db.collection('settings').doc('app');
        await settingsRef.get();
        console.log('✅ Successfully connected to Firestore');
      } catch (firestoreError) {
        console.warn('⚠️  Could not connect to Firestore (this might be expected if not using Firestore):', firestoreError.message);
      }
      
    } catch (authError) {
      console.error('❌ Error initializing Firebase Auth:', authError.message);
      console.error('This might be due to invalid credentials or insufficient permissions');
      process.exit(1);
    }
    
    // Clean up the test app
    await testApp.delete();
    console.log('\n✅ All tests passed! Firebase Admin is properly configured.');
    
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

testFirebaseConnection();
