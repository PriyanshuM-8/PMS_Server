import {
  getDashboardStats, getSystemChart,
  getPendingRequests, getAllPumps, getPumpById,
  approvePump, rejectPump, togglePumpStatus, deletePump,
  getAllUsers, toggleUserStatus, getUserDetails, getAllBookings, getAllMechanics, approvePumpAdmin,
  withdrawSuperAdminEarnings, updateAccountDetails, getAccountDetails
} from "../services/superAdmin.services.js";

export const handleGetDashboard = async (req, res) => {
  try {
    const data = await getDashboardStats();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const handleGetChart = async (req, res) => {
  try {
    const data = await getSystemChart();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const handleGetPendingRequests = async (req, res) => {
  try {
    const pumps = await getPendingRequests();
    res.status(200).json({ success: true, count: pumps.length, data: pumps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const handleGetAllPumps = async (req, res) => {
  try {
    const filter = req.query.status ? { approvalStatus: req.query.status } : {};
    const pumps = await getAllPumps(filter);
    res.status(200).json({ success: true, count: pumps.length, data: pumps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const handleGetPumpById = async (req, res) => {
  try {
    const pump = await getPumpById(req.params.id);
    res.status(200).json({ success: true, data: pump });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const handleApprovePump = async (req, res) => {
  try {
    const pump = await approvePump(req.params.id);
    res.status(200).json({ success: true, message: "Pump approved successfully", data: pump });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleRejectPump = async (req, res) => {
  try {
    const pump = await rejectPump(req.params.id, req.body.reason);
    res.status(200).json({ success: true, message: "Pump rejected", data: pump });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleToggleStatus = async (req, res) => {
  try {
    const pump = await togglePumpStatus(req.params.id);
    res.status(200).json({ success: true, message: `Pump is now ${pump.status}`, data: pump });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleDeletePump = async (req, res) => {
  try {
    const result = await deletePump(req.params.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleApprovePumpAdmin = async (req, res) => {
  try {
    const data = await approvePumpAdmin(req.params.id);
    res.status(200).json({ success: true, message: "Pump Admin approved successfully", data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

export const handleGetAllUsers = async (req, res) => {
  try {
    const data = await getAllUsers(req.query.role);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const handleToggleUserStatus = async (req, res) => {
  try {
    const data = await toggleUserStatus(req.params.id);
    res.status(200).json({ success: true, message: `User is now ${data.isActive ? "active" : "inactive"}`, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleGetUserDetails = async (req, res) => {
  try {
    const data = await getUserDetails(req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const handleGetAllMechanics = async (req, res) => {
  try {
    const data = await getAllMechanics();
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const handleGetAllBookings = async (req, res) => {
  try {
    const data = await getAllBookings(req.query);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const handleWithdrawEarnings = async (req, res) => {
  try {
    const data = await withdrawSuperAdminEarnings(req.user.id);
    res.status(200).json({ success: true, message: "Amount withdrawn successfully to bank account", data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleUpdateAccountDetails = async (req, res) => {
  try {
    const data = await updateAccountDetails(req.user.id, req.body);
    res.status(200).json({ success: true, message: "Account details updated successfully", data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleGetAccountDetails = async (req, res) => {
  try {
    const data = await getAccountDetails(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
