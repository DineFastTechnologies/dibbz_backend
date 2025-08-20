const twilio = require('twilio');
const { admin, db } = require('../firebase');
const { OAuth2Client } = require('google-auth-library');
const { createNotification } = require('../services/notificationService');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Lazy client getter to play well with serverless cold starts and env handling
const getTwilioClient = () => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    return null;
  }
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
};

// Send OTP
exports.sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const client = getTwilioClient();
    if (!client) {
      return res.status(500).json({ error: "Server misconfiguration: Twilio environment variables missing" });
    }

    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications
      .create({ to: phoneNumber, channel: 'sms' });

    res.set('Cache-Control', 'no-store');
    return res.json({ message: "OTP sent successfully", status: verification.status });
  } catch (error) {
    console.error("Error sending OTP:", error?.message || error);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: "Phone number and code are required" });
    }

    const client = getTwilioClient();
    if (!client) {
      return res.status(500).json({ error: "Server misconfiguration: Twilio environment variables missing" });
    }

    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks
      .create({ to: phoneNumber, code });

    res.set('Cache-Control', 'no-store');
    if (verificationCheck.status === 'approved') {
      let user;
      try {
        user = await admin.auth().getUserByPhoneNumber(phoneNumber);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          user = await admin.auth().createUser({ phoneNumber: phoneNumber });
        } else {
          throw error;
        }
      }
      
      const token = await admin.auth().createCustomToken(user.uid);
      return res.json({ message: "Phone verified successfully", verified: true, token: token });
    } else {
      return res.status(400).json({ error: "Invalid or expired OTP", verified: false });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error?.message || error);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
};

exports.googleLogin = async (req, res) => {
  const { idToken } = req.body;

  // --- ADDED LOGS ---
  console.log("GOOGLE LOGIN: Initiated.");
  console.log("GOOGLE LOGIN: Received idToken:", idToken ? idToken.substring(0, 30) + "..." : "Not provided");
  console.log("GOOGLE LOGIN: GOOGLE_CLIENT_ID from env:", process.env.GOOGLE_CLIENT_ID ? "Loaded" : "MISSING!");
  // --- END ADDED LOGS ---

  if (!idToken) {
    return res.status(400).json({ error: "idToken is required" });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    console.log(`GOOGLE LOGIN: Token verified for email: ${email}`);

    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
      console.log(`GOOGLE LOGIN: Existing user found: ${user.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`GOOGLE LOGIN: User not found, creating new user for email: ${email}`);
        user = await admin.auth().createUser({
          email,
          displayName: name,
          photoURL: picture,
          emailVerified: true,
        });
        console.log(`GOOGLE LOGIN: New user created: ${user.uid}`);
      } else {
        throw error; // Re-throw other auth errors
      }
    }

    const token = await admin.auth().createCustomToken(user.uid);
    console.log(`GOOGLE LOGIN: Custom token generated for UID: ${user.uid}`);
    res.json({ token });

    // Send a welcome notification
    console.log(`GOOGLE LOGIN: Attempting to send welcome notification to ${user.uid}`);
    await createNotification(
      user.uid,
      'Welcome to Dibbz!',
      'We are excited to have you on board.'
    );
    console.log(`GOOGLE LOGIN: Welcome notification sent successfully.`);

  } catch (error) {
    // --- IMPROVED ERROR LOGGING ---
    console.error("GOOGLE LOGIN ERROR:", error.message);
    console.error("Error Details:", error);
    res.status(401).json({ 
      error: 'Invalid Google token or server misconfiguration.',
      details: error.message 
    });
    // --- END IMPROVED ERROR LOGGING ---
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await admin.auth().getUserByEmail(email);
    // This is a simplified login. In a real app, you'd verify the password.
    // For Firebase, password verification is typically done on the client-side.
    const token = await admin.auth().createCustomToken(user.uid);
    res.json({ token });
  } catch (error) {
    res.status(401).json({ error: 'Invalid credentials' });
  }
};

exports.register = async (req, res) => {
  const { email, password, displayName } = req.body;
  try {
    const user = await admin.auth().createUser({
      email,
      password,
      displayName,
    });
    const token = await admin.auth().createCustomToken(user.uid);
    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
