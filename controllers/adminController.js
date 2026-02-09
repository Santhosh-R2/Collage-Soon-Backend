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
exports.sendBroadcast = async (req, res) => {
  try {
    const { senderId, title, message, targetAudience } = req.body;

    // 1. Validation check
    if (!title || !message || !targetAudience) {
      return res.status(400).json({ message: "Title, Message, and Audience are required." });
    }

    // 2. Save to Database
    await Broadcast.create({ 
      senderId: senderId || "000000000000000000000000", 
      title, 
      message, 
      targetAudience 
    });

    // 3. Fetch Email Recipients (Only Approved Users)
    let query = { isApproved: true }; // Only send to verified users
    if (targetAudience !== 'all') {
      query.role = targetAudience;
    }
    
    const users = await User.find(query).select('email');
    const emailList = users.map(u => u.email).filter(e => e);

    // 4. Send Emails (FIRE AND FORGET - Don't 'await' this to prevent frontend timeout)
    if (emailList.length > 0) {
        emailService.sendBroadcastEmail(emailList, title, message)
            .then(() => console.log(`Emails sent to ${emailList.length} users`))
            .catch(err => console.error("Background Email Error:", err));
    }

    // 5. Socket Emit
    const io = req.app.get('socketio');
    const socketPayload = { title, message, from: 'Admin', date: new Date() };

    if (targetAudience === 'all') {
      io.emit('broadcast-alert', socketPayload);
    } else {
      io.to(`role-${targetAudience}`).emit('broadcast-alert', socketPayload);
    }

    // 6. Respond immediately
    res.status(200).json({ 
      message: `Broadcast initiated for ${emailList.length} users.`,
      count: emailList.length 
    });

  } catch (error) {
    console.error("Broadcast Error:", error);
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