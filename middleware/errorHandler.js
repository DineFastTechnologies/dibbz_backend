// middleware/errorHandler.js

const handleValidationError = (err, res) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return res.status(400).json({ success: false, error: message });
};

const handleDuplicateFieldsError = (err, res) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return res.status(400).json({ success: false, error: message });
};

const handleCastError = (err, res) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return res.status(400).json({ success: false, error: message });
};

const handleJWTError = (res) => res.status(401).json({ success: false, error: 'Invalid token. Please log in again!' });

const handleJWTExpiredError = (res) => res.status(401).json({ success: false, error: 'Your token has expired! Please log in again.' });

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    let error = { ...err };
    error.message = err.message;

    if (error.name === 'ValidationError') error = handleValidationError(error, res);
    if (error.code === 11000) error = handleDuplicateFieldsError(error, res);
    if (error.name === 'CastError') error = handleCastError(error, res);
    if (error.name === 'JsonWebTokenError') return handleJWTError(res);
    if (error.name === 'TokenExpiredError') return handleJWTExpiredError(res);

    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message
    });
  }

  console.error('ERROR 💥', err);
  return res.status(500).json({
    success: false,
    status: 'error',
    message: 'Something went very wrong!'
  });
};
