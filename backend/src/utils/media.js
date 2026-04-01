const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const cloudinary = require('cloudinary').v2;

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
  
  // Check if it's a remote URL from Cloudinary
  if (/^https?:\/\//.test(relativePath)) {
    const match = relativePath.match(/(orbit_posts|orbit_avatars)\/[^.]+/);
    if (match) {
      const publicId = match[0];
      cloudinary.uploader.destroy(publicId).catch(err => {
        console.error('[Cloudinary] Failed to delete file:', publicId, err.message);
      });
    }
    return;
  }

  // Local fallback
  const absolutePath = path.join(mediaRoot, relativePath);
  if (absolutePath.startsWith(mediaRoot) && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

module.exports = {
  mediaRoot,
  avatarDir,
  postDir,
  fullMediaUrl,
  deleteFile,
};
