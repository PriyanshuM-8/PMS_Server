import Mechanic from "../models/mechanic.model.js";
import Pump from "../models/pump.model.js";

const getApprovedPump = async (pumpAdminId) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Approved pump not found");
  return pump;
};

// ─── PumpAdmin: Add Internal Mechanic ────────────────────────────────────────
export const addInternalMechanic = async (data, pumpAdminId, files) => {
  const { name, phone, email, upiId, skills, experience, address } = data;

  const pump = await getApprovedPump(pumpAdminId);

  const existing = await Mechanic.findOne({ phone, isDeleted: false });
  if (existing) throw new Error("Mechanic with this phone already exists");

  if (!upiId) throw new Error("UPI ID is required");

  // Auto-create User account for the mechanic to allow login
  const User = (await import("../models/user.model.js")).default;
  const bcrypt = (await import("bcryptjs")).default;
  
  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({
      name,
      email: email || `${phone}@mechanic.local`,
      password: await bcrypt.hash(phone.toString(), 10),
      phone,
      roles: ["mechanic"],
      activeRole: "mechanic",
    });
  } else {
    if (!user.roles.includes("mechanic")) {
      user.roles.push("mechanic");
      await user.save();
    }
  }

  const mechanic = await Mechanic.create({
    name, phone, email, upiId,
    user: user._id,
    skills: skills ? (Array.isArray(skills) ? skills : JSON.parse(skills)) : [],
    experience: experience || 0,
    address,
    type: "internal",
    pump: pump._id,
    addedBy: pumpAdminId,
    aadharPhoto: files?.aadharPhoto?.[0]?.secure_url || files?.aadharPhoto?.[0]?.path || "not-provided",
    profileImage: files?.profileImage?.[0]?.secure_url || files?.profileImage?.[0]?.path || "",
    isVerified: true,
    status: "active",
  });

  return mechanic;
};

// ─── PumpAdmin: Get Pending External Mechanics ───────────────────────────────
export const getPendingExternalMechanics = async (pumpAdminId) => {
  const pump = await getApprovedPump(pumpAdminId);
  
  return await Mechanic.find({
    type: "external",
    isDeleted: false,
    pumpConnections: { $elemMatch: { pump: pump._id, status: "pending" } },
  }).select("-password");
};

// ─── PumpAdmin: Approve External Mechanic ────────────────────────────────────
export const approveExternalMechanic = async (mechanicId, pumpAdminId) => {
  const pump = await getApprovedPump(pumpAdminId);

  const mechanic = await Mechanic.findOneAndUpdate(
    { _id: mechanicId, pumpConnections: { $elemMatch: { pump: pump._id, status: "pending" } } },
    { $set: { "pumpConnections.$.status": "approved" } },
    { new: true }
  ).select("-password");

  if (!mechanic) throw new Error("Mechanic not found or already processed");
  return mechanic;
};

// ─── PumpAdmin: Reject External Mechanic ─────────────────────────────────────
export const rejectExternalMechanic = async (mechanicId, pumpAdminId) => {
  const pump = await getApprovedPump(pumpAdminId);

  const mechanic = await Mechanic.findOneAndUpdate(
    { _id: mechanicId, pumpConnections: { $elemMatch: { pump: pump._id, status: "pending" } } },
    { $set: { "pumpConnections.$.status": "rejected" } },
    { new: true }
  ).select("-password");

  if (!mechanic) throw new Error("Mechanic not found or already processed");
  return mechanic;
};

// ─── PumpAdmin: Get All My Mechanics ─────────────────────────────────────────
export const getMyMechanics = async (pumpAdminId) => {
  const pump = await getApprovedPump(pumpAdminId);

  const [internal, external] = await Promise.all([
    Mechanic.find({ type: "internal", pump: pump._id, isDeleted: false }).select("-password"),
    Mechanic.find({
      type: "external",
      isDeleted: false,
      pumpConnections: { $elemMatch: { pump: pump._id, status: "approved" } },
    }).select("-password"),
  ]);

  return { internal, external };
};

// ─── PumpAdmin: Toggle Mechanic Status ───────────────────────────────────────
export const toggleMechanicStatus = async (mechanicId, pumpAdminId) => {
  const pump = await getApprovedPump(pumpAdminId);

  const mechanic = await Mechanic.findOne({
    _id: mechanicId,
    isDeleted: false,
    $or: [
      { type: "internal", pump: pump._id },
      { type: "external", pumpConnections: { $elemMatch: { pump: pump._id, status: "approved" } } },
    ],
  });
  if (!mechanic) throw new Error("Mechanic not found under your pump");

  mechanic.status = mechanic.status === "active" ? "inactive" : "active";
  await mechanic.save();
  return mechanic;
};

// PumpAdmin: Toggle Mechanic Availability
export const toggleMechanicAvailability = async (mechanicId, pumpAdminId) => {
  const pump = await getApprovedPump(pumpAdminId);
  const mechanic = await Mechanic.findOne({
    _id: mechanicId, isDeleted: false,
    $or: [
      { type: "internal", pump: pump._id },
      { type: "external", pumpConnections: { $elemMatch: { pump: pump._id, status: "approved" } } },
    ],
  });
  if (!mechanic) throw new Error("Mechanic not found under your pump");
  mechanic.isAvailable = !mechanic.isAvailable;
  await mechanic.save();
  return mechanic;
};

// PumpAdmin: Delete Internal Mechanic
export const deleteInternalMechanic = async (mechanicId, pumpAdminId) => {
  const pump = await getApprovedPump(pumpAdminId);
  const mechanic = await Mechanic.findOne({ _id: mechanicId, type: "internal", pump: pump._id, isDeleted: false });
  if (!mechanic) throw new Error("Internal mechanic not found under your pump");
  mechanic.isDeleted = true;
  await mechanic.save();
  return { message: "Mechanic removed" };
};

// PumpAdmin: Get Mechanic Jobs
export const getMechanicJobHistory = async (mechanicId, pumpAdminId) => {
  const pump = await getApprovedPump(pumpAdminId);
  const mechanic = await Mechanic.findOne({
    _id: mechanicId, isDeleted: false,
    $or: [
      { type: "internal", pump: pump._id },
      { type: "external", pumpConnections: { $elemMatch: { pump: pump._id, status: "approved" } } },
    ],
  });
  if (!mechanic) throw new Error("Mechanic not found");

  const Booking = (await import("../models/booking.model.js")).default;
  const jobs = await Booking.find({ mechanic: mechanicId, pump: pump._id })
    .populate("customer", "name phone")
    .sort({ createdAt: -1 })
    .limit(20);
  return { mechanic, jobs };
};
