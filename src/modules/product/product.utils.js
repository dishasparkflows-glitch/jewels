const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');

// ------------------------------- resolve metal color info ----------------------------
const resolveMetalColorInfo = (cObj, p = null) => {
  const isObj = typeof cObj === 'object' && cObj !== null;
  let id = isObj ? String(cObj._id || cObj.id || '') : (typeof cObj === 'string' && /^[a-f0-9]{24}$/i.test(cObj) ? cObj : '');
  let name = isObj ? cObj.name || '' : (typeof cObj === 'string' && !/^[a-f0-9]{24}$/i.test(cObj) ? cObj : '');
  let colorCode = isObj ? (cObj.colorCode || cObj.hex || cObj.code || '') : '';
  let colorCodeEnd = isObj ? (cObj.colorCodeEnd || '') : '';

  // If missing name or colorCode, try resolving from p.metalColorIds
  if ((!name || !colorCode) && p) {
    const list = Array.isArray(p.metalColorIds) && p.metalColorIds.length > 0
      ? p.metalColorIds
      : (Array.isArray(p.representative?.metalColorIds) ? p.representative.metalColorIds : []);
    for (const mc of list) {
      if (!mc) continue;
      const mcIsObj = typeof mc === 'object' && mc !== null;
      const mcId = mcIsObj ? String(mc._id || mc.id || '') : String(mc);
      const mcName = mcIsObj ? mc.name || '' : '';
      if ((id && mcId === id) || (name && mcName && mcName.toLowerCase() === name.toLowerCase())) {
        if (!id && mcId) id = mcId;
        if (!name && mcName) name = mcName;
        if (!colorCode && mcIsObj) colorCode = mc.colorCode || mc.hex || mc.code || '';
        if (!colorCodeEnd && mcIsObj) colorCodeEnd = mc.colorCodeEnd || '';
        break;
      }
    }
  }

  const hex = colorCode || '';

  return { id, name, colorCode, colorCodeEnd, hex };
};

// Lean and aggregate results do not apply schema defaults to existing records.
// ------------------------------- with color statuses ----------------------------
const withColorStatuses = (product) => {
  if (!product) return product;
  if (Array.isArray(product.colorImages)) {
    product.colorImages = product.colorImages.map((ci) => {
      const validImgs = (ci.images || [])
        .map((img) => (typeof img === 'string' ? img : img?.url))
        .filter((url) => url && typeof url === 'string' && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url));
      const firstPhoto =
        validImgs[0] ||
        (typeof ci.firstPhoto === 'string' ? ci.firstPhoto : '') ||
        (typeof ci.firstImage === 'string' ? ci.firstImage : '') ||
        (typeof ci.image === 'string' ? ci.image : '') ||
        '';
      const resolved = resolveMetalColorInfo(ci.metalColorId || ci.metalColor, product);

      const sanitizedImages = (ci.images || []).map((img) => {
        if (!img) return null;
        const url = typeof img === 'string' ? img : img.url;
        if (!url) return null;
        const mediaType = (typeof img === 'object' && img.mediaType) ? img.mediaType : 'image';
        return {
          url,
          mediaType,
        };
      }).filter(Boolean);

      const item = { ...ci };
      delete item.metalColor;
      return {
        ...item,
        images: sanitizedImages,
        status: item.status ?? 'active',
        metalColorId: resolved.name
          ? {
              _id: resolved.id || undefined,
              name: resolved.name,
              colorCode: resolved.colorCode || resolved.hex,
              colorCodeEnd: resolved.colorCodeEnd,
              hex: resolved.hex,
            }
          : (item.metalColorId || null),
        firstPhoto,
      };
    });
  }

  if (Array.isArray(product.ornate?.ornateImages)) {
    product.ornate.ornateImages = product.ornate.ornateImages.map((img) => {
      if (!img) return null;
      const url = typeof img === 'string' ? img : img.url;
      if (!url) return null;
      const mediaType = (typeof img === 'object' && img.mediaType) ? img.mediaType : 'image';
      return {
        url,
        mediaType,
      };
    }).filter(Boolean);
  }

  if (Array.isArray(product.images)) {
    product.images = product.images.map((img) => {
      if (!img) return null;
      const url = typeof img === 'string' ? img : img.url;
      if (!url) return null;
      const mediaType = (typeof img === 'object' && img.mediaType) ? img.mediaType : 'image';
      return {
        url,
        mediaType,
      };
    }).filter(Boolean);
  }

  if (Array.isArray(product.variants)) {
    const hasCenterConfig = Array.isArray(product.centerDiamondRows) && product.centerDiamondRows.length > 0;
    product.variants = product.variants.map((v) => {
      if (!v) return null;
      const centerWt = v.centerDiamondWeight !== undefined && v.centerDiamondWeight !== null
        ? v.centerDiamondWeight
        : (hasCenterConfig ? (v.caratWeight ?? null) : 0);
      return {
        _id: v._id,
        sku: v.sku || '',
        combination: v.combination || '',
        price: v.price ?? null,
        stock: v.stock ?? 0,
        metalPurityId: v.metalPurityId || null,
        metalColorId: v.metalColorId || null,
        diamondTypeId: v.diamondTypeId || null,
        diamondShapeId: v.diamondShapeId || null,
        diamondColorId: v.diamondColorId || null,
        diamondClarityId: v.diamondClarityId || null,
        caratWeight: v.caratWeight ?? centerWt ?? null,
        centerDiamondWeight: centerWt,
        sideDiamondWeight: v.sideDiamondWeight ?? null,
        centerDiamondCost: v.centerDiamondCost ?? null,
        sideDiamondCost: v.sideDiamondCost ?? null,
        diamondCost: v.diamondCost !== undefined && v.diamondCost !== null
          ? v.diamondCost
          : ((Number(v.centerDiamondCost || 0) + Number(v.sideDiamondCost || 0)) || null),
        metalCost: v.metalCost ?? null,
        metalRate: v.metalRate ?? null,
        metalWeight: v.metalWeight ?? null,
        labourCharge: v.labourCharge ?? null,
        certificateCharge: v.certificateCharge ?? null,
      };
    }).filter(Boolean);
  }

  if (!product.metalColors || !product.metalColors.length) {
    product.metalColors = extractMetalColors(product);
  }
  return product;
};

