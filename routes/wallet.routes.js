import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { getWalletData, createOrder, verifyPayment } from "../controllers/wallet.controller.js";

const router = express.Router();

router.use(protect);

router.get("/", getWalletData);
router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);

export default router;
