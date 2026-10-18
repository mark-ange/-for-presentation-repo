const express = require('express');
const mongoose = require('mongoose');
const { body, param } = require('express-validator');
const CommunityContent = require('../models/CommunityContent');
const { apiLimiter, sanitizeMongoDB, validateInput } = require('../middleware/securityMiddleware');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  MAX_IMAGES_PER_CONTENT,
  MAX_GALLERY_BYTES,
  parseImageUploads
} = require('../utils/contentImages');

const router = express.Router();
const contentTypes = ['recycle', 'event', 'tip', 'blog'];
const contentStatuses = ['draft', 'published'];

const contentValidation = [
  body('type').isIn(contentTypes).withMessage('Type must be recycle, event, tip, or blog'),
  body('title').isString().trim().notEmpty().isLength({ max: 140 }).withMessage('Title is required and must be 140 characters or fewer'),
  body('summary').optional().isString().trim().isLength({ max: 300 }),
  body('body').isString().trim().notEmpty().isLength({ max: 12000 }).withMessage('Content details are required and must be 12,000 characters or fewer'),
  body('imageUrl').optional({ checkFalsy: true }).isURL({ protocols: ['https'], require_protocol: true }).withMessage('Image URL must be a valid HTTPS URL'),
  body('sourceUrl').optional({ checkFalsy: true }).isURL({ protocols: ['https'], require_protocol: true }).withMessage('Source link must be a valid HTTPS URL'),
  body('images').optional().isArray({ max: MAX_IMAGES_PER_CONTENT }).withMessage(`At most ${MAX_IMAGES_PER_CONTENT} images are allowed`),
  body('status').optional().isIn(contentStatuses).withMessage('Status must be draft or published'),
  body('eventStartAt').optional({ checkFalsy: true }).isISO8601().withMessage('Event start must be a valid date and time'),
  body('eventEndAt').optional({ checkFalsy: true }).isISO8601().withMessage('Event end must be a valid date and time'),
  body('location').optional().isString().trim().isLength({ max: 240 })
];

const contentUpdateValidation = [
  param('id').isMongoId().withMessage('Content ID is invalid'),
  body('type').optional().isIn(contentTypes).withMessage('Type must be recycle, event, tip, or blog'),
  body('title').optional().isString().trim().notEmpty().isLength({ max: 140 }),
  body('summary').optional().isString().trim().isLength({ max: 300 }),
  body('body').optional().isString().trim().notEmpty().isLength({ max: 12000 }),
  body('imageUrl').optional({ checkFalsy: true }).isURL({ protocols: ['https'], require_protocol: true }),
  body('sourceUrl').optional({ checkFalsy: true }).isURL({ protocols: ['https'], require_protocol: true }),
  body('appendImages').optional().isArray({ max: MAX_IMAGES_PER_CONTENT }),
  body('removeImageIds').optional().isArray({ max: MAX_IMAGES_PER_CONTENT }),
  body('removeImageIds.*').optional().isMongoId(),
  body('status').optional().isIn(contentStatuses).withMessage('Status must be draft or published'),
  body('eventStartAt').optional({ checkFalsy: true }).isISO8601(),
  body('eventEndAt').optional({ checkFalsy: true }).isISO8601(),
  body('location').optional().isString().trim().isLength({ max: 240 })
];

const serializeContent = (record) => {
  const content = record.toObject();
  content.images = (content.images || []).map((image) => ({
    id: String(image._id),
    name: image.name,
    mimeType: image.mimeType,
    size: image.size,
    url: `/api/content/${record._id}/images/${image._id}`
  }));
  return content;
};

const serveImage = async (req, res, { publishedOnly }) => {
  try {
    const filter = { _id: req.params.id };
    if (publishedOnly) filter.status = 'published';
    const record = await CommunityContent.findOne(filter).select('+images.data');
    const image = record?.images.id(req.params.imageId);
    if (!image) return res.status(404).json({ success: false, message: 'Image not found.' });

    res.set('Content-Type', image.mimeType);
    res.set('Content-Length', String(image.data.length));
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'inline');
    res.set('Cache-Control', publishedOnly ? 'public, max-age=300' : 'private, no-store');
    return res.send(image.data);
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ success: false, message: 'Content or image ID is invalid.' });
    }
    console.error('Load community content image error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load image.' });
  }
};

const validateEventFields = (content) => {
  if (content.type !== 'event') return null;
  if (!content.eventStartAt || !content.location?.trim()) {
    return 'Events require a start date and time and a location.';
  }
  if (content.eventEndAt && new Date(content.eventEndAt) < new Date(content.eventStartAt)) {
    return 'Event end time must be after its start time.';
  }
  return null;
};

const readTypeFilter = (req, res, next) => {
  const { type } = req.query;
  if (type && !contentTypes.includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid content type.' });
  }
  return next();
};

router.get('/', readTypeFilter, async (req, res) => {
  try {
    const filter = { status: 'published' };
    if (req.query.type) filter.type = req.query.type;

    const records = await CommunityContent.find(filter).sort({ updatedAt: -1 });
    return res.json({ success: true, count: records.length, data: records.map(serializeContent) });
  } catch (error) {
    console.error('Fetch published community content error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load published content.' });
  }
});

