const User = require('../models/User');
const Institute = require('../models/Institute');
const AttendanceRecord = require('../models/AttendanceRecord'); // <--- Import New Model

// Helper to get today's date in IST (YYYY-MM-DD)
const getTodayIST = () => {
    return new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Asia/Kolkata', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).format(new Date());
};

// Helper: Distance Calculator
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; 
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function deg2rad(deg) { return deg * (Math.PI/180); }


exports.markAttendance = async (req, res) => {
  try {
    const { userId, lat, lng, status } = req.body; 
    const attendanceStatus = status || 'present'; 
    const today = getTodayIST(); 

    // Check Duplicate
    const existingRecord = await AttendanceRecord.findOne({ userId, date: today });
    if (existingRecord) {
      return res.status(400).json({ status: 'Info', message: `Already marked as ${existingRecord.status} today.` });
    }

    // --- ABSENT LOGIC (No GPS check needed) ---
    if (attendanceStatus === 'absent') {
      await AttendanceRecord.create({ userId, date: today, status: 'absent', location: { lat: 0, lng: 0 } });
      await User.findByIdAndUpdate(userId, { campusAttendance: { status: 'absent', date: today } });
      return res.status(200).json({ status: 'Success', message: 'Marked Absent' });
    }

    // --- PRESENT LOGIC (Strict 100m Radius Check) ---
    if (attendanceStatus === 'present') {
      
      if(!lat || !lng) {
        return res.status(400).json({ message: "GPS coordinates required." });
      }

      // 1. Get College Location
      const institute = await Institute.findOne();
      if (!institute) return res.status(400).json({ message: "Institute location not set by Admin." });

      // 2. Calculate Distance (in Kilometers)
      const distanceInKm = getDistanceFromLatLonInKm(lat, lng, institute.location.lat, institute.location.lng);
      
      // 3. Define Allowed Radius (0.1 KM = 100 Meters)
      // You can also use institute.geofenceRadius if you want it dynamic, 
      // but you specifically asked for 100m here.
      const ALLOWED_RADIUS_KM = 0.5; 

      if (distanceInKm <= ALLOWED_RADIUS_KM) {
        // SUCCESS: User is inside 100m
        await AttendanceRecord.create({
          userId,
          date: today,
          status: 'present',
          location: { lat, lng }
        });

        await User.findByIdAndUpdate(userId, { 
          campusAttendance: { status: 'present', date: today } 
        });

        return res.status(200).json({ status: 'Success', message: 'Marked Present (Inside Campus)' });
      
      } else {
        // FAILURE: User is too far
        const distanceInMeters = (distanceInKm * 1000).toFixed(0);
        return res.status(400).json({ 
          status: 'Failed', 
          message: `Cannot mark attendance. You are ${distanceInMeters}m away from college. Must be within 100m.` 
        });
      }
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. View Attendance History (For Student Profile)
// 2. View Attendance History
exports.getAttendanceHistory = async (req, res) => {
  try {
    // FIX: Check both Query String AND Request Body
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Fetch history
    const history = await AttendanceRecord.find({ userId: userId }).sort({ date: -1 });

    res.status(200).json({
      totalPresent: history.length,
      history: history
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLiveClassAttendance = async (req, res) => {
  try {
    const { teacherId } = req.query;

    if (!teacherId) {
      return res.status(400).json({ message: "Teacher ID is required" });
    }

    // 1. Get today's date string "YYYY-MM-DD"
    const today = getTodayIST();

    // 2. Find all students assigned to this teacher
    const students = await User.find({ 
      classTeacherId: teacherId,
      role: 'student',
      isApproved: true
    }, 'name email campusAttendance');

    // 3. Format the data for the frontend
    // If the student's stored attendance date is NOT today, show 'absent'
    const attendanceList = students.map(student => {
      let currentStatus = 'absent';
      
      // Check if the stored status is from TODAY
      if (student.campusAttendance && student.campusAttendance.date === today) {
        currentStatus = student.campusAttendance.status;
      }

      return {
        studentId: student._id,
        name: student.name,
        email: student.email,
        status: currentStatus // 'present' or 'absent'
      };
    });

    res.status(200).json({
      date: today,
      totalStudents: students.length,
      presentCount: attendanceList.filter(s => s.status === 'present').length,
      students: attendanceList
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTodayAttendanceByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const today = getTodayIST();

    // Find all attendance records for today
    const records = await AttendanceRecord.find({ 
      date: today,
      status: 'present'
    }).populate({
      path: 'userId',
      match: { role: role },
      select: 'name email role'
    });

    // Filter out records where userId didn't match the role (populate returns null for mismatch)
    const presentUsers = records
      .filter(r => r.userId !== null)
      .map(r => ({
        _id: r.userId._id,
        name: r.userId.name,
        email: r.userId.email,
        checkInTime: r.checkInTime
      }));

    res.status(200).json(presentUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};