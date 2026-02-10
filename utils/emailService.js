const { Resend } = require('resend');

// Initialize Resend with your API Key from Render/Env
const resend = new Resend(process.env.RESEND_API_KEY);

const getHtmlTemplate = (title, bodyContent, isUrgent = false) => {
  const headerColor = isUrgent ? '#d9534f' : '#6366f1'; 
  return `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
      <div style="background-color: ${headerColor}; padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 26px;">Campus Soon</h1>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">${title}</p>
      </div>
      <div style="padding: 30px; color: #333; line-height: 1.6; font-size: 15px;">
        ${bodyContent}
      </div>
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee;">
        <p>Campus Soon Digital Ecosystem • Automated Notification</p>
      </div>
    </div>
  `;
};


const sendEmail = async (toEmails, subject, htmlContent) => {
  try {
    // 1. Ensure we have an array
    let recipients = Array.isArray(toEmails) ? toEmails : [toEmails];

    // 2. CRITICAL: Clean the data
    // Remove nulls, undefined, empty strings, and ensure they are strings with '@'
    recipients = recipients.filter(email => 
      email && 
      typeof email === 'string' && 
      email.trim() !== '' && 
      email.includes('@')
    );

    // 3. If after cleaning no emails are left, stop
    if (recipients.length === 0) {
      console.log("⚠️ No valid email addresses found to send to.");
      return;
    }

    // 4. Send using Resend
    const { data, error } = await resend.emails.send({
      from: 'Campus Soon <onboarding@resend.dev>',
      to: recipients,
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      // Log the specific error from Resend
      console.error("❌ RESEND API ERROR:", error);
      return;
    }

    console.log(`📧 API SUCCESS: Email sent to ${recipients.length} users. ID: ${data.id}`);
  } catch (err) {
    console.error("❌ GLOBAL EMAIL ERROR:", err.message);
  }
};


module.exports = {
  sendBroadcastEmail: async (emails, title, message) => {
    const html = getHtmlTemplate(title, `<p>${message}</p>`);
    await sendEmail(emails, `📢 Campus Notice: ${title}`, html);
  },

  sendAssignmentEmail: async (emails, teacherName, topic, date) => {
    const html = getHtmlTemplate('New Assignment Uploaded', `
      <h3>${topic}</h3>
      <p><strong>Teacher:</strong> ${teacherName}</p>
      <p><strong>Deadline:</strong> ${date}</p>
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