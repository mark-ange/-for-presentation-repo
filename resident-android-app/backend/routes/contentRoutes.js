const express = require('express');
const router = express.Router();
const CommunityContent = require('../models/CommunityContent');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const contentTypes = new Set(['recycle', 'event', 'tip', 'blog']);
const contentLabels = {
  recycle: 'Recycling update',
  event: 'New community event',
  tip: 'New waste-reduction tip',
  blog: 'New CityCare blog post'
};

router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    if (type !== undefined && (typeof type !== 'string' || !contentTypes.has(type))) {
      return res.status(400).json({ success: false, message: 'Unsupported content type.' });
    }

    const content = await CommunityContent.find(type ? { type } : {})
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ success: true, data: content });
  } catch (error) {
    console.error('Failed to load community content:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to load community content.' });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { type, title, summary, body, imageUrl, sourceUrl, images, eventStartAt, eventEndAt, location } = req.body;
    if (!contentTypes.has(type) || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Choose a supported content type and provide a title.'
      });
    }

    const content = await CommunityContent.create({
      type,
      title: title.trim(),
      summary: typeof summary === 'string' ? summary.trim() : '',
      body: typeof body === 'string' ? body.trim() : '',
      imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() : '',
      sourceUrl: typeof sourceUrl === 'string' ? sourceUrl.trim() : '',
      images: Array.isArray(images) ? images : [],
      eventStartAt: typeof eventStartAt === 'string' ? eventStartAt : '',
      eventEndAt: typeof eventEndAt === 'string' ? eventEndAt : '',
      location: typeof location === 'string' ? location.trim() : ''
    });

    const residents = await User.find({ role: 'resident' }).select('_id').lean();
    if (residents.length) {
      await Notification.insertMany(residents.map(resident => ({
        user: resident._id,
        title: contentLabels[type],
        body: content.title,
        type: type.toUpperCase()
      })));
    }

    return res.status(201).json({ success: true, data: content });
  } catch (error) {
    console.error('Failed to publish community content:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to publish community content.' });
  }
});

module.exports = router;
