const { Post, Interest, PostLike, Comment, Match } = require('../models');
const { serializePost } = require('../serializers/post');
const { deleteFile, fullMediaUrl, uploadToCloudinary, deleteFromCloudinary } = require('../utils/media');
const { asNumber, parseIdList } = require('../utils/validation');

async function feed(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const interestId = req.query.interest;

    // Find all users this person is matched/connected with
    const matches = await Match.find({
      $or: [{ user1: req.user._id }, { user2: req.user._id }],
    }).lean();

    const connectedUserIds = matches.map((m) =>
      String(m.user1) === String(req.user._id) ? String(m.user2) : String(m.user1)
    );

    // Build the privacy filter
    const privacyFilter = {
      $or: [
        { privacy: 'public' },
        { author: req.user._id }, // always see own posts
        {
          $and: [
            { privacy: 'connections' },
            { author: { $in: connectedUserIds } },
          ],
        },
      ],
    };

    if (interestId) {
      privacyFilter.interest_ids = interestId;
    }

    const [postRows, total] = await Promise.all([
      Post.find(privacyFilter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments(privacyFilter),
    ]);

    const results = [];
    for (const post of postRows) {
      results.push(await serializePost(post, req.user._id, req));
    }

    res.json({
      posts: results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[feed]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function myPosts(req, res) {
  const postRows = await Post.find({ author: req.user._id }).sort({ created_at: -1 });
  const results = [];
  for (const post of postRows) {
    results.push(await serializePost(post, req.user._id, req));
  }
  res.json(results);
}

async function userPosts(req, res) {
  const targetUserId = req.params.userId;
  const isOwn = String(targetUserId) === String(req.user._id);

  let privacyFilter;
  if (isOwn) {
    privacyFilter = { author: targetUserId };
  } else {
    const match = await Match.findOne({
      $or: [
        { user1: req.user._id, user2: targetUserId },
        { user1: targetUserId, user2: req.user._id },
      ],
    });
    privacyFilter = {
      author: targetUserId,
      privacy: { $in: match ? ['public', 'connections'] : ['public'] },
    };
  }

  const postRows = await Post.find(privacyFilter).sort({ created_at: -1 });
  const results = [];
  for (const post of postRows) {
    results.push(await serializePost(post, req.user._id, req));
  }
  res.json(results);
}

async function createPost(req, res) {
  try {
    const privacy = req.body?.privacy;
    const VALID_PRIVACY = ['public', 'connections', 'private'];
    const postPrivacy = VALID_PRIVACY.includes(privacy) ? privacy : 'public';

    if (!req.file) {
      return res.status(400).json({ error: 'No image file received by server.' });
    }

    // multer-storage-cloudinary already uploaded the file to Cloudinary.
    // req.file.path = Cloudinary secure URL, req.file.filename = public_id
    const mediaUrl = req.file.path;
    const mediaPublicId = req.file.filename || null;

    if (!mediaUrl || !mediaUrl.startsWith('https://')) {
      return res.status(500).json({ error: 'Cloudinary did not return a valid URL.' });
    }

    const caption = String(req.body?.caption || '');
    const interestIds = parseIdList(req.body?.interest_ids || req.body?.['interest_ids[]']);

    const interests = interestIds.length
      ? await Interest.find({ _id: { $in: interestIds } })
      : [];

    const post = await Post.create({
      author: req.user._id,
      caption,
      image: mediaUrl,
      mediaPublicId,
      privacy: postPrivacy,
      location_name: String(req.body?.location_name || ''),
      latitude: asNumber(req.body?.latitude),
      longitude: asNumber(req.body?.longitude),
      interest_ids: interests.map((i) => i._id),
    });

    res.status(201).json(await serializePost(post, req.user._id, req));
  } catch (err) {
    console.error('[createPost]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getPost(req, res) {
  const post = await Post.findById(req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const isOwn = String(post.author) === String(req.user._id);
  if (!isOwn) {
    if (post.privacy === 'private') {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    if (post.privacy === 'connections') {
      const match = await Match.findOne({
        $or: [
          { user1: req.user._id, user2: post.author },
          { user1: post.author, user2: req.user._id },
        ],
      });
      if (!match) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }
    }
  }

  res.json(await serializePost(post, req.user._id, req));
}

async function patchPost(req, res) {
  const post = await Post.findById(req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  if (String(post.author) !== String(req.user._id)) {
    res.status(403).json({ detail: 'You can only edit your own posts' });
    return;
  }

  const interestIds = parseIdList(req.body?.interest_ids);
  if (req.body?.caption !== undefined) post.caption = String(req.body.caption);
  if (req.body?.location_name !== undefined) post.location_name = String(req.body.location_name);
  if (req.body?.latitude !== undefined) post.latitude = asNumber(req.body.latitude);
  if (req.body?.longitude !== undefined) post.longitude = asNumber(req.body.longitude);

  if (interestIds.length || req.body?.interest_ids !== undefined) {
    const interests = await Interest.find({ _id: { $in: interestIds } });
    post.interest_ids = interests.map((i) => i._id);
  }

  await post.save();
  res.json(await serializePost(post, req.user._id, req));
}

async function deletePost(req, res) {
  const post = await Post.findById(req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  if (String(post.author) !== String(req.user._id)) {
    res.status(403).json({ detail: 'You can only delete your own posts' });
    return;
  }
  if (post.image) {
    if (post.mediaPublicId) {
      deleteFromCloudinary(post.mediaPublicId).catch((e) =>
        console.error('[deletePost] Cloudinary deletion failed:', e)
      );
    } else {
      deleteFile(post.image);
    }
  }
  await PostLike.deleteMany({ post: post._id });
  await Comment.deleteMany({ post: post._id });
  await Post.deleteOne({ _id: post._id });
  res.status(204).send();
}

async function toggleLike(req, res) {
  const post = await Post.findById(req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  const existing = await PostLike.findOne({ post: post._id, user: req.user._id });
  if (existing) {
    await PostLike.deleteOne({ _id: existing._id });
    const count = await PostLike.countDocuments({ post: post._id });
    res.json({ liked: false, like_count: count });
    return;
  }
  await PostLike.create({
    user: req.user._id,
    post: post._id,
  });
  const count = await PostLike.countDocuments({ post: post._id });
  res.json({ liked: true, like_count: count });
}

async function listComments(req, res) {
  const commentRows = await Comment.find({
    post: req.params.id,
    parent: null,
  })
    .sort({ created_at: 1 })
    .populate('author');
  const results = [];
  for (const comment of commentRows) {
    const replyCount = await Comment.countDocuments({ parent: comment._id });
    results.push({
      id: String(comment._id),
      author: {
        id: String(comment.author._id),
        username: comment.author.username,
        avatar: comment.author.avatar,
      },
      text: comment.text,
      parent: comment.parent ? String(comment.parent) : null,
      reply_count: replyCount,
      created_at: comment.created_at.toISOString(),
    });
  }
  res.json(results);
}

async function createComment(req, res) {
  const post = await Post.findById(req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  const text = String(req.body?.text || '').trim();
  if (!text) {
    res.status(400).json({ text: ['This field is required.'] });
    return;
  }
  const comment = await Comment.create({
    author: req.user._id,
    post: post._id,
    text,
    parent: req.body?.parent || null,
  });
  const populated = await Comment.findById(comment._id).populate('author');
  res.status(201).json({
    id: String(populated._id),
    author: {
      id: String(populated.author._id),
      username: populated.author.username,
      avatar: populated.author.avatar,
    },
    text: populated.text,
    parent: populated.parent ? String(populated.parent) : null,
    reply_count: 0,
    created_at: populated.created_at.toISOString(),
  });
}

async function deleteComment(req, res) {
  const comment = await Comment.findById(req.params.id);
  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }
  if (String(comment.author) !== String(req.user._id)) {
    res.status(403).json({ error: 'You can only delete your own comments' });
    return;
  }
  await Comment.deleteMany({
    $or: [{ _id: comment._id }, { parent: comment._id }],
  });
  res.status(204).send();
}

module.exports = {
  feed,
  myPosts,
  userPosts,
  createPost,
  getPost,
  patchPost,
  deletePost,
  toggleLike,
  listComments,
  createComment,
  deleteComment,
};
