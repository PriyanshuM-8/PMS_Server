import User from "../models/user.model.js";
import Pump from "../models/pump.model.js";
import Booking from "../models/booking.model.js";
import Customer from "../models/customer.model.js";
import Mechanic from "../models/mechanic.model.js";

const getApprovedPump = async (userId) => {
  const pump = await Pump.findOne({ owner: userId, approvalStatus: "approved" });
  if (!pump) throw new Error("Approved pump not found");
  return pump;
};

// ─── Profile ──────────────────────────────────────────────────────────────────
export const getMyProfile = async (userId) => {
  const user = await User.findById(userId).select("-password -otp -otpExpiry");
  if (!user) throw new Error("User not found");
  return user;
};

export const getMyPump = async (userId) => {
  const pump = await Pump.findOne({ owner: userId });
  if (!pump) throw new Error("Pump not found");
  return pump;
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export const getDashboardStats = async (userId) => {
  const pump = await getApprovedPump(userId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    totalOrdersToday,
    pendingOrders,
    activeDeliveries,
    completedToday,
    cancelledToday,
    revenueToday,
    revenueMonth,
    totalCustomers,
    availableMechanics,
    totalFuelDelivered,
  ] = await Promise.all([
    Booking.countDocuments({ pump: pump._id, createdAt: { $gte: todayStart } }),
    Booking.countDocuments({ pump: pump._id, status: "pending" }),
    Booking.countDocuments({ pump: pump._id, status: { $in: ["accepted", "assigned", "in_progress"] } }),
    Booking.countDocuments({ pump: pump._id, status: "completed", createdAt: { $gte: todayStart } }),
    Booking.countDocuments({ pump: pump._id, status: "cancelled", createdAt: { $gte: todayStart } }),
    Booking.aggregate([
      { $match: { pump: pump._id, status: "completed", createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Booking.aggregate([
      { $match: { pump: pump._id, status: "completed", createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Booking.distinct("customer", { pump: pump._id }),
    Mechanic.countDocuments({
      isDeleted: false, status: "active", isAvailable: true,
      $or: [
        { type: "internal", pump: pump._id },
        { type: "external", pumpConnections: { $elemMatch: { pump: pump._id, status: "approved" } } },
      ],
    }),
    Booking.aggregate([
      { $match: { pump: pump._id, status: "completed", serviceType: "fuel" } },
      { $group: { _id: null, total: { $sum: "$fuelDetails.quantity" } } },
    ]),
  ]);

  return {
    totalOrdersToday,
    pendingOrders,
    activeDeliveries,
    completedToday,
    cancelledToday,
    revenueToday: revenueToday[0]?.total || 0,
    revenueMonth: revenueMonth[0]?.total || 0,
    totalCustomers: totalCustomers.length,
    availableMechanics,
    totalFuelDelivered: totalFuelDelivered[0]?.total || 0,
  };
};

// ─── Dashboard Chart — last 7 days bookings ───────────────────────────────────
export const getBookingChart = async (userId) => {
  const pump = await getApprovedPump(userId);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }

  const results = await Promise.all(
    days.map(async (day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const [bookings, revenue] = await Promise.all([
        Booking.countDocuments({ pump: pump._id, createdAt: { $gte: day, $lt: next } }),
        Booking.aggregate([
          { $match: { pump: pump._id, status: "completed", createdAt: { $gte: day, $lt: next } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);
      return {
        date: day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
        bookings,
        revenue: revenue[0]?.total || 0,
      };
    })
  );

  return results;
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const getMyCustomers = async (userId) => {
  const pump = await getApprovedPump(userId);

  const customerIds = await Booking.distinct("customer", { pump: pump._id });
  const customers = await Customer.find({ _id: { $in: customerIds }, isDeleted: false })
    .populate("user", "email isActive")
    .select("-__v");

  return customers;
};

export const toggleCustomerBlock = async (userId, customerId) => {
  const pump = await getApprovedPump(userId);

  // Verify customer has booking with this pump
  const hasBooking = await Booking.exists({ pump: pump._id, customer: customerId });
  if (!hasBooking) throw new Error("Customer not found under your pump");

  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error("Customer not found");

  customer.isBlocked = !customer.isBlocked;
  await customer.save();
  return customer;
};

// ─── Fuel Prices ──────────────────────────────────────────────────────────────
export const updateFuelPrices = async (userId, { petrol, diesel }) => {
  const pump = await getApprovedPump(userId);
  pump.fuelPrices = { petrol, diesel, lastUpdated: new Date() };
  await pump.save();
  return pump.fuelPrices;
};

export const getFuelPricesByPumpId = async (pumpId) => {
  const pump = await Pump.findById(pumpId).select("fuelPrices pumpName");
  if (!pump) throw new Error("Pump not found");
  return pump.fuelPrices;
};

export const getMyFuelPrices = async (userId) => {
  const pump = await getApprovedPump(userId);
  return pump.fuelPrices;
};
