// firebase.js
const admin = require("firebase-admin");

// --- TEMPORARY HARDCODED SERVICE ACCOUNT - FOR DIAGNOSIS ONLY ---
// WARNING: DO NOT USE IN PRODUCTION. REPLACE WITH ORIGINAL LOGIC AFTER TEST.
// PASTE THE ENTIRE JSON CONTENT OF YOUR serviceAccountKey.json FILE HERE.
// ENSURE ALL NEWLINES ARE KEPT IN THE private_key STRING.
const HARDCODED_SERVICE_ACCOUNT = {
  "type": "service_account",
  "project_id": "dibbz-android-3af82", // <-- Replace with your exact project_id
  "private_key_id": "ceb925ba150ec5a1b0b115d58ebbc17db34ca9c8", // <-- Replace with your exact private_key_id
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDLANF1D8tkIrP9\nreAn1KrjGa7YYg49OziU8f7e5+5gQ6mDxLS1zGrRiVYhaWqX6S7BzYB/Gi1bhKU+\nxJwT+s2A/fx6HNI6MHuZqiQhKxZU+nEKPu7k67GAjTxlIRpSV8L3rqbjbyaKHjTq\n/TKtHCSnejR4hZHzFU3VNUVIcC1npvZDsJUBVlGcpbLwSS5xkEBdSMyLERiOuq8q\nDiEOSEnVfUZ1Mfb6wfsEKaS6SGePoM+wgn7XeOKMpSVUYjMwpi1Hdfk+7x9ctoW/\nMNpfKfDEPD83WsTjMZcf9xLrju5aPaj2NlWoesq56rtThHHNQU5x83zZJe9WaMqF\nMSsBO8D5AgMBAAECggEABx3Hz0gm4Q4EDBt1YpgRMdsI4X4rJx4wGS0+5Mlcdnnw\nvj/d9jXiCbyRgnmA+oMlYoxbGeQ3nQAc+y1ma583ZzNKz5dlOZPRBWhCPM/B8ufW\nS3MSKgARgyLlsDA1TW0qVnHu2PALebyI2N2tkjAiIHqHeTEfgRYTr4Ae+2TZUUs9\nmBn8b88hon604D7DX/w0kxnkxzQ/mdYrUrK0OW2GZKJ/z3IszD6BqcPLMUX6hJX\nnmpLIwEHKu0IlipK3zDOaLvlPmS8aG76MWhnWYxFWE/9AhyJwXpGf0wfh+kGl69z\nl0MLGQocDz+7kSh5DpAyJmXiLPkycl+m6fXwwuyT4QKBgQD7WqMZkXggs/LoEVoO\nvccxtyS3Q2gEI8m47d8d09WB4YIDBF2vGDPO9fOw65vr68+GAz0sPFosOchec6BB\nSbqg0xSo6FV67nVEtjXAzRofzJ631LqHoL0ziFSeUALTioxGxmL4ARaDiye9Ot1H\nl8rApTTa+jerdZytkBvJUF8+EQKBgQDOwWS1aZVJB1cz18Jcuo9Ble49WwFw17IY\n67BEoCcQpdN5sbli6y5Fpr0sOA5hkMpK/p1kg0+42GNkP/8y/O95hpL+y586A+PA\nJtxtlaH1brvGKidj5WEyto1ZdiWnftFqpnbsPx30ewfNXgqQW5l7W2YHQn91GB7O\n5dC5vpqMaQKBgQC5+zqrdIOaTwvwwsYMGkgFdSnpoCqaxZBBEWEBxPg5/g4hBV38\nbMAI5tvFkM/yJK2Mz2C4Fn/yMV8c5BkztcYtsYGb6S02pLKIgPoNCrXFybW29+R8\n7maQdtOFwFYXCHD6/VfFgaiS9KgW0DNjAeG34YXWcUY3y/J+Sh8FOj7+wQKBgQDK\nmCJwySbpSnIecLsZVg1t/NZX9Mbypcj0Nm6gsDXXUEZqpsW7sivDQGF55Ovimpg+\n6EOd7DXAMPkjkLomYkbeVAnR9gDuPkV7UhkIoGj1MC57PW8fqfKWWN8k3GqFN/VI\nhhld4XMezzeT+yRq0/cPMz5EutpeCOaXYgYnHCggkQKBgQCEkA9ZKjAn7NG0xQRS\nd+NkPaYTmDCyFW/6SrlywalehOjsCeH0V2n3udFzE64Ctv/mxpe1qxHlbLqD2D1n\nJ0jRqDReOdTlSDBjuNbvPSY5ggYWnb5MxSrHCcVQmM2PFgjcoqEgkSs8crvSx3Ii\nPHWBkcLKKSo3MbUkoY/XLbJk9Q==\n-----END PRIVATE KEY-----\n", // <-- CRITICAL: Paste your EXACT private_key string here (including -----BEGIN/END PRIVATE KEY----- and all newlines)
  "client_email": "firebase-adminsdk-fbsvc@dibbz-android-3af82.iam.gserviceaccount.com", // <-- Replace with your exact client_email
  "client_id": "110761871476490562728", // <-- Replace with your exact client_id
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40dibbz-android-3af82.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};
// --- END TEMPORARY HARDCODED SERVICE ACCOUNT ---


const PROJECT_ID = HARDCODED_SERVICE_ACCOUNT.project_id; // Use the hardcoded project ID

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  console.log(`[Firebase Init] Attempting to initialize Firebase Admin SDK with HARDCODED key for project ${PROJECT_ID}...`);
  try {
    admin.initializeApp({
      credential: admin.credential.cert(HARDCODED_SERVICE_ACCOUNT), // Use the hardcoded object
      storageBucket: `${PROJECT_ID}.appspot.com`, 
      projectId: PROJECT_ID 
    });
    console.log(`[Firebase Init] Firebase Admin SDK initialized successfully for Project ID: ${admin.app().options.projectId}`);
  } catch (e) {
    console.error(`[Firebase Init] FATAL ERROR: Failed to initialize Firebase Admin SDK with HARDCODED key. Error: ${e.message}`);
    console.error(`[Firebase Init] This means the hardcoded key is invalid or permissions are wrong.`);
    process.exit(1); 
  }
} else {
    console.log("[Firebase Init] Firebase Admin SDK already initialized.");
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

console.log("[Firebase Init] Firestore DB and Cloud Storage bucket instances created.");

module.exports = { admin, db, bucket };