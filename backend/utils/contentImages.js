const MAX_IMAGES_PER_CONTENT = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_GALLERY_BYTES = 8 * 1024 * 1024;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const hasValidImageSignature = (buffer, mimeType) => {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
};

const sanitizeImageName = (name, mimeType) => {
  const extension = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.webp';
  const baseName = typeof name === 'string'
    ? name.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
    : '';
  return baseName || `image${extension}`;
};

const parseImageUpload = (upload) => {
  if (!upload || typeof upload.dataUrl !== 'string') {
    throw new Error('Each image must include a valid image file.');
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(upload.dataUrl);
  if (!match || !allowedImageTypes.has(match[1])) {
    throw new Error('Images must be JPEG, PNG, or WebP files.');
  }

  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > MAX_IMAGE_BYTES) {
    throw new Error('Each image must be no larger than 2 MB.');
  }
  if (!hasValidImageSignature(data, match[1])) {
    throw new Error('An uploaded image does not match its declared image format.');
  }

  return {
    mimeType: match[1],
    name: sanitizeImageName(upload.name, match[1]),
    size: data.length,
    data
  };
};

const parseImageUploads = (uploads = []) => {
  if (!Array.isArray(uploads)) {
    throw new Error('Images must be provided as a list.');
  }
  if (uploads.length > MAX_IMAGES_PER_CONTENT) {
    throw new Error(`Each content item can have at most ${MAX_IMAGES_PER_CONTENT} images.`);
  }

  const images = uploads.map(parseImageUpload);
  const totalBytes = images.reduce((sum, image) => sum + image.data.length, 0);
  if (totalBytes > MAX_GALLERY_BYTES) {
    throw new Error('The total size of images must not exceed 8 MB.');
  }
  return images;
};

module.exports = {
  MAX_IMAGES_PER_CONTENT,
  MAX_IMAGE_BYTES,
  MAX_GALLERY_BYTES,
  parseImageUploads
};
