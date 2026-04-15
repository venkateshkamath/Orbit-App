const { PostLike, Comment } = require('../models');
const { fullMediaUrl } = require('../utils/media');

async function serializePost(post, currentUserId, req) {
  if (!post) return null;
  await post.populate('author');
  await post.populate('interest_ids');

  const likeCount = await PostLike.countDocuments({ post: post._id });
  const commentCount = await Comment.countDocuments({ post: post._id });
  const liked = await PostLike.findOne({ post: post._id, user: currentUserId });
  const recentCommentRows = await Comment.find({ post: post._id, parent: null })
    .sort({ created_at: 1 })
    .limit(3)
    .populate('author');

  const recentComments = recentCommentRows.map((comment) => ({
    id: String(comment._id),
    author: {
      id: String(comment.author._id),
      username: comment.author.username,
      avatar: comment.author.avatar,
    },
    text: comment.text,
    parent: comment.parent ? String(comment.parent) : null,
    reply_count: 0,
    created_at: comment.created_at.toISOString(),
  }));

  return {
    id: String(post._id),
    author: {
      id: String(post.author._id),
      username: post.author.username,
      avatar: post.author.avatar,
    },
    caption: post.caption || '',
    image: post.image,
    image_url: post.image,
    privacy: post.privacy,
    interests: post.interest_ids.map((interest) => ({
      id: String(interest._id),
      name: interest.name,
      emoji: interest.emoji,
      category: interest.category,
      color: interest.color,
    })),
    location_name: post.location_name || '',
    latitude: post.latitude,
    longitude: post.longitude,
    like_count: likeCount,
    comment_count: commentCount,
    is_liked: !!liked,
    recent_comments: recentComments,
    created_at: post.created_at.toISOString(),
    updated_at: post.updated_at.toISOString(),
  };
}

module.exports = { serializePost };
