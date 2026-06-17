"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['webview/__tests__/**/*.test.ts'],
        testTimeout: 10000,
    },
});
//# sourceMappingURL=vitest.ksa252.config.js.map