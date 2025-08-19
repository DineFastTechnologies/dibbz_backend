// middleware/csrf.js
const csurf = require('csurf');

module.exports = csurf({ cookie: true });
