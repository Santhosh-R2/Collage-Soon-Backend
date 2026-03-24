const cron = require('node-cron');
const User = require('../models/User');
const AttendanceRecord = require('../models/AttendanceRecord');

const initAttendanceCron = () => {
    // Run at 23:55 (11:55 PM) every day
    cron.schedule('55 23 * * *', async () => {
        console.log('--- 🕒 Running Daily Attendance Check (11:55 PM) ---');
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Find all approved users (Teachers, Drivers, Students, etc.)
            const users = await User.find({ isApproved: true });
            
            let markedCount = 0;
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
            console.log(`--- ✅ Attendance Check Completed. Auto-marked ${markedCount} students as Absent. ---`);
        } catch (err) {
            console.error('❌ Attendance Cron Error:', err.message);
        }
    });

    console.log('🚀 Attendance Cron Service Initialized (Scheduled for 23:55 Daily)');
};

module.exports = initAttendanceCron;