// Sanitize and validate colorImages entries for database persistence
// ------------------------------- sanitize color images ----------------------------
const sanitizeColorImages = (colorImages) => {
  if (!Array.isArray(colorImages)) return colorImages;
  return colorImages.map((ci) => {
    if (!ci || typeof ci !== 'object') return null;
    const item = { ...ci };

    // Sanitize metalColorId
    if (item.metalColorId && typeof item.metalColorId === 'object') {
      const extractedId = item.metalColorId._id || item.metalColorId.id;
      if (extractedId && mongoose.isValidObjectId(extractedId)) {
        item.metalColorId = extractedId;
      } else {
        delete item.metalColorId;
      }
    } else if (!item.metalColorId || !mongoose.isValidObjectId(item.metalColorId)) {
      delete item.metalColorId;
    }

    // Sanitize variantIcon to prevent nested objects or empty invalid values
    if (item.variantIcon) {
      if (typeof item.variantIcon === 'string') {
        const trimmed = item.variantIcon.trim();
        item.variantIcon = trimmed ? { url: trimmed, key: '' } : undefined;
      } else if (typeof item.variantIcon === 'object') {
        let vUrl = item.variantIcon.url;
        while (vUrl && typeof vUrl === 'object') {
          vUrl = vUrl.url;
        }
        if (typeof vUrl === 'string' && vUrl.trim()) {
          item.variantIcon = {
            url: vUrl.trim(),
            key: typeof item.variantIcon.key === 'string' ? item.variantIcon.key : '',
          };
        } else {
          delete item.variantIcon;
        }
      } else {
        delete item.variantIcon;
      }
    }

    // Sanitize vtoImage
    if (item.vtoImage) {
      if (typeof item.vtoImage === 'string') {
        const trimmed = item.vtoImage.trim();
        item.vtoImage = trimmed ? { url: trimmed, key: '' } : undefined;
      } else if (typeof item.vtoImage === 'object') {
        let vUrl = item.vtoImage.url;
        while (vUrl && typeof vUrl === 'object') {
          vUrl = vUrl.url;
        }
        if (typeof vUrl === 'string' && vUrl.trim()) {
          item.vtoImage = {
            url: vUrl.trim(),
            key: typeof item.vtoImage.key === 'string' ? item.vtoImage.key : '',
          };
        } else {
          delete item.vtoImage;
        }
      } else {
        delete item.vtoImage;
      }
    }

    // Sanitize images
    if (Array.isArray(item.images)) {
      item.images = item.images.map((img) => {
        if (!img) return null;
        if (typeof img === 'string') {
          const trimmed = img.trim();
          return trimmed ? { url: trimmed, mediaType: 'image' } : null;
        }
        if (typeof img === 'object') {
          const url = typeof img.url === 'string' ? img.url.trim() : '';
          if (!url) return null;
          return {
            url,
            key: typeof img.key === 'string' ? img.key : '',
            mediaType: img.mediaType || (url.endsWith('.mp4') ? 'video' : 'image'),
          };
        }
        return null;
      }).filter(Boolean);
    }

    return item;
  }).filter(Boolean);
};

const PRICING_COMPARISON_KEYS = [
  'pricingKey', 'sku', 'combination', 'sideDiamondWeight', 'centerDiamondWeight', 'centerDiamondRate', 'certificateCharge', 'subtotal',
  'price',
  'metalCost',
  'metalRate',
  'metalWeight',
  'centerDiamondCost',
  'sideDiamondCost',
  'computedGst',
  'labourCharge',
  'otherAmount',
];

