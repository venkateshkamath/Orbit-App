const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const cloudinary = require('cloudinary').v2;

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('CRITICAL ERROR: Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing. Uploads will fail.');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing Cloudinary env vars in production environment. Boot aborted.');
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const mediaRoot = path.join(env.ROOT_DIR, 'media');
const avatarDir = path.join(mediaRoot, 'avatars');
const postDir = path.join(mediaRoot, 'posts');

fs.mkdirSync(avatarDir, { recursive: true });
fs.mkdirSync(postDir, { recursive: true });

function fullMediaUrl(req, relativePath) {
  if (!relativePath) {
    return null;
  }
  if (/^https?:\/\//.test(relativePath)) {
    return relativePath;
  }
  return `${req.protocol}://${req.get('host')}/media/${relativePath}`;
}

function deleteFile(relativePath) {
  if (!relativePath) {
    return;
  }
  const absolutePath = path.join(mediaRoot, relativePath);
  if (absolutePath.startsWith(mediaRoot) && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

/**
 * Upload a local file to Cloudinary, then delete the temp file.
 * @param {string} localFilePath - Path from multer temp upload
 * @param {string} folder - Cloudinary folder (e.g., 'posts', 'avatars')
 * @returns {{ url: string, publicId: string }}
 */
async function uploadToCloudinary(localFilePath, folder = 'posts') {
  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder,
      resource_type: 'auto',
    });
    return { url: result.secure_url, publicId: result.public_id };
  } finally {
    // Always clean up temp file, even if upload throws
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  }
}

/**
 * Delete a file from Cloudinary by its public_id.
 */
async function deleteFromCloudinary(publicId) {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
}

module.exports = {
  mediaRoot,
  avatarDir,
  postDir,
  fullMediaUrl,
  deleteFile,
  uploadToCloudinary,
  deleteFromCloudinary,
};
