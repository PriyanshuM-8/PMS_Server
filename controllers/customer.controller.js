import {
  getMe, getMyProfile, updateProfile,
  requestPhoneChange, verifyPhoneChange,
  addVehicle, removeVehicle,
} from "../services/customer.services.js";

export const handleGetMe = async (req, res) => {
  try {
    const data = await getMe(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const handleGetProfile = async (req, res) => {
  try {
    const data = await getMyProfile(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

// name + profilePhoto update
export const handleUpdateProfile = async (req, res) => {
  try {
    const data = await updateProfile(req.user.id, req.body, req.file);
    res.status(200).json({ success: true, message: "Profile updated", data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Phone change — OTP request
export const handleRequestPhoneChange = async (req, res) => {
  try {
    const data = await requestPhoneChange(req.user.id, req.body.oldPhone, req.body.newPhone);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Phone change — OTP verify
export const handleVerifyPhoneChange = async (req, res) => {
  try {
    const data = await verifyPhoneChange(req.user.id, req.body.otp);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleAddVehicle = async (req, res) => {
  try {
    const data = await addVehicle(req.user.id, req.body);
    res.status(200).json({ success: true, message: "Vehicle added", data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const handleRemoveVehicle = async (req, res) => {
  try {
    const data = await removeVehicle(req.user.id, req.params.vehicleId);
    res.status(200).json({ success: true, message: "Vehicle removed", data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
