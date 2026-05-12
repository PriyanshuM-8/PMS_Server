import { Router } from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import {
  handleCreateBooking, handleGetMyBookings, handleGetBookingById,
  handleCancelBooking, handleSubmitRating,
  handleGetPendingBookings, handleGetAllPumpBookings,
  handleAcceptBooking, handleAssignMechanic,
  handleMarkInProgress, handleCompleteJobByAdmin,
  handleGetMechanicJobs,
} from "../controllers/booking.controller.js";
import { calcFuelPrice } from "../services/booking.services.js";
import Pump from "../models/pump.model.js";

const router = Router();

// ─── Public: Price Preview (no auth) ─────────────────────────────────────────
router.get("/price-preview", async (req, res) => {
  try {
    const { pumpId, fuelType, quantity } = req.query;
    if (!fuelType || !quantity) return res.status(400).json({ success: false, message: "fuelType and quantity required" });
    let pricePerLitre = fuelType === "petrol" ? 96.12 : 89.42;
    if (pumpId) {
      const pump = await Pump.findById(pumpId).select("fuelPrices");
      if (pump?.fuelPrices?.[fuelType]) pricePerLitre = pump.fuelPrices[fuelType];
    }
    const breakdown = calcFuelPrice(parseFloat(quantity), pricePerLitre);
    res.json({ success: true, data: { ...breakdown, pricePerLitre } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
// ─── Customer ─────────────────────────────────────────────────────────────────
router.post("/", protect, authorize("customer"), handleCreateBooking);
router.get("/my", protect, authorize("customer"), handleGetMyBookings);
router.get("/my/:id", protect, authorize("customer"), handleGetBookingById);
router.patch("/my/:id/cancel", protect, authorize("customer"), handleCancelBooking);
router.post("/my/:id/rate", protect, authorize("customer"), handleSubmitRating);

// ─── PumpAdmin ────────────────────────────────────────────────────────────────
router.get("/pump/pending", protect, authorize("pumpAdmin"), handleGetPendingBookings);
router.get("/pump/all", protect, authorize("pumpAdmin"), handleGetAllPumpBookings);   // ?status=filter
router.patch("/pump/:id/accept", protect, authorize("pumpAdmin"), handleAcceptBooking);
router.patch("/pump/:id/assign", protect, authorize("pumpAdmin"), handleAssignMechanic);
router.patch("/pump/:id/in-progress", protect, authorize("pumpAdmin"), handleMarkInProgress);
router.patch("/pump/:id/complete", protect, authorize("pumpAdmin"), handleCompleteJobByAdmin);

// ─── Mechanic ─────────────────────────────────────────────────────────────────
router.get("/mechanic/jobs", protect, authorize("mechanic"), handleGetMechanicJobs);

export default router;
