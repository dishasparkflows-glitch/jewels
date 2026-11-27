const { normalizeMedia } = require('./media');

// ------------------------------- media mongoose plugin ----------------------------
module.exports = function mediaPlugin(schema) {
  if (schema.$mediaPluginInstalled) return;
  schema.$mediaPluginInstalled = true;
  const paths = [];
  schema.eachPath((path, type) => {
    if (type.schema) type.schema.plugin(module.exports);
    if (path.endsWith('.url') && schema.path(`${path.slice(0, -4)}.key`)) paths.push(path.slice(0, -4));
  });

  if (paths.length === 0 && !(schema.path('url') && schema.path('key'))) {
    return;
  }

  schema.pre('validate', function () {
    if (schema.path('url') && schema.path('key')) {
      const normalized = normalizeMedia(this.toObject());
      this.set('url', normalized.url);
      this.set('key', normalized.key);
    }
    for (const path of paths) {
      const media = this.get(path);
      if (media) this.set(path, normalizeMedia(media.toObject ? media.toObject() : media));
    }
  });

  if (paths.length > 0) {
    schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function () {
      const update = this.getUpdate();
      if (!update || typeof update !== 'object') return;
      for (const values of [update, update.$set]) {
        if (!values || typeof values !== 'object') continue;
        for (const path of paths) {
          if (Object.hasOwn(values, `${path}.url`)) {
            const media = normalizeMedia({ url: values[`${path}.url`], key: values[`${path}.key`] });
            values[`${path}.url`] = media.url;
            values[`${path}.key`] = media.key;
          }
        }
      }
    });
  }
};
