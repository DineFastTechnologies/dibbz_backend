// firebase.js
const admin = require("firebase-admin");

let serviceAccount;
let PROJECT_ID;

// Check if running in a Vercel-like environment (production) or locally
if (process.env.SERVICE_ACCOUNT_KEY_BASE64) {
  // Production/Vercel: Load from Base64 encoded environment variable
  try {
    serviceAccount = JSON.parse(
      Buffer.from(process.env.SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8')
    );
    PROJECT_ID = serviceAccount.project_id;
    console.log("[Firebase Init] Loading service account from environment variable.");
  } catch (e) {
    console.error("[Firebase Init] ERROR: Failed to parse SERVICE_ACCOUNT_KEY_BASE64 environment variable. Ensure it's valid Base64 JSON.", e.message);
    // Exit or throw to prevent further errors
    process.exit(1); 
  }
} else {
  // Local development: Load from local file
  try {
    serviceAccount = require("./serviceAccountKey.json");
    PROJECT_ID = serviceAccount.project_id;
    console.log("[Firebase Init] Loading service account from local file.");
  } catch (e) {
    console.error("[Firebase Init] ERROR: serviceAccountKey.json not found or malformed. Ensure it's in the root directory for local dev.", e.message);
    console.error("If deploying to Vercel, ensure SERVICE_ACCOUNT_KEY_BASE64 env var is set.");
    // Exit or throw to prevent further errors
    process.exit(1);
  }
}


// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${PROJECT_ID}.appspot.com`, 
      projectId: PROJECT_ID 
    });
    console.log(`[Firebase Init] Successfully initialized for Project ID: ${admin.app().options.projectId}`);
  } catch (e) {
    console.error(`[Firebase Init] Error initializing Firebase Admin SDK: ${e.message}`);
    console.error(`[Firebase Init] Please check your service account credentials and Firebase project configuration.`);
    // In a serverless function, an initialization error should typically crash the instance
    process.exit(1); 
  }
} else {
    console.log("[Firebase Init] Firebase Admin SDK already initialized.");
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket };   