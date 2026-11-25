/**
 * Master Registry of All System Modules
 * Single source of truth used by:
 * 1. Admin Owners UI (to load and assign accessible modules per client/website)
 * 2. Backend Module Access Middleware (to enforce API route permissions)
 * 3. Admin Navigation & Route Guards
 */
const SYSTEM_MODULES = [
  // ─── General ─────────────────────────────────────────
  {
    id: 'dashboard',
    title: 'Dashboard',
    group: 'General',
    path: '/dashboard',
    apiPrefixes: ['/dashboard'],
  },

  // ─── Catalog ─────────────────────────────────────────
  {
    id: 'jewelry-products',
    title: 'Jewellery Products',
    group: 'Catalog',
    path: '/catalog/jewelry-products',
    apiPrefixes: ['/products', '/product-groups', '/upload'],
  },
  {
    id: 'silver-products',
    title: 'Silver Products',
    group: 'Catalog',
    path: '/catalog/silver-products',
    apiPrefixes: ['/products', '/product-groups', '/upload'],
  },
  {
    id: 'ornate-products',
    title: 'Ornate Products',
    group: 'Catalog',
    path: '/catalog/ornate-products',
    apiPrefixes: ['/ornate', '/products', '/upload'],
  },
  {
    id: 'diamonds',
    title: 'Diamonds',
    group: 'Catalog',
    path: '/diamonds',
    apiPrefixes: ['/diamonds', '/upload'],
  },
  {
    id: 'categories',
    title: 'Categories',
    group: 'Catalog',
    path: '/catalog/categories',
    apiPrefixes: ['/categories', '/upload'],
  },
  {
    id: 'category-filters',
    title: 'Category Filters',
    group: 'Catalog',
    path: '/catalog/category-filters',
    apiPrefixes: ['/filters', '/categories'],
  },
  {
    id: 'navigation-menus',
    title: 'Navigation Menus',
    group: 'Catalog',
    path: '/catalog/navigation-menus',
    apiPrefixes: ['/menu-items', '/menu-sections'],
  },

  // ─── Pricing Hub ─────────────────────────────────────
  {
    id: 'metal-rates',
    title: 'Metal Rates',
    group: 'Pricing Hub',
    path: '/pricing-hub/metal-rates',
    apiPrefixes: ['/goldprice', '/gold-rates'],
  },
  {
    id: 'diamond-rates',
    title: 'Diamond Rates',
    group: 'Pricing Hub',
    path: '/pricing-hub/diamond-rates',
    apiPrefixes: ['/diamond-prices', '/center-diamond-prices', '/side-diamond-prices'],
  },
  {
    id: 'currencies',
    title: 'Currencies',
    group: 'Pricing Hub',
    path: '/currencies',
    apiPrefixes: ['/currencies'],
  },

  // ─── Product Config ──────────────────────────────────
  {
    id: 'metal-purity',
    title: 'Metal Purity',
    group: 'Product Config',
    path: '/metal-purity',
    apiPrefixes: ['/metal-purities'],
  },
  {
    id: 'metal-color',
    title: 'Metal Color',
    group: 'Product Config',
    path: '/metal-color',
    apiPrefixes: ['/metal-colors'],
  },
  {
    id: 'sizes',
    title: 'Sizes',
    group: 'Product Config',
    path: '/sizes',
    apiPrefixes: ['/sizes'],
  },
  {
    id: 'vto-masters',
    title: 'VTO Masters',
    group: 'Product Config',
    path: '/vto-masters',
    apiPrefixes: ['/vto-masters'],
  },

  // ─── Diamond Config ──────────────────────────────────
  {
    id: 'diamond-types',
    title: 'Diamond Types',
    group: 'Diamond Config',
    path: '/diamond-types',
    apiPrefixes: ['/diamond-types'],
  },
  {
    id: 'diamond-shapes',
    title: 'Diamond Shapes',
    group: 'Diamond Config',
    path: '/diamond-shapes',
    apiPrefixes: ['/diamond-shapes'],
  },
  {
    id: 'diamond-color',
    title: 'Diamond Color',
    group: 'Diamond Config',
    path: '/diamond-color',
    apiPrefixes: ['/diamond-colors'],
  },
  {
    id: 'diamond-clarity',
    title: 'Diamond Clarity',
    group: 'Diamond Config',
    path: '/diamond-clarity',
    apiPrefixes: ['/diamond-clarities'],
  },
  {
    id: 'diamond-size',
    title: 'Diamond Size',
    group: 'Diamond Config',
    path: '/diamond-size',
    apiPrefixes: ['/diamond-sizes'],
  },

  // ─── Gemstone Config ─────────────────────────────────
  {
    id: 'gemstone-types',
    title: 'Gemstone Types',
    group: 'Gemstone Config',
    path: '/gemstone-types',
    apiPrefixes: ['/gemstone-types'],
  },
  {
    id: 'gemstone-shapes',
    title: 'Gemstone Shapes',
    group: 'Gemstone Config',
    path: '/gemstone-shapes',
    apiPrefixes: ['/gemstone-shapes'],
  },

  // ─── Sales & Orders ──────────────────────────────────
  {
    id: 'all-orders',
    title: 'Orders',
    group: 'Sales & Orders',
    path: '/orders',
    apiPrefixes: ['/orders', '/payments', '/logistics', '/shiprocket'],
  },
  {
    id: 'returns',
    title: 'Returns',
    group: 'Sales & Orders',
    path: '/returns',
    apiPrefixes: ['/returns'],
  },
  {
    id: 'custom-inquiries',
    title: 'Custom Inquiries',
    group: 'Sales & Orders',
    path: '/custom-inquiries',
    apiPrefixes: ['/custom-inquiries'],
  },
  {
    id: 'cod-sequence',
    title: 'COD Sequence',
    group: 'Sales & Orders',
    path: '/cod-sequences',
    apiPrefixes: ['/cod-sequences'],
  },

  // ─── Customer Hub ────────────────────────────────────
  {
    id: 'customers',
    title: 'Customers',
    group: 'Customer Hub',
    path: '/customers',
    apiPrefixes: ['/users', '/addresses', '/cart', '/wishlist'],
  },
  {
    id: 'appointments',
    title: 'Appointments',
    group: 'Customer Hub',
    path: '/appointments',
    apiPrefixes: ['/appointments'],
  },
  {
    id: 'reviews',
    title: 'Reviews',
    group: 'Customer Hub',
    path: '/reviews',
    apiPrefixes: ['/reviews'],
  },

  // ─── Marketing & Storefront ──────────────────────────
  {
    id: 'home-sections',
    title: 'Home Sections',
    group: 'Storefront',
    path: '/home-sections',
    apiPrefixes: ['/home-sections'],
  },
  {
    id: 'banners',
    title: 'Banners',
    group: 'Storefront',
    path: '/banners',
    apiPrefixes: ['/banners', '/top-announcements'],
  },
  {
    id: 'celebrate-gifts',
    title: 'Celebrate & Gifts',
    group: 'Promotions & Gifts',
    path: '/celebrate-gifts',
    apiPrefixes: ['/featured'],
  },
  {
    id: 'offers',
    title: 'Offers',
    group: 'Promotions & Gifts',
    path: '/coupons',
    apiPrefixes: ['/coupons'],
  },
  {
    id: 'birthstones',
    title: 'Birthstones',
    group: 'Jewelry Collections',
    path: '/birthstones',
    apiPrefixes: ['/birthstones'],
  },
  {
    id: 'before-after',
    title: 'Lookare Before/After',
    group: 'Jewelry Collections',
    path: '/marketing/before-after',
    apiPrefixes: ['/cust-jewellery-before-after'],
  },
  {
    id: 'gallery',
    title: 'Media Gallery',
    group: 'Content & Social',
    path: '/gallery',
    apiPrefixes: ['/gallery', '/upload'],
  },
  {
    id: 'themes',
    title: 'Themes',
    group: 'Content & Social',
    path: '/themes',
    apiPrefixes: ['/themes'],
  },
  {
    id: 'instagram',
    title: 'Instagram Posts',
    group: 'Content & Social',
    path: '/instagram-posts',
    apiPrefixes: ['/instagram-posts'],
  },
  {
    id: 'blogs',
    title: 'Blog Articles',
    group: 'Content & Social',
    path: '/blogs',
    apiPrefixes: ['/blogs'],
  },
  {
    id: 'blog-categories',
    title: 'Blog Categories',
    group: 'Content & Social',
    path: '/blog-categories',
    apiPrefixes: ['/blog-categories'],
  },
  {
    id: 'static-pages',
    title: 'Static Pages',
    group: 'Content & Social',
    path: '/static-pages',
    apiPrefixes: ['/static-pages'],
  },

  // ─── Analytics & Administration ──────────────────────
  {
    id: 'reports',
    title: 'Reports',
    group: 'Analytics & Administration',
    path: '/reports',
    apiPrefixes: ['/analytics'],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Connect',
    group: 'Analytics & Administration',
    path: '/system/whatsapp',
    apiPrefixes: ['/whatsapp'],
  },
  {
    id: 'profile',
    title: 'User Profile & Theme',
    group: 'Analytics & Administration',
    path: '/profile',
    apiPrefixes: ['/users/me'],
  },
  {
    id: 'settings',
    title: 'Settings',
    group: 'Analytics & Administration',
    path: '/settings',
    apiPrefixes: ['/settings'],
  },
];

const VALID_MODULE_IDS = new Set(SYSTEM_MODULES.map((m) => m.id));

/**
 * Given a request path (relative to /api, e.g. '/orders/123'), returns matching module IDs.
 * Returns empty array if path is unmapped/system-level.
 */
function getModulesForApiPath(reqPath = '') {
  const normalized = '/' + String(reqPath || '').replace(/^\/+/, '').toLowerCase();
  const matched = [];

  for (const mod of SYSTEM_MODULES) {
    for (const prefix of mod.apiPrefixes || []) {
      const p = prefix.toLowerCase();
      if (normalized === p || normalized.startsWith(`${p}/`)) {
        matched.push(mod.id);
        break;
      }
    }
  }

  return matched;
}

module.exports = {
  SYSTEM_MODULES,
  VALID_MODULE_IDS,
  getModulesForApiPath,
};
