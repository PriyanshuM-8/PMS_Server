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

    // SuperAdmin Wallet Earnings
    superAdminEarningsFuel: { type: Number, default: 0 },
    superAdminEarningsMechanic: { type: Number, default: 0 },

    // SuperAdmin Account Details
    accountDetails: {
      bankName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
      accountHolderName: { type: String, default: "" }
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
