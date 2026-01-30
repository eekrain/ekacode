export function testFunction(a: string, b?: number): boolean {
  return Boolean(a && b);
}

export interface TestInterface {
  foo: string;
}

export interface BaseInterface {
  base: string;
}

export interface DerivedInterface extends BaseInterface {
  extra: number;
}

export type TestType = {
  bar: number;
  baz?: string;
};

export class TestClass implements TestInterface {
  foo: string = "x";
}

export const testSymbol = 1;
