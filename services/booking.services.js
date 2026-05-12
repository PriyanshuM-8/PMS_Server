import Booking from "../models/booking.model.js";
import Customer from "../models/customer.model.js";
import Pump from "../models/pump.model.js";
import Mechanic from "../models/mechanic.model.js";
import { notify, notifyPumpOwners } from "../utils/socket.js";

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const addTimeline = (booking, status, note = "") => {
  if (!booking.statusTimeline) booking.statusTimeline = [];
  booking.statusTimeline.push({ status, time: new Date(), note });
};

// Pricing Calculator
const PLATFORM_FEE = 10;

const getDeliveryFee = (quantity) => {
  if (quantity <= 3) return 25;
  if (quantity <= 7) return 20;
  return 10;
};

export const calcFuelPrice = (quantity, pricePerLitre) => {
  const qty = parseFloat(quantity) || 0;
  const fuelCost = parseFloat((qty * pricePerLitre).toFixed(2));
  const deliveryFee = getDeliveryFee(qty);
  const platformFee = PLATFORM_FEE;
  const total = parseFloat((fuelCost + deliveryFee + platformFee).toFixed(2));
  return { fuelCost, deliveryFee, platformFee, total };
};

// Customer: Create Booking
export const createBooking = async (userId, data) => {
  const { serviceType, addressFull, lng, lat, fuelType, quantity } = data;

  if (!lng || !lat) throw new Error("Location (lng, lat) is required");
  if (!serviceType) throw new Error("serviceType is required: fuel or mechanic");
  if (!addressFull) throw new Error("addressFull is required");

  const customer = await Customer.findOne({ user: userId, isDeleted: false, isBlocked: false });
  if (!customer) throw new Error("Profile not found. Please setup profile first.");

  // 5km ke andar saare approved active pumps
  let nearbyPumps = [];
  try {
    nearbyPumps = await Pump.find({
      approvalStatus: "approved", status: "active",
      "address.location": {
        $near: { $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: 5000 },
      },
    }).select("_id owner pumpName fuelPrices");
  } catch (_) {}

  // Fallback: koi bhi ek approved pump
  if (nearbyPumps.length === 0) {
    const fallback = await Pump.findOne({ approvalStatus: "approved", status: "active" })
      .select("_id owner pumpName fuelPrices");
    if (fallback) nearbyPumps = [fallback];
  }

  const nearestPump = nearbyPumps[0] || null;

  // Pricing with live pump rates
  let breakdown = { fuelCost: 0, deliveryFee: 0, platformFee: PLATFORM_FEE, total: PLATFORM_FEE };
  if (serviceType === "fuel" && fuelType && quantity) {
    const livePrice = nearestPump?.fuelPrices?.[fuelType] || (fuelType === "petrol" ? 96.12 : 89.42);
    breakdown = calcFuelPrice(quantity, livePrice);
  }

  const booking = await Booking.create({
    customer: customer._id,
    serviceType,
    address: { full: addressFull, location: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] } },
    ...(serviceType === "fuel" && fuelType && { fuelDetails: { fuelType, quantity: parseFloat(quantity) || 0 } }),
    ...(serviceType === "mechanic" && data.workDetails && { workDetails: { description: data.workDetails.description } }),
    amount: breakdown.total,
    priceBreakdown: breakdown,
    notifiedPumps: nearbyPumps.map((p) => p._id),
    statusTimeline: [{ status: "pending", time: new Date(), note: "Booking created" }],
  });

  // 5km ke saare pump owners ko notify karo
  notifyPumpOwners(nearbyPumps.map((p) => p.owner), "new_booking", {
    bookingId: booking._id,
    serviceType,
    customerName: customer.name,
    address: addressFull,
    amount: breakdown.total,
    fuelType: fuelType || null,
    quantity: quantity || null,
  });

  return await booking.populate("pump", "pumpName phone address");
};

// Customer: Get My Bookings
export const getMyBookings = async (userId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) return [];
  return await Booking.find({ customer: customer._id })
    .populate("pump", "pumpName phone")
    .populate("mechanic", "name phone profileImage")
    .sort({ createdAt: -1 });
};

// Customer: Get Single Booking
export const getBookingById = async (userId, bookingId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) throw new Error("Profile not found");
  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id })
    .populate("pump", "pumpName phone email")
    .populate("mechanic", "name phone profileImage currentStatus");
  if (!booking) throw new Error("Booking not found");
  return booking;
};

