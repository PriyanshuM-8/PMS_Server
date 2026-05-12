import { Server } from "socket.io";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("join", (id) => {
      if (!id) return;
      socket.join(id.toString());
    });

    socket.on("send-location", (data) => {
      io.emit("receive-location", { id: socket.id, ...data });
    });

    socket.on("mechanic:location", ({ mechanicId, lat, lng, bookingId }) => {
      if (!mechanicId || lat == null || lng == null) return;
      if (bookingId) {
        io.to(`booking:${bookingId}`).emit("mechanic:location:update", { lat, lng, mechanicId });
      }
    });

    socket.on("join:booking", (bookingId) => {
      if (!bookingId) return;
      socket.join(`booking:${bookingId}`);
    });

    socket.on("disconnect", () => {
      io.emit("user-disconnected", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};

// ─── Notify a single room ─────────────────────────────────────────────────────
export const notify = (roomId, event, data) => {
  try { getIO().to(roomId.toString()).emit(event, data); } catch (_) {}
};

// ─── Notify multiple pump owners ─────────────────────────────────────────────
export const notifyPumpOwners = (ownerIds, event, data) => {
  try {
    const io = getIO();
    ownerIds.forEach((id) => io.to(id.toString()).emit(event, data));
  } catch (_) {}
};
