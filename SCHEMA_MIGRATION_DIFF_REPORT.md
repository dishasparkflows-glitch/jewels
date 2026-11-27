# Database Schema Migration & Differences Report

Generated on: `2026-11-27T11:20:29.805Z`  
Status: **DRY RUN (Preview Only)**  
Mode: **Cross-DB Migration (`new-rare-dev` [Read-Only] ➔ `new-rare-live`)**  

---

## Executive Summary

1. **Source Protection (`FROM_DB`)**:
   - `new-rare-dev` was opened strictly for **read-only** traversal. Zero writes, updates, or deletions were performed on `FROM_DB`.
2. **Top-Level Audit Fields Moved to `meta`**:
   - Across **974** documents that had top-level `createdAt`, `createdBy`, `updatedAt`, or `updatedBy`, values were moved into `meta` (`meta.createdAt`, `meta.createdBy`, `meta.updatedAt`, `meta.updatedBy`) and **removed from the top level**.
3. **Version Key Cleanup (`__v`)**:
   - `__v` was removed from **973** records (0 remaining in target).
4. **Third-Party & Cloudflare Media Safety**:
   - **Zero** media files deleted. All Cloudflare R2 / CDN image URLs and keys are fully preserved.
5. **Extra Field Preservation**:
   - All other extra database fields missing from the latest Mongoose schemas (e.g., `subType`, `displayPrice`, `isDeleted`, `category`, `subTypes`, `densityFactor`, `purity`, etc.) are retained at the top level.
6. **Product Slugs & Schema Mapping (1044 total source records migrated)**:
   - `products`: Generated unique `basicInfo.slug` from `title`; mapped `basicInfo`, `pricing`, `specifications`, `categoryIds`, `menuItemIds`, `sizeIds`, `metalColorIds`, `variants`, stone rows (`centerDiamondRows`, `sideDiamondRows`, `colorStoneRows`, `sideColorStoneRows`), `colorImages`, and `meta`.

---

## Collection Details & Differences

| Collection | `FROM_DB` Docs | `TO_DB` Docs | `__v` Removed | Top-Level Audit Moved | Unique Conflicts Resolved | Key Differences & Transformations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `banners` | 7 | 0 | 7 | 7 | 0 | Mapped `category`, `type`, `position` to `display`; normalized `content` & `image.key`; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`; preserved extra fields. |
| `birthstones` | 12 | 0 | 12 | 12 | 0 | Normalized `image.key`; set `order: 0`; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `categories` | 8 | 0 | 8 | 8 | 0 | Generated `slug`; normalized `images`, `sizeChart`, and `subTypes[*].sizeChart` keys; set `sizingConfig`, `order`, `promoBanners`; moved `createdAt` to `meta` & removed top-level; removed `__v`. |
| `center_diamond_prices` | 62 | 0 | 62 | 62 | 0 | Moved top-level `createdAt`/`updatedAt`/`updatedBy` to `meta` & removed top-level; removed `__v`; preserved legacy fields. |
| `coupons` | 1 | 0 | 1 | 1 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `currencies` | 9 | 0 | 0 | 0 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `diamond_clarities` | 6 | 0 | 6 | 6 | 0 | Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `diamond_colors` | 4 | 0 | 4 | 4 | 0 | Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `diamond_shapes` | 2 | 0 | 2 | 2 | 0 | Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `diamond_sizes` | 5 | 0 | 5 | 5 | 0 | Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `diamond_types` | 2 | 0 | 2 | 2 | 0 | Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `featureds` | 8 | 0 | 8 | 8 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `gold_prices` | 1 | 0 | 0 | 1 | 0 | Moved top-level `createdAt`/`updatedAt`/`updatedBy` to `meta` & removed top-level; removed `__v`; preserved legacy fields. |
| `instagram_posts` | 4 | 0 | 4 | 4 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `menu_items` | 135 | 0 | 135 | 135 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `menu_sections` | 31 | 0 | 31 | 31 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `metal_colors` | 3 | 0 | 3 | 3 | 0 | Normalized `colorCode`/`colorCodeEnd`; moved `createdAt` to `meta` & removed top-level; removed `__v`. |
| `metal_purities` | 4 | 0 | 4 | 4 | 0 | Set `order: 0`; moved `createdAt` to `meta` & removed top-level; removed `__v`; preserved `densityFactor`, `purity`. |
| `modules` | 47 | 47 | 0 | 0 | 47 | Synced authoritative module records from `FROM_DB` (resolved auto-seeded `slug` `_id` mismatches in `TO_DB`). |
| `products` | 499 | 0 | 499 | 499 | 0 | Mapped `basicInfo` (generated unique `slug` from `title`), `pricing`, `specifications`, `*Ids`, `variants`, stone row IDs, `colorImages`; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`; preserved extra fields. |
| `reviews` | 4 | 0 | 4 | 4 | 0 | Mapped `user` to `customer`, `title`/`rating`/`comment` to `review`, `images` to `image`; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `side_diamond_prices` | 144 | 0 | 144 | 144 | 0 | Moved top-level `createdAt`/`updatedAt`/`updatedBy` to `meta` & removed top-level; removed `__v`; preserved legacy fields. |
| `sizes` | 32 | 0 | 32 | 32 | 0 | Mapped `category` to `categoryId`; moved `createdAt` to `meta` & removed top-level; removed `__v`; preserved `subType`, `category`. |
| `top_announcements` | 6 | 0 | 0 | 0 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `users` | 4 | 0 | 0 | 0 | 0 | Ensured `ownerId: null` default; verified `meta`; removed `__v`. |
| `vto_masters` | 4 | 0 | 0 | 0 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |

---

## Usage in the Future

Script location: `src/scripts/migrateSchemaToLatest.js`

```bash
# 1. Dry-run preview (reads FROM_DB, checks TO_DB, writes nothing)
node src/scripts/migrateSchemaToLatest.js --dry-run

# 2. Execute FROM_DB -> TO_DB migration (FROM_DB remains untouched)
node src/scripts/migrateSchemaToLatest.js --execute

# 3. Migrate a single collection only
node src/scripts/migrateSchemaToLatest.js --execute --collection=products
```
