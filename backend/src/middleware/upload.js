const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

const postStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'orbit_posts',
      allowed_formats: allowedFormats,
      format: 'jpg',
      transformation: [{ width: 1080, crop: 'limit', quality: 'auto' }],
    };
  },
});

const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'orbit_avatars',
      allowed_formats: allowedFormats,
      format: 'jpg',
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
    };
  },
});

const fileFilter = (req, file, cb) => {
  const mimetype = String(file.mimetype || '').toLowerCase();
  const extension = path.extname(file.originalname || '').toLowerCase();
  const isAllowedMime = allowedMimeTypes.has(mimetype);
  const isOctetStreamImage = mimetype === 'application/octet-stream' && allowedExtensions.has(extension);
  isAllowedMime || isOctetStreamImage
    ? cb(null, true)
    : cb(new Error('Only JPEG, PNG, WebP or iPhone HEIC photos are allowed.'), false);
};

const eventStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (_req, _file) => ({
    folder: 'orbit_events',
    allowed_formats: allowedFormats,
    format: 'jpg',
    transformation: [{ width: 1080, crop: 'limit', quality: 'auto' }],
  }),
});

const uploadPost   = multer({ storage: postStorage,   limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter });
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize:  5 * 1024 * 1024, files: 1 }, fileFilter });
const uploadEvent  = multer({ storage: eventStorage,  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, fileFilter });

module.exports = { uploadPost, uploadAvatar, uploadEvent };
