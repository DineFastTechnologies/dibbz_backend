const twilio = require('twilio');

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
