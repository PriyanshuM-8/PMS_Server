import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Pump from "../models/pump.model.js";
import Mechanic from "../models/mechanic.model.js";
import Customer from "../models/customer.model.js";
import { sendOTPEmail, sendNewRegistrationAlert } from "../utils/nodemailer.js";
import { sendOTP as twilioSendOTP, verifyOTP as twilioVerifyOTP } from "../utils/twilio.js";

const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  roles: user.roles,
  activeRole: user.activeRole,
});

// Customer Register
export const registerCustomer = async ({ name, email, password, phone, addressFull, lng, lat }) => {
  if (!name || !email || !password || !phone || !addressFull)
    throw new Error("name, email, password, phone, addressFull required");

  const existing = await User.findOne({ email });
  if (existing) throw new Error("Email already registered");

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name, email, password: hashed, phone,
    roles: ["customer"],
    activeRole: "customer",
  });

  await Customer.create({
    user: user._id, name, phone,
    address: {
      full: addressFull,
      ...(lng && lat && {
        location: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
      }),
    },
  });

  const token = generateToken({ id: user._id, roles: user.roles, activeRole: user.activeRole });
  return { token, user: userResponse(user) };
};

// PumpAdmin Register
export const registerPumpAdmin = async ({ name, email, password, phone, pumpName, address, pumpType, licenseNumber, lng, lat }, files) => {
  if (!name || !email || !password || !phone || !pumpName || !address || !licenseNumber)
    throw new Error("All fields are required");

  const existing = await User.findOne({ email });
  let user;
  if (existing) {
    if (existing.roles.includes("pumpAdmin")) throw new Error("Already registered as pumpAdmin");
    if (!existing.roles.includes("customer")) existing.roles.push("customer");
    existing.roles.push("pumpAdmin");
    await existing.save();
    user = existing;
  } else {
    const hashed = await bcrypt.hash(password, 10);
    user = await User.create({
      name, email, password: hashed, phone,
      roles: ["customer", "pumpAdmin"],
      activeRole: "customer",
    });
    await Customer.create({ user: user._id, name, phone, address: { full: address } });
  }

  await Pump.create({
    owner: user._id, pumpName, phone, email,
    address: {
      full: address,
      ...(lng && lat && { location: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] } }),
    },
    pumpType: pumpType || [],
    licenseNumber,
    approvalStatus: "pending",
    profileImage: files?.profileImage?.[0]?.path || "",
    aadharPhoto: files?.aadharPhoto?.[0]?.path || "",
    ownerIdProof: files?.ownerIdProof?.[0]?.path || "",
  });

  await sendNewRegistrationAlert(name, email, pumpName);
  return { message: "Registration successful. Awaiting SuperAdmin approval." };
};

// Mechanic Register
export const registerMechanicRole = async ({ email, password, phone, name, skills, experience, address, lng, lat }, files) => {
  if (!phone || !name) throw new Error("name and phone required");
  if (!lng || !lat) throw new Error("Location (lng, lat) required for mechanic");

  const existing = await User.findOne({ email });
  let user;
  if (existing) {
    if (existing.roles.includes("mechanic")) throw new Error("Already registered as mechanic");
    if (!existing.roles.includes("customer")) existing.roles.push("customer");
    existing.roles.push("mechanic");
    await existing.save();
    user = existing;
  } else {
    if (!email || !password) throw new Error("email and password required");
    const hashed = await bcrypt.hash(password, 10);
    user = await User.create({
      name, email, password: hashed, phone,
      roles: ["customer", "mechanic"],
      activeRole: "customer",
    });
    await Customer.create({ user: user._id, name, phone, address: { full: address || "Address not set" } });
  }

  const mechanic = await Mechanic.create({
    user: user._id, name, phone, email,
    skills: skills ? JSON.parse(skills) : [],
    experience: experience || 0,
    address,
    type: "external",
    location: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
    aadharPhoto: files?.aadharPhoto?.[0]?.path || "",
    profileImage: files?.profileImage?.[0]?.path || "",
    pumpConnections: [],
  });

  let nearbyPumps = [];
  try {
    nearbyPumps = await Pump.find({
      approvalStatus: "approved",
      "address.location": {
        $near: { $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: 10000 },
      },
    });
  } catch (_) {}

  if (nearbyPumps.length === 0) nearbyPumps = await Pump.find({ approvalStatus: "approved" });

  if (nearbyPumps.length > 0) {
    mechanic.pumpConnections = nearbyPumps.map((p) => ({ pump: p._id, status: "pending" }));
    await mechanic.save();
  }

  return { message: "Mechanic registered. Nearby pumps will review your profile." };
};

