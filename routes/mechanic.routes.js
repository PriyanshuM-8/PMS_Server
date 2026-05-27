import { Router } from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.js";
import {
  handleAddInternal, handleGetPending, handleApprove, handleReject,
  handleGetMyMechanics, handleToggle,
  handleGetMe, handleGetStats, handleToggleAvailability, handleGetMyJobs, handleUpdateMe,
} from "../controllers/mechanic.controller.js";

const router = Router();

const mechanicUpload = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "aadharPhoto", maxCount: 1 },
]);

// ─── Mechanic Self Routes ─────────────────────────────────────────────────────
router.get("/me", protect, authorize("mechanic"), handleGetMe);
router.patch("/me", protect, authorize("mechanic"), mechanicUpload, handleUpdateMe);
router.get("/stats", protect, authorize("mechanic"), handleGetStats);
router.patch("/availability", protect, authorize("mechanic"), handleToggleAvailability);
router.get("/jobs", protect, authorize("mechanic"), handleGetMyJobs);

// ─── PumpAdmin Routes ─────────────────────────────────────────────────────
router.post("/internal", protect, authorize("pumpAdmin"), mechanicUpload, handleAddInternal);
router.get("/", protect, authorize("pumpAdmin"), handleGetMyMechanics);
router.get("/pending", protect, authorize("pumpAdmin"), handleGetPending);
router.patch("/:id/approve", protect, authorize("pumpAdmin"), handleApprove);
router.patch("/:id/reject", protect, authorize("pumpAdmin"), handleReject);
router.patch("/:id/toggle", protect, authorize("pumpAdmin"), handleToggle);

export default router;
