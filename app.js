import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import superAdminRoutes from "./routes/superAdmin.routes.js";
import pumpAdminRoutes from "./routes/pumpAdmin.routes.js";
import mechanicRoutes from "./routes/mechanic.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import bookingRoutes from "./routes/booking.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("PMS Server is running"));

app.use("/api/auth", authRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/pump-admin", pumpAdminRoutes);
app.use("/api/mechanics", mechanicRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/bookings", bookingRoutes);

export default app;
