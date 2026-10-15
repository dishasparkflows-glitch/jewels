const zlib = require('zlib');
const { XMLParser } = require('fast-xml-parser');
const DiamondType = require('../modules/diamondType/diamondType.model');
const DiamondShape = require('../modules/diamondShape/diamondShape.model');
const DiamondColor = require('../modules/diamondColor/diamondColor.model');
const DiamondClarity = require('../modules/diamondClarity/diamondClarity.model');
const ApiError = require('./ApiError');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
});

function readZipEntries(buffer) {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new ApiError(400, 'The uploaded file is not a valid .xlsx workbook');

  const count = buffer.readUInt16LE(eocdOffset + 10);
  let cursor = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new ApiError(400, 'The Excel workbook could not be read');
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const filenameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const filename = buffer.toString('utf8', cursor + 46, cursor + 46 + filenameLength);
    const localFilenameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localFilenameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    let content;
    if (method === 0) content = compressed;
    else if (method === 8) content = zlib.inflateRawSync(compressed);
    else throw new ApiError(400, 'This Excel workbook uses an unsupported compression format');
    entries.set(filename, content.toString('utf8'));
    cursor += 46 + filenameLength + extraLength + commentLength;
  }
  return entries;
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function columnIndex(cellReference) {
  const letters = String(cellReference || '').match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function textFromRichString(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value) return '';
  if (value.t !== undefined) return textFromRichString(value.t);
  return asArray(value.r).map((run) => textFromRichString(run?.t)).join('');
}

function parseWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) throw new ApiError(400, 'Please upload a valid Excel workbook');
  if (buffer.length > 10 * 1024 * 1024) throw new ApiError(413, 'Excel files must be 10 MB or smaller');
  const entries = readZipEntries(buffer);
  const sharedStrings = entries.has('xl/sharedStrings.xml')
    ? asArray(parser.parse(entries.get('xl/sharedStrings.xml'))?.sst?.si).map(textFromRichString)
    : [];

  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbookXml = entries.get('xl/workbook.xml');
  const relationshipsXml = entries.get('xl/_rels/workbook.xml.rels');
  if (workbookXml && relationshipsXml) {
    const workbook = parser.parse(workbookXml)?.workbook;
    const firstSheet = asArray(workbook?.sheets?.sheet)[0];
    const relationId = firstSheet?.['@_r:id'];
    const relationships = asArray(parser.parse(relationshipsXml)?.Relationships?.Relationship);
    const relation = relationships.find((item) => item['@_Id'] === relationId);
    if (relation?.['@_Target']) {
      const target = relation['@_Target'].replace(/^\//, '');
      sheetPath = target.startsWith('xl/') ? target : `xl/${target.replace(/^\.\//, '')}`;
    }
  }
  const sheet = entries.get(sheetPath);
  if (!sheet) throw new ApiError(400, 'The workbook has no readable worksheet');
  const rows = asArray(parser.parse(sheet)?.worksheet?.sheetData?.row).map((row) => {
    const values = [];
    for (const cell of asArray(row.c)) {
      const index = columnIndex(cell['@_r']);
      let value = cell.v ?? cell.is?.t ?? '';
      if (cell['@_t'] === 's') value = sharedStrings[Number(value)] ?? '';
      else if (cell['@_t'] === 'inlineStr') value = textFromRichString(cell.is);
      values[index] = value;
    }
    return values;
  });
  return rows;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

function normalizeHeader(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findColumn(headers, names) {
  return headers.findIndex((header) => names.some((name) => header === name || header.includes(name)));
}

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const normalized = String(value ?? '').replace(/[₹$,\s]/g, '');
  return normalized ? Number(normalized) : NaN;
}

function resolveRange(row, fromIndex, toIndex, sizeIndex) {
  if (fromIndex >= 0 && toIndex >= 0) return [parseNumber(row[fromIndex]), parseNumber(row[toIndex])];
  const raw = String(row[sizeIndex] ?? '').trim();
  const range = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)\s*$/i);
  return range ? [Number(range[1]), Number(range[2])] : [NaN, NaN];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function allowedGroupedMaster(kind, name) {
  if (kind === 'shape') return name === 'FANCY';
  if (kind === 'color') return /^[D-J]-[D-J]$/.test(name);
  if (kind === 'clarity') return ['VVS', 'VS', 'SI'].includes(name);
  return false;
}

