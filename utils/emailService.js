const nodemailer = require('nodemailer');

// 1. Create a Pooled Transporter
// Pooling is CRITICAL for Render to prevent connection drops during broadcasts
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465, // Port 465 is the ONLY reliable port for Render/Cloud
  secure: true, // true for 465
  pool: true,   // Reuse the connection instead of creating new ones
  maxConnections: 5,
  maxMessages: 100,
  auth: {
    user: process.env.EMAIL_USER,
    // This regex removes spaces automatically in case they exist in Render Dashboard
    pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : ""
  },
  // HIGH TIMEOUTS FOR CLOUD LATENCY
  connectionTimeout: 60000, // 60 seconds
  greetingTimeout: 30000,   // 30 seconds
  socketTimeout: 60000,     // 60 seconds
  debug: false,             // Set to true if you need to see logs in Render console
  logger: false
});

// 2. HTML Template
const getHtmlTemplate = (title, bodyContent, isUrgent = false) => {
  const headerColor = isUrgent ? '#d9534f' : '#6366f1'; 
  return `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <div style="background-color: ${headerColor}; padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 26px; letter-spacing: 1px;">Campus Soon</h1>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">${title}</p>
      </div>
      <div style="padding: 30px; background-color: #ffffff; color: #333333; line-height: 1.6; font-size: 15px;">
        ${bodyContent}
      </div>
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee;">
        <p>Campus Soon Digital Ecosystem • Automated Notification</p>
        <p>Please do not reply to this email.</p>
      </div>
    </div>
  `;
};

// 3. Optimized Send Function
const sendEmail = async (toEmails, subject, htmlContent) => {
  if (!toEmails || (Array.isArray(toEmails) && toEmails.length === 0)) return;

  const mailOptions = {
    from: `"Campus Soon Admin" <${process.env.EMAIL_USER}>`,
    to: Array.isArray(toEmails) ? toEmails.join(', ') : toEmails,
    subject: subject,
    html: htmlContent
  };

  try {
    // Verify connection before sending (Optional but helpful for debugging Render)
    await transporter.sendMail(mailOptions);
    console.log(`📧 SUCCESS: Email sent to ${Array.isArray(toEmails) ? toEmails.length : 1} users.`);
  } catch (error) {
    console.error("❌ CLOUD EMAIL ERROR:", error.message);
    // Don't throw error so the rest of the API logic (Socket/DB) continues
  }
};

module.exports = {
  sendBroadcastEmail: async (emails, title, message) => {
    const html = getHtmlTemplate(title, `<p style="font-size: 16px;">${message}</p>`);
    await sendEmail(emails, `📢 Campus Notice: ${title}`, html);
  },

  sendAssignmentEmail: async (emails, teacherName, topic, date) => {
    const html = getHtmlTemplate('New Assignment Uploaded', `
      <h3 style="color: #6366f1;">${topic}</h3>
      <p><strong>Teacher:</strong> ${teacherName}</p>
      <p><strong>Submission Deadline:</strong> ${date}</p>
      <p>Check your student dashboard for details.</p>
    `);
    await sendEmail(emails, `📝 Assignment: ${topic}`, html);
  },

  sendTimetableEmail: async (emails, teacherName, semester) => {
    const html = getHtmlTemplate('Exam Timetable Published', `
      <p>The exam schedule for <strong>${semester}</strong> has been released by ${teacherName}.</p>
    `);
    await sendEmail(emails, `📅 Exam Schedule: ${semester}`, html);
  },

  sendSOSEmail: async (emails, driverName, reason, googleMapLink) => {
    const html = getHtmlTemplate('🚨 SOS EMERGENCY ALERT', `
      <h2 style="color: #d9534f;">Emergency Reported</h2>
      <p><strong>Driver:</strong> ${driverName}</p>
      <p><strong>Status:</strong> ${reason}</p>
      <div style="text-align: center; margin-top: 20px;">
        <a href="${googleMapLink}" style="background-color: #d9534f; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Live Location</a>
      </div>
    `, true);
    await sendEmail(emails, `🚨 SOS: Emergency on Bus`, html);
  }
};