const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const postStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'orbit_posts',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1080, crop: 'limit', quality: 'auto' }],
    };
  },
});

const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'orbit_avatars',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
    };
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only JPEG, PNG and WebP images are allowed.'), false);
};

const eventStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (_req, _file) => ({
    folder: 'orbit_events',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1080, crop: 'limit', quality: 'auto' }],
  }),
});

const uploadPost   = multer({ storage: postStorage,   limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter });
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize:  5 * 1024 * 1024, files: 1 }, fileFilter });
const uploadEvent  = multer({ storage: eventStorage,  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, fileFilter });

module.exports = { uploadPost, uploadAvatar, uploadEvent };
