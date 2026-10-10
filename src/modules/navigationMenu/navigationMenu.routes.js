const express = require('express');
const router = express.Router();
const navigationMenuController = require('./navigationMenu.controller');

// Main navigation menu routes
router
  .route('/')
  .get(navigationMenuController.getAll)
  .post(navigationMenuController.create);

router.post('/reorder', navigationMenuController.reorder);

router
  .route('/:id')
  .get(navigationMenuController.getOne)
  .put(navigationMenuController.update)
  .delete(navigationMenuController.delete);

// Sections under a menu
router
  .route('/:id/sections')
  .post(navigationMenuController.addSection);

router
  .route('/:id/sections/:sectionId')
  .put(navigationMenuController.updateSection)
  .delete(navigationMenuController.deleteSection);

// Items under a section
router
  .route('/:id/sections/:sectionId/items')
  .post(navigationMenuController.addMenuItem);

router
  .route('/:id/sections/:sectionId/items/:itemId')
  .put(navigationMenuController.updateMenuItem)
  .delete(navigationMenuController.deleteMenuItem);

// Banners under a menu
router
  .route('/:id/banners')
  .post(navigationMenuController.addBanner);

router
  .route('/:id/banners/:bannerId')
  .put(navigationMenuController.updateBanner)
  .delete(navigationMenuController.deleteBanner);

module.exports = router;
