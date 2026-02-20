const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// GET /api/debug-env
// Checks environment variables and connections
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

        // 1. Create Transporter with explicit settings
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            logger: true, // Log to console
            debug: true   // Include debug info
        });

        // 2. Verify Connection
        await transporter.verify();
        debugInfo.smtpTest.connectionVerified = true;

        // 3. Try sending a self-email
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to self
            subject: 'Vercel Debug Test',
            text: 'If you received this, Vercel email sending is WORKING.'
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
