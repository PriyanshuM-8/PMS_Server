import Booking from "../models/booking.model.js";
import Customer from "../models/customer.model.js";
import Pump from "../models/pump.model.js";
import Mechanic from "../models/mechanic.model.js";
import DeliveryBoy from "../models/deliveryBoy.model.js";
import User from "../models/user.model.js";
import { notify, notifyPumpOwners } from "../utils/socket.js";

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const addTimeline = (booking, status, note = "") => {
  if (!booking.statusTimeline) booking.statusTimeline = [];
  booking.statusTimeline.push({ status, time: new Date(), note });
};

// Pricing Calculator — customer se koi platform fee nahi
const getDeliveryFee = (quantity) => {
  if (quantity <= 3) return 25;
  if (quantity <= 7) return 20;
  return 10;
};

export const calcFuelPrice = (quantity, pricePerLitre) => {
  const qty = parseFloat(quantity) || 0;
  const fuelCost = parseFloat((qty * pricePerLitre).toFixed(2));
  const deliveryFee = getDeliveryFee(qty);
  const total = parseFloat((fuelCost + deliveryFee).toFixed(2));
  return { fuelCost, deliveryFee, platformFee: 0, total };
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
  let breakdown = { fuelCost: 0, deliveryFee: 0, platformFee: 0, total: 0 };
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
    notifiedPumps: serviceType === "fuel" ? nearbyPumps.map((p) => p._id) : [],
    statusTimeline: [{ status: "pending", time: new Date(), note: "Booking created" }],
  });

  if (serviceType === "fuel") {
    // Fuel — pump owners ko notify karo
    notifyPumpOwners(nearbyPumps.map((p) => p.owner), "new_booking", {
      bookingId: booking._id, serviceType,
      customerName: customer.name, address: addressFull,
      amount: breakdown.total, fuelType: fuelType || null, quantity: quantity || null,
    });
  } else {
    // Mechanic — nearby available mechanics ko directly notify karo
    let nearbyMechanics = [];
    try {
      if (lng && lat) {
        nearbyMechanics = await Mechanic.find({
          isDeleted: false, status: "active", isAvailable: true,
          location: { $near: { $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: 10000 } },
        }).select("_id user");
      }
    } catch (_) {}

    if (nearbyMechanics.length === 0) {
      nearbyMechanics = await Mechanic.find({ isDeleted: false, status: "active", isAvailable: true }).select("_id user");
    }
    
    booking.notifiedMechanics = nearbyMechanics.map(m => m._id);
    await booking.save();
    
    const mechanicUserIds = nearbyMechanics.map((m) => m.user).filter(Boolean);
    notifyPumpOwners(mechanicUserIds, "new_mechanic_job", {
      bookingId: booking._id, serviceType,
      customerName: customer.name, address: addressFull,
      description: data.workDetails?.description || "",
    });
  }

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

// PumpAdmin: Get All Pump Bookings — sirf fuel
export const getPumpAllBookings = async (pumpAdminId, statusFilter) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");

  if (!statusFilter || statusFilter === "pending") {
    const pendingQuery = { notifiedPumps: pump._id, status: "pending", serviceType: "fuel" };
    if (statusFilter === "pending") {
      return await Booking.find(pendingQuery).populate("customer", "name phone").sort({ createdAt: -1 });
    }
    const [pending, rest] = await Promise.all([
      Booking.find(pendingQuery).populate("customer", "name phone"),
      Booking.find({ pump: pump._id, serviceType: "fuel" }).populate("customer", "name phone"),
    ]);
    const seen = new Set();
    return [...pending, ...rest]
      .filter(b => { const id = b._id.toString(); if (seen.has(id)) return false; seen.add(id); return true; })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return await Booking.find({ pump: pump._id, serviceType: "fuel", status: statusFilter })
    .populate("customer", "name phone").sort({ createdAt: -1 });
};

// Helper: Handle Platform Fee — ₹20/day on first booking (pump admin se)
const PUMP_DAILY_FEE = 20;

