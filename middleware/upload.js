const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. ربط حسابك
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. إعدادات التخزين
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'edulearn_instructors', // الفولدر اللي هيتعمل على كلاوديناري
        resource_type: 'auto', // عشان يقبل الـ PDF والـ Video مع بعض
    },
});

const upload = multer({ storage: storage });

module.exports = upload;