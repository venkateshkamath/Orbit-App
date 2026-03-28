const path = require('path');
const fs = require('fs');
const env = require('../config/env');

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

module.exports = {
  mediaRoot,
  avatarDir,
  postDir,
  fullMediaUrl,
  deleteFile,
};
