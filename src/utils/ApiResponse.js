/**
 * Standard API response helper
 */
const { serializeMedia } = require('./media');
class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200, options = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data: options.includeMediaKeys ? data : serializeMedia(data),
    });
  }

  static created(res, data = null, message = 'Created successfully') {
    return res.status(201).json({
      success: true,
      message,
      data: serializeMedia(data),
    });
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data: serializeMedia(data),
      pagination,
    });
  }

  static error(res, message = 'Something went wrong', statusCode = 500) {
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}

module.exports = ApiResponse;