// ------------------------------- is pricing unchanged ----------------------------
const isPricingUnchanged = (product, result) => {
  if (!product || !result) return false;
  if (result.salePrice !== product.pricing?.salePrice) return false;
  if (!Array.isArray(result.variants) || !Array.isArray(product.variants)) return false;
  if (result.variants.length !== product.variants.length) return false;

  return result.variants.every((v, i) => {
    const origVariant = product.variants[i];
    if (!origVariant) return false;
    return PRICING_COMPARISON_KEYS.every((key) => v[key] === origVariant[key]);
  });
};

// ------------------------------- extract product images ----------------------------
const extractProductImages = (p) => {
  if (!p) return [];
  const images = [];

  // 1. Direct images array (strings or objects with url)
  if (Array.isArray(p.images)) {
    p.images.forEach((img) => {
      const u = typeof img === 'string' ? img : img?.url;
      if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
    });
  }

  // 2. Color images
  if (Array.isArray(p.colorImages)) {
    p.colorImages.forEach((c) => {
      if (Array.isArray(c?.images)) {
        c.images.forEach((img) => {
          const u = typeof img === 'string' ? img : img?.url;
          if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
        });
      }
    });
  }

  // 3. Ornate images (from ERP / R2)
  if (Array.isArray(p.ornate?.ornateImages)) {
    p.ornate.ornateImages.forEach((img) => {
      const u = typeof img === 'string' ? img : img?.url;
      if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
    });
  }

  // 4. Group representative images
  if (p.representative) {
    if (Array.isArray(p.representative.images)) {
      p.representative.images.forEach((img) => {
        const u = typeof img === 'string' ? img : img?.url;
        if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
      });
    }
    if (Array.isArray(p.representative.colorImages)) {
      p.representative.colorImages.forEach((c) => {
        if (Array.isArray(c?.images)) {
          c.images.forEach((img) => {
            const u = typeof img === 'string' ? img : img?.url;
            if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
          });
        }
      });
    }
    if (Array.isArray(p.representative.ornate?.ornateImages)) {
      p.representative.ornate.ornateImages.forEach((img) => {
        const u = typeof img === 'string' ? img : img?.url;
        if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
      });
    }
  }

  // 5. Single image fallback
  if (p.image) {
    const u = typeof p.image === 'string' ? p.image : p.image?.url;
    if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
  }

  return [...new Set(images)];
};

// ------------------------------- extract metal colors ----------------------------
const extractMetalColors = (p) => {
  if (!p) return [];
  const colorMap = new Map();

  const sourceColorImages = Array.isArray(p.colorImages) && p.colorImages.length > 0
    ? p.colorImages
    : (Array.isArray(p.representative?.colorImages) ? p.representative.colorImages : []);

  // 1. Process colorImages rows
  for (const row of sourceColorImages) {
    if (!row || row.status === 'inactive') continue;
    const cObj = row.metalColor || row.metalColorId || row.color;
    const resolved = resolveMetalColorInfo(cObj, p);
    const key = (resolved.name || resolved.id || resolved.hex || '').toLowerCase().trim();
    if (!key) continue;

    const validImages = (row.images || [])
      .map((img) => (typeof img === 'string' ? img : img?.url))
      .filter((url) => url && typeof url === 'string' && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url));

    const firstPhoto =
      validImages[0] ||
      (typeof row.firstPhoto === 'string' ? row.firstPhoto : '') ||
      (typeof row.firstImage === 'string' ? row.firstImage : '') ||
      (typeof row.image === 'string' ? row.image : '') ||
      '';

    colorMap.set(key, {
      _id: resolved.id || undefined,
      name: resolved.name || key,
      colorCode: resolved.colorCode,
      colorCodeEnd: resolved.colorCodeEnd,
      hex: resolved.hex,
      firstPhoto,
      images: validImages,
    });
  }

  // 2. Also process metalColorIds
  const sourceMetalColors = Array.isArray(p.metalColorIds) && p.metalColorIds.length > 0
    ? p.metalColorIds
    : (Array.isArray(p.representative?.metalColorIds) ? p.representative.metalColorIds : []);

  for (const mc of sourceMetalColors) {
    if (!mc) continue;
    const resolved = resolveMetalColorInfo(mc, p);
    const key = (resolved.name || resolved.id || resolved.hex || '').toLowerCase().trim();
    if (!key) continue;

    if (colorMap.has(key)) {
      const existing = colorMap.get(key);
      if (!existing._id && resolved.id) existing._id = resolved.id;
      if (!existing.name && resolved.name) existing.name = resolved.name;
      if (!existing.colorCode && resolved.colorCode) existing.colorCode = resolved.colorCode;
      if (!existing.colorCodeEnd && resolved.colorCodeEnd) existing.colorCodeEnd = resolved.colorCodeEnd;
      if (!existing.hex && resolved.hex) existing.hex = resolved.hex;
    } else {
      let matchedPhoto = '';
      let matchedImages = [];
      for (const row of sourceColorImages) {
        if (!row || row.status === 'inactive') continue;
        const rResolved = resolveMetalColorInfo(row.metalColor || row.metalColorId || row.color, p);
        if (
          (resolved.id && rResolved.id && resolved.id === rResolved.id) ||
          (resolved.name && rResolved.name && resolved.name.toLowerCase() === rResolved.name.toLowerCase())
        ) {
          matchedImages = (row.images || [])
            .map((img) => (typeof img === 'string' ? img : img?.url))
            .filter((url) => url && typeof url === 'string' && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url));
          matchedPhoto =
            matchedImages[0] ||
            (typeof row.firstPhoto === 'string' ? row.firstPhoto : '') ||
            (typeof row.firstImage === 'string' ? row.firstImage : '') ||
            (typeof row.image === 'string' ? row.image : '') ||
            '';
          break;
        }
      }

      colorMap.set(key, {
        _id: resolved.id || undefined,
        name: resolved.name || key,
        colorCode: resolved.colorCode,
        colorCodeEnd: resolved.colorCodeEnd,
        hex: resolved.hex,
        firstPhoto: matchedPhoto,
        images: matchedImages,
      });
    }
  }

  return Array.from(colorMap.values());
};

