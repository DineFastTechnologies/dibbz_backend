// middleware/roles.js

const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  RESTAURANT_OWNER: 'restaurant_owner',
  STAFF: 'staff'
};

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const rolesArray = [...allowedRoles];
    const result = rolesArray.includes(req.user.role);

    if (!result) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    next();
  };
};

module.exports = {
  ROLES,
  checkRole
};
