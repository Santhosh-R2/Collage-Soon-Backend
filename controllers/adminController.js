const User = require('../models/User');
const Institute = require('../models/Institute');
const Broadcast = require('../models/Broadcast');
const SOSAlert = require('../models/SOSAlert');
const ExamSchedule = require('../models/ExamSchedule');
const Assignment = require('../models/Assignment');
const emailService = require('../utils/emailService');
exports.setInstituteLocation = async (req, res) => {
  try {
    const { lat, lng, radius, adminId } = req.body;

    const institute = await Institute.findOneAndUpdate(
      { adminId: adminId }, 
      {
        location: { lat, lng },
        geofenceRadius: radius || 0.5,
        adminId: adminId,
        lastUpdated: Date.now()
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: "Institute Location Updated Successfully",
      institute: institute
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendBroadcast = async (req, res) => {
  try {
    const { senderId, title, message, targetAudience } = req.body;

    if (!title || !message || !targetAudience) {
      return res.status(400).json({ message: "All fields are required." });
    }

    await Broadcast.create({
      senderId: senderId || "000000000000000000000000",
      title,
      message,
      targetAudience
    });

    let query = { isApproved: true };
    if (targetAudience !== 'all') {
      query.role = targetAudience;
    }

    const users = await User.find(query).select('email');
    const emailList = users.map(u => u.email).filter(e => e);
    console.log(emailList);
    console.log(users);

    let emailStatus = "No emails sent";
    if (emailList.length > 0) {
      try {
        const info = await emailService.sendBroadcastEmail(emailList, title, message);
        if (info) {
          console.log(`📧 Broadcast emails sent to ${emailList.length} users via BCC.`);
          emailStatus = `Broadcast transmitted to ${emailList.length} users.`;
        } else {
          console.warn("⚠️ Broadcast email process returned no info.");
          emailStatus = "Broadcast triggered, but email delivery status uncertain.";
        }
      } catch (err) {
        console.error("❌ Staff Broadcast Email Error:", err.message);
        emailStatus = `Broadcast recorded, but email failed: ${err.message}`;
      }
    }

    const io = req.app.get('socketio');
    const payload = { title, message, from: 'Admin', date: new Date() };

    if (targetAudience === 'all') {
      io.emit('broadcast-alert', payload);
    } else {
      io.to(`role-${targetAudience}`).emit('broadcast-alert', payload);
    }

    res.status(200).json({
      message: emailStatus
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getInstituteByAdmin = async (req, res) => {
  try {
    const { adminId } = req.params; 

    const institute = await Institute.findOne({ adminId: adminId });

    if (!institute) {
      return res.status(404).json({ message: "No Institute found for this Admin ID" });
    }

    res.status(200).json(institute);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getActiveInstitute = async (req, res) => {
  try {
    const institute = await Institute.findOne().sort({ lastUpdated: -1 });
    if (!institute) {
      return res.status(404).json({ message: "No Institute location defined yet" });
    }
    res.status(200).json(institute);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find()
      .populate('senderId', 'name role')
      .sort({ createdAt: -1 });
    const sosAlerts = await SOSAlert.find()
      .populate('driverId', 'name role')
      .sort({ createdAt: -1 });
    const exams = await ExamSchedule.find()
      .populate('teacherId', 'name role')
      .sort({ createdAt: -1 });

    const assignments = await Assignment.find()
      .populate('teacherId', 'name role')
      .sort({ createdAt: -1 });

    const formattedBroadcasts = broadcasts.map(b => {
      const role = b.senderId && b.senderId.role ? b.senderId.role.toLowerCase() : 'admin';
      const name = b.senderId && b.senderId.name ? b.senderId.name : 'System Admin';

      return {
        _id: b._id,
        type: 'General',
        senderName: name,
        senderRole: role, 
        title: b.title,
        message: b.message,
        targetAudience: b.targetAudience,
        createdAt: b.createdAt
      };
    });

    const formattedSOS = sosAlerts.map(s => {
      const name = s.driverId && s.driverId.name ? s.driverId.name : 'Unknown Driver';

      return {
        _id: s._id,
        type: 'SOS',
        senderName: name,
        senderRole: 'driver',
        title: `EMERGENCY SOS: ${s.reason}`,
        message: `Driver triggered SOS at Location: Lat ${s.location?.lat}, Lng ${s.location?.lng}`,
        targetAudience: 'admin', 
        createdAt: s.createdAt
      };
    });

    const formattedExams = exams.map(e => {
      const name = e.teacherId && e.teacherId.name ? e.teacherId.name : 'Faculty';
      const examList = e.exams.map(ex => `${ex.subject} (${ex.date})`).join(', ');

      return {
        _id: e._id,
        type: 'Exam',
        senderName: name,
        senderRole: 'teacher',
        title: `Exam Schedule: ${e.semester}`,
        message: `New exam schedule posted for ${e.semester}: ${examList}`,
        targetAudience: 'students',
        createdAt: e.createdAt,
        senderId: e.teacherId?._id 
      };
    });

    const formattedAssignments = assignments.map(a => {
      const name = a.teacherId && a.teacherId.name ? a.teacherId.name : 'Faculty';

      return {
        _id: a._id,
        type: 'Assignment',
        senderName: name,
        senderRole: 'teacher',
        title: `Assignment: ${a.topic}`,
        message: `New assignment on ${a.topic}. Due Date: ${a.submissionDate}. Description: ${a.description}`,
        targetAudience: 'students',
        createdAt: a.createdAt,
        senderId: a.teacherId?._id 
      };
    });
    const allMessages = [
      ...formattedBroadcasts, 
      ...formattedSOS, 
      ...formattedExams, 
      ...formattedAssignments
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json(allMessages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteBroadcastLog = async (req, res) => {
  try {
    const { id, type } = req.params;

    if (type === 'General') {
      await Broadcast.findByIdAndDelete(id);
    } else if (type === 'SOS') {
      await SOSAlert.findByIdAndDelete(id);
    } else if (type === 'Exam') {
      await ExamSchedule.findByIdAndDelete(id);
    } else if (type === 'Assignment') {
        await Assignment.findByIdAndDelete(id);
    } else {
      return res.status(400).json({ message: "Invalid log type" });
    }

    res.status(200).json({ message: "Log deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getBroadcastDetail = async (req, res) => {
  try {
    const { id, type } = req.params;

    let result;
    if (type === 'General') {
      result = await Broadcast.findById(id).populate('senderId', 'name role');
    } else if (type === 'SOS') {
      result = await SOSAlert.findById(id).populate('driverId', 'name role');
    } else if (type === 'Exam') {
      result = await ExamSchedule.findById(id).populate('teacherId', 'name role');
    } else if (type === 'Assignment') {
      result = await Assignment.findById(id).populate('teacherId', 'name role');
    } else {
      return res.status(400).json({ message: "Invalid type" });
    }

    if (!result) {
      return res.status(404).json({ message: "Entry not found" });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;