// ------------------------------- format color images ----------------------------
const formatColorImages = (colorImages, p = null) => {
  if (!Array.isArray(colorImages)) return [];
  return colorImages
    .map((ci) => {
      if (!ci) return null;
      const cObj = ci.metalColor || ci.metalColorId;
      const resolved = resolveMetalColorInfo(cObj, p);

      const validImages = (ci.images || [])
        .map((img) => (typeof img === 'string' ? img : img?.url))
        .filter((url) => url && typeof url === 'string' && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url));

      const firstPhoto =
        validImages[0] ||
        (typeof ci.firstPhoto === 'string' ? ci.firstPhoto : '') ||
        (typeof ci.firstImage === 'string' ? ci.firstImage : '') ||
        (typeof ci.image === 'string' ? ci.image : '') ||
        '';

      return {
        status: ci.status || 'active',
        metalColorId: {
          _id: resolved.id || undefined,
          name: resolved.name || '',
          colorCode: resolved.colorCode || resolved.hex,
          colorCodeEnd: resolved.colorCodeEnd,
          hex: resolved.hex,
        },
        firstPhoto,
        images: (ci.images || []).map((img) =>
          typeof img === 'string'
            ? { url: img, mediaType: 'image' }
            : { url: img?.url, mediaType: img?.mediaType || 'image', key: img?.key }
        ),
      };
    })
    .filter(Boolean);
};

// ------------------------------- format storefront product ----------------------------
const formatStorefrontProduct = (p) => {
  if (!p) return null;
  const isGroup = Boolean(p.isGroup);
  let title = p.basicInfo?.title || p.groupName || p.name || 'Untitled product';
  let slug = p.basicInfo?.slug || p.slug || '';

  // Clean trailing sequence numbers if present (e.g. -000030)
  if (slug && /-\d{6}$/.test(slug)) {
    slug = slug.replace(/-\d{6}$/, '');
  }

  // If title was auto-generated with " - <barcode>" on single-product items, clean it
  if (title && (p.variantCount <= 1 || !isGroup) && title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length === 2 && /^\d+$/.test(parts[1].trim())) {
      title = parts[0].trim();
    }
  }

  const description = p.basicInfo?.description || p.description || '';
  const images = extractProductImages(p);

  const salePrice = Number(p.pricing?.salePrice || 0);
  const isGold = String(p.productType || '').toLowerCase() === 'gold';
  const mrp = isGold ? salePrice : Number(p.pricing?.mrp || salePrice || 0);

  let minPrice = Number(p.pricing?.minPrice || 0);
  let maxPrice = Number(p.pricing?.maxPrice || 0);

  if ((!minPrice || !maxPrice || minPrice === maxPrice) && Array.isArray(p.variants) && p.variants.length > 0) {
    const variantPrices = p.variants
      .map((v) => Number(v.pricing?.calculatedPrice || v.pricing?.salePrice || v.salePrice || v.price || 0))
      .filter((pr) => pr > 0);
    if (variantPrices.length > 0) {
      minPrice = Math.min(...variantPrices);
      maxPrice = Math.max(...variantPrices);
    }
  }

  if (!minPrice) minPrice = salePrice;
  if (!maxPrice) maxPrice = isGold ? salePrice : mrp;

  const categoryIds = Array.isArray(p.categoryIds) ? p.categoryIds : (p.categoryIds ? [p.categoryIds] : []);
  const menuItemIds = Array.isArray(p.menuItemIds) ? p.menuItemIds : (p.menuItemIds ? [p.menuItemIds] : []);
  const gender = p.basicInfo?.gender || [];

  const metalColors = extractMetalColors(p);
  const colorImages = formatColorImages(p.colorImages || p.representative?.colorImages || [], p);
  const metalColorIds = Array.isArray(p.metalColorIds)
    ? p.metalColorIds
    : (Array.isArray(p.representative?.metalColorIds) ? p.representative.metalColorIds : []);

  let selectedAttributes = undefined;
  if (p.productType === 'gold') {
    const firstVariant = Array.isArray(p.variants) && p.variants[0] ? p.variants[0] : null;
    const firstCenterRow = Array.isArray(p.centerDiamondRows) && p.centerDiamondRows[0] ? p.centerDiamondRows[0] : null;
    const firstMetalColor = metalColors[0]?.id || (Array.isArray(p.metalColorIds) ? p.metalColorIds[0] : null);

    selectedAttributes = {
      metalPurity: firstVariant?.metalPurityId || (Array.isArray(p.metalPurityIds) ? p.metalPurityIds[0] : null) || null,
      metalColor: firstVariant?.metalColorId || firstMetalColor || null,
      diamondType: firstVariant?.diamondTypeId || firstCenterRow?.diamondTypeId || null,
      diamondShape: firstVariant?.diamondShapeId || firstCenterRow?.diamondShapeId || null,
      diamondClarity: firstVariant?.diamondClarityId || firstCenterRow?.diamondClarityId || null,
      diamondColor: firstVariant?.diamondColorId || firstCenterRow?.diamondColorId || null,
      caratWeight: Number(firstVariant?.caratWeight ?? firstCenterRow?.caratWeight ?? 1.5),
      size: null,
      sizeRange: null,
    };
  }

  return {
    _id: p._id,
    images,
    image: images[0] || '',
    metalColors,
    colorImages,
    metalColorIds,
    basicInfo: {
      title,
      slug,
      description,
      gender,
    },
    pricing: {
      salePrice,
      mrp,
      minPrice,
      maxPrice,
    },
    isGroup,
    variantCount: p.variantCount || 0,
    categoryIds,
    menuItemIds,
    productType: p.productType || '',
    stockStatus: p.stockStatus || '',
    selectedAttributes,
  };
};

