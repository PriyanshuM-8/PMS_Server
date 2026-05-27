import User from "../models/user.model.js";
import Pump from "../models/pump.model.js";
import Booking from "../models/booking.model.js";
import Mechanic from "../models/mechanic.model.js";
import Customer from "../models/customer.model.js";
import { sendApprovalEmail, sendRejectionEmail } from "../utils/nodemailer.js";

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export const getDashboardStats = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    totalPumps, pendingPumps, approvedPumps, rejectedPumps,
    totalCustomers, totalMechanics,
    totalBookings, bookingsToday,
    revenueToday, revenueMonth, revenueTotal, superAdminWallet
  ] = await Promise.all([
    Pump.countDocuments(),
    Pump.countDocuments({ approvalStatus: "pending" }),
    Pump.countDocuments({ approvalStatus: "approved" }),
    Pump.countDocuments({ approvalStatus: "rejected" }),
    Customer.countDocuments({ isDeleted: false }),
    Mechanic.countDocuments({ isDeleted: false }),
    Booking.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: todayStart } }),
    Booking.aggregate([
      { $match: { status: "completed", createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Booking.aggregate([
      { $match: { status: "completed", createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Booking.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    User.aggregate([
      { $match: { roles: "superAdmin" } },
      { $group: { _id: null, total: { $sum: "$superAdminEarnings" } } }
    ])
  ]);

  return {
    totalPumps, pendingPumps, approvedPumps, rejectedPumps,
    totalCustomers, totalMechanics,
    totalBookings, bookingsToday,
    revenueToday: revenueToday[0]?.total || 0,
    revenueMonth: revenueMonth[0]?.total || 0,
    revenueTotal: revenueTotal[0]?.total || 0,
    superAdminWallet: superAdminWallet[0]?.total || 0,
  };
};

// ─── Chart — last 7 days ──────────────────────────────────────────────────────
export const getSystemChart = async () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }

  return await Promise.all(
    days.map(async (day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const [bookings, revenue, newPumps] = await Promise.all([
        Booking.countDocuments({ createdAt: { $gte: day, $lt: next } }),
        Booking.aggregate([
          { $match: { status: "completed", createdAt: { $gte: day, $lt: next } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Pump.countDocuments({ createdAt: { $gte: day, $lt: next } }),
      ]);
      return {
        date: day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
        bookings,
        revenue: revenue[0]?.total || 0,
        newPumps,
      };
    })
  );
};

// ─── Pumps ────────────────────────────────────────────────────────────────────
export const getPendingRequests = async () => {
  return await Pump.find({ approvalStatus: "pending" })
    .populate("owner", "name email phone")
    .sort({ createdAt: -1 });
};

export const getAllPumps = async (filter = {}) => {
  return await Pump.find(filter)
    .populate("owner", "name email phone")
    .sort({ createdAt: -1 });
};

export const getPumpById = async (pumpId) => {
  const pump = await Pump.findById(pumpId).populate("owner", "name email phone");
  if (!pump) throw new Error("Pump not found");
  return pump;
};

export const approvePump = async (pumpId) => {
  const pump = await Pump.findByIdAndUpdate(
    pumpId,
    { approvalStatus: "approved" },
    { new: true }
  ).populate("owner", "name email phone");
  if (!pump) throw new Error("Pump not found");
  await sendApprovalEmail(pump.owner.email, pump.owner.name, pump.pumpName);
  return pump;
};

export const rejectPump = async (pumpId, reason) => {
  if (!reason) throw new Error("Rejection reason is required");
  const pump = await Pump.findByIdAndUpdate(
    pumpId,
    { approvalStatus: "rejected", rejectionReason: reason },
    { new: true }
  ).populate("owner", "name email phone");
  if (!pump) throw new Error("Pump not found");
  await sendRejectionEmail(pump.owner.email, pump.owner.name, pump.pumpName, reason);
  return pump;
};

export const togglePumpStatus = async (pumpId) => {
  const pump = await Pump.findById(pumpId);
  if (!pump) throw new Error("Pump not found");
  if (pump.approvalStatus !== "approved") throw new Error("Only approved pumps can be toggled");
  pump.status = pump.status === "active" ? "inactive" : "active";
  await pump.save();
  return pump;
};

export const deletePump = async (pumpId) => {
  const pump = await Pump.findByIdAndDelete(pumpId);
  if (!pump) throw new Error("Pump not found");
  await User.findByIdAndUpdate(pump.owner, { isActive: false });
  return { message: "Pump deleted successfully" };
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const getAllUsers = async (roleFilter) => {
  const query = roleFilter ? { roles: roleFilter } : {};
  const users = await User.find(query)
    .select("-password -otp -otpExpiry -pendingPhone")
    .sort({ createdAt: -1 })
    .lean();

  if (roleFilter === "pumpAdmin") {
    const pumps = await Pump.find({ owner: { $in: users.map(u => u._id) } })
      .select("owner approvalStatus").lean();
    const pumpMap = {};
    pumps.forEach(p => { pumpMap[p.owner.toString()] = p; });
    return users.map(u => ({
      ...u,
      pump: pumpMap[u._id.toString()] || null,
    }));
  }

  return users;
};

export const approvePumpAdmin = async (userId) => {
  const pump = await Pump.findOneAndUpdate(
    { owner: userId },
    { approvalStatus: "approved" },
    { new: true }
  ).populate("owner", "name email");
  if (!pump) throw new Error("No pump found for this user");
  await sendApprovalEmail(pump.owner.email, pump.owner.name, pump.pumpName);
  return pump;
};

export const toggleUserStatus = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (user.roles.includes("superAdmin")) throw new Error("Cannot deactivate superAdmin");
  user.isActive = !user.isActive;
  await user.save();
  return user;
};

export const getUserDetails = async (userId) => {
  const user = await User.findById(userId).select("-password -otp -otpExpiry -pendingPhone").lean();
  if (!user) throw new Error("User not found");

  let profile = null;
  let bookings = [];

  if (user.roles.includes("mechanic")) {
    profile = await Mechanic.findOne({ user: userId }).populate("pump", "pumpName").lean();
    if (profile) {
      bookings = await Booking.find({ mechanic: profile._id })
        .populate("customer", "name phone")
        .populate("pump", "pumpName")
        .sort({ createdAt: -1 })
        .lean();
    }
  } else if (user.roles.includes("pumpAdmin")) {
    profile = await Pump.findOne({ owner: userId }).lean();
    if (profile) {
      bookings = await Booking.find({ pump: profile._id })
        .populate("customer", "name phone")
        .populate("mechanic", "name phone")
        .sort({ createdAt: -1 })
        .lean();
    }
  } else if (user.roles.includes("customer")) {
    profile = await Customer.findOne({ user: userId }).lean();
    if (profile) {
      bookings = await Booking.find({ customer: profile._id })
        .populate("mechanic", "name phone")
        .populate("pump", "pumpName")
        .sort({ createdAt: -1 })
        .lean();
    }
  }

  return { ...user, profile, bookings };
};

export const getAllMechanics = async () => {
  return await Mechanic.find({ isDeleted: false })
    .select("-password")
    .sort({ createdAt: -1 });
};

// All Bookings
export const getAllBookings = async ({ status, serviceType, page = 1, limit = 20 } = {}) => {
  const query = {};
  if (status) query.status = status;
  if (serviceType) query.serviceType = serviceType;
  const skip = (page - 1) * limit;
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate("customer", "name phone")
      .populate("pump", "pumpName")
      .populate("mechanic", "name phone")
      .populate("deliveryBoy", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(query),
  ]);
  return { bookings, total, page, pages: Math.ceil(total / limit) };
};

// ─── Wallet / Withdrawal ──────────────────────────────────────────────────────
export const withdrawSuperAdminEarnings = async (userId) => {
  // Only the main superAdmin should do this. Since only superAdmin can access this route, we check the user.
  const user = await User.findById(userId);
  if (!user || !user.roles.includes("superAdmin")) {
    throw new Error("Unauthorized");
  }

  const amount = user.superAdminEarnings || 0;
  if (amount <= 0) {
    throw new Error("No earnings to withdraw.");
  }

  // Reset earnings to 0
  user.superAdminEarnings = 0;
  await user.save();

  return { withdrawnAmount: amount, newBalance: 0 };
};