const handlePlatformFee = async (userDoc) => {
  // Free trial active hai toh kuch nahi
  if (userDoc.freeTrialEndsAt && new Date() < new Date(userDoc.freeTrialEndsAt)) {
    return;
  }

  const now = new Date();
  // 24 hours mein already deduct ho chuka hai
  if (
    userDoc.lastPlatformFeeDeduction &&
    now.getTime() - new Date(userDoc.lastPlatformFeeDeduction).getTime() < 24 * 60 * 60 * 1000
  ) {
    return;
  }

  if (userDoc.walletBalance < PUMP_DAILY_FEE) {
    throw new Error("Insufficient wallet balance. Minimum ₹20 required to accept bookings. Please recharge.");
  }

  userDoc.walletBalance -= PUMP_DAILY_FEE;
  userDoc.lastPlatformFeeDeduction = now;
  await userDoc.save();

  await User.findOneAndUpdate(
    { roles: "superAdmin" },
    { $inc: { superAdminEarnings: PUMP_DAILY_FEE } },
    { sort: { createdAt: 1 } }
  );
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

  await handlePlatformFee(pump);

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

// PumpAdmin: Assign Delivery Boy (fuel bookings)
export const assignDeliveryBoy = async (pumpAdminId, bookingId, deliveryBoyId, estimatedArrival) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");

  const booking = await Booking.findOne({ _id: bookingId, pump: pump._id, status: "accepted", serviceType: "fuel" });
  if (!booking) throw new Error("Booking not found or not accepted yet");

  const boy = await DeliveryBoy.findOne({ _id: deliveryBoyId, pump: pump._id, isActive: true });
  if (!boy) throw new Error("Delivery boy not available");

  const otp = generateOTP();
  booking.deliveryBoy = deliveryBoyId;
  booking.status = "assigned";
  booking.completionOTP = otp;
  if (estimatedArrival) booking.estimatedArrival = estimatedArrival;
  addTimeline(booking, "assigned", `${boy.name} assigned${estimatedArrival ? `. ETA: ${estimatedArrival} min` : ""}`);
  await booking.save();

  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id, status: "assigned",
      estimatedArrival: booking.estimatedArrival,
      deliveryBoy: { name: boy.name, phone: boy.phone },
    });
  }

  // Delivery boy ko notify karo — new order assigned
  notify(deliveryBoyId.toString(), "new_order_assigned", {
    bookingId: booking._id,
    customerName: customer?.name,
    address: booking.address?.full,
    fuelType: booking.fuelDetails?.fuelType,
    quantity: booking.fuelDetails?.quantity,
    amount: booking.amount,
    estimatedArrival: booking.estimatedArrival,
  });

  return await booking.populate("deliveryBoy", "name phone");
};

// PumpAdmin: Assign Mechanic (mechanic bookings only)
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

// DeliveryBoy: Mark Reached Location
export const deliveryBoyReached = async (pumpAdminId, bookingId) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");

  const booking = await Booking.findOne({ _id: bookingId, pump: pump._id, status: "in_progress", serviceType: "fuel" });
  if (!booking) throw new Error("Booking not found or not in progress");

  booking.status = "reached";
  addTimeline(booking, "reached", "Delivery boy reached customer location");
  await booking.save();

  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id, status: "reached",
      message: "Delivery boy has arrived at your location",
      amount: booking.amount,
    });
  }
  return booking;
};

// Customer: Confirm Payment (fuel delivery OR mechanic service)
export const confirmPayment = async (userId, bookingId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) throw new Error("Profile not found");

  const booking = await Booking.findOne({
    _id: bookingId, customer: customer._id,
    status: { $in: ["reached", "mechanic_payment_pending"] },
  });
  if (!booking) throw new Error("Booking not found or payment not applicable");

  const isMechanic = booking.serviceType === "mechanic";
  booking.paymentStatus = "paid";
  booking.paymentMethod = "online";

  if (isMechanic) {
    // Mechanic booking — payment done, OTP se complete hoga
    addTimeline(booking, "mechanic_payment_pending", "Customer payment confirmed. Share OTP with mechanic.");
    await booking.save();
    // Notify mechanic
    if (booking.mechanic) {
      notify(booking.mechanic.toString(), "booking:update", {
        bookingId: booking._id, status: "mechanic_payment_pending",
        message: "Customer has paid. Ask for OTP to complete.",
      });
    }
  } else {
    // Fuel booking
    booking.status = "payment_pending";
    addTimeline(booking, "payment_pending", "Payment confirmed. Delivery boy delivering fuel.");
    await booking.save();
    const pump = await Pump.findById(booking.pump).select("owner");
    if (pump) {
      notify(pump.owner.toString(), "booking:update", {
        bookingId: booking._id, status: "payment_pending",
        message: "Customer payment confirmed. Fuel delivery in progress.",
      });
    }
  }
  return booking;
};

// Helper: Calculate Free Trial Remaining Message
export const getFreeTrialMessage = (userDoc) => {
  if (!userDoc || !userDoc.freeTrialEndsAt) return null;
  const now = new Date();
  const endsAt = new Date(userDoc.freeTrialEndsAt);
  if (now > endsAt) return "Your free trial has expired.";
  
  const diffTime = Math.abs(endsAt - now);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `You have ${diffDays} day(s) left in your free demo.`;
};

// PumpAdmin: Complete Job via OTP
export const completeJobByAdmin = async (pumpAdminId, bookingId, otp, workDetails) => {
  const pump = await Pump.findOne({ owner: pumpAdminId, approvalStatus: "approved" });
  if (!pump) throw new Error("Pump not found");

  const booking = await Booking.findOne({
    _id: bookingId, pump: pump._id,
    status: { $in: ["in_progress", "payment_pending"] },
  });
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

  const trialMsg = getFreeTrialMessage(pump);

  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id, status: "completed", amount: totalAmount,
    });
  }

  // Notify Pump Admin about completion and trial
  notify(pump.owner.toString(), "job_completed_admin", {
    bookingId: booking._id, 
    message: "Booking completed successfully.",
    trialMessage: trialMsg
  });

  return { booking, trialMessage: trialMsg };
};

