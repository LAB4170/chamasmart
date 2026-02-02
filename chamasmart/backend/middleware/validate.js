const Joi = require('joi');

const validate = (schema, property = 'body') => (req, res, next) => {
  try {
    const { error } = schema.validate(req[property], { abortEarly: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: errorMessage,
      });
    }

    next();
  } catch (err) {
    console.error('Validation middleware crash:', err);
    next(err);
  }
};

module.exports = validate;
