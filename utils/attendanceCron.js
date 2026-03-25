const cron = require('node-cron');
const User = require('../models/User');
const AttendanceRecord = require('../models/AttendanceRecord');

// Helper to get today's date in IST (YYYY-MM-DD)
const getTodayIST = () => {
    return new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Asia/Kolkata', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).format(new Date());
};

const runManualAttendanceCheck = async () => {
    console.log('--- 🕒 Running Attendance Check (IST) ---');
    const today = getTodayIST();
    let markedCount = 0;
    
    // Find all approved users (Teachers, Drivers, Students, etc.)
    const users = await User.find({ isApproved: true });
    
    for (let student of users) {
        // Check if they already have a record for today
        const existing = await AttendanceRecord.findOne({ userId: student._id, date: today });
        
        if (!existing) {
            // Mark as ABSENT in logs
            await AttendanceRecord.create({
                userId: student._id,
                date: today,
                status: 'absent',
                location: { lat: 0, lng: 0 }
            });
            
            // Update User's last status cache
            await User.findByIdAndUpdate(student._id, {
                campusAttendance: { status: 'absent', date: today }
            });
            
            markedCount++;
        }
    }
    console.log(`--- ✅ Attendance Check Completed. Auto-marked ${markedCount} users as Absent. ---`);
    return markedCount;
};

const initAttendanceCron = () => {
    // Run at 23:55 (11:55 PM) every day IST
    cron.schedule('55 23 * * *', async () => {
        try {
            await runManualAttendanceCheck();
        } catch (err) {
            console.error('❌ Attendance Cron Error:', err.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('🚀 Attendance Cron Service Initialized (Scheduled for 23:55 Daily IST)');
};

module.exports = { initAttendanceCron, runManualAttendanceCheck };
