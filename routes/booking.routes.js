import { Router } from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import {
  handleCreateBooking, handleGetMyBookings, handleGetBookingById,
  handleCancelBooking, handleSubmitRating,
  handleGetPendingBookings, handleGetAllPumpBookings,
  handleAcceptBooking, handleAssignMechanic, handleAssignDeliveryBoy,
  handleMarkInProgress, handleDeliveryBoyReached, handleCompleteJobByAdmin,
  handleRejectBooking, handleConfirmPayment,
  handleGetMechanicJobs, handleMechanicAcceptBooking, handleMechanicMarkInProgress,
  handleMechanicArrived, handleMechanicCompleteJob
} from "../controllers/booking.controller.js";
import { calcFuelPrice } from "../services/booking.services.js";
import Pump from "../models/pump.model.js";
import Booking from "../models/booking.model.js";
import Customer from "../models/customer.model.js";
import Mechanic from "../models/mechanic.model.js";

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
router.patch("/my/:id/confirm-payment", protect, authorize("customer"), handleConfirmPayment);

// ─── Customer: Call Mechanic (masked via Twilio) ──────────────────────────────
router.post("/my/:id/call", protect, authorize("customer"), async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user.id });
    if (!customer) return res.status(404).json({ success: false, message: "Profile not found" });

    const booking = await Booking.findOne({ _id: req.params.id, customer: customer._id })
      .populate("mechanic", "phone");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (!["assigned", "in_progress"].includes(booking.status))
      return res.status(400).json({ success: false, message: "Call not available at this stage" });
    if (!booking.mechanic?.phone)
      return res.status(400).json({ success: false, message: "Mechanic contact not available" });

    res.json({ success: true, devMode: true, maskedNumber: booking.mechanic.phone });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PumpAdmin ────────────────────────────────────────────────────────────────
router.get("/pump/pending", protect, authorize("pumpAdmin"), handleGetPendingBookings);
router.get("/pump/all", protect, authorize("pumpAdmin"), handleGetAllPumpBookings);   // ?status=filter
router.patch("/pump/:id/accept", protect, authorize("pumpAdmin"), handleAcceptBooking);
router.patch("/pump/:id/reject", protect, authorize("pumpAdmin"), handleRejectBooking);
router.patch("/pump/:id/assign-delivery-boy", protect, authorize("pumpAdmin"), handleAssignDeliveryBoy);
router.patch("/pump/:id/assign", protect, authorize("pumpAdmin"), handleAssignMechanic);
router.patch("/pump/:id/in-progress", protect, authorize("pumpAdmin"), handleMarkInProgress);
router.patch("/pump/:id/reached", protect, authorize("pumpAdmin"), handleDeliveryBoyReached);
router.patch("/pump/:id/complete", protect, authorize("pumpAdmin"), handleCompleteJobByAdmin);

// ─── Mechanic ─────────────────────────────────────────────────────────────────
router.get("/mechanic/jobs", protect, authorize("mechanic"), handleGetMechanicJobs);
router.patch("/mechanic/:id/accept", protect, authorize("mechanic"), handleMechanicAcceptBooking);
router.patch("/mechanic/:id/start", protect, authorize("mechanic"), handleMechanicMarkInProgress);
router.patch("/mechanic/:id/arrived", protect, authorize("mechanic"), handleMechanicArrived);
router.patch("/mechanic/:id/complete", protect, authorize("mechanic"), handleMechanicCompleteJob);

export default router;
