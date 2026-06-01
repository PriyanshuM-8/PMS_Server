import { Router } from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import {
  handleGetDashboard, handleGetChart,
  handleGetPendingRequests, handleGetAllPumps, handleGetPumpById,
  handleApprovePump, handleRejectPump, handleToggleStatus, handleDeletePump,
  handleGetAllUsers, handleToggleUserStatus, handleGetUserDetails, handleGetAllMechanics, handleGetAllBookings, handleApprovePumpAdmin, handleWithdrawEarnings, handleUpdateAccountDetails, handleGetAccountDetails
} from "../controllers/superAdmin.controller.js";

const router = Router();
router.use(protect, authorize("superAdmin"));

// ─── Dashboard & Wallet ───────────────────────────────────────────────────────
router.get("/dashboard", handleGetDashboard);
router.get("/dashboard/chart", handleGetChart);
router.post("/withdraw", handleWithdrawEarnings);
router.get("/account", handleGetAccountDetails);
router.patch("/account", handleUpdateAccountDetails);

// ─── Pumps ────────────────────────────────────────────────────────────────────
router.get("/pumps/pending", handleGetPendingRequests);
router.get("/pumps", handleGetAllPumps);                    // ?status=approved|pending|rejected
router.get("/pumps/:id", handleGetPumpById);
router.patch("/pumps/:id/approve", handleApprovePump);
router.patch("/pumps/:id/reject", handleRejectPump);
router.patch("/pumps/:id/toggle-status", handleToggleStatus);
router.delete("/pumps/:id", handleDeletePump);

// ─── Users ────────────────────────────────────────────────────────────────────
router.get("/users", handleGetAllUsers);
router.patch("/users/:id/toggle-status", handleToggleUserStatus);
router.patch("/users/:id/approve-pump", handleApprovePumpAdmin);
router.get("/users/:id/details", handleGetUserDetails);

// ─── Mechanics ────────────────────────────────────────────────────────────────
router.get("/mechanics", handleGetAllMechanics);

// ─── Bookings ─────────────────────────────────────────────────────────────────
router.get("/bookings", handleGetAllBookings);
router.get("/bookings/:id", async (req, res) => {
  try {
    const Booking = (await import("../models/booking.model.js")).default;
    const booking = await Booking.findById(req.params.id)
      .populate("customer", "name phone")
      .populate("pump", "pumpName phone")
      .populate("mechanic", "name phone upiId")
      .populate("deliveryBoy", "name phone");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    res.json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
