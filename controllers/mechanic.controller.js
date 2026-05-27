import {
  addInternalMechanic,
  getPendingExternalMechanics,
  approveExternalMechanic,
  rejectExternalMechanic,
  getMyMechanics,
  toggleMechanicStatus,
} from "../services/mechanic.services.js";
import Mechanic from "../models/mechanic.model.js";
import Booking from "../models/booking.model.js";

// ─── Mechanic Self Routes ─────────────────────────────────────────────────────
export const handleGetMe = async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ user: req.user.id, isDeleted: false });
    if (!mechanic) return res.status(404).json({ success: false, message: "Mechanic profile not found" });
    res.status(200).json({ success: true, data: mechanic });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleGetStats = async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ user: req.user.id, isDeleted: false });
    if (!mechanic) return res.status(404).json({ success: false, message: "Mechanic profile not found" });

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [todayJobs, todayEarnings, activeJob, pendingJobDoc] = await Promise.all([
      Booking.countDocuments({ mechanic: mechanic._id, status: "completed", updatedAt: { $gte: todayStart } }),
      Booking.aggregate([{ $match: { mechanic: mechanic._id, status: "completed", updatedAt: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Booking.findOne({ mechanic: mechanic._id, status: { $in: ["assigned", "in_progress"] } }).populate("customer", "name phone"),
      Booking.findOne({ notifiedMechanics: mechanic._id, status: "pending", serviceType: "mechanic" }).populate("customer", "name")
    ]);

    let pendingJob = null;
    if (pendingJobDoc) {
      pendingJob = {
        bookingId: pendingJobDoc._id,
        serviceType: pendingJobDoc.serviceType,
        customerName: pendingJobDoc.customer?.name,
        address: pendingJobDoc.address?.full,
        description: pendingJobDoc.workDetails?.description || "",
        vehicleType: pendingJobDoc.workDetails?.vehicleType // if any
      };
    }

    res.status(200).json({ success: true, data: {
      isAvailable: mechanic.isAvailable,
      currentStatus: mechanic.currentStatus,
      totalJobs: mechanic.totalJobs,
      totalEarnings: mechanic.totalEarnings,
      rating: mechanic.rating,
      todayJobs,
      todayEarnings: todayEarnings[0]?.total || 0,
      activeJob: activeJob || null,
      pendingJob
    }});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleToggleAvailability = async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ user: req.user.id, isDeleted: false });
    if (!mechanic) return res.status(404).json({ success: false, message: "Mechanic profile not found" });
    mechanic.isAvailable = !mechanic.isAvailable;
    mechanic.currentStatus = mechanic.isAvailable ? "idle" : "offline";
    await mechanic.save();
    res.status(200).json({ success: true, data: { isAvailable: mechanic.isAvailable } });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleGetMyJobs = async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ user: req.user.id, isDeleted: false });
    if (!mechanic) return res.status(404).json({ success: false, message: "Mechanic profile not found" });
    const jobs = await Booking.find({ mechanic: mechanic._id })
      .populate("customer", "name phone")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: jobs });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};


export const handleUpdateMe = async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ user: req.user.id, isDeleted: false });
    if (!mechanic) return res.status(404).json({ success: false, message: "Mechanic profile not found" });
    const { name, address, experience, skills } = req.body;
    if (name) mechanic.name = name;
    if (address) mechanic.address = address;
    if (experience !== undefined) mechanic.experience = experience;
    if (skills) mechanic.skills = Array.isArray(skills) ? skills : [skills];
    if (req.files?.profileImage?.[0]?.path) mechanic.profileImage = req.files.profileImage[0].path;
    if (req.files?.aadharPhoto?.[0]?.path) mechanic.aadharPhoto = req.files.aadharPhoto[0].path;
    await mechanic.save();
    res.status(200).json({ success: true, data: mechanic });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleAddInternal = async (req, res) => {
  try {
    const mechanic = await addInternalMechanic(req.body, req.user.id, req.files);
    res.status(201).json({ success: true, message: "Internal mechanic added", data: mechanic });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleGetPending = async (req, res) => {
  try {
    const mechanics = await getPendingExternalMechanics(req.user.id);
    res.status(200).json({ success: true, count: mechanics.length, data: mechanics });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleApprove = async (req, res) => {
  try {
    const mechanic = await approveExternalMechanic(req.params.id, req.user.id);
    res.status(200).json({ success: true, message: "Mechanic approved", data: mechanic });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleReject = async (req, res) => {
  try {
    const mechanic = await rejectExternalMechanic(req.params.id, req.user.id);
    res.status(200).json({ success: true, message: "Mechanic rejected", data: mechanic });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleGetMyMechanics = async (req, res) => {
  try {
    const data = await getMyMechanics(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleToggle = async (req, res) => {
  try {
    const mechanic = await toggleMechanicStatus(req.params.id, req.user.id);
    res.status(200).json({ success: true, message: `Mechanic is now ${mechanic.status}`, data: mechanic });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
