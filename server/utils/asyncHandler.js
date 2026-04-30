/**
 * Wrapper for asynchronous controller functions to eliminate the need for repetitive try-catch blocks.
 * If a promise rejects, it passes the error to the next express error-handling middleware.
 * 
 * @param {Function} requestHandler - The asynchronous controller function
 * @returns {Function} - Wrapped middleware function
 */
const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

module.exports = asyncHandler;
