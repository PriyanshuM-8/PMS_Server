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

    fuelPrices: {
      petrol: { type: Number, default: 0 },
      diesel: { type: Number, default: 0 },
      lastUpdated: { type: Date },
    },
  },
  { timestamps: true }
);

pumpSchema.index({ "address.location": "2dsphere" });

export default mongoose.model("Pump", pumpSchema);