router.get('/manage', protect, adminOnly, readTypeFilter, async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;

    const records = await CommunityContent.find(filter).sort({ updatedAt: -1 });
    return res.json({ success: true, count: records.length, data: records.map(serializeContent) });
  } catch (error) {
    console.error('Fetch managed community content error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load content for management.' });
  }
});

router.get(
  '/manage/:id/images/:imageId',
  protect,
  adminOnly,
  validateInput([
    param('id').isMongoId(),
    param('imageId').isMongoId()
  ]),
  (req, res) => serveImage(req, res, { publishedOnly: false })
);

router.get(
  '/:id/images/:imageId',
  validateInput([
    param('id').isMongoId(),
    param('imageId').isMongoId()
  ]),
  (req, res) => serveImage(req, res, { publishedOnly: true })
);

router.post(
  '/',
  apiLimiter,
  sanitizeMongoDB,
  validateInput(contentValidation),
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const eventError = validateEventFields(req.body);
      if (eventError) return res.status(400).json({ success: false, message: eventError });
      let images;
      try {
        images = parseImageUploads(req.body.images || []);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }

      const record = await CommunityContent.create({
        type: req.body.type,
        title: req.body.title,
        summary: req.body.summary || '',
        body: req.body.body,
        imageUrl: req.body.imageUrl || '',
        sourceUrl: req.body.sourceUrl || '',
        images,
        status: req.body.status || 'draft',
        eventStartAt: req.body.type === 'event' ? req.body.eventStartAt : null,
        eventEndAt: req.body.type === 'event' ? req.body.eventEndAt || null : null,
        location: req.body.type === 'event' ? req.body.location : '',
        createdBy: req.user._id
      });

      return res.status(201).json({
        success: true,
        message: 'Content created successfully.',
        data: serializeContent(record)
      });
    } catch (error) {
      console.error('Create community content error:', error);
      return res.status(500).json({ success: false, message: 'Unable to create content.' });
    }
  }
);

router.put(
  '/:id',
  apiLimiter,
  sanitizeMongoDB,
  validateInput(contentUpdateValidation),
  protect,
  adminOnly,
  async (req, res) => {
    try {
      if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ success: false, message: 'Provide at least one field to update.' });
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'images')) {
        return res.status(400).json({ success: false, message: 'Use appendImages and removeImageIds when updating a gallery.' });
      }

      const record = await CommunityContent.findById(req.params.id).select('+images.data');
      if (!record) return res.status(404).json({ success: false, message: 'Content not found.' });

      const fields = ['type', 'title', 'summary', 'body', 'imageUrl', 'sourceUrl', 'status', 'eventStartAt', 'eventEndAt', 'location'];
      fields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          const value = req.body[field];
          if (['eventStartAt', 'eventEndAt'].includes(field)) {
            record[field] = value || null;
          } else {
            record[field] = value;
          }
        }
      });

      const removeImageIds = req.body.removeImageIds || [];
      const imageIds = new Set(record.images.map((image) => String(image._id)));
      if (removeImageIds.some((imageId) => !imageIds.has(imageId))) {
        return res.status(400).json({ success: false, message: 'One or more image IDs do not belong to this content item.' });
      }
      record.images = record.images.filter((image) => !removeImageIds.includes(String(image._id)));

      let newImages;
      try {
        newImages = parseImageUploads(req.body.appendImages || []);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      const resultingImageCount = record.images.length + newImages.length;
      const resultingGalleryBytes = record.images.reduce((sum, image) => sum + image.data.length, 0)
        + newImages.reduce((sum, image) => sum + image.data.length, 0);
      if (resultingImageCount > MAX_IMAGES_PER_CONTENT) {
        return res.status(400).json({ success: false, message: `Each content item can have at most ${MAX_IMAGES_PER_CONTENT} images.` });
      }
      if (resultingGalleryBytes > MAX_GALLERY_BYTES) {
        return res.status(400).json({ success: false, message: 'The total size of images must not exceed 8 MB.' });
      }
      record.images.push(...newImages);

      const eventError = validateEventFields(record);
      if (eventError) return res.status(400).json({ success: false, message: eventError });

      if (record.type !== 'event') {
        record.eventStartAt = null;
        record.eventEndAt = null;
        record.location = '';
      }

      await record.save();
      return res.json({ success: true, message: 'Content updated successfully.', data: serializeContent(record) });
    } catch (error) {
      if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Update community content error:', error);
      return res.status(500).json({ success: false, message: 'Unable to update content.' });
    }
  }
);

router.delete(
  '/:id',
  apiLimiter,
  sanitizeMongoDB,
  validateInput([param('id').isMongoId().withMessage('Content ID is invalid')]),
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const record = await CommunityContent.findByIdAndDelete(req.params.id);
      if (!record) return res.status(404).json({ success: false, message: 'Content not found.' });
      return res.json({ success: true, message: 'Content deleted successfully.' });
    } catch (error) {
      console.error('Delete community content error:', error);
      return res.status(500).json({ success: false, message: 'Unable to delete content.' });
    }
  }
);

module.exports = router;
