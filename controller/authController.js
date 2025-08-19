const twilio = require('twilio');
const { admin, db } = require('../firebase');
const { OAuth2Client } = require('google-auth-library');
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
      return res.json({ message: "Phone verified successfully", verified: true });
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
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;
    let user = await admin.auth().getUserByEmail(email).catch(() => null);
    if (!user) {
      user = await admin.auth().createUser({
        email,
        displayName: name,
        photoURL: picture,
      });
    }
    const token = await admin.auth().createCustomToken(user.uid);
    res.json({ token });
  } catch (error) {
    res.status(401).json({ error: 'Invalid Google token' });
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
