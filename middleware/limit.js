// middleware/limit.js
const express = require('express');

module.exports = express.json({ limit: '10kb' });
