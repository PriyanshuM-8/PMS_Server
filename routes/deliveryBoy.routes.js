import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import DeliveryBoy from "../models/deliveryBoy.model.js";
import Booking from "../models/booking.model.js";
import Pump from "../models/pump.model.js";
import Customer from "../models/customer.model.js";
import { notify } from "../utils/socket.js";

const router = Router();

// ─── JWT for delivery boy ─────────────────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id, role: "deliveryBoy" }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ─── Auth middleware for delivery boy ────────────────────────────────────────
const protectDB = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "No token" });
  try {
    const decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
    if (decoded.role !== "deliveryBoy") return res.status(403).json({ success: false, message: "Access denied" });
    req.deliveryBoyId = decoded.id;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ─── POST /api/delivery-boy/login ─────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ success: false, message: "Phone and password required" });

    const boy = await DeliveryBoy.findOne({ phone, isActive: true });
    if (!boy) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const match = await bcrypt.compare(password, boy.password);
    if (!match) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = signToken(boy._id);
    res.json({
      success: true,
      token,
      deliveryBoy: { _id: boy._id, name: boy.name, phone: boy.phone, pump: boy.pump },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/delivery-boy/my-orders ─────────────────────────────────────────
router.get("/my-orders", protectDB, async (req, res) => {
  try {
    const orders = await Booking.find({ deliveryBoy: req.deliveryBoyId, serviceType: "fuel" })
      .populate("customer", "name phone")
      .populate("pump", "pumpName upiId")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/delivery-boy/order/:id ─────────────────────────────────────────
router.get("/order/:id", protectDB, async (req, res) => {
  try {
    const order = await Booking.findOne({ _id: req.params.id, deliveryBoy: req.deliveryBoyId })
      .populate("customer", "name phone")
      .populate("pump", "pumpName upiId phone");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/delivery-boy/order/:id/start ─────────────────────────────────
// Delivery boy starts — marks in_progress
router.patch("/order/:id/start", protectDB, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, deliveryBoy: req.deliveryBoyId, status: "assigned" });
    if (!booking) return res.status(404).json({ success: false, message: "Order not found or not in assigned state" });

    booking.status = "in_progress";
    booking.statusTimeline.push({ status: "in_progress", time: new Date(), note: "Delivery boy is on the way" });
    await booking.save();

    const customer = await Customer.findById(booking.customer);
    if (customer) {
      notify(customer.user.toString(), "booking:update", {
        bookingId: booking._id, status: "in_progress",
        message: "Your delivery partner is on the way",
      });
    }
    res.json({ success: true, message: "Marked in progress", data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/delivery-boy/order/:id/arrived ───────────────────────────────
// Delivery boy reached customer location
router.patch("/order/:id/arrived", protectDB, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, deliveryBoy: req.deliveryBoyId, status: "in_progress" });
    if (!booking) return res.status(404).json({ success: false, message: "Order not found or not in progress" });

    booking.status = "reached";
    booking.statusTimeline.push({ status: "reached", time: new Date(), note: "Delivery partner arrived at customer location" });
    await booking.save();

    const customer = await Customer.findById(booking.customer);
    if (customer) {
      notify(customer.user.toString(), "booking:update", {
        bookingId: booking._id, status: "reached",
        message: "Delivery Partner Arrived at your location",
        amount: booking.amount,
      });
    }

    // Notify pump admin too
    const pump = await Pump.findById(booking.pump).select("owner");
    if (pump) {
      notify(pump.owner.toString(), "booking:update", {
        bookingId: booking._id, status: "reached",
        message: "Delivery boy reached customer location",
      });
    }

    res.json({ success: true, message: "Marked as arrived", data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/delivery-boy/order/:id/cash-received ─────────────────────────
// Delivery boy collected cash — moves to payment_pending so fuel can be delivered
router.patch("/order/:id/cash-received", protectDB, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, deliveryBoy: req.deliveryBoyId, status: "reached" });
    if (!booking) return res.status(404).json({ success: false, message: "Order not found or not in reached state" });

    booking.status = "payment_pending";
    booking.paymentMethod = "cash";
    booking.paymentStatus = "paid";
    booking.statusTimeline.push({ status: "payment_pending", time: new Date(), note: "Cash payment received by delivery boy" });
    await booking.save();

    // Notify pump admin
    const pump = await Pump.findById(booking.pump).select("owner");
    if (pump) {
      notify(pump.owner.toString(), "booking:update", {
        bookingId: booking._id, status: "payment_pending",
        message: `Cash ₹${booking.amount} received. Fuel delivery in progress.`,
        paymentMethod: "cash",
      });
    }

    // Notify customer
    const customer = await Customer.findById(booking.customer);
    if (customer) {
      notify(customer.user.toString(), "booking:update", {
        bookingId: booking._id, status: "payment_pending",
        message: "Cash payment received. Fuel being delivered.",
      });
    }

    res.json({ success: true, message: "Cash received", data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/delivery-boy/order/:id/fuel-delivered ────────────────────────
// Delivery boy marks fuel as delivered — completes the order
router.patch("/order/:id/fuel-delivered", protectDB, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id, deliveryBoy: req.deliveryBoyId,
      status: "payment_pending",
    });
    if (!booking) return res.status(404).json({ success: false, message: "Order not found or payment not confirmed" });

    booking.status = "completed";
    booking.completionOTP = null;
    booking.statusTimeline.push({ status: "completed", time: new Date(), note: "Fuel delivered successfully" });
    await booking.save();

    await Customer.findByIdAndUpdate(booking.customer, { $inc: { totalOrders: 1 } });

    const customer = await Customer.findById(booking.customer);
    if (customer) {
      notify(customer.user.toString(), "booking:update", {
        bookingId: booking._id, status: "completed",
        message: "Fuel delivered! Please rate your experience.",
        amount: booking.amount,
      });
    }

    const pump = await Pump.findById(booking.pump).select("owner");
    if (pump) {
      notify(pump.owner.toString(), "booking:update", {
        bookingId: booking._id, status: "completed",
        message: "Fuel delivery completed successfully.",
      });
    }

    res.json({ success: true, message: "Fuel delivered. Order completed.", data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