// ------------------------------- format home product ----------------------------
const formatHomeProduct = (p) => {
  return formatStorefrontProduct(p);
};

// ------------------------------- format storefront product detail ----------------------------
const formatStorefrontProductDetail = (p) => {
  if (!p) return null;

  const title = p.basicInfo?.title || '';
  const slug = p.basicInfo?.slug || '';
  const sku = p.basicInfo?.sku || '';
  const description = p.basicInfo?.description || '';
  const gender = p.basicInfo?.gender || [];

  const salePrice = Number(p.pricing?.salePrice || 0);
  const isGold = String(p.productType || '').toLowerCase() === 'gold';
  const mrp = isGold ? salePrice : Number(p.pricing?.mrp || salePrice || 0);

  let minPrice = Number(p.pricing?.minPrice || 0);
  let maxPrice = Number(p.pricing?.maxPrice || 0);

  if ((!minPrice || !maxPrice || minPrice === maxPrice) && Array.isArray(p.variants) && p.variants.length > 0) {
    const variantPrices = p.variants
      .map((v) => Number(v.pricing?.calculatedPrice || v.pricing?.salePrice || v.salePrice || v.price || 0))
      .filter((pr) => pr > 0);
    if (variantPrices.length > 0) {
      minPrice = Math.min(...variantPrices);
      maxPrice = Math.max(...variantPrices);
    }
  }

  if (!minPrice) minPrice = salePrice;
  if (!maxPrice) maxPrice = mrp || salePrice;
  const colorImages = Array.isArray(p.colorImages) ? p.colorImages : [];
  const hasColorImages = colorImages.some((ci) => Array.isArray(ci?.images) && ci.images.length > 0);
  const images = hasColorImages ? undefined : extractProductImages(p);
  const image = hasColorImages ? undefined : (images?.[0] || '');
  const rawMetalColors = extractMetalColors(p);
  const metalColors = rawMetalColors.map((c) => {
    const item = {
      _id: c._id || c.id ? String(c._id || c.id) : undefined,
      name: c.name || '',
      colorCode: c.colorCode || c.hex || '',
    };
    if (c.colorCodeEnd) item.colorCodeEnd = c.colorCodeEnd;
    return item;
  }).filter((c) => c.name);

  // Lean variant projection: strip dead 0-value fields and flatten nested populated duplicates
  const extractIdAndName = (item) => {
    if (!item) return { id: null, name: '' };
    if (typeof item === 'object') {
      const id = item._id ? String(item._id) : (item.id ? String(item.id) : null);
      return { id, name: item.name || '' };
    }
    const str = String(item).trim();
    const isId = /^[a-f0-9]{24}$/i.test(str);
    return { id: isId ? str : null, name: isId ? '' : str };
  };

  const variants = Array.isArray(p.variants)
    ? p.variants.map((v) => {
        const purity = extractIdAndName(v.metalPurityId || v.metalPurity);
        const color = extractIdAndName(v.diamondColorId || v.diamondColor);
        const clarity = extractIdAndName(v.diamondClarityId || v.diamondClarity);
        const dType = extractIdAndName(v.diamondTypeId || v.diamondType);
        const shape = extractIdAndName(v.diamondShapeId || v.diamondShape);
        const mColor = extractIdAndName(v.metalColorId || v.metalColor);

        const hasCenterConfig = Array.isArray(p.centerDiamondRows) && p.centerDiamondRows.length > 0;
        const centerWt = v.centerDiamondWeight !== undefined && v.centerDiamondWeight !== null
          ? Number(v.centerDiamondWeight)
          : (hasCenterConfig ? Number(v.caratWeight || 0) : 0);

        const item = {
          _id: v._id,
          sku: v.sku || '',
          combination: v.combination || '',
          price: Number(v.price || 0),
          stock: v.stock !== undefined ? v.stock : 10,
          caratWeight: Number(v.caratWeight || centerWt || 0),
          centerDiamondWeight: centerWt,
          centerDiamondCost: Number(v.centerDiamondCost || 0),
          sideDiamondWeight: Number(v.sideDiamondWeight || 0),
          sideDiamondCost: Number(v.sideDiamondCost || 0),
          diamondCost: Number(
            v.diamondCost !== undefined && v.diamondCost !== null
              ? v.diamondCost
              : (Number(v.centerDiamondCost || 0) + Number(v.sideDiamondCost || 0))
          ),
          metalCost: Number(v.metalCost || 0),
          metalRate: Number(v.metalRate || 0),
          metalWeight: Number(v.metalWeight || 0),
        };

        if (purity.name) {
          item.purity = purity.name;
          item.metalPurity = purity.name;
        }
        if (purity.id) item.metalPurityId = purity.id;

        if (color.name) {
          item.color = color.name;
          item.diamondColor = color.name;
        }
        if (color.id) item.diamondColorId = color.id;

        if (clarity.name) {
          item.clarity = clarity.name;
          item.diamondClarity = clarity.name;
        }
        if (clarity.id) item.diamondClarityId = clarity.id;

        if (dType.name) item.diamondType = dType.name;
        if (dType.id) item.diamondTypeId = dType.id;

        if (shape.name) item.diamondShape = shape.name;
        if (shape.id) item.diamondShapeId = shape.id;

        if (mColor.name) item.metalColor = mColor.name;
        if (mColor.id) item.metalColorId = mColor.id;

        if (v.labourCharge) item.labourCharge = Number(v.labourCharge);
        if (v.certificateCharge) item.certificateCharge = Number(v.certificateCharge);

        return item;
      })
    : [];

  const centerDiamondRows = Array.isArray(p.centerDiamondRows) ? p.centerDiamondRows : [];

  return {
    _id: p._id,
    ...(images ? { images } : {}),
    ...(image ? { image } : {}),
    metalColors,
    basicInfo: {
      title,
      slug,
      sku,
      description,
      gender,
    },
    productType: p.productType || 'gold',
    isOrnate: Boolean(p.isOrnate),
    categoryIds: Array.isArray(p.categoryIds) ? p.categoryIds : [],
    metalPurityIds: Array.isArray(p.metalPurityIds) ? p.metalPurityIds : [],
    colorImages,
    sizes: Array.isArray(p.sizeIds) && p.sizeIds.length > 0 && typeof p.sizeIds[0] === 'object'
      ? p.sizeIds.map((s) => ({ _id: String(s._id || s.id), name: s.name }))
      : (Array.isArray(p.sizes) ? p.sizes : (Array.isArray(p.sizeIds) ? p.sizeIds : [])),
    pricing: {
      ...(p.pricing || {}),
      salePrice,
      mrp,
      calculatedPrice: Number(p.pricing?.calculatedPrice || salePrice || 0),
      gstPercentage: Number(p.pricing?.gstPercentage ?? 3),
      minPrice,
      maxPrice,
    },
    specifications: {
      metalWeight: Number(p.specifications?.metalWeight || 0),
    },
    productSpecifications: Array.isArray(p.productSpecifications) ? p.productSpecifications : [],
    descriptionSections: Array.isArray(p.descriptionSections) ? p.descriptionSections : [],
    centerDiamondRows,
    sideDiamondRows: Array.isArray(p.sideDiamondRows) ? p.sideDiamondRows : [],
    variants,
    demoMetrics: {
      soldCount: Number(p.demoMetrics?.soldCount ?? 0),
      reviewCount: Number(p.demoMetrics?.reviewCount ?? 0),
    },
    certificateImage: p.certificateImage || null,
    inWishlist: Boolean(p.inWishlist),
    sizeChart: p.sizeChart || null,
    stockStatus: p.stockStatus || 'In Stock',
    seo: p.seo || undefined,
    ...(p.ornate ? {
      ornate: {
        tagNo: p.ornate.tagNo,
        barcode: p.ornate.barcode,
        itemCode: p.ornate.itemCode,
        ornateImages: p.ornate.ornateImages,
      }
    } : {}),
  };
};

