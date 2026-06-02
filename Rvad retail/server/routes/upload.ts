import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/requireAuth';
import { v2 as cloudinary } from 'cloudinary';

const router = Router();

// Configure Cloudinary if variables are provided
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post('/', requireAuth(), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не передан.' });
  }

  // If Cloudinary is not configured, fall back to local storage URL
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({ url: fileUrl });
  }

  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'rvad_products',
    });

    // Clean up temporary local file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Failed to delete temporary local upload file:', err);
    });

    return res.json({ url: result.secure_url });
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    // Attempt cleanup of local file
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: 'Ошибка загрузки файла в Cloudinary: ' + error.message });
  }
});

export default router;
