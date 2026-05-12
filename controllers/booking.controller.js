import {
  createBooking, getMyBookings, getBookingById, cancelBooking, submitRating,
  getPumpPendingBookings, getPumpAllBookings, acceptBooking, assignMechanic,
  markInProgress, completeJobByAdmin,
  getMechanicJobs,
} from "../services/booking.services.js";

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

export const handleAssignMechanic = async (req, res) => {
  try {
    const data = await assignMechanic(req.user.id, req.params.id, req.body.mechanicId, req.body.estimatedArrival);
    res.status(200).json({ success: true, message: "Mechanic assigned", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleMarkInProgress = async (req, res) => {
  try {
    const data = await markInProgress(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: "Marked in progress", data });
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
    const data = await getMechanicJobs(req.user.id);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};
