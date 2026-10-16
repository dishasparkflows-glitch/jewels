const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { normalizeMedia, normalizeAssets, serializeMedia, publicUrl } = require('./media');
const mediaPlugin = require('./mediaPlugin');
const ApiResponse = require('./ApiResponse');
process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN = 'https://cdn.example.com';

test('storage uses the CDN URL and actual key, including old proxy URLs', () => {
  assert.deepEqual(normalizeMedia({ url: '/api/upload/file/navigation/tennis.webp', public_id: 'old-fake-id' }), {
    url: 'https://cdn.example.com/navigation/tennis.webp', key: 'navigation/tennis.webp',
  });
  assert.equal(normalizeMedia({ url: 'https://cdn.example.com/a%20b.webp', key: '' }).key, 'a b.webp');
  assert.equal(normalizeMedia({ url: 'https://other.example.com/a.webp' }).key, '');
  assert.equal(publicUrl('folder/a b.webp'), 'https://cdn.example.com/folder/a%20b.webp');
});

test('nested legacy images migrate without changing application keys or BSON values', () => {
  const id = new mongoose.Types.ObjectId();
  const created = new Date();
  const input = { _id: id, created, key: 'featured', items: [{ imageUrl: 'https://cdn.example.com/home/a.webp', imagePublicId: 'bad-id' }], images: [{ url: 'https://cdn.example.com/p.webp', public_id: 'p.webp' }] };
  const output = normalizeAssets(input);
  assert.equal(output._id, id);
  assert.equal(output.created, created);
  assert.equal(output.key, 'featured');
  assert.deepEqual(output.items[0], { image: { url: 'https://cdn.example.com/home/a.webp', key: 'home/a.webp' } });
  assert.equal(output.images[0].key, 'p.webp');
  assert.equal(input.images[0].public_id, 'p.webp');
});

test('Mongoose saves URL/key pairs for nested images and string snapshot inputs', async () => {
  const schema = new mongoose.Schema({ image: { url: String, key: String }, images: [{ url: String, key: String }], snapshot: require('./mediaField') });
  schema.plugin(mediaPlugin);
  const Model = mongoose.model('MediaContractTest', schema);
  const doc = new Model({ image: { url: 'https://cdn.example.com/main.webp' }, images: [{ url: 'https://cdn.example.com/nested.webp' }], snapshot: 'https://cdn.example.com/snapshot.webp' });
  await doc.validate();
  assert.equal(doc.image.key, 'main.webp');
  assert.equal(doc.images[0].key, 'nested.webp');
  assert.equal(doc.snapshot.key, 'snapshot.webp');
  assert.equal(serializeMedia(doc).images[0].key, undefined);
});

test('content responses omit media keys while upload responses retain them', () => {
  let body;
  const res = { status() { return this; }, json(value) { body = value; return value; } };
  const data = { key: 'featured', image: { url: 'https://cdn.example.com/a.webp', key: 'a.webp' }, legacy: { url: 'https://cdn.example.com/b.webp', public_id: 'b.webp' } };
  for (const method of ['success', 'created', 'paginated']) {
    ApiResponse[method](res, data, {});
    assert.deepEqual(body.data.image, { url: 'https://cdn.example.com/a.webp' });
    assert.equal(body.data.legacy.public_id, undefined);
    assert.equal(body.data.key, 'featured');
  }
  ApiResponse.success(res, data.image, 'Uploaded', 200, { includeMediaKeys: true });
  assert.equal(body.data.key, 'a.webp');
  assert.equal(data.image.key, 'a.webp');
});

test('updates derive missing keys, including dotted URL replacement', async () => {
  const schema = new mongoose.Schema({ image: { url: String, key: String } });
  schema.plugin(mediaPlugin);
  const Model = mongoose.model('MediaUpdateTest', schema);
  let saved;
  Model.collection.updateOne = async (_filter, update) => { saved = update; return { acknowledged: true }; };
  await Model.updateOne({}, { $set: { 'image.url': 'https://cdn.example.com/replacement.webp' } });
  assert.equal(saved.$set['image.key'], 'replacement.webp');
  await Model.updateOne({}, { image: { url: 'https://cdn.example.com/new.webp' } });
  assert.equal(saved.$set.image.key, 'new.webp');
  const legacy = Model.hydrate({ image: { url: 'https://cdn.example.com/old.webp', public_id: 'old.webp' } });
  assert.equal(legacy.image.key, 'old.webp');
});
