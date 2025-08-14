require('dotenv').config({ quiet: true });
const JWT_SECRET = process.env.JWT_SECRET;
const jwt = require('jsonwebtoken');

const authMiddleware = (req,res,next) => {
  const authheader = req.headers.authorization;

  if(!authheader || !authheader.startsWith('Bearer ')){
    return res.status(403).json({});
  }

  const token = authheader.split(' ')[1];

  try{
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  }
  catch(err){
    return req.status(403).json({});
  }
};

module.exports = {
  authMiddleware
}

