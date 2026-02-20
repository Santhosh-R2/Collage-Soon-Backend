require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require("socket.io");
const connectDB = require('./config/db');
const apiRoutes = require('./routes/apiRoutes');
const LiveBusLocation = require('./models/LiveBusLocation');

connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all frontend apps
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(cors());

// Pass IO instance to routes (So controllers can emit events like 'Broadcast')
app.set('socketio', io);

// Mount API Routes
app.use('/api', apiRoutes);
app.use('/api', require('./routes/testEmailRoute')); // Test Route
app.use('/api', require('./routes/debugRoute')); // Debug Route

// ============================================
// 🔌 REAL-TIME SOCKET ENGINE
// ============================================
io.on('connection', (socket) => {
  console.log(`✅ User Connected: ${socket.id}`);

  // 1. JOIN ROOMS (Setup Phase)
  // Frontend emits this when app opens
  socket.on('join-app', (data) => {
    const { role, driverId, classTeacherId } = data;

    // Join Role Room (e.g., "role-student", "role-admin")
    if (role) socket.join(`role-${role}`);

    // Join Class Room (For Student <-> Teacher Broadcasts)
    if (classTeacherId) socket.join(`class-${classTeacherId}`);

    // Join Trip Room (For Live Tracking & SOS)
    // Students join the room of their assigned driver
    if (driverId) socket.join(`trip-${driverId}`);

    console.log(`Socket joined rooms for role: ${role}`);
  });

  // 2. LIVE TRACKING STREAM (Driver emits every ~3 seconds)
  socket.on('driver-location-update', async (data) => {
    const { driverId, lat, lng, heading, speed } = data;

    // A. Broadcast to Passengers IMMEDIATELY (Fastest UI update)
    io.to(`trip-${driverId}`).emit('live-bus-update', { driverId, lat, lng, heading, speed });

    // B. Broadcast to Admin Map (Global Fleet View)
    io.emit('admin-map-update', { driverId, lat, lng });

    // C. Save to Database (Persistence)
    // This ensures that if a user opens the app late, they can fetch the last known location via API
    try {
      await LiveBusLocation.findOneAndUpdate(
        { driverId },
        {
          location: { lat, lng, heading, speed },
          lastUpdated: Date.now()
        },
        { upsert: true } // Create if doesn't exist
      );
    } catch (err) {
      console.error("❌ Location Save Error:", err.message);
    }
  });

  // 3. SOS ALERT (Critical)
  socket.on('sos-alert', (data) => {
    const { driverId, message, lat, lng } = data;
    const alertData = { driverId, type: 'SOS', message, location: { lat, lng }, time: new Date() };

    // Alert Admin
    io.emit('admin-alert', alertData);

    // Alert Passengers on that specific bus
    io.to(`trip-${driverId}`).emit('sos-broadcast', alertData);
  });

  socket.on('disconnect', () => {
    console.log('❌ User Disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));