import mongoose from "mongoose";

const pumpSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pumpName: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },

    address: {
      full: { type: String, required: true },
      location: {
        type: { type: String, enum: ["Point"] },
        coordinates: { type: [Number] }, // [lng, lat]
      },
    },

    pumpType: [{ type: String, enum: ["petrol", "diesel"] }],
    licenseNumber: { type: String, required: true },

    profileImage: { type: String },
    aadharPhoto: { type: String },
    ownerIdProof: { type: String },

    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // Wallet & Platform Subscription
    walletBalance: { type: Number, default: 0 },
    lastPlatformFeeDeduction: { type: Date, default: null },
    freeTrialEndsAt: { 
      type: Date, 
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) 
    },

    fuelPrices: {
      petrol: { type: Number, default: 0 },
      diesel: { type: Number, default: 0 },
      lastUpdated: { type: Date },
    },

    // UPI for delivery payments — only admin can set, delivery boy cannot edit
    upiId: { type: String, default: "" },
  },
  { timestamps: true }
);

pumpSchema.index({ "address.location": "2dsphere" });

export default mongoose.model("Pump", pumpSchema);
