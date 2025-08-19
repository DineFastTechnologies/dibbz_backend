// middleware/sanitizer.js
const sanitize = (obj) => {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(/<script.*?>.*?<\/script>/gi, '');
      obj[key] = obj[key].replace(/' OR '1'='1'/gi, '');
    } else if (typeof obj[key] === 'object') {
      sanitize(obj[key]);
    }
  }
};

module.exports = (req, res, next) => {
  if (req.body) {
    sanitize(req.body);
  }
  if (req.query) {
    sanitize(req.query);
  }
  if (req.params) {
    sanitize(req.params);
  }
  next();
};
