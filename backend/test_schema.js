const { updateProfileSchema } = require('./utils/validationSchemas');
const Joi = require('joi');

const testData = {
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com'
};

const { error } = updateProfileSchema.validate(testData);

if (error) {
  console.log('Validation FAILED:');
  console.log(error.details.map(d => d.message));
} else {
  console.log('Validation PASSED!');
}
