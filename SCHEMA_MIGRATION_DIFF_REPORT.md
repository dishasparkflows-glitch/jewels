# Database Schema Migration & Differences Report

Generated on: `2026-11-27T12:39:01.634Z`  
Status: **DRY RUN (Preview Only)**  
Mode: **Cross-DB Migration (`new-rare-dev` [Read-Only] ➔ `new-rare-live`)**  

---

## Executive Summary

1. **Source Protection (`FROM_DB` & `MASTER_DB`)**:
   - `new-rare-dev` (`FROM_DB`) and `new-neirah` (`MASTER_DB`) were opened strictly for **read-only** traversal. Zero writes, updates, or deletions were performed on source databases.
2. **Soft-Delete Filtering & Cleanup**:
   - **62** records with `isDeleted: true` in `FROM_DB` were **skipped** and not migrated to `TO_DB`.
   - Top-level `isDeleted` (`isDeleted: false`) was stripped from all migrated records (soft deletion is represented by `meta.deletedAt: null`).
3. **Top-Level Audit Fields Moved to `meta`**:
   - Across **912** documents that had top-level `createdAt`, `createdBy`, `updatedAt`, or `updatedBy`, values were moved into `meta` (`meta.createdAt`, `meta.createdBy`, `meta.updatedAt`, `meta.updatedBy`) and **removed from the top level**.
4. **Version Key Cleanup (`__v`)**:
   - `__v` was removed from **911** records (0 remaining in target).
5. **Third-Party & Cloudflare Media Safety**:
   - **Zero** media files deleted. All Cloudflare R2 / CDN image URLs and keys are fully preserved.
6. **Mapped vs Extra Field Handling**:
   - Legacy top-level fields mapped into nested/renamed model fields (e.g., `title`, `sku`, `description`, `gstPercentage`, `baseMetalWeight`, `baseLabourCharge`, `certificateCharge`, `otherAmountPercentage`, `displayPrice`, `category`, `menuItem`, `size`, `metalColors`, `gender`, `position`, `user`, `rating`, `comment`, `images`, etc.) are **removed from the top level**.
   - Genuinely extra database fields missing from the latest Mongoose schemas (e.g., `birthMonth`, `subTypes`, `densityFactor`, `purity`, `video`, etc.) are retained at the top level (while `featured` and `subType` are explicitly skipped from `products`).
7. **Product Slugs & Schema Mapping (993 active source records migrated)**:
   - `products`: Set `productType: "gold"` & `isOrnate: false`; mapped `status` (`active` ➔ `approved`, `inactive` ➔ `draft`); converted `promoBanner` strings to MongoDB `ObjectId`; generated unique `basicInfo.slug` from `title`; mapped `basicInfo`, `pricing`, `specifications`, `categoryIds`, `menuItemIds`, `sizeIds`, `metalColorIds`, `variants`, stone rows (`centerDiamondRows`, `sideDiamondRows`, `colorStoneRows`, `sideColorStoneRows`), `colorImages`, and `meta`; removed mapped legacy fields plus `featured` and `subType` from top level and subdocuments.

---

## Collection Details & Differences

