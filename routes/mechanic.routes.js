import { Router } from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.js";
import {
  handleAddInternal,
  handleGetPending,
  handleApprove,
  handleReject,
  handleGetMyMechanics,
  handleToggle,
} from "../controllers/mechanic.controller.js";

const router = Router();

const mechanicUpload = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "aadharPhoto", maxCount: 1 },
]);

// PumpAdmin routes
router.post("/internal", protect, authorize("pumpAdmin"), mechanicUpload, handleAddInternal);
router.get("/", protect, authorize("pumpAdmin"), handleGetMyMechanics);
router.get("/pending", protect, authorize("pumpAdmin"), handleGetPending);
router.patch("/:id/approve", protect, authorize("pumpAdmin"), handleApprove);
router.patch("/:id/reject", protect, authorize("pumpAdmin"), handleReject);
router.patch("/:id/toggle", protect, authorize("pumpAdmin"), handleToggle);

export default router;
