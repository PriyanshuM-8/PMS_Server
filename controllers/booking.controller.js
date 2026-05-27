import {
  createBooking, getMyBookings, getBookingById, cancelBooking, submitRating,
  getPumpPendingBookings, getPumpAllBookings, acceptBooking, rejectBooking,
  assignDeliveryBoy, assignMechanic,
  markInProgress, deliveryBoyReached, confirmPayment, completeJobByAdmin,
  getMechanicJobs, mechanicAcceptBooking, mechanicMarkInProgress, mechanicArrived, mechanicCompleteJob
} from "../services/booking.services.js";

// Mechanic Models lookup for controller handlers
import Mechanic from "../models/mechanic.model.js";

// ─── Customer ─────────────────────────────────────────────────────────────────
export const handleCreateBooking = async (req, res) => {
  try {
    const data = await createBooking(req.user.id, req.body);
    res.status(201).json({ success: true, message: "Booking created", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleGetMyBookings = async (req, res) => {
  try {
    const data = await getMyBookings(req.user.id);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleGetBookingById = async (req, res) => {
  try {
    const data = await getBookingById(req.user.id, req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) { res.status(404).json({ success: false, message: err.message }); }
};

export const handleCancelBooking = async (req, res) => {
  try {
    const data = await cancelBooking(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: "Booking cancelled", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleSubmitRating = async (req, res) => {
  try {
    const data = await submitRating(req.user.id, req.params.id, req.body.rating, req.body.feedback);
    res.status(200).json({ success: true, message: "Rating submitted", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// ─── PumpAdmin ────────────────────────────────────────────────────────────────
export const handleGetPendingBookings = async (req, res) => {
  try {
    const data = await getPumpPendingBookings(req.user.id);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleGetAllPumpBookings = async (req, res) => {
  try {
    const data = await getPumpAllBookings(req.user.id, req.query.status);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleAcceptBooking = async (req, res) => {
  try {
    const data = await acceptBooking(req.user.id, req.params.id, req.body.estimatedArrival);
    res.status(200).json({ success: true, message: "Booking accepted", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleRejectBooking = async (req, res) => {
  try {
    const data = await rejectBooking(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: "Booking rejected", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleAssignMechanic = async (req, res) => {
  try {
    const data = await assignMechanic(req.user.id, req.params.id, req.body.mechanicId, req.body.estimatedArrival);
    res.status(200).json({ success: true, message: "Mechanic assigned", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleAssignDeliveryBoy = async (req, res) => {
  try {
    const data = await assignDeliveryBoy(req.user.id, req.params.id, req.body.deliveryBoyId, req.body.estimatedArrival);
    res.status(200).json({ success: true, message: "Delivery boy assigned", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleMarkInProgress = async (req, res) => {
  try {
    const data = await markInProgress(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: "Marked in progress", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleDeliveryBoyReached = async (req, res) => {
  try {
    const data = await deliveryBoyReached(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: "Delivery boy reached", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleConfirmPayment = async (req, res) => {
  try {
    const data = await confirmPayment(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: "Payment confirmed", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleCompleteJobByAdmin = async (req, res) => {
  try {
    const data = await completeJobByAdmin(req.user.id, req.params.id, req.body.otp, req.body.workDetails);
    res.status(200).json({ success: true, message: "Job completed", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// ─── Mechanic ─────────────────────────────────────────────────────────────────
export const handleGetMechanicJobs = async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ user: req.user.id });
    if (!mechanic) return res.status(404).json({ success: false, message: "Mechanic profile not found" });

    const data = await getMechanicJobs(mechanic._id);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleMechanicAcceptBooking = async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ user: req.user.id });
    if (!mechanic) return res.status(404).json({ success: false, message: "Mechanic profile not found" });

    const data = await mechanicAcceptBooking(mechanic._id, req.params.id);
    res.status(200).json({ success: true, message: "Booking accepted", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleMechanicMarkInProgress = async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ user: req.user.id });
    if (!mechanic) return res.status(404).json({ success: false, message: "Mechanic profile not found" });
    const data = await mechanicMarkInProgress(mechanic._id, req.params.id);
    res.status(200).json({ success: true, message: "Marked in progress", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleMechanicArrived = async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ user: req.user.id });
    if (!mechanic) return res.status(404).json({ success: false, message: "Mechanic profile not found" });
    const data = await mechanicArrived(mechanic._id, req.params.id);
    res.status(200).json({ success: true, message: "Marked as arrived", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// mechanicSubmitWork removed

export const handleMechanicCompleteJob = async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ user: req.user.id });
    if (!mechanic) return res.status(404).json({ success: false, message: "Mechanic profile not found" });

    const data = await mechanicCompleteJob(mechanic._id, req.params.id, req.body.amount, req.body.paymentMethod, req.body.workDetails);
    res.status(200).json({ success: true, message: "Job completed", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};
