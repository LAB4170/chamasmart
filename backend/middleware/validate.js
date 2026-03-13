const Joi = require('joi');

const validate = (schema, property = 'body') => (req, res, next) => {
  try {
    const { error } = schema.validate(req[property], { abortEarly: false });

    if (error) {
      const errors = error.details.map(d => d.message);
      console.log(`[Validation Error] [${property}]:`, errors);
      console.log(`[Request Body]:`, JSON.stringify(req.body, null, 2));
      console.log(`[Schema Keys]:`, schema._ids?._byKey ? Array.from(schema._ids._byKey.keys()) : 'Unknown');

      return res.status(400).json({
        success: false,
        message: error.details[0].message,
        details: error.details.map(d => d.message),
      });
    }


    next();
  } catch (err) {
    console.error('Validation middleware crash:', err);
    next(err);
  }
};

module.exports = validate;
