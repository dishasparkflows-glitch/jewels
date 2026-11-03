/**
 * Standard API response helper
 */
class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200) {
    let resData = data;
    let resMessage = message;
    if (typeof data === 'string' && message === 'Success') {
      resMessage = data;
      resData = null;
    }

    const payload = {
      success: true,
      message: resMessage,
    };

    if (resData !== null && resData !== undefined) {
      payload.data = resData;
    }

    return res.status(statusCode).json(payload);
  }

  static created(res, data = null, message = 'Created successfully') {
    let resData = data;
    let resMessage = message;
    if (typeof data === 'string' && message === 'Created successfully') {
      resMessage = data;
      resData = null;
    }

    const payload = {
      success: true,
      message: resMessage,
    };

    if (resData !== null && resData !== undefined) {
      payload.data = resData;
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
