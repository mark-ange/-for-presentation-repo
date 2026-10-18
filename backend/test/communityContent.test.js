const assert = require('node:assert/strict');
const test = require('node:test');
const CommunityContent = require('../models/CommunityContent');
const { MAX_IMAGES_PER_CONTENT, parseImageUploads } = require('../utils/contentImages');

test('accepts the supported resident content types', async () => {
  for (const type of ['recycle', 'event', 'tip', 'blog']) {
    const record = new CommunityContent({
      type,
      title: `${type} title`,
      body: 'Details for residents.',
      ...(type === 'event' ? {
        eventStartAt: new Date('2026-11-01T09:00:00.000Z'),
        location: 'City Hall'
      } : {})
    });

    await assert.doesNotReject(record.validate());
    assert.equal(record.status, 'draft');
  }
});

test('does not permit donate as community content', async () => {
  const record = new CommunityContent({
    type: 'donate',
    title: 'Donate',
    body: 'This content type is excluded.'
  });

  await assert.rejects(record.validate(), (error) => Boolean(error.errors.type));
});

test('requires event start time and location', async () => {
  const record = new CommunityContent({
    type: 'event',
    title: 'Neighborhood cleanup',
    body: 'Join the cleanup.'
  });

  await assert.rejects(record.validate(), (error) =>
    Boolean(error.errors.eventStartAt) && Boolean(error.errors.location)
  );
});

test('rejects an event end time before its start time', async () => {
  const record = new CommunityContent({
    type: 'event',
    title: 'Neighborhood cleanup',
    body: 'Join the cleanup.',
    eventStartAt: new Date('2026-11-01T11:00:00.000Z'),
    eventEndAt: new Date('2026-11-01T10:00:00.000Z'),
    location: 'City Hall'
  });

  await assert.rejects(record.validate(), (error) => Boolean(error.errors.eventEndAt));
});

test('accepts a bounded gallery of correctly signed PNG image uploads', () => {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const [image] = parseImageUploads([{
    name: '..\\resident photo.png',
    dataUrl: `data:image/png;base64,${pngSignature.toString('base64')}`
  }]);

  assert.equal(image.name, 'resident_photo.png');
  assert.equal(image.mimeType, 'image/png');
  assert.deepEqual(image.data, pngSignature);
  assert.equal(image.size, pngSignature.length);
});

test('rejects unsupported, spoofed, and excessive gallery image uploads', () => {
  const invalidType = {
    name: 'notes.txt',
    dataUrl: `data:text/plain;base64,${Buffer.from('not an image').toString('base64')}`
  };
  const spoofedImage = {
    name: 'fake.png',
    dataUrl: `data:image/png;base64,${Buffer.from('not png').toString('base64')}`
  };

  assert.throws(() => parseImageUploads([invalidType]), /JPEG, PNG, or WebP/);
  assert.throws(() => parseImageUploads([spoofedImage]), /does not match its declared image format/);
  assert.throws(
    () => parseImageUploads(Array.from({ length: MAX_IMAGES_PER_CONTENT + 1 }, () => spoofedImage)),
    /at most 5 images/
  );
});
