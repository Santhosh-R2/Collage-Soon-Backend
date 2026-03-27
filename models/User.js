const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  password: { type: String },
  role: { type: String, enum: ['student', 'teacher', 'driver', 'admin', 'non-faculty'] },
  isApproved: { type: Boolean, default: false },

  // Location
  homeLocation: { lat: Number, lng: Number },

  // Teacher Link
  classTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Teacher Logic (My Students)
  assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Campus Geo-Attendance (Still kept here for current status, or move to history model as shown before)
  campusAttendance: {
    date: String,
    status: { type: String, enum: ['present', 'absent'], default: 'absent' }
  },

  // ❌ REMOVED busStatus from here
  busDriverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  // Fallback for existing plaintext passwords
  if (!this.password.startsWith('$2a$') && !this.password.startsWith('$2b$')) {
    return candidatePassword === this.password;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);