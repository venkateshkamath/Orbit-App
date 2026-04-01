const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const { mediaRoot, deleteFile } = require('./utils/media');
const routes = require('./routes');

function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(
    express.urlencoded({
      extended: true,
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (
          !origin ||
          env.NODE_ENV !== 'production' ||
          env.CORS_ALLOWED_ORIGINS.length === 0 ||
          env.CORS_ALLOWED_ORIGINS.includes(origin)
        ) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked for origin ${origin}`));
      },
    })
  );
  app.use(morgan('dev'));
  app.use('/media', express.static(mediaRoot));

  app.use(routes);

  app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large.' });
    if (err.message && err.message.includes('allow')) return res.status(415).json({ error: err.message });
    next(err);
  });

  app.use((error, req, res, next) => {
    // Cloudinary errors bubble up here. No local file cleanup needed.
    console.error(error);
    res.status(500).json({ detail: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