// ------------------------------- format lookup product ----------------------------
const formatLookupProduct = (p) => {
  if (!p) return null;
  withColorStatuses(p);

  const title = p.basicInfo?.title || p.title || p.name || 'Untitled product';
  const sku = p.basicInfo?.sku || p.sku || p.ornate?.itemCode || p.ornate?.tagNo || '';
  const effectivePrice = Number(p.pricing?.salePrice || p.pricing?.mrp || p.cataloguePrice || 0);

  // Extract 1st photo from colorImages (first valid image that is not a video)
  let firstPhoto = '';
  if (Array.isArray(p.colorImages)) {
    for (const color of p.colorImages) {
      if (Array.isArray(color.images)) {
        for (const img of color.images) {
          const u = typeof img === 'string' ? img : img?.url;
          const mediaType = typeof img === 'object' ? img?.mediaType : '';
          if (u && typeof u === 'string' && u.trim() && mediaType !== 'video') {
            firstPhoto = u.trim();
            break;
          }
        }
      }
      if (firstPhoto) break;
    }
  }

  // Fallback to p.images, p.ornate.ornateImages, or p.image if colorImages has no photo
  if (!firstPhoto && Array.isArray(p.images)) {
    for (const img of p.images) {
      const u = typeof img === 'string' ? img : img?.url;
      if (u && typeof u === 'string' && u.trim() && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(u)) {
        firstPhoto = u.trim();
        break;
      }
    }
  }

  if (!firstPhoto && Array.isArray(p.ornate?.ornateImages)) {
    for (const img of p.ornate.ornateImages) {
      const u = typeof img === 'string' ? img : img?.url;
      if (u && typeof u === 'string' && u.trim() && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(u)) {
        firstPhoto = u.trim();
        break;
      }
    }
  }

  if (!firstPhoto && p.image) {
    const u = typeof p.image === 'string' ? p.image : p.image?.url;
    if (u && typeof u === 'string' && u.trim()) {
      firstPhoto = u.trim();
    }
  }

  // Format colorImages keeping only the 1st image photo for each color
  const formattedColorImages = Array.isArray(p.colorImages)
    ? p.colorImages
        .map((ci) => {
          if (!ci) return null;
          const validImgs = (ci.images || [])
            .filter((img) => img && (typeof img === 'string' || img?.mediaType !== 'video'))
            .map((img) => (typeof img === 'string' ? img : img?.url))
            .filter(Boolean);
          const photo = validImgs[0] || '';
          return {
            status: ci.status || 'active',
            metalColorId: ci.metalColorId || null,
            firstPhoto: photo,
            images: photo ? [{ url: photo, mediaType: 'image' }] : [],
          };
        })
        .filter(Boolean)
    : [];

  const resolvedCategory =
    Array.isArray(p.categoryIds) && p.categoryIds.length > 0 ? p.categoryIds : [];

  return {
    _id: p._id,
    title,
    sku,
    price: effectivePrice,
    basicInfo: p.basicInfo || {},
    pricing: String(p.productType || '').toLowerCase() === 'gold' && p.pricing
      ? { ...p.pricing, mrp: p.pricing.salePrice || effectivePrice }
      : (p.pricing || {}),
    categoryIds: resolvedCategory,
    status: p.status || 'draft',
    colorImages: formattedColorImages,
    firstPhoto,
    thumbnail: firstPhoto,
    productType: p.productType || '',
    isOrnate: Boolean(p.isOrnate),
    ornate: p.ornate || {},
  };
};

