import mongoose from "mongoose";

const mechanicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, match: /^[6-9]\d{9}$/ },
    email: { type: String, lowercase: true, trim: true },
    password: { type: String, minlength: 6, select: false },

    // Link to User model for multi-role login
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    profileImage: String,
    aadharPhoto: { type: String, required: true },

    type: { type: String, enum: ["internal", "external"], required: true },

    // Internal mechanic — single pump
    pump: { type: mongoose.Schema.Types.ObjectId, ref: "Pump" },

    // External mechanic — multi pump connections
    pumpConnections: [
      {
        pump: { type: mongoose.Schema.Types.ObjectId, ref: "Pump" },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
      },
    ],

    skills: [{ type: String, enum: ["engine", "puncture", "battery", "oil", "all work"] }],
    experience: { type: Number, default: 0 },
    address: String,

   location: {
  type: {
    type: String,
    enum: ["Point"],
  },
  coordinates: {
    type: [Number],
    validate: {
      validator: function (val) {
        return val.length === 2;
      },
      message: "Coordinates must be [lng, lat]",
    },
  },
},

    isAvailable: { type: Boolean, default: true },
    currentStatus: { type: String, enum: ["idle", "busy", "offline"], default: "idle" },

    totalJobs: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },

    status: { type: String, enum: ["active", "inactive"], default: "active" },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },

    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

mechanicSchema.index({ location: "2dsphere" });

export default mongoose.model("Mechanic", mechanicSchema);
