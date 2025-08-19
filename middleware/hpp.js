// middleware/hpp.js
const hpp = require('hpp');

module.exports = hpp({
  whitelist: [
    'isPureVeg',
    'foodCategory',
    'lat',
    'lng',
    'radiusKm'
  ]
});
