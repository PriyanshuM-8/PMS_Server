import { Router } from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.js";
import {
  handleGetMyProfile, handleGetMyPump,
  handleGetDashboard, handleGetBookingChart,
  handleGetPendingBookings, handleGetAllBookings,
  handleAcceptBooking, handleRejectBooking, handleAssignMechanic, handleMarkInProgress,
  handleGetMechanics, handleGetPendingMechanics,
  handleAddInternalMechanic, handleApproveMechanic,
  handleRejectMechanic, handleToggleMechanic,
  handleGetCustomers, handleToggleCustomerBlock,
  handleGetFuelPrices, handleUpdateFuelPrices,
} from "../controllers/pumpAdmin.controller.js";

const router = Router();
router.use(protect, authorize("pumpAdmin"));

const mechanicUpload = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "aadharPhoto", maxCount: 1 },
]);

// ─── Profile & Pump ───────────────────────────────────────────────────────────
router.get("/profile", handleGetMyProfile);
router.get("/pump", handleGetMyPump);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get("/dashboard", handleGetDashboard);
router.get("/dashboard/chart", handleGetBookingChart);

// ─── Bookings ─────────────────────────────────────────────────────────────────
router.get("/bookings/pending", handleGetPendingBookings);
router.get("/bookings", handleGetAllBookings);              // ?status=completed|cancelled
router.patch("/bookings/:id/accept", handleAcceptBooking);
router.patch("/bookings/:id/reject", handleRejectBooking);
router.patch("/bookings/:id/assign", handleAssignMechanic);
router.patch("/bookings/:id/in-progress", handleMarkInProgress);

// ─── Mechanics ────────────────────────────────────────────────────────────────
router.get("/mechanics", handleGetMechanics);
router.get("/mechanics/pending", handleGetPendingMechanics);
router.post("/mechanics", mechanicUpload, handleAddInternalMechanic);
router.patch("/mechanics/:id/approve", handleApproveMechanic);
router.patch("/mechanics/:id/reject", handleRejectMechanic);
router.patch("/mechanics/:id/toggle", handleToggleMechanic);

// ─── Customers ────────────────────────────────────────────────────────────────
router.get("/customers", handleGetCustomers);
router.patch("/customers/:id/toggle-block", handleToggleCustomerBlock);

// ─── Fuel Prices ──────────────────────────────────────────────────────────────
router.get("/fuel-prices", handleGetFuelPrices);
router.put("/fuel-prices", handleUpdateFuelPrices);

export default router;
