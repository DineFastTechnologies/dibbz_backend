const express = require("express");
const router = express.Router();
const searchController = require("../controller/searchController");

router.post("/search", searchController.storeSearch);

module.exports = router;