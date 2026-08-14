module.exports = {
    env: {
        browser: true,
        es2022: true,
        node: true
    },
    globals: {
        firebase: 'readonly'
    },
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    extends: ['eslint:recommended'],
    rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-console': 'off',
        'no-undef': 'error'
    }
};