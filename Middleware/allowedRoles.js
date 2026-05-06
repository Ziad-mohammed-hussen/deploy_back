const allowedRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.role) {
      return res.status(401).json({ message: "Unauthorized: Role not found" });
    }
    const isAllowed = roles.includes(req.role);
    if (!isAllowed) {
      return res.status(403).json({ message: "Forbidden: You don't have permission" });
    }
    next();
  };
};

module.exports = allowedRoles;