| Collection | `FROM_DB` Active | Skipped (`isDeleted: true`) | `TO_DB` Docs | `__v` Removed | Top-Level Audit Moved | Unique Conflicts Resolved | Key Differences & Transformations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `banners` | 7 | 0 | 7 | 7 | 7 | 0 | Mapped `category`, `type`, `position`, `mediaType` to `display` & `image`; removed mapped top-level keys; moved audit to `meta`; removed `__v` & `isDeleted`; kept `video`. |
| `birthstones` | 12 | 0 | 12 | 12 | 12 | 0 | Normalized `image.key`; set `order: 0`; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `categories` | 5 | 3 | 5 | 5 | 5 | 0 | Generated `slug`; normalized `images`, `sizeChart`, and `subTypes[*].sizeChart` keys; set `sizingConfig`, `order`, `promoBanners`; moved audit to `meta`; removed `__v` & `isDeleted`. |
| `center_diamond_prices` | 62 | 0 | 62 | 62 | 62 | 0 | Moved top-level `createdAt`/`updatedAt`/`updatedBy` to `meta` & removed top-level; removed `__v`; preserved legacy fields. |
| `coupons` | 1 | 0 | 1 | 1 | 1 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `currencies` | 9 | 0 | 9 | 0 | 0 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `diamond_clarities` | 6 | 0 | 6 | 6 | 6 | 0 | Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `diamond_colors` | 4 | 0 | 4 | 4 | 4 | 0 | Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `diamond_shapes` | 2 | 0 | 2 | 2 | 2 | 0 | Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `diamond_sizes` | 0 | 5 | 0 | 0 | 0 | 0 | Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `diamond_types` | 2 | 0 | 2 | 2 | 2 | 0 | Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`. |
| `featureds` | 8 | 0 | 8 | 8 | 8 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `gold_prices` | 1 | 0 | 1 | 0 | 1 | 0 | Moved top-level `createdAt`/`updatedAt`/`updatedBy` to `meta` & removed top-level; removed `__v`; preserved legacy fields. |
| `instagram_posts` | 4 | 0 | 4 | 4 | 4 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `menu_items` | 93 | 42 | 93 | 93 | 93 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `menu_sections` | 26 | 5 | 26 | 26 | 26 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `metal_colors` | 3 | 0 | 3 | 3 | 3 | 0 | Normalized `colorCode`/`colorCodeEnd`; moved `createdAt` to `meta` & removed top-level; removed `__v`. |
| `metal_purities` | 3 | 1 | 3 | 3 | 3 | 0 | Set `order: 0`; moved `createdAt` to `meta` & removed top-level; removed `__v`; preserved `densityFactor`, `purity`. |
| `products` | 499 | 0 | 499 | 499 | 499 | 0 | Set `productType: "gold"`, `isOrnate: false`; mapped `status` (`active`->`approved`, `inactive`->`draft`); converted `promoBanner` to `ObjectId[]`; mapped `basicInfo` (unique `slug`), `pricing`, `specifications`, `*Ids`, `variants`, stone rows, `colorImages`; removed mapped legacy keys plus `featured` & `subType`; moved audit to `meta`; removed `__v` & `isDeleted`; kept `birthMonth`. |
| `reviews` | 4 | 0 | 4 | 4 | 4 | 0 | Mapped `user`, `title`, `rating`, `comment`, `images` to `customer`, `review`, `image`; removed mapped top-level keys; moved audit to `meta`; removed `__v`. |
| `side_diamond_prices` | 144 | 0 | 144 | 144 | 144 | 0 | Moved top-level `createdAt`/`updatedAt`/`updatedBy` to `meta` & removed top-level; removed `__v`; preserved legacy fields. |
| `sizes` | 26 | 6 | 26 | 26 | 26 | 0 | Mapped `category` to `categoryId` & removed top-level `category`; moved audit to `meta`; removed `__v` & `isDeleted`; kept `subType`. |
| `users` | 4 | 0 | 4 | 0 | 0 | 0 | Ensured `ownerId: null` default; verified `meta`; removed `__v`. |
| `vto_masters` | 4 | 0 | 4 | 0 | 0 | 0 | Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`. |
| `top_announcements` | 6 | 0 | 6 | 0 | 0 | 0 | Synced from `MASTER_DB` (`new-neirah`); verified `meta` & removed `__v` / `isDeleted`. |
| `modules` | 47 | 0 | 47 | 0 | 0 | 47 | Synced from `MASTER_DB` (`new-neirah`); resolved any `slug` `_id` conflicts in `TO_DB`; verified `meta` & removed `__v`. |
| `filters` | 10 | 0 | 10 | 0 | 0 | 0 | Synced from `MASTER_DB` (`new-neirah`); rebuilt `categoryConfigs` with `TO_DB` category `_id`s & `slug`s (preserving `priceRanges` & slug config matching). |
| `settings` | 1 | 0 | 1 | 0 | 0 | 0 | Synced from `MASTER_DB` (`new-neirah`); normalized image keys, cleaned `trustBadges`, validated `currentThemeId` against `TO_DB.themes`, ensured `meta`. |

---

## Usage in the Future

Script location: `src/scripts/migrateSchemaToLatest.js`

```bash
# 1. Dry-run preview (reads FROM_DB, checks TO_DB, writes nothing)
node src/scripts/migrateSchemaToLatest.js --dry-run

# 2. Execute full migration (FROM_DB -> TO_DB, plus filters, settings, top_announcements & modules from MASTER_DB)
node src/scripts/migrateSchemaToLatest.js --execute

# 3. Migrate or sync a single collection only
node src/scripts/migrateSchemaToLatest.js --execute --collection=products
node src/scripts/migrateSchemaToLatest.js --execute --collection=filters
node src/scripts/migrateSchemaToLatest.js --execute --collection=settings
node src/scripts/migrateSchemaToLatest.js --execute --collection=top_announcements
node src/scripts/migrateSchemaToLatest.js --execute --collection=modules
```