// PumpAdmin Login
export const pumpAdminDirectLogin = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user || !user.roles.includes("pumpAdmin"))
    throw new Error("Email or password is incorrect");
  if (!user.isActive) throw new Error("Account is deactivated. Contact support.");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Email or password is incorrect");

  const pump = await Pump.findOne({ owner: user._id });
  if (pump?.approvalStatus === "pending") throw new Error("Your pump is pending SuperAdmin approval");
  if (pump?.approvalStatus === "rejected") throw new Error("Your pump registration has been rejected");

  const otp = generateOTP();
  await User.findByIdAndUpdate(user._id, { otp, otpExpiry: new Date(Date.now() + 10 * 60 * 1000) });
  await sendOTPEmail(user.email, user.name, otp);

  return { message: "OTP sent to your email.", identifier: email };
};

// Email Login
export const loginWithEmail = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("Invalid credentials");
  if (!user.isActive) throw new Error("Account is deactivated");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid credentials");

  if (user.roles.includes("superAdmin")) {
    const token = generateToken({ id: user._id, roles: user.roles, activeRole: "superAdmin" });
    return { token, user: userResponse({ ...user.toObject(), activeRole: "superAdmin" }), otpMethod: "none" };
  }

  if (user.roles.includes("pumpAdmin") && !user.roles.includes("customer")) {
    const pump = await Pump.findOne({ owner: user._id });
    if (pump?.approvalStatus === "pending") throw new Error("Your pump is pending SuperAdmin approval");
    if (pump?.approvalStatus === "rejected") throw new Error("Your pump registration has been rejected");
  }

  const otp = generateOTP();
  await User.findByIdAndUpdate(user._id, { otp, otpExpiry: new Date(Date.now() + 10 * 60 * 1000) });
  await sendOTPEmail(user.email, user.name, otp);

  return { message: "OTP sent to your email.", otpMethod: "email", identifier: email, roles: user.roles };
};

// Phone Login — Twilio Verify SMS OTP
export const loginWithPhone = async ({ phone }) => {
  const cleaned = phone.toString().replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(cleaned)) throw new Error("Invalid phone number");

  const customer = await Customer.findOne({ phone: cleaned, isDeleted: false, isBlocked: false });
  if (!customer) throw new Error("This mobile number is not registered. Please register first or use email login.");

  const user = await User.findById(customer.user);
  if (!user) throw new Error("Account not found. Please register first.");
  if (!user.isActive) throw new Error("Account is deactivated. Contact support.");

  // Twilio Verify se SMS OTP bhejo
  await twilioSendOTP(cleaned);

  return {
    message: `OTP sent to +91${cleaned}`,
    otpMethod: "sms",
    identifier: cleaned,
  };
};

// Verify OTP — email (DB check) or sms (Twilio Verify check)
export const verifyOTP = async ({ identifier, otp, method }) => {
  let user;

  if (method === "sms") {
    const cleaned = identifier.toString().replace(/\D/g, "");

    // Twilio Verify se check karo
    const approved = await twilioVerifyOTP(cleaned, otp.toString());
    if (!approved) throw new Error("Invalid OTP");

    const customer = await Customer.findOne({ phone: cleaned, isDeleted: false });
    if (!customer) throw new Error("Account not found");
    user = await User.findById(customer.user);
  } else {
    // Email OTP — DB se check karo
    user = await User.findOne({ email: identifier });
    if (!user) throw new Error("User not found");
    if (!user.otp || !user.otpExpiry) throw new Error("No OTP requested. Please login again.");
    if (new Date() > user.otpExpiry) throw new Error("OTP has expired. Please login again.");
    if (user.otp !== otp.toString()) throw new Error("Invalid OTP");
    await User.findByIdAndUpdate(user._id, { otp: null, otpExpiry: null });
  }

  if (!user) throw new Error("User not found");
  if (!user.isActive) throw new Error("Account is deactivated");

  if (user.activeRole === "pumpAdmin") {
    const pump = await Pump.findOne({ owner: user._id });
    if (pump?.approvalStatus === "pending") throw new Error("Your pump is pending SuperAdmin approval");
    if (pump?.approvalStatus === "rejected") throw new Error("Your pump has been rejected");
  }

  if (user.roles.includes("pumpAdmin") && user.activeRole !== "pumpAdmin") {
    user.activeRole = "pumpAdmin";
    await user.save();
  }

  const token = generateToken({ id: user._id, roles: user.roles, activeRole: user.activeRole });
  return { token, user: userResponse(user) };
};

export const loginUser = loginWithEmail;

// Switch Role
export const switchRole = async (userId, newRole) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (!user.roles.includes(newRole)) throw new Error(`You don't have the ${newRole} role`);

  if (newRole === "pumpAdmin") {
    const pump = await Pump.findOne({ owner: userId });
    if (!pump) throw new Error("No pump found for this account");
    if (pump.approvalStatus === "pending") throw new Error("Your pump is pending SuperAdmin approval");
    if (pump.approvalStatus === "rejected") throw new Error("Your pump has been rejected");
  }

  user.activeRole = newRole;
  await user.save();

  const token = generateToken({ id: user._id, roles: user.roles, activeRole: newRole });
  return { token, user: userResponse(user) };
};
