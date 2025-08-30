describe('Test Setup', () => {
  it('should have TextEncoder polyfill', () => {
    expect(global.TextEncoder).toBeDefined();
  });

  it('should have TextDecoder polyfill', () => {
    expect(global.TextDecoder).toBeDefined();
  });

  it('should have mocked console methods', () => {
    expect(console.log).toBeDefined();
    expect(console.warn).toBeDefined();
    expect(console.error).toBeDefined();
    expect(console.debug).toBeDefined();
  });
});
