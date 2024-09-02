const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const cors = require('cors');
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

// Email Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Handle image upload and email sending
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    const { b_id, secret_code, location, timestamp } = req.body;

    if (secret_code !== process.env.SECRET_CODE) {
      return res.status(401).json({ message: 'Invalid secret code' });
    }

    const imageBuffer = req.file.buffer;
    const locationObj = JSON.parse(location);
    const zipFileName = `${b_id}_${locationObj.latitude}_${locationObj.longitude}_${timestamp}.zip`;

    // Create a zip archive
    const output = fs.createWriteStream(path.join(__dirname, zipFileName));
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Zip file ${zipFileName} created with ${archive.pointer()} total bytes`);

      // Send email with zip file as attachment
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO,
        subject: 'Image Upload with Location and Timestamp',
        text: `Attached is the image captured with B ID: ${b_id}, location: ${locationObj.latitude}, ${locationObj.longitude}, and timestamp: ${timestamp}`,
        attachments: [
          {
            filename: zipFileName,
            path: path.join(__dirname, zipFileName),
          },
        ],
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
          return res.status(500).json({ message: 'Error sending email' });
        }

        console.log('Email sent:', info.response);
        res.json({ message: 'Image uploaded and email sent successfully!' });

        // Clean up the zip file after sending the email
        fs.unlinkSync(path.join(__dirname, zipFileName));
      });
    });

    archive.on('error', (err) => {
      throw err;
    });

    // Append the image to the zip file
    archive.append(imageBuffer, { name: req.file.originalname });
    archive.pipe(output);
    archive.finalize();

  } catch (error) {
    console.error('Error handling upload:', error);
    res.status(500).json({ message: 'Error handling upload' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
