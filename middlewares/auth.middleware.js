import jwt from "jsonwebtoken";
import { isBlacklisted } from "../utils/tokenBlacklist.js";
import User from "../models/user.model.js";

//  Protect Middleware
export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  const token = authHeader.split(" ")[1];

  if (isBlacklisted(token)) {
    return res.status(401).json({ success: false, message: "Token has been invalidated" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password -otp -otpExpiry");
    
    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists" });
    }
    
    req.user = {
      ...decoded,
      ...user.toObject(),
      id: user._id.toString()
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      error: err.message,
    });
  }
};

//  Role Authorization Middleware
export const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const { activeRole, roles } = req.user;

  if (!activeRole || !roles?.includes(activeRole)) {
    return res.status(403).json({
      success: false,
      message: "Invalid role configuration",
    });
  }

  if (!allowedRoles.includes(activeRole)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  next();
};