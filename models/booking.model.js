import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    pump:     { type: mongoose.Schema.Types.ObjectId, ref: "Pump" },
    mechanic: { type: mongoose.Schema.Types.ObjectId, ref: "Mechanic" },
    deliveryBoy: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy" },

    // All pumps within 5km that were notified — first to accept gets the booking
    notifiedPumps: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pump" }],
    notifiedMechanics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Mechanic" }],

    serviceType: { type: String, enum: ["fuel", "mechanic"], required: true },

    fuelDetails: {
      fuelType: { type: String, enum: ["petrol", "diesel"] },
      quantity: Number,
    },

    workDetails: {
      description: String,
      vehicleName: String,
      partsChanged: [{ partName: String, price: Number }],
      labourCharge: { type: Number, default: 0 },
      totalAmount:  { type: Number, default: 0 },
    },

    address: {
      full: String,
      location: {
        type: { type: String, enum: ["Point"] },
        coordinates: { type: [Number] },
      },
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "assigned", "in_progress", "reached", "payment_pending", "mechanic_payment_pending", "completed", "cancelled"],
      default: "pending",
    },

    // ─── Estimated arrival time (minutes) ────────────────────────────────────
    estimatedArrival: { type: Number, default: null }, // e.g. 15, 20, 30

    // ─── Status timeline — har status change ka timestamp ────────────────────
    statusTimeline: [
      {
        status: String,
        time: { type: Date, default: Date.now },
        note: String, // optional note e.g. "Mechanic on the way"
      },
    ],

    amount: { type: Number, default: 0 },
    priceBreakdown: {
      fuelCost:     { type: Number, default: 0 },
      deliveryFee:  { type: Number, default: 0 },
      platformFee:  { type: Number, default: 0 },
      total:        { type: Number, default: 0 },
    },
    paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
    paymentMethod: { type: String, enum: ["online", "cash", "upi"] },
    isRated: { type: Boolean, default: false },
    rating: { type: Number, min: 1, max: 5, default: null },
    feedback: { type: String, default: '' },
    completionOTP: { type: String },
  },
  { timestamps: true }
);

bookingSchema.index({ "address.location": "2dsphere" });

export default mongoose.model("Booking", bookingSchema);
