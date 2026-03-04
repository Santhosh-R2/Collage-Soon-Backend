const User = require('../models/User');
const Bus = require('../models/Bus');
const Institute = require('../models/Institute');
const SOSAlert = require('../models/SOSAlert')
const LiveBusLocation = require('../models/LiveBusLocation');
const emailService = require('../utils/emailService');
const BusAttendance = require('../models/BusAttendance');
const Trip = require('../models/Trip');

// Helper: Calculate Distance using Haversine Formula (Returns km)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Prediction Logic: Simple ETA based on Distance and Avg Speed (e.g., 30 km/h)
function calculatePrediction(startLat, startLng, destLat, destLng, startTime) {
  const distance = getDistance(startLat, startLng, destLat, destLng);
  const avgSpeed = 30; // km/h
  const durationHours = distance / avgSpeed;
  const durationSeconds = Math.round(durationHours * 3600);

  const predictedTime = new Date(startTime.getTime() + durationSeconds * 1000);
  return { predictedTime, distance: Math.round(distance * 1000), duration: durationSeconds };
}
// 1. Initialize Bus (Driver creates their bus profile)
exports.initBus = async (req, res) => {
  try {
    const { driverId, busNumber } = req.body;

    // findOneAndUpdate with { upsert: true } handles both create and update
    const bus = await Bus.findOneAndUpdate(
      { driverId },
      { busNumber },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ 
      message: "Bus Profile saved/updated successfully", 
      bus 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getBusByDriver = async (req, res) => {
  try {
    const { driverId } = req.query;

    const bus = await Bus.findOne({ driverId });
    
    if (!bus) {
      return res.status(200).json({ busNumber: "" }); // Return empty if not found
    }

    res.status(200).json(bus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// 2. Get All Available Users (For Driver to Search & Add)
exports.getAllUsers = async (req, res) => {
  try {
    // Fetch users who are NOT admins or drivers
    const users = await User.find(
      { role: { $nin: ['admin', 'driver'] }, isApproved: true },
      'name role email homeLocation'
    );
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Add Passenger to Bus List
exports.addPassenger = async (req, res) => {
  try {
    const { driverId, passengerId } = req.body;

    // Use $addToSet to prevent duplicates
    await Bus.findOneAndUpdate(
      { driverId },
      { $addToSet: { passengers: passengerId } },
      { upsert: true }
    );

    res.status(200).json({ message: "Passenger Added to Trip List" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Remove Passenger from Bus List
exports.removePassenger = async (req, res) => {
  try {
    const { driverId, passengerId } = req.body;

    await Bus.findOneAndUpdate(
      { driverId },
      { $pull: { passengers: passengerId } }
    );

    res.status(200).json({ message: "Passenger Removed from Trip List" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Get My Passenger List (View Edit Screen)
exports.getMyPassengers = async (req, res) => {
  try {
    const { driverId } = req.query;
    const bus = await Bus.findOne({ driverId }).populate('passengers', 'name role email homeLocation');
    res.status(200).json(bus ? bus.passengers : []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. User sets "Coming" or "Absent" (Daily Status)
// 1. User Sets Status (Coming/Absent) for TODAY
exports.setDailyStatus = async (req, res) => {
  try {
    const { userId, status, driverId } = req.body;
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    // 1. Check if a record ALREADY exists for today
    const existingRecord = await BusAttendance.findOne({ userId, date: today });

    if (existingRecord) {
      return res.status(400).json({
        message: `You have already marked your status as '${existingRecord.status}' for today. You cannot change it.`
      });
    }

    // 2. If no record, Create a new one
    await BusAttendance.create({
      userId,
      date: today,
      status,
      driverId,
      updatedAt: Date.now()
    });

    res.status(200).json({ message: `Bus status successfully set to ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.startTrip = async (req, res) => {
  try {
    const { driverId, lat, lng } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const startTime = new Date();

    // 1. Create or Reset Live Location Entry
    await LiveBusLocation.findOneAndUpdate(
      { driverId },
      {
        location: { lat, lng, speed: 0, heading: 0 },
        lastUpdated: startTime
      },
      { upsert: true, new: true }
    );

    // 2. Setup Arrival Predictions for "Coming" Passengers
    const busProfile = await Bus.findOne({ driverId });
    if (busProfile) {
      const attendanceRecords = await BusAttendance.find({
        userId: { $in: busProfile.passengers },
        date: today,
        status: 'coming'
      });

      const comingUserIds = attendanceRecords.map(record => record.userId);
      const activePassengers = await User.find({ _id: { $in: comingUserIds } }, 'homeLocation');

      const predictions = activePassengers.map(p => {
        if (!p.homeLocation || !p.homeLocation.lat) return null;
        const pred = calculatePrediction(lat, lng, p.homeLocation.lat, p.homeLocation.lng, startTime);
        return {
          userId: p._id,
          predictedArrivalTime: pred.predictedTime,
          distance: pred.distance,
          duration: pred.duration
        };
      }).filter(p => p !== null);

      // Create Active Trip Record
      await Trip.findOneAndUpdate(
        { driverId, status: 'STARTED' },
        {
          startTime,
          predictions,
          lastUpdated: startTime
        },
        { upsert: true, new: true }
      );
    }

    // Notify via Socket
    const io = req.app.get('socketio');
    io.to(`trip-${driverId}`).emit('trip-status', { status: 'STARTED', message: 'Bus has left.' });

    res.status(200).json({ message: "Trip Started. Arrival predictions ready.", startTime });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserPrediction = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find active trip where this user is in predictions
    const activeTrip = await Trip.findOne({
      status: 'STARTED',
      'predictions.userId': userId
    }).populate('driverId', 'name');

    if (!activeTrip) {
      return res.status(404).json({ message: "No active trip found for your route." });
    }

    const userPred = activeTrip.predictions.find(p => p.userId.toString() === userId);

    // 1. Format Distance
    const distanceFormatted = userPred.distance < 1000
      ? `${userPred.distance} m`
      : `${(userPred.distance / 1000).toFixed(1)} Km`;

    // 2. Format Duration
    let durationFormatted = "";
    if (userPred.duration < 60) {
      durationFormatted = `${userPred.duration} sec`;
    } else {
      const mins = Math.floor(userPred.duration / 60);
      const secs = userPred.duration % 60;
      durationFormatted = secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`;
    }

    // 3. Format Time to Local String (e.g., "14:25 PM")
    const arrivalTime = new Date(userPred.predictedArrivalTime);
    const timeFormatted = arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    res.status(200).json({
      status: 'ACTIVE',
      driver: activeTrip.driverId.name,
      predictedArrivalTime: timeFormatted,
      arrivalTimeISO: userPred.predictedArrivalTime, // Keep ISO for potential frontend usage
      distance: distanceFormatted,
      duration: durationFormatted
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.endTrip = async (req, res) => {
  try {
    const { driverId } = req.body;

    // 1. DELETE the live location record
    await LiveBusLocation.findOneAndDelete({ driverId });

    // 2. Mark Trip as Completed
    await Trip.updateMany({ driverId, status: 'STARTED' }, { status: 'COMPLETED', lastUpdated: Date.now() });

    // Notify via Socket
    const io = req.app.get('socketio');
    io.to(`trip-${driverId}`).emit('trip-status', { status: 'ENDED', message: 'Trip Completed.' });

    res.status(200).json({ message: "Trip Ended. Tracking Stopped." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLiveLocation = async (req, res) => {
  try {
    const { driverId } = req.query;

    if (driverId) {
      const liveData = await LiveBusLocation.findOne({ driverId });
      if (!liveData) {
        return res.status(404).json({ status: 'OFFLINE', message: "Bus is not running currently." });
      }
      return res.status(200).json({ status: 'ONLINE', data: liveData });
    } else {
      // If no driverId provided, fetch all active live locations
      const allLiveData = await LiveBusLocation.find().populate('driverId', 'name email');
      if (!allLiveData || allLiveData.length === 0) {
        return res.status(200).json({ status: 'OFFLINE', message: "No buses are running currently.", data: [] });
      }
      return res.status(200).json({ status: 'ONLINE', count: allLiveData.length, data: allLiveData });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// 7. GET OPTIMIZED ROUTE (The Logic Core)
// Only fetch passengers who are: 
// A) In this Driver's List AND 
// B) Have busStatus = 'coming'
exports.getRoute = async (req, res) => {
  try {
    const { driverId } = req.query;
    const today = new Date().toISOString().split('T')[0];

    const institute = await Institute.findOne();
    if (!institute) return res.status(400).json({ message: "Institute location missing" });

    // A. Get Driver's Static Passenger List
    const busProfile = await Bus.findOne({ driverId });
    if (!busProfile || busProfile.passengers.length === 0) {
      return res.status(400).json({ message: "No passengers assigned to this bus." });
    }

    // B. Get Attendance Records for TODAY for these passengers
    // We look for users in the list who marked 'coming'
    const attendanceRecords = await BusAttendance.find({
      userId: { $in: busProfile.passengers }, // Only my passengers
      date: today,
      status: 'coming'
    });

    // Extract the User IDs who are coming
    const comingUserIds = attendanceRecords.map(record => record.userId);

    // C. Fetch User Details (Lat/Lng) for the Coming Users
    const activePassengers = await User.find({
      _id: { $in: comingUserIds }
    }, 'name role homeLocation');

    // D. Construct Route
    const route = {
      date: today,
      start: institute.location,
      stops: activePassengers.map(p => ({
        id: p._id,
        name: p.name,
        role: p.role,
        lat: p.homeLocation ? p.homeLocation.lat : 0,
        lng: p.homeLocation ? p.homeLocation.lng : 0
      })),
      end: institute.location,
      totalComing: activePassengers.length
    };

    res.status(200).json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 8. Driver: Start/End Trip (Socket Notification)
exports.toggleTrip = async (req, res) => {
  const { driverId, action } = req.body; // 'START' or 'END'
  const io = req.app.get('socketio');

  // Notify everyone
  io.emit('trip-status', { driverId, status: action });

  if (action === 'END') {
    // Optional: Reset daily status
    // await User.updateMany({}, { busStatus: 'pending' });
  }

  res.status(200).json({ message: `Trip ${action}ED` });
};
exports.getComingUsers = async (req, res) => {
  try {
    const { driverId } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let userIdsToFetch = [];

    if (driverId) {
      // Logic for Specific Driver
      const bus = await Bus.findOne({ driverId });
      if (!bus) return res.status(404).json({ message: "Bus not found" });

      // Find 'coming' records for today strictly for this bus list
      const records = await BusAttendance.find({
        userId: { $in: bus.passengers },
        date: today,
        status: 'coming'
      });
      userIdsToFetch = records.map(r => r.userId);

    } else {
      // Logic for Admin (Show ALL coming users in college)
      const records = await BusAttendance.find({ date: today, status: 'coming' });
      userIdsToFetch = records.map(r => r.userId);
    }

    // Fetch details
    const users = await User.find({ _id: { $in: userIdsToFetch } }, 'name email role homeLocation');

    res.status(200).json({
      date: today,
      count: users.length,
      users: users
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.triggerSOS = async (req, res) => {
  try {
    const { driverId, reason, lat, lng } = req.body;

    // 1. Save Alert
    await SOSAlert.create({ driverId, reason, location: { lat, lng } });

    // 2. Get Driver Name
    const driver = await User.findById(driverId);

    // 3. Find Passengers on this Bus
    const bus = await Bus.findOne({ driverId });
    let passengerEmails = [];

    if (bus && bus.passengers.length > 0) {
      const passengers = await User.find({ _id: { $in: bus.passengers } }, 'email');
      passengerEmails = passengers.map(p => p.email).filter(e => e);
    }

    // 4. Send Urgent Email
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    await emailService.sendSOSEmail(passengerEmails, driver.name, reason, mapLink);

    // 5. Socket Broadcast (Existing)
    const io = req.app.get('socketio');
    const alertData = { type: 'SOS', message: reason, location: { lat, lng } };
    io.emit('admin-alert', alertData);
    io.to(`trip-${driverId}`).emit('sos-broadcast', alertData);

    res.status(200).json({ message: "SOS Broadcasted & Emailed to Passengers" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Optional: Admin can view SOS History
exports.getSOSHistory = async (req, res) => {
  try {
    const history = await SOSAlert.find().populate('driverId', 'name email').sort({ createdAt: -1 });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};