/**
 * Standard API response helper
 */
class ApiResponse {
  /**
   * Determine whether the 'data' field should be included in the response.
   * - GET requests include the 'data' field.
   * - Non-GET requests (POST, PUT, PATCH, DELETE) return only 'success' and 'message'.
   * - Essential data-returning endpoints (auth, upload, coupon validation) or explicit forceData retain 'data'.
   */
  static shouldIncludeData(res, forceData = false) {
    if (forceData) return true;

    const method = (res?.req?.method || res?.request?.method || '').toUpperCase();
    if (method === 'GET') return true;

    const url = (res?.req?.originalUrl || res?.req?.url || '').toLowerCase();
    const isEssentialDataRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/google') ||
      url.includes('/upload') ||
      url.includes('/coupons/validate');

    return isEssentialDataRoute;
  }

  static success(res, data = null, message = 'Success', statusCode = 200, forceData = false) {
    const payload = {
      success: true,
      message,
    };

    if (this.shouldIncludeData(res, forceData)) {
      payload.data = data;
    }

    return res.status(statusCode).json(payload);
  }

  static created(res, data = null, message = 'Created successfully', forceData = false) {
    const payload = {
      success: true,
      message,
    };

    if (this.shouldIncludeData(res, forceData)) {
      payload.data = data;
    }

    return res.status(201).json(payload);
  }

  static paginated(res, data, pagination, message = 'Success', facets) {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination,
      ...(facets ? { facets } : {}),
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
