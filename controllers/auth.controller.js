import {
  registerCustomer, registerPumpAdmin, registerMechanicRole,
  loginWithEmail, loginWithPhone, verifyOTP, switchRole,
  pumpAdminDirectLogin,
} from "../services/auth.service.js";

export const customerRegisterHandler = async (req, res) => {
  try {
    const data = await registerCustomer(req.body);
    res.status(201).json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const pumpAdminRegister = async (req, res) => {
  try {
    const data = await registerPumpAdmin(req.body, req.files);
    res.status(201).json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const mechanicRegisterHandler = async (req, res) => {
  try {
    const data = await registerMechanicRole(req.body, req.files);
    res.status(201).json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Email + Password → Email OTP
export const loginWithEmailHandler = async (req, res) => {
  try {
    const data = await loginWithEmail(req.body);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};

// Phone → SMS OTP (Twilio)
export const loginWithPhoneHandler = async (req, res) => {
  try {
    const data = await loginWithPhone(req.body);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};

// Verify OTP — email or phone
export const verifyLoginOTP = async (req, res) => {
  try {
    const data = await verifyOTP(req.body);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Legacy handler (other apps use /login)
export const loginHandler = loginWithEmailHandler;

// PumpAdmin login — email+password → OTP
export const pumpAdminLoginHandler = async (req, res) => {
  try {
    const data = await pumpAdminDirectLogin(req.body);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};

export const switchRoleHandler = async (req, res) => {
  try {
    const data = await switchRole(req.user.id, req.body.role);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
