module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    moduleNameMapper: {
        '^uuid$': require.resolve('uuid')
    },
    transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        'test_browser.js',
        'test_login.js'
    ]
};
