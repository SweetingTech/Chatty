import '@types/jest';

declare global {
  namespace jest {
    interface Expect extends jest.Matchers<void> {
      toBe(expected: any): void;
      toEqual(expected: any): void;
      toBeUndefined(): void;
      toBeDefined(): void;
      toHaveLength(length: number): void;
      toHaveBeenCalledWith(...args: any[]): void;
      toThrow(message?: string | RegExp): void;
      resolves: jest.Matchers<Promise<any>>;
      rejects: jest.Matchers<Promise<any>>;
    }
  }
}

export {};
