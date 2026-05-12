import {
  getMyProfile, getMyPump,
  getDashboardStats, getBookingChart,
  getMyCustomers, toggleCustomerBlock,
  updateFuelPrices, getMyFuelPrices,
} from "../services/pumpAdmin.services.js";

import {
  getPumpPendingBookings, getPumpAllBookings,
  acceptBooking, rejectBooking, assignMechanic, markInProgress,
} from "../services/booking.services.js";

import {
  getMyMechanics, getPendingExternalMechanics,
  addInternalMechanic, approveExternalMechanic,
  rejectExternalMechanic, toggleMechanicStatus,
} from "../services/mechanic.services.js";

// ─── Profile & Pump ───────────────────────────────────────────────────────────
export const handleGetMyProfile = async (req, res) => {
  try { res.status(200).json({ success: true, data: await getMyProfile(req.user.id) }); }
  catch (err) { res.status(404).json({ success: false, message: err.message }); }
};

export const handleGetMyPump = async (req, res) => {
  try { res.status(200).json({ success: true, data: await getMyPump(req.user.id) }); }
  catch (err) { res.status(404).json({ success: false, message: err.message }); }
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const handleGetDashboard = async (req, res) => {
  try { res.status(200).json({ success: true, data: await getDashboardStats(req.user.id) }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const handleGetBookingChart = async (req, res) => {
  try { res.status(200).json({ success: true, data: await getBookingChart(req.user.id) }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── Bookings ─────────────────────────────────────────────────────────────────
export const handleGetPendingBookings = async (req, res) => {
  try {
    const data = await getPumpPendingBookings(req.user.id);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleGetAllBookings = async (req, res) => {
  try {
    const data = await getPumpAllBookings(req.user.id, req.query.status);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// Accept + estimatedArrival
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

// Assign mechanic + optional estimatedArrival update
export const handleAssignMechanic = async (req, res) => {
  try {
    const data = await assignMechanic(req.user.id, req.params.id, req.body.mechanicId, req.body.estimatedArrival);
    res.status(200).json({ success: true, message: "Mechanic assigned", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// Mark In Progress — mechanic nikal gaya
export const handleMarkInProgress = async (req, res) => {
  try {
    const data = await markInProgress(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: "Marked as in progress", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// ─── Mechanics ────────────────────────────────────────────────────────────────
export const handleGetMechanics = async (req, res) => {
  try { res.status(200).json({ success: true, data: await getMyMechanics(req.user.id) }); }
  catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleGetPendingMechanics = async (req, res) => {
  try {
    const data = await getPendingExternalMechanics(req.user.id);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleAddInternalMechanic = async (req, res) => {
  try {
    const data = await addInternalMechanic(req.body, req.user.id, req.files);
    res.status(201).json({ success: true, message: "Mechanic added", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleApproveMechanic = async (req, res) => {
  try {
    const data = await approveExternalMechanic(req.params.id, req.user.id);
    res.status(200).json({ success: true, message: "Mechanic approved", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleRejectMechanic = async (req, res) => {
  try {
    const data = await rejectExternalMechanic(req.params.id, req.user.id);
    res.status(200).json({ success: true, message: "Mechanic rejected", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleToggleMechanic = async (req, res) => {
  try {
    const data = await toggleMechanicStatus(req.params.id, req.user.id);
    res.status(200).json({ success: true, message: `Mechanic is now ${data.status}`, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const handleGetCustomers = async (req, res) => {
  try {
    const data = await getMyCustomers(req.user.id);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleToggleCustomerBlock = async (req, res) => {
  try {
    const data = await toggleCustomerBlock(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: `Customer ${data.isBlocked ? "blocked" : "unblocked"}`, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// ─── Fuel Prices ──────────────────────────────────────────────────────────────
export const handleGetFuelPrices = async (req, res) => {
  try { res.status(200).json({ success: true, data: await getMyFuelPrices(req.user.id) }); }
  catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleUpdateFuelPrices = async (req, res) => {
  try {
    const data = await updateFuelPrices(req.user.id, req.body);
    res.status(200).json({ success: true, message: "Fuel prices updated", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};
