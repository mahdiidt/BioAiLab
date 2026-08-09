/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  // Log full detail server-side only.
  console.error('[bioai-lab-backend] Unhandled error:', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our end. Please try again.',
    },
  });
}

module.exports = errorHandler;
