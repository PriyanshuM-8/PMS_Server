import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";
import connectDB from "./db/db.js";
import { initSocket } from "./utils/socket.js";

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);

console.log("⏳ Initializing Socket.io...");
initSocket(httpServer);

console.log("⏳ Starting Database Connection...");
connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`✅ Server is successfully running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Server failed to start due to DB error:", err);
  });
