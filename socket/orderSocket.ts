import { Server } from "socket.io";

let io: Server | null = null;

export function setIo(instance: Server) {
  io = instance;
}

export function getIo(): Server {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
}

export function initOrderSocket(instance: Server) {
  instance.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("joinOrder", (orderId: string) => {
      if (!orderId) return;
      socket.join(`order_${orderId}`);
      console.log(`${socket.id} joined order_${orderId}`);
    });

    socket.on("joinUser", (userId: string) => {
      if (!userId) return;
      socket.join(`user_${userId}`);
      console.log(`${socket.id} joined user_${userId}`);
    });

    socket.on("join_online_drivers", () => {
      socket.join("online_drivers");
      console.log(`${socket.id} joined online_drivers room`);
    });

    socket.on("joinDriver", (driverId: string) => {
      if (!driverId) return;
      socket.join(`driver_${driverId}`);
      console.log(`${socket.id} joined driver_${driverId}`);
    });

    socket.on("joinAdmin", () => {
      socket.join("admins");
      console.log(`${socket.id} joined admins room`);
    });

    socket.on("leaveOrder", (orderId: string) => {
      if (!orderId) return;
      socket.leave(`order_${orderId}`);
      console.log(`${socket.id} left order_${orderId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", socket.id, reason);
    });
  });
}

export function broadcastNewOrder(orderData: any) {
  if (!io) {
    console.warn("IO not initialized");
    return;
  }
  io.to("online_drivers").emit("new_order_broadcast", orderData);
  console.log(`[Socket] Broadcasted new_order_broadcast to online_drivers for Order ${orderData._id}`);
}

export function emitOrderStatusUpdate(orderId: string, payload: any) {
  if (!io) {
    console.warn("IO not initialized");
    return;
  }
  io.to(`order_${orderId}`).emit("orderStatusUpdated", { orderId, ...payload });
  io.to("admins").emit("orderStatusChanged", { orderId, ...payload });
}

export function emitOrderToDriver(driverId: string, orderData: any) {
  if (!io) {
    console.warn("IO not initialized");
    return;
  }
  io.to(`driver_${driverId}`).emit("new_order_broadcast", orderData);
  console.log(`[Socket] Assigned order directly to driver_${driverId}`);
}

export function emitAdminNotification(type: string, message: string, data: any = {}) {
  if (!io) {
    console.warn("IO not initialized");
    return;
  }
  io.to("admins").emit("adminNotification", {
    type,
    message,
    data,
    timestamp: new Date().toISOString()
  });
  console.log(`[Socket] Admin Notification Emitted: ${type} - ${message}`);
}
