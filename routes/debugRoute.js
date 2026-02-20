const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

router.get('/debug-env', async (req, res) => {
    try {
        const userSet = !!process.env.EMAIL_USER;
        const passSet = !!process.env.EMAIL_PASS;

        let connectionStatus = 'Skipped';
        let errorDetails = null;

        if (userSet && passSet) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });
            try {
                await transporter.verify();
                connectionStatus = 'Success';
            } catch (err) {
                connectionStatus = 'Failed';
                errorDetails = err.message;
            }
        }

        res.json({
            status: 'Debug Info',
            environment: {
                EMAIL_USER_SET: userSet,
                EMAIL_PASS_SET: passSet,
                NODE_ENV: process.env.NODE_ENV
            },
            smtpConnection: connectionStatus,
            error: errorDetails
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
