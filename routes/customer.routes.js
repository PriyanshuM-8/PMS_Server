import { Router } from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.js";
import {
  handleGetMe, handleGetProfile, handleUpdateProfile,
  handleRequestPhoneChange, handleVerifyPhoneChange,
  handleAddVehicle, handleRemoveVehicle,
} from "../controllers/customer.controller.js";
import { getFuelPricesByPumpId } from "../services/pumpAdmin.services.js";

const router = Router();

// Public — no auth needed
router.get("/fuel-prices/:pumpId", async (req, res) => {
  try {
    const data = await getFuelPricesByPumpId(req.params.pumpId);
    res.status(200).json({ success: true, data });
  } catch (err) { res.status(404).json({ success: false, message: err.message }); }
});

router.use(protect, authorize("customer"));

router.get("/me", handleGetMe);
router.get("/profile", handleGetProfile);
router.put("/profile", upload.single("profileImage"), handleUpdateProfile);  // name + photo

// Phone change — 2 step
router.post("/profile/phone/request", handleRequestPhoneChange);   // { phone } → OTP via Twilio
router.post("/profile/phone/verify", handleVerifyPhoneChange);     // { otp } → phone update

router.post("/vehicles", handleAddVehicle);
router.delete("/vehicles/:vehicleId", handleRemoveVehicle);

export default router;
