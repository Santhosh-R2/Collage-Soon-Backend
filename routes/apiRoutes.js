const express = require('express');
const router = express.Router();

const authCtrl = require('../controllers/authController');
const adminCtrl = require('../controllers/adminController');
const acadCtrl = require('../controllers/academicController');
const attendCtrl = require('../controllers/attendanceController');
const busCtrl = require('../controllers/busController');

router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/admin/login', authCtrl.defaultAdminLogin);
router.get('/admin/pending', authCtrl.getPendingUsers);
router.post('/admin/approve', authCtrl.approveUser);
router.post('/admin/reject', authCtrl.rejectUser);
router.delete('/admin/user/:id', authCtrl.deleteUser);
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/verify-otp', authCtrl.verifyOTP);
router.post('/reset-password', authCtrl.resetPassword);
router.post('/admin/set-location', adminCtrl.setInstituteLocation);
router.get('/admin/institute/active', adminCtrl.getActiveInstitute);
router.get('/admin/institute/:adminId', adminCtrl.getInstituteByAdmin);
router.post('/admin/broadcast', adminCtrl.sendBroadcast);
router.get('/admin/broadcasts', adminCtrl.getAllBroadcasts);
router.get('/profile/:id', authCtrl.getProfile);
router.get('/teachers', acadCtrl.getTeachers);
router.post('/student/select-teacher', acadCtrl.selectTeacher);
router.post('/teacher/handle-request', acadCtrl.handleStudentRequest);
router.post('/teacher/broadcast', acadCtrl.classBroadcast);
router.get('/teacher/my-students', acadCtrl.getMyClassList);
router.post('/academic/exam-schedule', acadCtrl.createExamSchedule); 
router.get('/academic/exam-schedule', acadCtrl.getExamSchedule);     
router.post('/academic/add-marks', acadCtrl.addStudentMarks); 
router.get('/academic/my-marks', acadCtrl.getMyMarks);       

router.post('/academic/assignment', acadCtrl.createAssignment);
router.get('/academic/assignment', acadCtrl.getAssignments);   
router.post('/attendance/mark', attendCtrl.markAttendance);
router.get('/attendance/history', attendCtrl.getAttendanceHistory);
router.get('/attendance/live-class', attendCtrl.getLiveClassAttendance);
router.get('/attendance/today/:role', attendCtrl.getTodayAttendanceByRole);
router.get('/attendance/trigger-cron', attendCtrl.triggerAttendanceCron);
router.post('/bus/start-trip', busCtrl.startTrip);
router.post('/bus/end-trip', busCtrl.endTrip);
router.get('/bus/live-location', busCtrl.getLiveLocation);
router.post('/bus/update-location', busCtrl.updateLocation);
router.post('/bus/init', busCtrl.initBus);
router.get('/bus/details', busCtrl.getBusByDriver);                 
router.get('/bus/all-users', busCtrl.getAllUsers);         
router.post('/bus/add-passenger', busCtrl.addPassenger);   
router.post('/bus/remove-passenger', busCtrl.removePassenger); 
router.get('/bus/my-passengers', busCtrl.getMyPassengers); 
router.post('/bus/sos', busCtrl.triggerSOS);
router.get('/admin/sos-history', busCtrl.getSOSHistory); 
router.post('/bus/status', busCtrl.setDailyStatus); 
router.get('/bus/route', busCtrl.getRoute);         
router.post('/bus/toggle-trip', busCtrl.toggleTrip); 
router.get('/bus/coming-users', busCtrl.getComingUsers);
router.get('/bus/prediction/:userId', busCtrl.getUserPrediction);
router.post('/teacher/requests', acadCtrl.getStudentRequests);
router.post('/teacher/handle-request', acadCtrl.handleStudentRequest);


router.get('/view/students', (req, res) => {
    req.params.role = 'student';
    authCtrl.getUsersByRole(req, res);
});

router.get('/view/teachers', (req, res) => {
    req.params.role = 'teacher';
    authCtrl.getUsersByRole(req, res);
});

router.get('/view/drivers', (req, res) => {
    req.params.role = 'driver';
    authCtrl.getUsersByRole(req, res);
});

router.get('/view/non-faculty', (req, res) => {
    req.params.role = 'non-faculty';
    authCtrl.getUsersByRole(req, res);
});

router.delete('/admin/broadcast/:id/:type', adminCtrl.deleteBroadcastLog);
router.get('/admin/broadcast/:id/:type', adminCtrl.getBroadcastDetail);



module.exports = router;