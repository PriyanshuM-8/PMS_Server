import {
  addInternalMechanic,
  getPendingExternalMechanics,
  approveExternalMechanic,
  rejectExternalMechanic,
  getMyMechanics,
  toggleMechanicStatus,
} from "../services/mechanic.services.js";

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
