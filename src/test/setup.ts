/**
 * Test setup file
 * Mocks the VS Code API before running tests
 */

import * as Module from 'module';

// Create mock for vscode module
const vscode = require('./vscode-mock');

// Mock the vscode module
const originalRequire = Module.prototype.require;

(Module.prototype.require as any) = function (id: string) {
    if (id === 'vscode') {
        return vscode;
    }
    return originalRequire.apply(this, arguments as any);
};