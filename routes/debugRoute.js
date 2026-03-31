const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

router.get('/debug-env', async (req, res) => {
    const debugInfo = {
        environment: {
            EMAIL_USER_CONFIGURED: !!process.env.EMAIL_USER,
            EMAIL_PASS_CONFIGURED: !!process.env.EMAIL_PASS,
            NODE_ENV: process.env.NODE_ENV,
        },
        smtpTest: {
            attempted: false,
            success: false,
            error: null,
            logs: []
        }
    };

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        debugInfo.environment.error = "Missing EMAIL_USER or EMAIL_PASS environment variables.";
        return res.status(500).json(debugInfo);
    }

    try {
        debugInfo.smtpTest.attempted = true;

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            logger: true, 
            debug: true   // Include debug info
        });

        await transporter.verify();
        debugInfo.smtpTest.connectionVerified = true;

        // 3. Try sending a self-email OR to a specific request
        const targetEmail = req.query.to || process.env.EMAIL_USER;

        const info = await transporter.sendMail({
            from: `"Campus Zone Debug" <${process.env.EMAIL_USER}>`,
            to: targetEmail,
            subject: 'Vercel Debug Test (New)',
            text: `If you received this, Vercel email sending is WORKING. Target: ${targetEmail}`,
            html: `<h3>Vercel Email Test</h3><p>Success! The system can send emails.</p><p>Target: ${targetEmail}</p>`
        });

        debugInfo.smtpTest.success = true;
        debugInfo.smtpTest.messageId = info.messageId;
        debugInfo.smtpTest.response = info.response;

        res.json(debugInfo);

    } catch (error) {
        console.error("Debug Route Error:", error);
        debugInfo.smtpTest.error = {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode
        };
        res.status(500).json(debugInfo);
    }
});

module.exports = router;
