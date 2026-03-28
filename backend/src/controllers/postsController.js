const { Post, Interest, PostLike, Comment } = require('../models');
const { serializePost } = require('../serializers/post');
const { deleteFile, fullMediaUrl } = require('../utils/media');
const { asNumber, parseIdList } = require('../utils/validation');

async function feed(req, res) {
  const interestId = req.query.interest;
  const filter = {};
  if (interestId) {
    filter.interest_ids = interestId;
  }
  const postRows = await Post.find(filter).sort({ created_at: -1 });
  const results = [];
  for (const post of postRows) {
    results.push(await serializePost(post, req.user._id, req));
  }
  res.json(results);
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
  const postRows = await Post.find({ author: req.params.userId }).sort({ created_at: -1 });
  const results = [];
  for (const post of postRows) {
    results.push(await serializePost(post, req.user._id, req));
  }
  res.json(results);
}

async function createPost(req, res) {
  const caption = String(req.body?.caption || '');
  const interestIds = parseIdList(req.body?.interest_ids || req.body?.['interest_ids[]']);
  const imagePath = req.file ? `posts/${req.file.filename}` : null;

  const interests = interestIds.length
    ? await Interest.find({ _id: { $in: interestIds } })
    : [];

  const post = await Post.create({
    author: req.user._id,
    caption,
    image: imagePath,
    location_name: String(req.body?.location_name || ''),
    latitude: asNumber(req.body?.latitude),
    longitude: asNumber(req.body?.longitude),
    interest_ids: interests.map((i) => i._id),
  });

  res.status(201).json(await serializePost(post, req.user._id, req));
}

async function getPost(req, res) {
  const post = await Post.findById(req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
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
    deleteFile(post.image);
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
        avatar: fullMediaUrl(req, comment.author.avatar),
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
      avatar: fullMediaUrl(req, populated.author.avatar),
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
