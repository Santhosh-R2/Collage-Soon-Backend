const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, 
    },
    pool: false, 
    maxConnections: 1,
    secure: true,
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    },
    connectionTimeout: 10000, 
    greetingTimeout: 15000,    
    socketTimeout: 15000,     
  });
};

const getHtmlTemplate = (title, bodyContent, isUrgent = false) => {
  const headerColor = isUrgent ? '#d9534f' : '#6366f1';
  return `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <div style="background-color: ${headerColor}; padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 26px; letter-spacing: 1px;">Campus Zone</h1>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">${title}</p>
      </div>
      <div style="padding: 30px; background-color: #ffffff; color: #333333; line-height: 1.6; font-size: 15px;">
        ${bodyContent}
      </div>
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee;">
        <p style="margin-bottom: 5px;"><strong>Campus Zone Digital Ecosystem</strong></p>
        <p style="margin-top: 0;">This is an automated notification. Please do not reply.</p>
      </div>
    </div>
  `;
};

const sendEmail = async (toEmails, subject, htmlContent) => {
  if (!toEmails || (Array.isArray(toEmails) && toEmails.length === 0)) {
    console.warn("⚠️ Email skipped: No recipients provided.");
    return;
  }

  const transporter = createTransporter();

  const isMultiple = Array.isArray(toEmails) && toEmails.length > 1;
  const mailOptions = {
    from: `"Campus Zone" <${process.env.EMAIL_USER}>`,
    subject: subject,
    html: htmlContent,
  };

  if (isMultiple) {
    mailOptions.to = process.env.EMAIL_USER; 
    mailOptions.bcc = toEmails; 
  } else {
    mailOptions.to = Array.isArray(toEmails) ? toEmails[0] : toEmails;
  }

  try {
    await transporter.verify();

    const info = await transporter.sendMail(mailOptions);

    console.log(`📧 Email sent: ${info.messageId} to ${isMultiple ? toEmails.length + ' (BCC)' : mailOptions.to}`);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    // Log the full error but don't fail the entire process
    return null;
  }
};

module.exports = {
  sendBroadcastEmail: async (emails, title, message) => {
    const html = getHtmlTemplate(title, `<p style="font-size: 16px;">${message}</p>`);
    return await sendEmail(emails, `📢 Notice: ${title}`, html);
  },
  sendAssignmentEmail: async (emails, teacherName, topic, date) => {
    const html = getHtmlTemplate('New Assignment Uploaded', `
      <h3 style="color: #6366f1; margin-top: 0;">${topic}</h3>
      <p><strong>Teacher:</strong> ${teacherName}</p>
      <p><strong>Submission Deadline:</strong> ${date}</p>
      <p>Please check your student dashboard for full details and instructions.</p>
    `);
    return await sendEmail(emails, `📝 Assignment: ${topic}`, html);
  },
  sendTimetableEmail: async (emails, teacherName, semester) => {
    const html = getHtmlTemplate('Exam Timetable Published', `
      <p><strong>Academic Advisor:</strong> ${teacherName}</p>
      <p>The examination schedule for <strong>${semester}</strong> has been officially released.</p>
      <p>Please login to the <strong>Campus Zone</strong> app to view specific dates, hall timings, and subjects.</p>
    `);
    return await sendEmail(emails, `📅 Exam Schedule: ${semester}`, html);
  },
  sendSOSEmail: async (emails, driverName, reason, googleMapLink) => {
    const html = getHtmlTemplate('🚨 SOS EMERGENCY ALERT', `
      <div style="border: 2px solid #d9534f; padding: 20px; border-radius: 10px;">
        <h2 style="color: #d9534f; margin-top: 0;">Emergency Reported</h2>
        <p><strong>Bus Driver:</strong> ${driverName}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>An SOS alert has been triggered for your bus route. Please stay calm and follow emergency protocols.</p>
        <div style="text-align: center; margin-top: 25px;">
           <a href="${googleMapLink}" style="background-color: #d9534f; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Live Bus Location</a>
        </div>
      </div>
    `, true);
    return await sendEmail(emails, `🚨 URGENT: Emergency SOS on Bus`, html);
  },
  sendOTPEmail: async (email, otp) => {
    const html = getHtmlTemplate('Password Reset OTP', `
      <div style="text-align: center; padding: 20px;">
        <p>You have requested to reset your password. Please use the following 6-digit OTP to proceed:</p>
        <div style="font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 5px; margin: 20px 0; padding: 15px; background: #f0f4ff; border-radius: 8px; display: inline-block;">
          ${otp}
        </div>
        <p style="color: #666; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
      </div>
    `);
    return await sendEmail(email, '🔑 Password Reset OTP', html);
  },
  sendGenericEmail: sendEmail
};