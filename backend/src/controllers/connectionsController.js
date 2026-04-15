const { Like, Match, User } = require('../models');

// POST /api/connections/request/:targetUserId
exports.sendRequest = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    if (String(targetUserId) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot connect with yourself.' });
    }

    const existing = await Like.findOne({
      from_user: req.user._id,
      to_user: targetUserId,
    });
    if (existing) {
      return res.status(409).json({ error: 'Request already sent.' });
    }

    // In step 1.5 we track it as a 'pending' request
    await Like.create({
      from_user: req.user._id,
      to_user: targetUserId,
      status: 'pending',
    });

    res.status(201).json({ message: 'Connection request sent.' });
  } catch (err) {
    console.error('[sendRequest]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// PUT /api/connections/respond/:requestId
exports.respondToRequest = async (req, res) => {
  try {
    const { action } = req.body; // 'accepted' or 'rejected'
    if (!['accepted', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action.' });
    }

    const request = await Like.findOne({
      _id: req.params.requestId,
      to_user: req.user._id,
      status: 'pending',
    });
    if (!request) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    request.status = action;
    await request.save();

    if (action === 'accepted') {
      const sortedIds = [String(request.from_user), String(request.to_user)].sort();
      let match = await Match.findOne({ user1: sortedIds[0], user2: sortedIds[1] });
      if (!match) {
        await Match.create({ user1: sortedIds[0], user2: sortedIds[1] });
      }
    }

    res.json({ message: `Request ${action}.` });
  } catch (err) {
    console.error('[respondToRequest]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
