import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// ─── Masked Call — customer → mechanic (Twilio masking) ─────────────────────
// Customer call karta hai → Twilio company number se mechanic ko connect karta hai
// Dono ko sirf company number dikhta hai
export const initiateCall = async (fromNumber, toNumber) => {
  const from = fromNumber.startsWith("+91") ? fromNumber : `+91${fromNumber}`;
  const to   = toNumber.startsWith("+91")   ? toNumber   : `+91${toNumber}`;

  try {
    const call = await client.calls.create({
      to: from,                          // customer ko call jaayegi
      from: process.env.TWILIO_PHONE,    // company masked number
      twiml: `<Response>
        <Say voice="alice">Connecting you to your service agent. Please wait.</Say>
        <Dial callerId="${process.env.TWILIO_PHONE}">${to}</Dial>
      </Response>`,
    });
    console.log(`📞 Masked call initiated | Customer: ${from} → Mechanic: ${to} | SID: ${call.sid}`);
    return { success: true, sid: call.sid, maskedNumber: process.env.TWILIO_PHONE };
  } catch (err) {
    // Trial account — unverified numbers
    if (err.code === 21608 || err.code === 21215) {
      console.log(`\n⚠️  TWILIO TRIAL: Call not initiated (unverified numbers)`);
      console.log(`📞 Would connect: ${from} → ${to}`);
      return { success: false, devMode: true, maskedNumber: process.env.TWILIO_PHONE };
    }
    console.error("Twilio call error:", err.message);
    throw new Error("Call failed: " + err.message);
  }
};

// ─── Masked SMS ───────────────────────────────────────────────────────────────
// Pump ke Twilio number se SMS jaata hai
export const maskedSMS = async (toNumber, message) => {
  try {
    const sms = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: toNumber,
    });
    return { success: true, sid: sms.sid };
  } catch (err) {
    console.error("Twilio SMS error:", err.message);
    throw new Error("SMS failed: " + err.message);
  }
};


export const sendOTP = async (toNumber, otp) => {
  try {
    const formattedNumber = toNumber.startsWith("+91")
      ? toNumber
      : `+91${toNumber}`;

    const sms = await client.messages.create({
      body: `Your OTP is ${otp}. Do not share it with anyone.`,
      from: process.env.TWILIO_PHONE,
      to: formattedNumber,
    });

    console.log(`✅ OTP SMS sent to ${formattedNumber} | SID: ${sms.sid}`);
    return { success: true, sid: sms.sid };
  } catch (err) {
    // Trial account — unverified number
    if (err.code === 21608) {
      console.log(`\n⚠️  TWILIO TRIAL ACCOUNT`);
      console.log(`📱 Number ${toNumber} is not verified in Twilio.`);
      console.log(`🔗 Verify at: https://www.twilio.com/console/phone-numbers/verified`);
      console.log(`🔑 OTP for ${toNumber}: ${otp}\n`);
      // Dev fallback — OTP still works, just SMS nahi gaya
      return { success: true, devMode: true, otp };
    }
    console.error("Twilio OTP error:", err.message);
    throw new Error("OTP failed: " + err.message);
  }
};