export const getMechanicJobs = async (mechanicId) => {
  return await Booking.find({ mechanic: mechanicId })
    .populate("customer", "name phone")
    .populate("pump", "pumpName phone")
    .populate("mechanic", "upiId name profileImage phone")
    .sort({ createdAt: -1 });
};

// Mechanic: Accept Booking
export const mechanicAcceptBooking = async (mechanicId, bookingId) => {
  const mechanic = await Mechanic.findById(mechanicId);
  if (!mechanic) throw new Error("Mechanic not found");

  const booking = await Booking.findOne({ _id: bookingId, status: "pending", serviceType: "mechanic" });
  if (!booking) throw new Error("Booking not found or already accepted by someone else");

  await handlePlatformFee(mechanic);

  const otp = generateOTP();
  booking.mechanic = mechanic._id;
  booking.status = "assigned";
  booking.completionOTP = otp;
  
  addTimeline(booking, "assigned", `Accepted by ${mechanic.name}`);
  await booking.save();

  // Update mechanic status
  mechanic.currentStatus = "busy";
  mechanic.isAvailable = false;
  await mechanic.save();

  // Notify customer
  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id,
      status: "assigned",
      mechanic: { name: mechanic.name, phone: mechanic.phone, profileImage: mechanic.profileImage },
      otp
    });
  }

  // Notify other mechanics
  const otherMechanics = await Mechanic.find({
    _id: { $in: booking.notifiedMechanics, $ne: mechanic._id }
  }).select("user");
  const otherMechanicUserIds = otherMechanics.map(m => m.user).filter(Boolean);
  notifyPumpOwners(otherMechanicUserIds, "job_assigned_to_other", {
    bookingId: booking._id
  });

  return await booking.populate("customer", "name phone address");
};

// Mechanic Submit Work removed in favor of direct Complete Job

// Mechanic: Mark In Progress
export const mechanicMarkInProgress = async (mechanicId, bookingId) => {
  const booking = await Booking.findOne({ _id: bookingId, mechanic: mechanicId, status: "assigned" });
  if (!booking) throw new Error("Booking not found or not in assigned state");

  booking.status = "in_progress";
  addTimeline(booking, "in_progress", "Mechanic is on the way");
  await booking.save();

  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id,
      status: "in_progress",
      message: "Mechanic is on the way"
    });
  }
  return booking;
};

// Mechanic: Arrived at customer location
export const mechanicArrived = async (mechanicId, bookingId) => {
  const booking = await Booking.findOne({ _id: bookingId, mechanic: mechanicId, status: "in_progress" });
  if (!booking) throw new Error("Booking not found or not in progress");

  booking.status = "reached";
  addTimeline(booking, "reached", "Mechanic arrived at customer location");
  await booking.save();

  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id,
      status: "reached",
      message: "Mechanic has arrived at your location!",
    });
  }
  return booking;
};

// Mechanic: Complete Job — no OTP needed
export const mechanicCompleteJob = async (mechanicId, bookingId, amount, paymentMethod, workDetails) => {
  const booking = await Booking.findOne({
    _id: bookingId, mechanic: mechanicId,
    status: { $in: ["in_progress", "reached"] },
  });
  if (!booking) throw new Error("Booking not found or not in progress");

  const totalAmount = parseFloat(amount) || 0;

  booking.amount = totalAmount;
  booking.paymentMethod = paymentMethod || "cash";
  booking.paymentStatus = "paid";
  booking.status = "completed";
  booking.completionOTP = null;
  if (workDetails) {
    booking.workDetails = {
      ...booking.workDetails,
      partsChanged: workDetails.partsChanged || [],
      labourCharge: workDetails.labourCharge || 0,
      totalAmount: workDetails.totalAmount || totalAmount,
    };
  }
  addTimeline(booking, "completed", `Job completed. Paid via ${(paymentMethod || "cash").toUpperCase()} (₹${totalAmount})`);
  await booking.save();

  // Update mechanic stats
  const mechanic = await Mechanic.findById(mechanicId);
  if (mechanic) {
    mechanic.currentStatus = "idle";
    mechanic.isAvailable = true;
    mechanic.totalJobs = (mechanic.totalJobs || 0) + 1;
    mechanic.totalEarnings = (mechanic.totalEarnings || 0) + totalAmount;
    await mechanic.save();
  }

  // Update customer stats
  await Customer.findByIdAndUpdate(booking.customer, { $inc: { totalOrders: 1 } });

  const trialMsg = getFreeTrialMessage(mechanic);

  const customer = await Customer.findById(booking.customer);
  if (customer) {
    notify(customer.user.toString(), "booking:update", {
      bookingId: booking._id,
      status: "completed",
      amount: totalAmount,
      paymentMethod: booking.paymentMethod
    });
  }

  // Notify Mechanic (if they are connected via socket on a specific ID, though HTTP response will also have it)
  if (mechanic && mechanic.user) {
    notify(mechanic.user.toString(), "job_completed_mechanic", {
      bookingId: booking._id, 
      message: "Job completed successfully.",
      trialMessage: trialMsg
    });
  }

  return { booking, trialMessage: trialMsg };
};
