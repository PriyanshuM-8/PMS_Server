import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Pump from "../models/pump.model.js";
import Mechanic from "../models/mechanic.model.js";
import Customer from "../models/customer.model.js";
import { sendOTPEmail, sendNewRegistrationAlert } from "../utils/nodemailer.js";
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
    profileImage: files?.profileImage?.[0]?.secure_url || files?.profileImage?.[0]?.path || "",
    aadharPhoto: files?.aadharPhoto?.[0]?.secure_url || files?.aadharPhoto?.[0]?.path || "",
    ownerIdProof: files?.ownerIdProof?.[0]?.secure_url || files?.ownerIdProof?.[0]?.path || "",
  });

  await sendNewRegistrationAlert(name, email, pumpName);
  return { message: "Registration successful. Awaiting SuperAdmin approval." };
};

// Mechanic Register
export const registerMechanicRole = async ({ phone, name, upiId, skills, experience, address, lng, lat }, files) => {
  if (!phone || !name || !upiId) throw new Error("name, phone, and upiId required");

  const cleaned = phone.toString().replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(cleaned)) throw new Error("Invalid phone number");

  // Phone se existing mechanic check
  const existingMechanic = await Mechanic.findOne({ phone: cleaned, isDeleted: false });
  if (existingMechanic) throw new Error("Mechanic with this phone already registered");

  // User create karo (phone-based login ke liye)
  let user = await User.findOne({ phone: cleaned });
  if (!user) {
    user = await User.create({
      name,
      email: `${cleaned}@mechanic.local`,
      password: await bcrypt.hash(cleaned, 10), // dummy password
      phone: cleaned,
      roles: ["mechanic"],
      activeRole: "mechanic",
    });
  } else {
    if (!user.roles.includes("mechanic")) {
      user.roles.push("mechanic");
      await user.save();
    }
  }

  const validSkills = ["engine", "puncture", "battery", "oil", "all work"];
  const skillsArray = Array.isArray(skills)
    ? skills.map(s => s.toLowerCase().trim()).filter(s => validSkills.includes(s))
    : [];

  const mechanicData = {
    user: user._id, name, phone: cleaned, upiId,
    skills: skillsArray,
    experience: experience || 0,
    address: address || "",
    type: "external",
    aadharPhoto: files?.aadharPhoto?.[0]?.secure_url || files?.aadharPhoto?.[0]?.path || "not-provided",
    profileImage: files?.profileImage?.[0]?.secure_url || files?.profileImage?.[0]?.path || "",
    pumpConnections: [],
    isAvailable: true,
    status: "active",
  };

  // Location optional — agar diya toh set karo
  if (lng && lat) {
    mechanicData.location = { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] };
  }

  const mechanic = await Mechanic.create(mechanicData);

  // Nearby pumps se connect karo (optional)
  if (lng && lat) {
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
  }

  return { message: "Registration successful! You can now login with your phone number." };
};

// PumpAdmin Login
export const pumpAdminDirectLogin = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+password");
  if (!user || !user.roles.includes("pumpAdmin") || !user.password)
    throw new Error("Email or password is incorrect");
  if (!user.isActive) throw new Error("Account is deactivated. Contact support.");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Email or password is incorrect");

  const pump = await Pump.findOne({ owner: user._id });
  if (!pump) throw new Error("No pump found for this account");
  if (pump.approvalStatus === "pending") throw new Error("Your pump is pending SuperAdmin approval");
  if (pump.approvalStatus === "rejected") throw new Error("Your pump registration has been rejected");

  const otp = generateOTP();
  await User.findByIdAndUpdate(user._id, { otp, otpExpiry: new Date(Date.now() + 10 * 60 * 1000) });
  await sendOTPEmail(user.email, user.name, otp);

  return { message: "OTP sent to your email.", identifier: email };
};

// Forgot Password — send OTP
export const forgotPasswordService = async ({ email, phone }) => {
  let user;
  let identifier;
  let method;

  if (email) {
    user = await User.findOne({ email });
    if (!user) throw new Error("No account found with this email");
    identifier = email;
    method = "email";
  } else if (phone) {
    const cleaned = phone.toString().replace(/\D/g, "");
    
    // Check mechanic
    const mechanic = await Mechanic.findOne({ phone: cleaned, isDeleted: false });
    if (mechanic) {
      user = await User.findById(mechanic.user);
    } else {
      // Check customer
      const customer = await Customer.findOne({ phone: cleaned, isDeleted: false });
      if (customer) {
        user = await User.findById(customer.user);
      }
    }
    
    // Fallback to checking User directly just in case
    if (!user) {
      user = await User.findOne({ phone: cleaned });
    }

    if (!user) throw new Error("No account found with this mobile number");
    identifier = cleaned;
    method = "sms";
  } else {
    throw new Error("Please provide email or phone");
  }

  if (!user.isActive) throw new Error("Account is deactivated. Contact support.");

  if (method === "email") {
    const otp = generateOTP();
    await User.findByIdAndUpdate(user._id, { otp, otpExpiry: new Date(Date.now() + 10 * 60 * 1000) });
    await sendOTPEmail(user.email, user.name, otp);
    return { message: "OTP sent to your email.", identifier, method };
  } else if (method === "sms") {
    const demoOtp = generateOTP();
    await User.findByIdAndUpdate(user._id, { otp: demoOtp, otpExpiry: new Date(Date.now() + 10 * 60 * 1000) });
    return { message: "Demo OTP generated for mobile number", identifier, method, devOtp: demoOtp };
  }
};

