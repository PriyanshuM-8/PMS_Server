import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";
import connectDB from "./db/db.js";
import { initSocket } from "./utils/socket.js";

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);

initSocket(httpServer);

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
