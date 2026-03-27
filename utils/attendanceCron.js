const cron = require('node-cron');
const User = require('../models/User');
const AttendanceRecord = require('../models/AttendanceRecord');

// Helper to get today's date in IST (YYYY-MM-DD)
const getTodayIST = (date = new Date()) => {
    return new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Asia/Kolkata', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).format(date);
};

/**
 * Core Logic: Mark all approved users as absent if they have no record for a specific date.
 */
const markAbsentsForDate = async (dateString) => {
    console.log(`--- 🕒 Checking Attendance for Date: ${dateString} ---`);
    let markedCount = 0;
    
    // Find all approved users (Teachers, Drivers, Students, etc.)
    const users = await User.find({ isApproved: true });
    
    for (let student of users) {
        // Check if they already have a record for this date
        const existing = await AttendanceRecord.findOne({ userId: student._id, date: dateString });
        
        if (!existing) {
            // Mark as ABSENT in logs
            await AttendanceRecord.create({
                userId: student._id,
                date: dateString,
                status: 'absent',
                location: { lat: 0, lng: 0 }
            });
            
            // Update User's last status cache (Only if it's the most recent state)
            // Note: We only update User.campusAttendance if the date is today or newer than stored
            const studentData = await User.findById(student._id);
            if (!studentData.campusAttendance || studentData.campusAttendance.date <= dateString) {
                await User.findByIdAndUpdate(student._id, {
                    campusAttendance: { status: 'absent', date: dateString }
                });
            }
            
            markedCount++;
        }
    }
    if (markedCount > 0) {
        console.log(`--- ✅ Processed ${dateString}: Auto-marked ${markedCount} users as Absent. ---`);
    } else {
        console.log(`--- ✅ Processed ${dateString}: No missing attendance records found. ---`);
    }
    return markedCount;
};

/**
 * Startup Catch-up:
 * Checks for missing records in the recent past (Yesterday and Today).
 * This handles Render's sleep periods.
 */
const runSystemCatchup = async () => {
    console.log('--- 🚀 Starting Attendance System Catch-up ---');
    try {
        const now = new Date();
        const today = getTodayIST(now);
        
        // 1. Always check Yesterday
        const yesterdayDate = new Date(now);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = getTodayIST(yesterdayDate);
        await markAbsentsForDate(yesterday);

        // 2. If it's very late (after 11:55 PM), also check Today
        const hours = now.getHours();
        const minutes = now.getMinutes();
        if (hours === 23 && minutes >= 55) {
            await markAbsentsForDate(today);
        }

    } catch (err) {
        console.error('❌ Catch-up Error:', err.message);
    }
    console.log('--- ✨ Attendance Catch-up Finished ---');
};

const initAttendanceCron = () => {
    // Run at 23:55 (11:55 PM) every day IST
    cron.schedule('55 23 * * *', async () => {
        try {
            await markAbsentsForDate(getTodayIST());
        } catch (err) {
            console.error('❌ Attendance Cron Error:', err.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('🚀 Attendance Cron Service Initialized (Scheduled for 23:55 Daily IST)');
};

module.exports = { 
    initAttendanceCron, 
    runManualAttendanceCheck: () => markAbsentsForDate(getTodayIST()), // For manual trigger API
    runSystemCatchup 
};
