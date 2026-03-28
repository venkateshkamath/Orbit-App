const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { avatarDir, postDir } = require('../utils/media');

const storage = multer.diskStorage({
  destination(req, file, callback) {
    if (file.fieldname === 'avatar') {
      callback(null, avatarDir);
      return;
    }
    callback(null, postDir);
  },
  filename(req, file, callback) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    callback(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage });

module.exports = { upload };