// ------------------------------- build product search filter ----------------------------
const buildProductSearchFilter = (search) => {
  if (!search || !String(search).trim()) return null;
  const searchRegex = new RegExp(String(search).trim(), 'i');
  return [
    { 'basicInfo.title': searchRegex },
    { 'basicInfo.sku': searchRegex },
    { 'ornate.tagNo': searchRegex },
    { 'ornate.barcode': searchRegex },
    { 'ornate.itemCode': searchRegex },
    { 'ornate.groupName': searchRegex },
    { 'ornate.customGroupName': searchRegex },
  ];
};

// ------------------------------- build product type filter ----------------------------
const buildProductTypeFilter = (productType, isOrnateSpecified = false) => {
  if (!productType) return null;
  const pt = String(productType).toLowerCase();
  if (pt === 'gold') {
    return { productType: 'gold' };
  }
  if (pt === 'silver') {
    return isOrnateSpecified
      ? { productType: 'silver' }
      : { productType: 'silver', isOrnate: { $ne: true } };
  }
  return { productType: pt };
};

// ------------------------------- build lookup product type filter ----------------------------
const buildLookupProductTypeFilter = (productType, isOrnateSpecified = false) => {
  if (!productType || productType === 'all') return null;
  const pt = String(productType).toLowerCase();
  if (pt === 'gold') {
    return { productType: 'gold' };
  }
  if (pt === 'silver') {
    return isOrnateSpecified
      ? { productType: 'silver' }
      : { productType: 'silver', isOrnate: { $ne: true } };
  }
  if (pt === 'ornate') {
    return { isOrnate: true };
  }
  return { productType: pt };
};

