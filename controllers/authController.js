const User = require('../models/User');

// Helper to get today's date in IST (YYYY-MM-DD)
const getTodayIST = () => {
    return new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Asia/Kolkata', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).format(new Date());
};

// Register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, lat, lng, classTeacherId } = req.body;

    // 1. CHECK IF EMAIL ALREADY EXISTS
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "This email is already registered." });
    }
    
    // 2. Auto-approve Admin, others need approval
    const isApproved = role === 'admin'; 

    // 3. Logic: If registering with a Teacher ID, set status to 'pending'
    let requestStatus = 'none';
    if (role === 'student' && classTeacherId) {
      requestStatus = 'pending';
    }

    const newUser = new User({
      name, 
      email, 
      password, 
      role, 
      isApproved,
      classTeacherId, 
      teacherRequestStatus: requestStatus, 
      homeLocation: { lat, lng }
    });

    await newUser.save();
    res.status(201).json({ message: "Registration Successful." });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "Invalid Credentials" });

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

    if (!user.isApproved) return res.status(403).json({ message: "Account pending approval." });

    res.status(200).json({ 
      message: "Login Success", 
      userId: user._id, 
      role: user.role, 
      name: user.name,
      classTeacherId: user.classTeacherId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: Approve Users
exports.approveUser = async (req, res) => {
  try {
    const { userId } = req.body;
    await User.findByIdAndUpdate(userId, { isApproved: true });
    res.status(200).json({ message: "User Approved" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.rejectUser = async (req, res) => {
  try {
    const { userId } = req.body;
    
    const deletedUser = await User.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "User request rejected and account deleted." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Admin: Get Pending List
exports.getPendingUsers = async (req, res) => {
  try {
    // Fetch users where approved is false, BUT role is NOT 'student'
    // This ensures Admin only sees Drivers, Teachers, Staff
    const users = await User.find({ 
      isApproved: false, 
      role: { $ne: 'student' } 
    });
    
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.defaultAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check against .env variables
    const defaultEmail = process.env.ADMIN_EMAIL || "admin@campussoon.com";
    const defaultPass = process.env.ADMIN_PASSWORD || "admin123";

    if (email === defaultEmail && password === defaultPass) {
      // 2. Return success with a hardcoded ID (or a special flag)
      // We use a fake MongoDB ObjectId for consistency
      return res.status(200).json({
        message: "Super Admin Login Successful",
        userId: "000000000000000000000000", // 24-char hex string
        name: "Super Admin",
        role: "admin",
        isApproved: true
      });
    }

    // 3. If credentials don't match
    return res.status(401).json({ message: "Invalid Admin Credentials" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;

    // 1. Validate role
    const validRoles = ['student', 'teacher', 'driver', 'non-faculty', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid Role" });
    }

    // 2. Find users with specific role AND isApproved set to true
    const users = await User.find({ 
      role: role, 
      isApproved: true  // <--- Added this filter
    })
    .select('-password') // Don't send passwords
    .sort({ name: 1 });   // Sort alphabetically

    // 3. Process attendance status for users
    const today = getTodayIST();
    const processedUsers = users.map(user => {
      const userObj = user.toObject();
      
      // If attendance is NOT from today, show as absent in the UI response
      if (userObj.campusAttendance && userObj.campusAttendance.date !== today) {
        userObj.campusAttendance.status = 'absent';
      }
      
      // If no attendance record at all, ensure it shows absent
      if (!userObj.campusAttendance) {
        userObj.campusAttendance = { status: 'absent', date: today };
      }
      
      return userObj;
    });

    res.status(200).json({
      count: users.length,
      role: role,
      users: processedUsers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// View Profile (exclude password)
exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the user by ID and exclude the password field
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete User (Admin Only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the user by ID and completely remove from the database
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "User permanently deleted." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};