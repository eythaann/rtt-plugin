import { LanguageServicePlugin } from './LaguageServicePlugin';

//@ts-ignore
globalThis.assertType = () => ({
//@ts-ignore
  not: globalThis.assertType,
  //@ts-ignore
  awaited: globalThis.assertType,
  //@ts-ignore
  returned: globalThis.assertType,
  equals() {},
  isSuperTypeOf() {},
  isAssignableTo() {},
  isSubTypeOf() {},
  toBeTrue() {},
  toBeFalse() {},
  toBeNever() {},
  toBeNull() {},
  toBeUndefined() {},
  toBeAny() {},
  toBeUnknow() {},
  toBeObject() {},
  toBeStrictObject() {},
  toBeFunction() {},
  toBeArray() {},
  toBeTuple() {},
  toBeTupleWithLength() {},
  toBeString() {},
  toBeNumber() {},
  toBeBoolean() {},
  toBePromise() {},
  toHaveProperty() {},
  __internal: {
    shouldBe() {},
  },
});
//@ts-ignore
globalThis.testType = () => {};
//@ts-ignore
globalThis.describeType = () => {};

module.exports = LanguageServicePlugin;