import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.js";
import {
  customerRegisterHandler,
  pumpAdminRegister,
  mechanicRegisterHandler,
  loginHandler,
  loginWithEmailHandler,
  loginWithPhoneHandler,
  pumpAdminLoginHandler,
  verifyLoginOTP,
  switchRoleHandler,
} from "../controllers/auth.controller.js";

const router = Router();

const pumpAdminUpload = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "aadharPhoto", maxCount: 1 },
  { name: "ownerIdProof", maxCount: 1 },
]);

const mechanicUpload = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "aadharPhoto", maxCount: 1 },
]);

// ─── Registration ─────────────────────────────────────────────────────────────
router.post("/register/customer", customerRegisterHandler);
router.post("/register/pump", pumpAdminUpload, pumpAdminRegister);
router.post("/register/mechanic", mechanicUpload, mechanicRegisterHandler);

// ─── Login ────────────────────────────────────────────────────────────────────
router.post("/login", loginHandler);
router.post("/login/email", loginWithEmailHandler);
router.post("/login/phone", loginWithPhoneHandler);
router.post("/login/pump", pumpAdminLoginHandler);     // pumpAdmin: email+password → OTP
router.post("/verify-otp", verifyLoginOTP);

// ─── Role Switch ──────────────────────────────────────────────────────────────
router.post("/switch-role", protect, switchRoleHandler);

export default router;
