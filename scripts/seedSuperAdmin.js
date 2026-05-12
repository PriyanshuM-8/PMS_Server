import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/user.model.js";

dotenv.config();

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB Connected");

    const existing = await User.findOne({ roles: "superAdmin" });
    if (existing) {
      console.log("SuperAdmin already exists:", existing.email);
      process.exit(0);
    }

    const hashed = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 10);

    await User.create({
      name: "Super Admin",
      email: process.env.SUPER_ADMIN_EMAIL,
      password: hashed,
      roles: ["superAdmin"],
      activeRole: "superAdmin",
      isActive: true,
      approvalStatus: "approved",
    });

    console.log("SuperAdmin created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
};

seedSuperAdmin();
