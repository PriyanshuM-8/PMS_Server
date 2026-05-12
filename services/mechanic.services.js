import Mechanic from "../models/mechanic.model.js";
import Pump from "../models/pump.model.js";

const getApprovedPump = async (pumpAdminId) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Approved pump not found");
  return pump;
};

// ─── PumpAdmin: Add Internal Mechanic ────────────────────────────────────────
export const addInternalMechanic = async (data, pumpAdminId, files) => {
  const { name, phone, email, skills, experience, address } = data;

  const pump = await getApprovedPump(pumpAdminId);

  const existing = await Mechanic.findOne({ phone, isDeleted: false });
  if (existing) throw new Error("Mechanic with this phone already exists");

  const mechanic = await Mechanic.create({
    name, phone, email,
    skills: skills ? (Array.isArray(skills) ? skills : JSON.parse(skills)) : [],
    experience: experience || 0,
    address,
    type: "internal",
    pump: pump._id,
    addedBy: pumpAdminId,
    aadharPhoto: files?.aadharPhoto?.[0]?.path || "not-provided",
    profileImage: files?.profileImage?.[0]?.path || "",
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

// ─── Booking: Find Available Mechanic ────────────────────────────────────────
export const findAvailableMechanic = async (pumpId, skill) => {
  const baseQuery = {
    isAvailable: true,
    currentStatus: "idle",
    status: "active",
    isDeleted: false,
    ...(skill && { skills: skill }),
  };

  const internal = await Mechanic.findOne({ ...baseQuery, type: "internal", pump: pumpId });
  if (internal) return internal;

  const external = await Mechanic.findOne({
    ...baseQuery,
    type: "external",
    pumpConnections: { $elemMatch: { pump: pumpId, status: "approved" } },
  });

  return external || null;
};
