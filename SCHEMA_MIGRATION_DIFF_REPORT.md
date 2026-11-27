# Database Schema Migration & Differences Report

Generated on: `2026-11-27T10:16:14.540Z`  
Status: **DRY RUN (Preview Only)**  
Mode: **Cross-DB Migration (`new-rare-live` [Read-Only] ➔ `new-rare-dev`)**  

---

## Executive Summary

1. **Source Protection (`FROM_DB`)**:
   - `new-rare-live` was opened strictly for **read-only** traversal. Zero writes, updates, or deletions were performed on `FROM_DB`.
2. **Top-Level Audit Fields Moved to `meta`**:
   - Across **0** documents that had top-level `createdAt`, `createdBy`, `updatedAt`, or `updatedBy`, values were moved into `meta` (`meta.createdAt`, `meta.createdBy`, `meta.updatedAt`, `meta.updatedBy`) and **removed from the top level**.
3. **Version Key Cleanup (`__v`)**:
   - `__v` was removed from **0** records (0 remaining in target).
4. **Third-Party & Cloudflare Media Safety**:
   - **Zero** media files deleted. All Cloudflare R2 / CDN image URLs and keys are fully preserved.
5. **Extra Field Preservation**:
   - All other extra database fields missing from the latest Mongoose schemas (e.g., `subType`, `displayPrice`, `isDeleted`, `category`, `subTypes`, `densityFactor`, `purity`, etc.) are retained at the top level.
6. **Product Slugs & Schema Mapping (47 total source records migrated)**:
   - `products`: Generated unique `basicInfo.slug` from `title`; mapped `basicInfo`, `pricing`, `specifications`, `categoryIds`, `menuItemIds`, `sizeIds`, `metalColorIds`, `variants`, stone rows (`centerDiamondRows`, `sideDiamondRows`, `colorStoneRows`, `sideColorStoneRows`), `colorImages`, and `meta`.

---

## Collection Details & Differences

| Collection | `FROM_DB` Docs | `TO_DB` Docs | `__v` Removed | Top-Level Audit Moved | Unique Conflicts Resolved | Key Differences & Transformations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `modules` | 47 | 47 | 0 | 0 | 47 | Synced authoritative module records from `FROM_DB` (resolved auto-seeded `slug` `_id` mismatches in `TO_DB`). |

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

# 4. In-place mode against MONGODB_URI (optional)
node src/scripts/migrateSchemaToLatest.js --in-place --execute
```