async function findMaster(Model, name, label, kind) {
  // The supplied pricing sheets use ROUND as the shape group name, while the
  // seeded config calls that shape "Round Brilliant".
  const aliases = kind === 'shape' && name === 'ROUND' ? ['Round Brilliant'] : [];
  const candidates = [name, ...aliases];
  for (const candidate of candidates) {
    const escaped = escapeRegex(candidate);
    const doc = await Model.findOne({
      name: new RegExp(`^${escaped}$`, 'i'),
      isDeleted: false,
      status: 'active',
    }).select('_id name').lean();
    if (doc) return doc._id;
  }
  for (const candidate of candidates) {
    const escaped = escapeRegex(candidate);
    const unavailable = await Model.findOne({ name: new RegExp(`^${escaped}$`, 'i') }).select('_id').lean();
    if (unavailable) {
      throw new ApiError(400, `${label} "${candidate}" is inactive or deleted. Activate it in Diamond Config before importing.`);
    }
  }

  // These files intentionally use grouped grading labels (D-E, VVS, etc.)
  // that are not part of the individual grade values created by the seed data.
  // Keep those groups as first-class master values so every imported price row
  // retains its exact grade instead of silently mapping it to one component.
  if (allowedGroupedMaster(kind, name)) {
    try {
      const created = await Model.create({ name, status: 'active', isDeleted: false });
      return created._id;
    } catch (error) {
      // A concurrent import may have created the same unique master value.
      if (error.code !== 11000) throw error;
      const existing = await Model.findOne({
        name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
        isDeleted: false,
        status: 'active',
      }).select('_id').lean();
      if (existing) return existing._id;
    }
  }

  throw new ApiError(400, `Unknown ${label} "${name}". Add it to Diamond Config before importing.`);
}

async function importDiamondPriceWorkbook({ buffer, filename, diamondTypeId, userId }) {
  if (!diamondTypeId) throw new ApiError(400, 'Diamond type is required');
  const type = await DiamondType.findOne({ _id: diamondTypeId, isDeleted: false }).select('_id').lean();
  if (!type) throw new ApiError(400, 'Selected diamond type was not found');

  const isCsv = /\.csv$/i.test(filename || '');
  if (!isCsv && !/\.xlsx$/i.test(filename || '')) {
    throw new ApiError(400, 'Please upload an .xlsx or .csv file');
  }
  const rows = isCsv ? parseCsv(buffer.toString('utf8')) : parseWorkbook(buffer);
  if (rows.length < 2) throw new ApiError(400, 'The workbook has no data rows');

  const headers = rows[0].map(normalizeHeader);
  const indexes = {
    shape: findColumn(headers, ['shape']),
    color: findColumn(headers, ['color']),
    clarity: findColumn(headers, ['clarity']),
    size: findColumn(headers, ['size']),
    from: findColumn(headers, ['size from', 'from', 'min']),
    to: findColumn(headers, ['size to', 'to', 'max']),
    price: findColumn(headers, ['price', 'rate']),
  };
  if ([indexes.shape, indexes.color, indexes.clarity, indexes.price].some((index) => index < 0) || (indexes.size < 0 && (indexes.from < 0 || indexes.to < 0))) {
    throw new ApiError(400, 'Required columns: SHAPE, COLOR, CLARITY, SIZE (or SIZE FROM and SIZE TO), PRICE');
  }

  const attributeCache = { shape: new Map(), color: new Map(), clarity: new Map() };
  const resolve = async (kind, Model, rawName) => {
    const name = String(rawName ?? '').trim() || (kind === 'clarity' ? 'SI' : '');
    if (!name) return null;
    const key = name.toUpperCase();
    if (!attributeCache[kind].has(key)) attributeCache[kind].set(key, await findMaster(Model, name, kind, kind));
    return attributeCache[kind].get(key);
  };

  const imported = [];
  const errors = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.every((value) => String(value ?? '').trim() === '')) continue;
    try {
      const shapeName = String(row[indexes.shape] ?? '').trim().toUpperCase();
      const colorName = String(row[indexes.color] ?? '').trim().toUpperCase();
      const clarityName = String(row[indexes.clarity] ?? '').trim().toUpperCase() || 'SI';
      const [sizeFrom, sizeTo] = resolveRange(row, indexes.from, indexes.to, indexes.size);
      const priceINR = parseNumber(row[indexes.price]);
      if (!shapeName || !colorName) throw new Error('Shape and color are required');
      if (!Number.isFinite(sizeFrom) || !Number.isFinite(sizeTo) || sizeFrom < 0 || sizeTo < sizeFrom) throw new Error('Size range is invalid');
      if (!Number.isFinite(priceINR) || priceINR < 0) throw new Error('Price must be a valid non-negative number');
      imported.push({
        diamondTypeId,
        diamondShapeId: await resolve('shape', DiamondShape, shapeName),
        diamondColorId: await resolve('color', DiamondColor, colorName),
        diamondClarityId: await resolve('clarity', DiamondClarity, clarityName),
        sizeFrom,
        sizeTo,
        priceINR,
        priceUSD: 0,
        updatedBy: userId || null,
      });
    } catch (error) {
      errors.push(`Row ${index + 1}: ${error.message}`);
      if (errors.length >= 10) break;
    }
  }
  if (errors.length) throw new ApiError(400, `Import stopped. ${errors.join('; ')}`);
  if (!imported.length) throw new ApiError(400, 'No valid diamond price rows were found');
  return imported;
}

module.exports = { importDiamondPriceWorkbook, parseWorkbook };