// ------------------------------- get effective price expression ----------------------------
const getEffectivePriceExpression = () => {
  return ['pricing.salePrice', 'pricing.mrp'].reduceRight(
    (fallback, field) => ({ $cond: [{ $gt: [`$${field}`, 0] }, `$${field}`, fallback] }),
    null
  );
};

// ------------------------------- build price range conditions ----------------------------
const buildPriceRangeConditions = (queryParams, effectivePrice) => {
  const priceConditions = [];
  for (const [parameter, operator] of [['minPrice', '$gte'], ['maxPrice', '$lte']]) {
    if (queryParams[parameter] !== undefined && queryParams[parameter] !== '') {
      const value = Number(queryParams[parameter]);
      if (!Number.isFinite(value) || value < 0) {
        throw new ApiError(400, 'Price must be a non-negative number');
      }
      priceConditions.push({ [operator]: [effectivePrice, value] });
    }
  }

  if (queryParams.minPrice && queryParams.maxPrice && Number(queryParams.minPrice) > Number(queryParams.maxPrice)) {
    throw new ApiError(400, 'Maximum price must be greater than minimum price');
  }

  return priceConditions;
};

// ------------------------------- get product populate options ----------------------------
const getProductPopulateOptions = () => {
  return [
    { path: 'categoryIds', select: 'name slug sizeChart sizingConfig', strictPopulate: false },
    { path: 'sizeIds', select: 'name _id', strictPopulate: false },
    { path: 'metalColorIds', select: 'name code colorCode colorCodeEnd', strictPopulate: false },
    { path: 'metalPurityIds', select: 'name karat metalType', strictPopulate: false },
    { path: 'colorImages.metalColorId', select: 'name code colorCode colorCodeEnd', strictPopulate: false },
    { path: 'variants.metalColorId', select: 'name code colorCode colorCodeEnd', strictPopulate: false },
    { path: 'variants.metalPurityId', select: 'name karat metalType', strictPopulate: false },
    { path: 'variants.diamondTypeId', select: 'name', strictPopulate: false },
    { path: 'variants.diamondShapeId', select: 'name', strictPopulate: false },
    { path: 'variants.diamondColorId', select: 'name', strictPopulate: false },
    { path: 'variants.diamondClarityId', select: 'name', strictPopulate: false },
  ];
};

// ------------------------------- format size chart ----------------------------
const formatSizeChart = (chart, categoryName = '') => {
  if (!chart) return null;
  const rawUrl = typeof chart === 'object' ? chart.url : chart;
  const rawKey = typeof chart === 'object' ? chart.key : '';
  if (!rawUrl) return null;
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return null;
  const resolvedUrl =
    trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')
      ? trimmed
      : `/${trimmed}`;
  const isPdf = /\.pdf($|\?)/i.test(resolvedUrl);

  let key = rawKey;
  if (!key && resolvedUrl) {
    const match = resolvedUrl.match(/categories\/[^\s?#]+/);
    if (match) key = match[0];
  }

  return {
    url: resolvedUrl,
    key: key || '',
    categoryName: categoryName || 'Jewelry',
    isPdf,
  };
};

// ------------------------------- extract size chart ----------------------------
const extractSizeChart = async (product) => {
  if (!product) return null;
  const Category = require('../category/category.model');
  const categories = Array.isArray(product.categoryIds)
    ? product.categoryIds
    : product.category
    ? [product.category]
    : [];

  for (const cat of categories) {
    if (cat && typeof cat === 'object') {
      const sc = cat.sizeChart;
      const scUrl = typeof sc === 'object' ? sc?.url : sc;
      if (scUrl) {
        return formatSizeChart(sc, cat.name);
      }
    }
  }

  // Fallback: check raw unpopulated category ObjectIds
  const rawIds = categories
    .map((c) => (c && typeof c === 'object' ? c._id : c))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (rawIds.length > 0) {
    const foundCat = await Category.findOne({
      _id: { $in: rawIds },
      $or: [
        { 'sizeChart.url': { $exists: true, $nin: ['', null] } },
        { sizeChart: { $type: 'string', $nin: ['', null] } },
      ],
    }).select('name sizeChart').lean();

    if (foundCat?.sizeChart) {
      return formatSizeChart(foundCat.sizeChart, foundCat.name);
    }
  }

  return null;
};

module.exports = {
  withColorStatuses,
  sanitizeColorImages,
  isPricingUnchanged,
  formatHomeProduct,
  formatStorefrontProduct,
  formatStorefrontProductDetail,
  extractProductImages,
  extractMetalColors,
  formatColorImages,
  formatLookupProduct,
  buildProductSearchFilter,
  buildProductTypeFilter,
  buildLookupProductTypeFilter,
  getEffectivePriceExpression,
  buildPriceRangeConditions,
  getProductPopulateOptions,
  extractSizeChart,
  formatSizeChart,
};
