import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOTPEmail = async (userEmail, userName, otp) => {
  try {
    await transporter.sendMail({
      from: `"PMS App" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: "Your Login OTP",
      html: `
        <h2>Hello ${userName},</h2>
        <p>Your one-time login OTP is:</p>
        <h1 style="letter-spacing: 8px; color: #e74c3c;">${otp}</h1>
        <p>This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <br/><small>Team PMS</small>
      `,
    });
  } catch (err) {
    console.error("OTP Mail error:", err.message);
  }
};

// Notify superAdmin when a new pump owner registers
export const sendNewRegistrationAlert = async (ownerName, ownerEmail, pumpName) => {
  try {
    await transporter.sendMail({
      from: `"PMS App" <${process.env.EMAIL_USER}>`,
      to: process.env.SUPER_ADMIN_EMAIL,
      subject: "New Petrol Pump Registration Request 🔔",
      html: `
        <h2>New Registration Request</h2>
        <p>A new petrol pump owner has registered and is awaiting your approval.</p>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; font-weight: bold;">Owner Name</td><td style="padding: 8px;">${ownerName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Email</td><td style="padding: 8px;">${ownerEmail}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Pump Name</td><td style="padding: 8px;">${pumpName}</td></tr>
        </table>
        <p>Please login to the admin panel to review and approve/reject this request.</p>
        <br/><small>Team PMS</small>
      `,
    });
  } catch (err) {
    console.error("Registration alert mail error:", err.message);
  }
};

// Notify pump owner when approved
export const sendApprovalEmail = async (ownerEmail, ownerName, pumpName) => {
  try {
    await transporter.sendMail({
      from: `"PMS App" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: "Your Petrol Pump Has Been Approved ✅",
      html: `
        <h2>Congratulations, ${ownerName}!</h2>
        <p>Your petrol pump <strong>${pumpName}</strong> has been approved by the admin.</p>
        <p>You can now login and start managing your pump, customers, and mechanics.</p>
        <br/><small>Team PMS</small>
      `,
    });
  } catch (err) {
    console.error("Approval mail error:", err.message);
  }
};

// Notify pump owner when rejected
export const sendRejectionEmail = async (ownerEmail, ownerName, pumpName, reason) => {
  try {
    await transporter.sendMail({
      from: `"PMS App" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: "Your Petrol Pump Registration Was Rejected ❌",
      html: `
        <h2>Hello ${ownerName},</h2>
        <p>Unfortunately, your petrol pump <strong>${pumpName}</strong> registration has been rejected.</p>
        <p><strong>Reason:</strong> ${reason || "Does not meet platform requirements."}</p>
        <p>Please contact support for more information.</p>
        <br/><small>Team PMS</small>
      `,
    });
  } catch (err) {
    console.error("Rejection mail error:", err.message);
  }
};
