const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const express = require('express');

const originalApkPath = process.env.CITYCARE_ANDROID_APK_PATH;
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'citycare-download-'));
const apkFile = path.join(temporaryDirectory, 'test.apk');
let server;
let baseUrl;

before(async () => {
  fs.writeFileSync(apkFile, Buffer.from('sample apk content'));
  process.env.CITYCARE_ANDROID_APK_PATH = apkFile;

  const app = express();
  app.use('/download', require('../routes/downloadRoutes'));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/download/citycare.apk`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (originalApkPath === undefined) {
    delete process.env.CITYCARE_ANDROID_APK_PATH;
  } else {
    process.env.CITYCARE_ANDROID_APK_PATH = originalApkPath;
  }
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('downloads the configured Android package with a safe fixed filename', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/vnd\.android\.package-archive/);
  assert.match(response.headers.get('content-disposition'), /filename="CityCare-CDO\.apk"/);
  assert.equal(await response.text(), 'sample apk content');
});

test('does not expose a package file when the configured path is missing', async () => {
  process.env.CITYCARE_ANDROID_APK_PATH = path.join(temporaryDirectory, 'missing.apk');
  const response = await fetch(baseUrl);
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.message, 'The CityCare Android app download is temporarily unavailable.');
});

