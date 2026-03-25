const User = require('../models/User');
const Broadcast = require('../models/Broadcast');
const ExamSchedule = require('../models/ExamSchedule');
const StudentResult = require('../models/StudentResult');
const Assignment = require('../models/Assignment');
const emailService = require('../utils/emailService');

// Helper to get today's date in IST (YYYY-MM-DD)
const getTodayIST = () => {
    return new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Asia/Kolkata', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).format(new Date());
};

const getStudentEmails = async (teacherId) => {
  const students = await User.find({ classTeacherId: teacherId, isApproved: true }, 'email');
  return students.map(s => s.email).filter(e => e);
};
// Get All Teachers
exports.getTeachers = async (req, res) => {
  try {
    const today = getTodayIST();
    const teachers = await User.find({ role: 'teacher', isApproved: true })
      .populate({
        path: 'assignedStudents',
        select: '-password'
      });

    // Process attendance status for students
    const processedTeachers = teachers.map(teacher => {
      const teacherObj = teacher.toObject();
      if (teacherObj.assignedStudents) {
        teacherObj.assignedStudents = teacherObj.assignedStudents.map(student => {
          // If attendance is NOT from today, show as absent
          if (student.campusAttendance && student.campusAttendance.date !== today) {
            student.campusAttendance.status = 'absent';
          }
          // If no attendance record at all, ensure it shows absent
          if (!student.campusAttendance) {
            student.campusAttendance = { status: 'absent', date: today };
          }
          return student;
        });
      }
      return teacherObj;
    });

    res.status(200).json(processedTeachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student Selects Teacher
exports.selectTeacher = async (req, res) => {
  const { studentId, teacherId } = req.body;
  await User.findByIdAndUpdate(studentId, {
    classTeacherId: teacherId,
    teacherRequestStatus: 'pending'
  });
  res.status(200).json({ message: "Request Sent to Teacher" });
};

// Teacher Handles Request
exports.handleStudentRequest = async (req, res) => {
  try {
    const { studentId, status } = req.body; // status = 'accepted' or 'rejected'

    // 1. Find the student first
    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const teacherId = student.classTeacherId;

    if (status === 'accepted') {
      // ===========================
      // CASE A: ACCEPTED
      // ===========================

      // 1. Update Student: Approve them
      await User.findByIdAndUpdate(studentId, {
        teacherRequestStatus: 'accepted',
        isApproved: true
      });

      // 2. Update Teacher: Add Student ID to array
      await User.findByIdAndUpdate(teacherId, {
        $addToSet: { assignedStudents: studentId }
      });

    } else {
      // ===========================
      // CASE B: REJECTED
      // ===========================

      // Update Student: Mark rejected AND remove the classTeacherId
      await User.findByIdAndUpdate(studentId, {
        teacherRequestStatus: 'rejected',

        // $unset removes the field entirely from the database
        $unset: { classTeacherId: "" }
      });
    }

    res.status(200).json({ message: `Student request ${status} and database updated.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Teacher Broadcast to Class
exports.classBroadcast = async (req, res) => {
  const { teacherId, title, message } = req.body;

  // Send Socket
  const io = req.app.get('socketio');
  io.to(`class-${teacherId}`).emit('broadcast-alert', { title, message, from: "Teacher" });

  // Send Email
  const emails = await getStudentEmails(teacherId);
  await emailService.sendBroadcastEmail(emails, title || "Class Notice", message);

  res.status(200).json({ message: "Sent to Class via Email & App" });
};
exports.getStudentRequests = async (req, res) => {
  try {
    const { teacherId } = req.body; // or req.query

    // Find students who:
    // 1. Are NOT approved yet
    // 2. Are role 'student'
    // 3. Have selected THIS teacher
    const students = await User.find({
      role: 'student',
      isApproved: false,
      classTeacherId: teacherId
    });

    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getMyClassList = async (req, res) => {
  try {
    const today = getTodayIST();
    const teacherId = req.query.teacherId || req.body.teacherId;

    if (!teacherId) {
      return res.status(400).json({ message: "Teacher ID is required" });
    }

    const teacher = await User.findById(teacherId).populate('assignedStudents', 'name email homeLocation campusAttendance');

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Process attendance status for students
    const processedStudents = teacher.assignedStudents.map(student => {
      const studentObj = student.toObject();
      if (studentObj.campusAttendance && studentObj.campusAttendance.date !== today) {
        studentObj.campusAttendance.status = 'absent';
      }
      if (!studentObj.campusAttendance) {
        studentObj.campusAttendance = { status: 'absent', date: today };
      }
      return studentObj;
    });

    res.status(200).json(processedStudents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createExamSchedule = async (req, res) => {
  try {
    const { teacherId, semester, exams } = req.body;

    await ExamSchedule.findOneAndUpdate(
      { teacherId, semester }, { exams }, { upsert: true }
    );

    // Get Teacher Name for Email
    const teacher = await User.findById(teacherId);

    // Send Email
    const emails = await getStudentEmails(teacherId);
    await emailService.sendTimetableEmail(emails, teacher.name, semester);

    res.status(200).json({ message: "Exam Schedule Published & Emailed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Student/Teacher: View Schedule
exports.getExamSchedule = async (req, res) => {
  try {
    // Accept either teacherId OR studentId
    const { teacherId, studentId, semester } = req.query;

    let targetTeacherId = teacherId;

    // IF studentId is sent, find their Class Teacher automatically
    if (studentId) {
      const student = await User.findById(studentId);
      if (!student || !student.classTeacherId) {
        return res.status(404).json({ message: "Student has not selected a Class Teacher yet." });
      }
      targetTeacherId = student.classTeacherId;
    }

    if (!targetTeacherId) {
      return res.status(400).json({ message: "Teacher ID or Student ID required" });
    }

    // Now find the schedule belonging to that Teacher
    const schedule = await ExamSchedule.findOne({
      teacherId: targetTeacherId,
      semester: semester
    });

    if (!schedule) return res.status(404).json({ message: "No schedule found for this semester" });

    res.status(200).json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 2. MARKS / RESULTS LOGIC
// ==========================================

// Teacher: Add Marks for a Student
exports.addStudentMarks = async (req, res) => {
  try {
    const { teacherId, studentId, semester, subject, marks, total, examType } = req.body;

    const result = await StudentResult.create({
      teacherId,
      studentId,
      semester,
      subject,
      marksObtained: marks,
      totalMarks: total || 100,
      examType: examType || 'Final'
    });

    res.status(200).json({ message: "Marks Added Successfully", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student: View My Marks
exports.getMyMarks = async (req, res) => {
  try {
    const studentId = req.query.studentId || req.body.studentId;
    if (!studentId) return res.status(400).json({ message: "Student ID required" });

    const results = await StudentResult.find({ studentId });
    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 3. ASSIGNMENT LOGIC
// ==========================================

// Teacher: Create Assignment
exports.createAssignment = async (req, res) => {
  try {
    const { teacherId, topic, description, semester, submissionDate } = req.body;

    await Assignment.create({ teacherId, topic, description, semester, submissionDate });

    // Get Teacher Name
    const teacher = await User.findById(teacherId);

    // Send Email
    const emails = await getStudentEmails(teacherId);
    await emailService.sendAssignmentEmail(emails, teacher.name, topic, submissionDate);

    res.status(200).json({ message: "Assignment Created & Emailed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student: View Assignments (from their Class Teacher)
exports.getAssignments = async (req, res) => {
  try {
    const { teacherId } = req.query; // Student sends their teacher's ID
    const assignments = await Assignment.find({ teacherId }).sort({ createdAt: -1 });
    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};