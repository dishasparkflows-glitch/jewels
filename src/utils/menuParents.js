const mongoose = require('mongoose');
const ApiError = require('./ApiError');

async function requireParent(Model, id, label) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Valid ${label} ID is required`);
  const parent = await Model.findOne({ _id: id, 'meta.deletedAt': null });
  if (!parent) throw new ApiError(404, `${label} not found`);
  return parent;
}
module.exports = requireParent;
