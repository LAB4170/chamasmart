module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Custom rules for ChamaSmart backend
    'no-console': 'warn', // Allow console in development, warn in production
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // Allow unused variables starting with _
    'consistent-return': 'error', // Require consistent return statements
    'prefer-const': 'error', // Require const when possible
    'no-var': 'error', // Disallow var, use let/const
    'object-shorthand': 'error', // Use object shorthand when possible
    'prefer-template': 'error', // Use template literals over string concatenation
    'template-curly-spacing': 'error', // Enforce consistent spacing in template literals
    'arrow-spacing': 'error', // Enforce spacing around arrow functions
    'comma-dangle': ['error', 'always-multiline'], // Require trailing commas in multiline
    'max-len': ['error', { code: 120, ignoreUrls: true }], // Max line length 120 chars
    'indent': ['error', 2], // 2 space indentation
    'quotes': ['error', 'single'], // Use single quotes
    'semi': ['error', 'always'], // Require semicolons
    'no-trailing-spaces': 'error', // No trailing spaces
    'eol-last': 'error', // Files must end with newline
    'comma-spacing': 'error', // Enforce spacing after commas
    'key-spacing': 'error', // Enforce spacing in object literals
    'space-infix-ops': 'error', // Enforce spacing around operators
    'space-before-blocks': 'error', // Enforce spacing before blocks
    'brace-style': ['error', '1tbs'], // One true brace style
    'curly': 'error', // Require braces for all control statements
    'no-multiple-empty-lines': ['error', { max: 2 }], // Limit consecutive empty lines
    'padded-blocks': ['error', 'never'], // No padding in blocks
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always',
    }], // Spacing before function parentheses
    'func-names': 'error', // Require function expressions to have names
    'prefer-arrow-callback': 'error', // Prefer arrow callbacks
    'arrow-parens': ['error', 'as-needed'], // Arrow function parentheses
    'no-param-reassign': ['error', { props: false }], // Allow parameter reassignment for objects
    'no-shadow': ['error', { allow: ['req', 'res', 'err'] }], // Allow common parameter names
    'no-underscore-dangle': 'off', // Allow underscore dangle for private methods
    'class-methods-use-this': 'off', // Don't require this usage in class methods
    'import/prefer-default-export': 'off', // Don't require default exports
    'import/no-unresolved': 'off', // Turn off for now due to module resolution
    'import/extensions': 'off', // Turn off file extension requirements
    'no-restricted-syntax': ['error', {
      selector: 'ForInStatement',
      message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
    }, {
      selector: 'LabeledStatement',
      message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
    }, {
      selector: 'WithStatement',
      message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
    }],
    // Security rules
    'no-eval': 'error', // Disallow eval
    'no-implied-eval': 'error', // Disallow implied eval
    'no-new-func': 'error', // Disallow new Function
    'no-script-url': 'error', // Disallow script URLs
    // Performance rules
    'no-loop-func': 'error', // Disallow functions in loops
    'no-inner-declarations': 'error', // Disallow function declarations in blocks
    // Error handling rules
    'prefer-promise-reject-errors': 'error', // Require Promise rejection with Error objects
    'no-throw-literal': 'error', // Disallow throwing literals as errors
    // Async/await rules
    'prefer-async-await': 'error', // Prefer async/await over Promise chains
    'require-await': 'error', // Disallow async functions without await
    'no-await-in-loop': 'error', // Disallow await in loops
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true,
      },
      rules: {
        'no-unused-expressions': 'off', // Allow expect statements
        'max-len': 'off', // Allow longer lines in tests
        'no-magic-numbers': 'off', // Allow magic numbers in tests
      },
    },
    {
      files: ['migrations/**/*.js', 'scripts/**/*.js'],
      rules: {
        'no-console': 'off', // Allow console in migration scripts
        'no-unused-vars': 'off', // Allow unused vars in scripts
      },
    },
    {
      files: ['server.js'],
      rules: {
        'no-console': 'off', // Allow console in main server file
      },
    },
  ],
};
