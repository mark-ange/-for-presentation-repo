const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../config/firebase');

const getTokenAlgorithm = (token) => {
  const decoded = jwt.decode(token, { complete: true });
  return decoded && decoded.header ? decoded.header.alg : null;
};

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
    if (!token || token.split('.').length !== 3 || token.split('.').some((segment) => !segment)) {
      return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
    }
    
    if (getTokenAlgorithm(token) === 'RS256') {
      try {
        const decodedToken = await auth.verifyIdToken(token);
        req.firebaseUser = decodedToken;
        req.user = {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email,
          role: 'resident'
        };
        req.authSource = 'firebase';
        return next();
      } catch {
        return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
      }
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
    }

    try {
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User no longer exists' });
      }
      req.authSource = 'jwt';
      return next();
    } catch (error) {
      return next(error);
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && (
    req.user.role === 'admin' ||
    req.user.role === 'clenro_officer' ||
    req.user.role === 'CLENRO Central Admin' ||
    req.user.role === 'CLENRO Staff'
  )) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied: Administrator privileges required' });
  }
};

module.exports = { protect, adminOnly };
