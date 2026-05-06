const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  secure: true
});

console.log("☁️ Cloudinary Configured for:", process.env.CLOUDINARY_CLOUD_NAME);

// استخدام Memory Storage لمعالجة الملف يدوياً لاحقاً
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // تقليل الحد لـ 100MB للتجربة
});

module.exports = { cloudinary, upload };
