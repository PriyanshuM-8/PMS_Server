import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // Multi-role support
    roles: {
      type: [String],
      enum: ["superAdmin", "pumpAdmin", "mechanic", "customer"],
      default: ["customer"],
    },

    // Currently active role (for frontend dashboard switch)
    activeRole: {
      type: String,
      enum: ["superAdmin", "pumpAdmin", "mechanic", "customer"],
      default: "customer",
    },

    phone: { type: String },
    isActive: { type: Boolean, default: true },
    pendingPhone: { type: String, default: null },
    otp: { type: String },
    otpExpiry: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
