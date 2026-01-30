import { TestInterface, testSymbol } from "./alpha";

export const useSymbol = testSymbol + 1;

class Impl implements TestInterface {
  foo = "y";
}

export { Impl };
