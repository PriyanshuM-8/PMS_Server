import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config();

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN  = process.env.TWILIO_AUTH;
const SERVICE_SID = process.env.TWILIO_SERVICE_SID;

// Startup check
if (!ACCOUNT_SID || !AUTH_TOKEN || !SERVICE_SID) {
  console.error("[Twilio] MISSING ENV VARS:", {
    ACCOUNT_SID: !!ACCOUNT_SID,
    AUTH_TOKEN: !!AUTH_TOKEN,
    SERVICE_SID: !!SERVICE_SID,
  });
}

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

const formatPhone = (phone) => {
  const cleaned = phone.toString().replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return `+${cleaned}`;
};

// ─── Send OTP via Twilio Verify ─────────────────────────────────────────────
export const sendOTP = async (phone) => {
  const formatted = formatPhone(phone);
  console.log(`[Twilio] Sending OTP to: ${formatted}`);

  try {
    const verification = await client.verify.v2
      .services(SERVICE_SID)
      .verifications.create({
        to: formatted,
        channel: "sms",
        // customMessage removed — not allowed on free/trial plan (error 60204)
      });

    console.log(`[Twilio] OTP sent | status: ${verification.status}`);
    return { success: true };
  } catch (err) {
    console.error(`[Twilio] sendOTP FAILED: ${err.code} - ${err.message}`);
    throw new Error(`SMS failed (${err.code}): ${err.message}`);
  }
};

// Verify OTP via Twilio Verify
export const verifyOTP = async (phone, code) => {
  const formatted = formatPhone(phone);
  try {
    const result = await client.verify.v2
      .services(SERVICE_SID)
      .verificationChecks.create({ to: formatted, code: code.toString() });
    console.log(`[Twilio] verifyOTP | status: ${result.status}`);
    return result.status === "approved";
  } catch (err) {
    console.error(`[Twilio] verifyOTP FAILED: ${err.code} - ${err.message}`);
    throw new Error(`OTP check failed (${err.code}): ${err.message}`);
  }
};

// Masked Call
export const initiateCall = async (fromNumber, toNumber) => {
  const from = formatPhone(fromNumber);
  const to   = formatPhone(toNumber);
  try {
    const call = await client.calls.create({
      to: from,
      from: process.env.TWILIO_PHONE,
      twiml: `<Response>
        <Say voice="alice">Connecting you to your service agent. Please wait.</Say>
        <Dial callerId="${process.env.TWILIO_PHONE}">${to}</Dial>
      </Response>`,
    });
    return { success: true, sid: call.sid };
  } catch (err) {
    if (err.code === 21608 || err.code === 21215) return { success: false, devMode: true };
    throw new Error("Call failed: " + err.message);
  }
};