// Customer: Cancel Booking
export const cancelBooking = async (userId, bookingId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) throw new Error("Profile not found");
  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id });
  if (!booking) throw new Error("Booking not found");
  if (!["pending", "accepted"].includes(booking.status))
    throw new Error("Booking cannot be cancelled at this stage");

  booking.status = "cancelled";
  addTimeline(booking, "cancelled", "Cancelled by customer");
  await booking.save();

  // Agar pump assigned hai toh notify karo
  if (booking.pump) {
    const pump = await Pump.findById(booking.pump).select("owner");
    if (pump) notify(pump.owner.toString(), "booking_cancelled", { bookingId: booking._id });
  } else {
    // Saare notified pumps ko notify karo
    const pumps = await Pump.find({ _id: { $in: booking.notifiedPumps } }).select("owner");
    notifyPumpOwners(pumps.map((p) => p.owner), "booking_cancelled", { bookingId: booking._id });
  }

  return booking;
};

// Customer: Submit Rating
export const submitRating = async (userId, bookingId, rating, feedback) => {
  if (!rating || rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");

  const customer = await Customer.findOne({ user: userId });
  if (!customer) throw new Error("Profile not found");

  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id, status: "completed" });
  if (!booking) throw new Error("Booking not found or not completed");
  if (booking.isRated) throw new Error("Already rated");

  booking.rating = rating;
  booking.feedback = feedback || "";
  booking.isRated = true;
  await booking.save();

  if (booking.mechanic) {
    const mechanic = await Mechanic.findById(booking.mechanic);
    if (mechanic) {
      const totalRatings = mechanic.totalJobs || 1;
      mechanic.rating = ((mechanic.rating * (totalRatings - 1)) + rating) / totalRatings;
      await mechanic.save();
    }
  }

  return booking;
};

// PumpAdmin: Get Pending Bookings (notifiedPumps mein is pump ka ID ho)
export const getPumpPendingBookings = async (pumpAdminId) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");
  return await Booking.find({ notifiedPumps: pump._id, status: "pending" })
    .populate("customer", "name phone address")
    .sort({ createdAt: -1 });
};

// PumpAdmin: Get All Pump Bookings (accepted/assigned/completed etc.)
export const getPumpAllBookings = async (pumpAdminId, statusFilter) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");
  const query = { pump: pump._id };
  if (statusFilter) query.status = statusFilter;
  return await Booking.find(query)
    .populate("customer", "name phone")
    .populate("mechanic", "name phone")
    .sort({ createdAt: -1 });
};

// PumpAdmin: Accept Booking — pump assign hota hai, baaki pumps ko booking_taken notify
export const acceptBooking = async (pumpAdminId, bookingId, estimatedArrival) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");

  const booking = await Booking.findOne({
    _id: bookingId,
    status: "pending",
    notifiedPumps: pump._id,
  });
  if (!booking) throw new Error("Booking not found, already accepted, or not in your area");

  booking.pump = pump._id;
  booking.status = "accepted";
  booking.estimatedArrival = estimatedArrival || null;
  addTimeline(booking, "accepted",
    estimatedArrival
      ? `Accepted by ${pump.pumpName}. ETA: ${estimatedArrival} min`
      : `Accepted by ${pump.pumpName}`
  );
  await booking.save();

  // Customer ko notify karo
  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id, status: "accepted",
      estimatedArrival: booking.estimatedArrival, pumpName: pump.pumpName,
    });
  }

  // Baaki notified pumps ko batao — booking kisi aur ne le li
  const otherPumps = await Pump.find({
    _id: { $in: booking.notifiedPumps, $ne: pump._id },
  }).select("owner");
  notifyPumpOwners(otherPumps.map((p) => p.owner), "booking_taken", {
    bookingId: booking._id, takenBy: pump.pumpName,
  });

  return booking;
};

// PumpAdmin: Reject Booking — is pump ko notifiedPumps se remove karo
export const rejectBooking = async (pumpAdminId, bookingId) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");

  const booking = await Booking.findOne({
    _id: bookingId, status: "pending", notifiedPumps: pump._id,
  });
  if (!booking) throw new Error("Booking not found or not in your area");

  booking.notifiedPumps = booking.notifiedPumps.filter(
    (id) => id.toString() !== pump._id.toString()
  );

  // Agar koi pump nahi bacha toh booking cancel
  if (booking.notifiedPumps.length === 0) {
    booking.status = "cancelled";
    addTimeline(booking, "cancelled", "No pump available to serve this booking");
    const customer = await Customer.findById(booking.customer);
    if (customer) {
      notify(customer.user.toString(), "booking:update", {
        bookingId: booking._id, status: "cancelled",
        message: "No pump available in your area",
      });
    }
  }

  await booking.save();
  return booking;
};

