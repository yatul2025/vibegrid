/**
 * server/src/controllers/feedController.js
 * ========================================
 * Controller for Live Feed and Live Stories Aggregation.
 *
 * Provides:
 * - GET /api/feed (Live aggregated feed with real users + external content)
 * - GET /api/feed/stories (Live aggregated active stories)
 */

const feedAggregator = require('../services/aggregator/FeedAggregator');

/**
 * @desc    Get live aggregated home feed
 * @route   GET /api/feed
 * @access  Public / Optional Auth
 */
const getLiveFeed = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const { page, limit, category, since, refresh } = req.query;

    const result = await feedAggregator.getFeed({
      currentUserId,
      page,
      limit,
      category,
      since,
      refresh: refresh === 'true' || refresh === '1' || refresh === true
    });

    return res.status(200).json({
      success: true,
      data: result,
      ...result
    });
  } catch (err) {
    console.error('[FeedController Error]', err);
    next(err);
  }
};

/**
 * @desc    Get live aggregated active stories
 * @route   GET /api/feed/stories
 * @access  Public / Optional Auth
 */
const getLiveStories = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const { refresh } = req.query;

    const creators = await feedAggregator.getStories({
      currentUserId,
      refresh: refresh === 'true' || refresh === '1' || refresh === true
    });

    const totalActiveStories = creators.reduce(
      (acc, c) => acc + (c.stories ? c.stories.length : 0),
      0
    );

    return res.status(200).json({
      success: true,
      data: {
        creators,
        totalActiveStories
      },
      creators,
      totalActiveStories
    });
  } catch (err) {
    console.error('[FeedController Error (Stories)]', err);
    next(err);
  }
};

module.exports = {
  getLiveFeed,
  getLiveStories
};
