import Mechanic from "../models/mechanic.model.js";
import Pump from "../models/pump.model.js";

import crypto from "crypto";
import Razorpay from "razorpay";

// Fetch Wallet Balance & Trial Status
export const getWalletData = async (req, res) => {
  try {
    let userDoc;
    const role = req.user.activeRole;

    if (role === "mechanic") {
      userDoc = await Mechanic.findOne({ user: req.user.id });
    } else if (role === "pumpAdmin") {
      userDoc = await Pump.findOne({ owner: req.user.id });
    }

    if (!userDoc) {
      userDoc = await Mechanic.findOne({ user: req.user.id });
      if (!userDoc) {
        userDoc = await Pump.findOne({ owner: req.user.id });
      }
    }

    if (!userDoc) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        walletBalance: userDoc.walletBalance || 0,
        freeTrialEndsAt: userDoc.freeTrialEndsAt,
        isTrialActive: userDoc.freeTrialEndsAt && new Date() < new Date(userDoc.freeTrialEndsAt)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Razorpay Order
export const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: amount * 100, // amount in the smallest currency unit (paise)
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`
    };

    const order = await instance.orders.create(options);

    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Razorpay Payment and add to wallet
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    let userDoc;
    const role = req.user.activeRole;

    if (role === "mechanic") {
      userDoc = await Mechanic.findOne({ user: req.user.id });
    } else if (role === "pumpAdmin") {
      userDoc = await Pump.findOne({ owner: req.user.id });
    }

    if (!userDoc) {
      userDoc = await Mechanic.findOne({ user: req.user.id });
      if (!userDoc) {
        userDoc = await Pump.findOne({ owner: req.user.id });
      }
    }

    if (!userDoc) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    // Amount is in rupees from frontend (or we can pass back the exact added amount)
    userDoc.walletBalance = (userDoc.walletBalance || 0) + Number(amount);
    await userDoc.save();

    res.status(200).json({
      success: true,
      message: `₹${amount} added to wallet successfully.`,
      walletBalance: userDoc.walletBalance
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
