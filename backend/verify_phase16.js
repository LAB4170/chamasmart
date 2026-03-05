const { createChamaSchema } = require('./utils/validationSchemas');
const Joi = require('joi');

console.log('--- TESTING sharePrice VALIDATION ---');

const testCases = [
  { label: 'ASCA with valid sharePrice', data: { chamaName: 'Test', chamaType: 'ASCA', contributionAmount: 100, contributionFrequency: 'MONTHLY', meetingDay: 'Mon', sharePrice: 500 } },
  { label: 'Table Banking with empty sharePrice', data: { chamaName: 'Test', chamaType: 'TABLE_BANKING', contributionAmount: 100, contributionFrequency: 'MONTHLY', meetingDay: 'Mon', sharePrice: "" } },
  { label: 'Table Banking with null sharePrice', data: { chamaName: 'Test', chamaType: 'TABLE_BANKING', contributionAmount: 100, contributionFrequency: 'MONTHLY', meetingDay: 'Mon', sharePrice: null } },
  { label: 'Table Banking without sharePrice', data: { chamaName: 'Test', chamaType: 'TABLE_BANKING', contributionAmount: 100, contributionFrequency: 'MONTHLY', meetingDay: 'Mon' } }
];

testCases.forEach(tc => {
  const { error } = createChamaSchema.validate(tc.data);
  if (error) {
    console.log(`❌ ${tc.label} FAILED: ${error.message}`);
  } else {
    console.log(`✅ ${tc.label} PASSED`);
  }
});

console.log('\n--- CHECKING CONTROLLER COMPILATION ---');
try {
  require('./controllers/contributionController');
  console.log('✅ contributionController compiled successfully');
} catch (e) {
  console.log(`❌ contributionController FAILED compilation: ${e.message}`);
}
