// firebase.js
const admin = require("firebase-admin");

let serviceAccount;
let PROJECT_ID;
let serviceAccountSource = "unknown"; // For logging where the key came from

try {
  // Check if running in a Vercel-like environment (production) where env var should be set
  if (process.env.SERVICE_ACCOUNT_KEY_BASE64) {
    serviceAccountSource = "environment_variable";
    console.log("[Firebase Init] Attempting to load SERVICE_ACCOUNT_KEY_BASE64 from process.env...");
    try {
      // Decode Base64 string and parse as JSON
      const decodedKey = Buffer.from(process.env.SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8');
      console.log("[Firebase Init] SERVICE_ACCOUNT_KEY_BASE64 decoded successfully. Attempting JSON parse...");
      serviceAccount = JSON.parse(decodedKey);
      PROJECT_ID = serviceAccount.project_id;
      console.log("[Firebase Init] SERVICE_ACCOUNT_KEY_BASE64 parsed to JSON. Project ID extracted:", PROJECT_ID);
    } catch (e) {
      console.error(`[Firebase Init] ERROR: Failed to parse SERVICE_ACCOUNT_KEY_BASE64 environment variable: ${e.message}`);
      console.error("[Firebase Init] Make sure the Base64 value is valid JSON and correctly encoded.");
      // CRITICAL: Re-throw to crash the function and force Vercel to show this log
      throw new Error("Invalid SERVICE_ACCOUNT_KEY_BASE64 format."); 
    }
  } else {
    serviceAccountSource = "local_file";
    console.log("[Firebase Init] SERVICE_ACCOUNT_KEY_BASE64 environment variable NOT found. Attempting to load from local serviceAccountKey.json file...");
    // Local development: Load from local file
    try {
      serviceAccount = require("./serviceAccountKey.json");
      PROJECT_ID = serviceAccount.project_id;
      console.log("[Firebase Init] Service account loaded from local file. Project ID:", PROJECT_ID);
    } catch (e) {
      console.error("[Firebase Init] ERROR: serviceAccountKey.json not found or malformed. Ensure it's in the root directory for local dev.", e.message);
      console.error("If deploying to Vercel, ensure SERVICE_ACCOUNT_KEY_BASE64 env var is set.");
      // CRITICAL: Re-throw to crash the function and force Vercel to show this log
      throw new Error("serviceAccountKey.json not found/valid for local dev.");
    }
  }
} catch (e) {
  // Catch any errors from the initial loading block
  console.error(`[Firebase Init] FATAL ERROR during service account loading (${serviceAccountSource}): ${e.message}`);
  // Force process exit to ensure Vercel captures a crash log
  process.exit(1); 
}


if (!admin.apps.length) {
  console.log(`[Firebase Init] Attempting to initialize Firebase Admin SDK for project ${PROJECT_ID}...`);
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${PROJECT_ID}.appspot.com`, 
      projectId: PROJECT_ID 
    });
    console.log(`[Firebase Init] Firebase Admin SDK initialized successfully for Project ID: ${admin.app().options.projectId}`);
  } catch (e) {
    console.error(`[Firebase Init] ERROR: Failed to initialize Firebase Admin SDK. Error: ${e.message}`);
    console.error(`[Firebase Init] This could be due to invalid credentials, network issues, or misconfigured project settings.`);
    process.exit(1); 
  }
} else {
    console.log("[Firebase Init] Firebase Admin SDK already initialized.");
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

console.log("[Firebase Init] Firestore DB and Cloud Storage bucket instances created.");

module.exports = { admin, db, bucket };