const express = require('express');
const router = express.Router();

const authCtrl = require('../controllers/authController');
const adminCtrl = require('../controllers/adminController');
const acadCtrl = require('../controllers/academicController');
const attendCtrl = require('../controllers/attendanceController');
const busCtrl = require('../controllers/busController');

// --- AUTH & ADMIN ---
router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/admin/login', authCtrl.defaultAdminLogin);
router.get('/admin/pending', authCtrl.getPendingUsers);
router.post('/admin/approve', authCtrl.approveUser);
router.post('/admin/reject', authCtrl.rejectUser);
router.post('/admin/set-location', adminCtrl.setInstituteLocation);
router.get('/admin/institute/:adminId', adminCtrl.getInstituteByAdmin);
router.post('/admin/broadcast', adminCtrl.sendBroadcast);

// --- ACADEMIC ---
router.get('/teachers', acadCtrl.getTeachers);
router.post('/student/select-teacher', acadCtrl.selectTeacher);
router.post('/teacher/handle-request', acadCtrl.handleStudentRequest);
router.post('/teacher/broadcast', acadCtrl.classBroadcast);
router.get('/teacher/my-students', acadCtrl.getMyClassList);
router.post('/academic/exam-schedule', acadCtrl.createExamSchedule); // Teacher creates
router.get('/academic/exam-schedule', acadCtrl.getExamSchedule);     // Student views

// --- ACADEMIC: MARKS ---
router.post('/academic/add-marks', acadCtrl.addStudentMarks); // Teacher adds
router.get('/academic/my-marks', acadCtrl.getMyMarks);        // Student views

// --- ACADEMIC: ASSIGNMENTS ---
router.post('/academic/assignment', acadCtrl.createAssignment); // Teacher creates
router.get('/academic/assignment', acadCtrl.getAssignments);    // Student views
// --- CAMPUS ATTENDANCE ---
router.post('/attendance/mark', attendCtrl.markAttendance);
router.get('/attendance/history', attendCtrl.getAttendanceHistory)
router.get('/attendance/live-class', attendCtrl.getLiveClassAttendance);
// --- BUS MANAGEMENT (Updated) ---
router.post('/bus/start-trip', busCtrl.startTrip);
router.post('/bus/end-trip', busCtrl.endTrip);
router.get('/bus/live-location', busCtrl.getLiveLocation);
// 1. Setup & List Management
router.post('/bus/init', busCtrl.initBus);                 // Create Bus Profile
router.get('/bus/all-users', busCtrl.getAllUsers);         // Search users to add
router.post('/bus/add-passenger', busCtrl.addPassenger);   // Add user to list
router.post('/bus/remove-passenger', busCtrl.removePassenger); // Remove user
router.get('/bus/my-passengers', busCtrl.getMyPassengers); // View current list
router.post('/bus/sos', busCtrl.triggerSOS);
router.get('/admin/sos-history', busCtrl.getSOSHistory); // Optional for Admin View
// 2. Daily Operations
router.post('/bus/status', busCtrl.setDailyStatus); // User: "I am coming"
router.get('/bus/route', busCtrl.getRoute);         // Driver: Get Map Points (Filtered)
router.post('/bus/toggle-trip', busCtrl.toggleTrip); // Driver: Start/End
router.get('/bus/coming-users', busCtrl.getComingUsers);
router.get('/bus/prediction/:userId', busCtrl.getUserPrediction);
// --- TEACHER ROUTES ---
router.post('/teacher/requests', acadCtrl.getStudentRequests);
router.post('/teacher/handle-request', acadCtrl.handleStudentRequest);


router.get('/view/students', (req, res) => {
    req.params.role = 'student'; 
    authCtrl.getUsersByRole(req, res);
});

// 2. View All Teachers
router.get('/view/teachers', (req, res) => {
    req.params.role = 'teacher';
    authCtrl.getUsersByRole(req, res);
});

// 3. View All Drivers
router.get('/view/drivers', (req, res) => {
    req.params.role = 'driver';
    authCtrl.getUsersByRole(req, res);
});

// 4. View All Non-Faculty (Staff)
router.get('/view/non-faculty', (req, res) => {
    req.params.role = 'non-faculty';
    authCtrl.getUsersByRole(req, res);
});

module.exports = router;