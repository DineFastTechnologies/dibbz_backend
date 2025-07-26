
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "dibbz-android-3af82.firebasestorage.app"
  });
}

const db = admin.firestore();

module.exports = { admin, db };