// PumpAdmin: Assign Mechanic
export const assignMechanic = async (pumpAdminId, bookingId, mechanicId, estimatedArrival) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");

  const booking = await Booking.findOne({ _id: bookingId, pump: pump._id, status: "accepted" });
  if (!booking) throw new Error("Booking not found or not accepted yet");

  const mechanic = await Mechanic.findOne({
    _id: mechanicId, isDeleted: false, status: "active", isAvailable: true,
    $or: [
      { type: "internal", pump: pump._id },
      { type: "external", pumpConnections: { $elemMatch: { pump: pump._id, status: "approved" } } },
    ],
  });
  if (!mechanic) throw new Error("Mechanic not available under your pump");

  const otp = generateOTP();
  booking.mechanic = mechanicId;
  booking.status = "assigned";
  booking.completionOTP = otp;
  if (estimatedArrival) booking.estimatedArrival = estimatedArrival;
  addTimeline(booking, "assigned",
    `${mechanic.name} assigned${estimatedArrival ? `. ETA: ${estimatedArrival} min` : ""}`
  );
  await booking.save();

  await Mechanic.findByIdAndUpdate(mechanicId, { currentStatus: "busy", isAvailable: false });

  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id, status: "assigned",
      estimatedArrival: booking.estimatedArrival,
      mechanic: { name: mechanic.name, phone: mechanic.phone, profileImage: mechanic.profileImage },
      otp,
    });
  }

  notify(mechanic._id.toString(), "new_job", {
    bookingId: booking._id, address: booking.address.full,
    serviceType: booking.serviceType, customerName: customer?.name,
  });

  return await booking.populate("mechanic", "name phone profileImage");
};

// PumpAdmin: Mark In Progress
export const markInProgress = async (pumpAdminId, bookingId) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");

  const booking = await Booking.findOne({ _id: bookingId, pump: pump._id, status: "assigned" });
  if (!booking) throw new Error("Booking not found or not in assigned state");

  booking.status = "in_progress";
  addTimeline(booking, "in_progress", "Staff is on the way to customer");
  await booking.save();

  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id, status: "in_progress",
      estimatedArrival: booking.estimatedArrival,
    });
  }
  return booking;
};

// PumpAdmin: Complete Job via OTP
export const completeJobByAdmin = async (pumpAdminId, bookingId, otp, workDetails) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");

  const booking = await Booking.findOne({ _id: bookingId, pump: pump._id, status: "in_progress" });
  if (!booking) throw new Error("Booking not found or not in progress");
  if (booking.completionOTP !== otp) throw new Error("Invalid OTP");

  // Fuel booking: amount already set. Mechanic booking: parts + labour
  let totalAmount = booking.amount;
  if (booking.serviceType === "mechanic" && workDetails) {
    const partsTotal = workDetails.partsChanged?.reduce((sum, p) => sum + (p.price || 0), 0) || 0;
    const labour = workDetails.labourCharge || 0;
    totalAmount = partsTotal + labour || booking.amount;
  }

  booking.status = "completed";
  booking.completionOTP = null;
  booking.workDetails = workDetails || {};
  booking.amount = totalAmount;
  addTimeline(booking, "completed", "Service completed and verified via OTP");
  await booking.save();

  if (booking.mechanic) {
    await Mechanic.findByIdAndUpdate(booking.mechanic, {
      currentStatus: "idle", isAvailable: true,
      $inc: { totalJobs: 1, totalEarnings: totalAmount },
    });
  }
  await Customer.findByIdAndUpdate(booking.customer, { $inc: { totalOrders: 1 } });

  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id, status: "completed", amount: totalAmount,
    });
  }
  return booking;
};

// Mechanic: Get My Jobs
export const getMechanicJobs = async (mechanicId) => {
  return await Booking.find({ mechanic: mechanicId })
    .populate("customer", "name phone")
    .populate("pump", "pumpName phone")
    .sort({ createdAt: -1 });
};
