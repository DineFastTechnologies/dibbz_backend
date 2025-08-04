const express = require("express");
const router = express.Router();
const searchController = require("../controller/searchController");

router.post("/search", searchController.storeSearch);
router.get("/recent/:userId", searchController.getRecentSearches);

module.exports = router;