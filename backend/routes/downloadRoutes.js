const express = require('express');
const fs = require('fs');
const router = express.Router();

router.get('/citycare.apk', (req, res) => {
  const apkPath = process.env.CITYCARE_ANDROID_APK_PATH;
  if (!apkPath) {
    return res.status(503).json({
      success: false,
      message: 'The CityCare Android app download is not configured.'
    });
  }

  if (!fs.existsSync(apkPath)) {
    return res.status(503).json({
      success: false,
      message: 'The CityCare Android app download is temporarily unavailable.'
    });
  }

  return res.download(apkPath, 'CityCare-CDO.apk', error => {
    if (error) {
      console.error('CityCare APK download failed:', error.message);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'The CityCare Android app could not be downloaded.'
        });
      }
    }
  });
});

module.exports = router;
