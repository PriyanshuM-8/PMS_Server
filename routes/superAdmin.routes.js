import { Router } from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import {
  handleGetDashboard, handleGetChart,
  handleGetPendingRequests, handleGetAllPumps, handleGetPumpById,
  handleApprovePump, handleRejectPump, handleToggleStatus, handleDeletePump,
  handleGetAllUsers, handleToggleUserStatus,
} from "../controllers/superAdmin.controller.js";

const router = Router();
router.use(protect, authorize("superAdmin"));

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get("/dashboard", handleGetDashboard);
router.get("/dashboard/chart", handleGetChart);

// ─── Pumps ────────────────────────────────────────────────────────────────────
router.get("/pumps/pending", handleGetPendingRequests);
router.get("/pumps", handleGetAllPumps);                    // ?status=approved|pending|rejected
router.get("/pumps/:id", handleGetPumpById);
router.patch("/pumps/:id/approve", handleApprovePump);
router.patch("/pumps/:id/reject", handleRejectPump);
router.patch("/pumps/:id/toggle-status", handleToggleStatus);
router.delete("/pumps/:id", handleDeletePump);

// ─── Users ────────────────────────────────────────────────────────────────────
router.get("/users", handleGetAllUsers);                    // ?role=customer|pumpAdmin|mechanic
router.patch("/users/:id/toggle-status", handleToggleUserStatus);

export default router;
