const User = require('../models/User');
const Institute = require('../models/Institute');
const Broadcast = require('../models/Broadcast');
const emailService = require('../utils/emailService');
// Set Institute Location
exports.setInstituteLocation = async (req, res) => {
  try {
    const { lat, lng, radius, adminId } = req.body;

    // FILTER by adminId. 
    // If an institute with this adminId exists -> UPDATE it.
    // If not -> CREATE it.
    const institute = await Institute.findOneAndUpdate(
      { adminId: adminId }, // <--- The Change: Look for this specific Admin's institute
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

// Send Broadcast (Admin)
// Send Broadcast (Admin)
exports.sendBroadcast = async (req, res) => {
  try {
    const { senderId, title, message, targetAudience } = req.body;

    if (!title || !message || !targetAudience) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // 1. Save to DB
    await Broadcast.create({
      senderId: senderId || "000000000000000000000000",
      title,
      message,
      targetAudience
    });

    // 2. Build Query
    let query = { isApproved: true };
    if (targetAudience !== 'all') {
      query.role = targetAudience;
    }

    const users = await User.find(query).select('email');
    const emailList = users.map(u => u.email).filter(e => e);
console.log(emailList);
console.log(users);

    // 3. Email Sending (UPDATED: Added 'await')
    // In Vercel, we MUST wait for this to finish, or the connection is cut.
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
        // Log but don't fail the request completely
        console.error("❌ Staff Broadcast Email Error:", err.message);
        emailStatus = `Broadcast recorded, but email failed: ${err.message}`;
      }
    }

    // 4. Socket Emit
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
    const { adminId } = req.params; // Get ID from URL parameter

    const institute = await Institute.findOne({ adminId: adminId });

    if (!institute) {
      return res.status(404).json({ message: "No Institute found for this Admin ID" });
    }

    res.status(200).json(institute);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};