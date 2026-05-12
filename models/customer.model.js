import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, match: /^[6-9]\d{9}$/ },
    profileImage: String,

    vehicles: [
      {
        vehicleType: { type: String, enum: ["bike", "car", "truck"] },
        vehicleNumber: { type: String, required: true },
        fuelType: { type: String, enum: ["petrol", "diesel"] },
      },
    ],

    address: {
      full: { type: String, required: true },
      location: {
        type: { type: String, enum: ["Point"] },
        coordinates: { type: [Number] }, // [lng, lat]
      },
    },

    walletBalance: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

customerSchema.index({ "address.location": "2dsphere" });

export default mongoose.model("Customer", customerSchema);
