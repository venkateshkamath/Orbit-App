const { Notification } = require('../models');

async function listNotifications(req, res) {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const [unread_count, rows] = await Promise.all([
    Notification.countDocuments({ recipient: req.user._id, read_at: null }),
    Notification.find({ recipient: req.user._id }).sort({ created_at: -1 }).limit(limit).lean(),
  ]);

  const results = rows.map((row) => ({
    id: String(row._id),
    type: row.type,
    title: row.title,
    body: row.body,
    payload: row.payload || {},
    read_at: row.read_at ? row.read_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
  }));

  res.json({
    count: results.length,
    unread_count,
    results,
  });
}

async function markNotificationRead(req, res) {
  const row = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id,
  });
  if (!row) {
    res.status(404).json({ detail: 'Notification not found.' });
    return;
  }
  if (!row.read_at) {
    row.read_at = new Date();
    await row.save();
  }
  res.json({ ok: true });
}

async function markAllRead(req, res) {
  await Notification.updateMany(
    { recipient: req.user._id, read_at: null },
    { $set: { read_at: new Date() } }
  );
  res.json({ ok: true });
}

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllRead,
};
