import User from "../models/user.model.js";
import Customer from "../models/customer.model.js";
import { sendOTP } from "../utils/twilio.js";

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─── Get Me ───────────────────────────────────────────────────────────────────
export const getMe = async (userId) => {
  const user = await User.findById(userId).select("-password -otp -otpExpiry");
  if (!user) throw new Error("User not found");
  const profile = await Customer.findOne({ user: userId, isDeleted: false });
  return { user, profile: profile || null, profileSetup: !!profile };
};

// ─── Get Profile ──────────────────────────────────────────────────────────────
export const getMyProfile = async (userId) => {
  const customer = await Customer.findOne({ user: userId, isDeleted: false })
    .populate("user", "email isActive");
  if (!customer) throw new Error("Profile not found");
  return customer;
};

// ─── Update Profile — name + profilePhoto ────────────────────────────────────
export const updateProfile = async (userId, data, file) => {
  const name = data?.name?.trim();

  const updateData = {
    ...(name && { name }),
    ...(file && { profileImage: file.path }),
  };

  // Kuch update nahi hai toh current profile return karo — error mat throw karo
  if (Object.keys(updateData).length === 0) {
    const existing = await Customer.findOne({ user: userId, isDeleted: false });
    if (!existing) throw new Error("Profile not found");
    return existing;
  }

  // name User model mein bhi sync karo
  if (name) await User.findByIdAndUpdate(userId, { name });

  const customer = await Customer.findOneAndUpdate(
    { user: userId, isDeleted: false },
    { $set: updateData },
    { new: true, runValidators: true }
  );
  if (!customer) throw new Error("Profile not found");
  return customer;
};

// ─── Phone Change Request — old verify + new number OTP ─────────────────────
export const requestPhoneChange = async (userId, oldPhone, newPhone) => {
  if (!oldPhone || !newPhone) throw new Error("Both old and new phone numbers are required");

  const oldCleaned = oldPhone.toString().replace(/\D/g, "");
  const newCleaned = newPhone.toString().replace(/\D/g, "");

  if (!/^[6-9]\d{9}$/.test(newCleaned)) throw new Error("Invalid new phone number");

  // Old number match karo
  const currentCustomer = await Customer.findOne({ user: userId, isDeleted: false });
  if (!currentCustomer) throw new Error("Profile not found");
  if (currentCustomer.phone !== oldCleaned) throw new Error("Old phone number is incorrect");

  // New number same nahi hona chahiye
  if (oldCleaned === newCleaned) throw new Error("New number must be different from current number");

  // New number kisi aur ke paas nahi hona chahiye
  const existing = await Customer.findOne({
    phone: newCleaned,
    user: { $ne: userId },
    isDeleted: false,
  });
  if (existing) throw new Error("This number is already registered with another account");

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  await User.findByIdAndUpdate(userId, { otp, otpExpiry, pendingPhone: newCleaned });

  await sendOTP(`+91${newCleaned}`, otp);

  return { message: `OTP sent to +91${newCleaned}` };
};

// ─── Phone Change Verify ──────────────────────────────────────────────────────
export const verifyPhoneChange = async (userId, otp) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (!user.otp || !user.otpExpiry) throw new Error("No OTP requested. Please request again.");
  if (new Date() > user.otpExpiry) throw new Error("OTP has expired. Please request again.");
  if (user.otp !== otp.toString()) throw new Error("Invalid OTP");

  const newPhone = user.pendingPhone;
  if (!newPhone) throw new Error("No pending phone change request");

  await User.findByIdAndUpdate(userId, {
    phone: newPhone,
    otp: null,
    otpExpiry: null,
    pendingPhone: null,
  });

  const customer = await Customer.findOneAndUpdate(
    { user: userId, isDeleted: false },
    { phone: newPhone },
    { new: true }
  );
  if (!customer) throw new Error("Profile not found");

  return { message: "Phone number updated successfully", data: customer };
};

// ─── Add Vehicle ──────────────────────────────────────────────────────────────
export const addVehicle = async (userId, vehicleData) => {
  const { vehicleType, vehicleNumber, fuelType } = vehicleData;
  if (!vehicleNumber) throw new Error("Vehicle number is required");

  const customer = await Customer.findOneAndUpdate(
    { user: userId, isDeleted: false },
    { $push: { vehicles: { vehicleType, vehicleNumber: vehicleNumber.toUpperCase(), fuelType } } },
    { new: true }
  );
  if (!customer) throw new Error("Profile not found");
  return customer;
};

// ─── Remove Vehicle ───────────────────────────────────────────────────────────
export const removeVehicle = async (userId, vehicleId) => {
  const customer = await Customer.findOneAndUpdate(
    { user: userId, isDeleted: false },
    { $pull: { vehicles: { _id: vehicleId } } },
    { new: true }
  );
  if (!customer) throw new Error("Profile not found");
  return customer;
};
