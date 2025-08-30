// Global test setup
import { TextEncoder, TextDecoder } from 'util';

// Polyfills for Node.js environment
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// Mock console methods for cleaner test output
const originalConsole = global.console;

beforeEach(() => {
  // Reset console mocks before each test
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
});

afterEach(() => {
  // Restore original console after each test
  global.console = originalConsole;
});

// Global timeout for async tests
jest.setTimeout(30000);