// Reset Password — verify OTP + set new password
export const resetPasswordService = async ({ email, phone, otp, newPassword }) => {
  let user;
  let identifier;
  let method;

  if (email) {
    user = await User.findOne({ email });
    method = "email";
  } else if (phone) {
    const cleaned = phone.toString().replace(/\D/g, "");
    
    const mechanic = await Mechanic.findOne({ phone: cleaned, isDeleted: false });
    if (mechanic) user = await User.findById(mechanic.user);
    else {
      const customer = await Customer.findOne({ phone: cleaned, isDeleted: false });
      if (customer) user = await User.findById(customer.user);
    }
    
    if (!user) {
      user = await User.findOne({ phone: cleaned });
    }
    
    identifier = cleaned;
    method = "sms";
  }

  if (!user) throw new Error("User not found");
  if (!user.otp || !user.otpExpiry) throw new Error("No OTP requested. Please try again.");
  if (new Date() > user.otpExpiry) throw new Error("OTP has expired. Please try again.");

  if (method === "email") {
    if (user.otp !== otp.toString()) throw new Error("Invalid OTP");
  } else if (method === "sms") {
    if (user.otp !== otp.toString()) throw new Error("Invalid OTP");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(user._id, { password: hashed, otp: null, otpExpiry: null });
  return { message: "Password reset successfully. Please login." };
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

  if (user.roles.includes("pumpAdmin")) {
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

  // Mechanic check first
  const mechanic = await Mechanic.findOne({ phone: cleaned, isDeleted: false });
  if (mechanic) {
    let user;
    if (mechanic.user) {
      user = await User.findById(mechanic.user);
    }
    if (!user) {
      user = await User.findOne({ phone: cleaned });
      if (!user) {
        const bcrypt = (await import("bcryptjs")).default;
        user = await User.create({
          name: mechanic.name,
          email: `${cleaned}@mechanic.local`,
          password: await bcrypt.hash(cleaned, 10),
          phone: cleaned,
          roles: ["mechanic"],
          activeRole: "mechanic",
        });
      } else {
        if (!user.roles.includes("mechanic")) {
          user.roles.push("mechanic");
          await user.save();
        }
      }
      mechanic.user = user._id;
      await mechanic.save();
    }
    if (!user.isActive) throw new Error("Account is deactivated. Contact support.");
  } else {
    // Customer check
    const customer = await Customer.findOne({ phone: cleaned, isDeleted: false, isBlocked: false });
    if (!customer) throw new Error("This mobile number is not registered. Please register first.");
    const user = await User.findById(customer.user);
    if (!user) throw new Error("Account not found. Please register first.");
    if (!user.isActive) throw new Error("Account is deactivated. Contact support.");
  }

  const demoOtp = generateOTP();
  const userToUpdate = mechanic
    ? await User.findById(mechanic.user)
    : await User.findOne({ phone: cleaned });
    
  if (userToUpdate) {
    await User.findByIdAndUpdate(userToUpdate._id, { otp: demoOtp, otpExpiry: new Date(Date.now() + 10 * 60 * 1000) });
  }

  return { message: "Demo OTP generated for mobile number", otpMethod: "sms", identifier: cleaned, devOtp: demoOtp };
};

// Verify OTP — email (DB check) or sms (Twilio Verify check)
export const verifyOTP = async ({ identifier, otp, method }) => {
  let user;

  if (method === "sms") {
    const cleaned = identifier.toString().replace(/\D/g, "");

    const mechanic = await Mechanic.findOne({ phone: cleaned, isDeleted: false });
    const userToCheck = mechanic
      ? await User.findById(mechanic.user)
      : await User.findOne({ phone: cleaned });
    if (!userToCheck) throw new Error("Account not found");
    if (!userToCheck.otp || !userToCheck.otpExpiry) throw new Error("No OTP requested. Please try again.");
    if (new Date() > userToCheck.otpExpiry) throw new Error("OTP expired. Please try again.");
    if (userToCheck.otp !== otp.toString()) throw new Error("Invalid OTP");
    await User.findByIdAndUpdate(userToCheck._id, { otp: null, otpExpiry: null });
    user = userToCheck;
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

  // Mechanic role check
  if (user.roles.includes("mechanic") && !user.roles.includes("pumpAdmin")) {
    user.activeRole = "mechanic";
    await user.save();
    const token = generateToken({ id: user._id, roles: user.roles, activeRole: "mechanic" });
    return { token, user: userResponse(user) };
  }

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
