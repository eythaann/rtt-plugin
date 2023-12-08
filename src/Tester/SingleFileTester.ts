import ts from 'typescript';

export enum TestStatus {
  pass = 'pass',
  fail = 'fail',
}

export enum Type {
  group = 'group',
  test = 'test',
}

export interface TestGroup {
  type: Type;
  status: TestStatus;
  description: string;
  start?: number;
  length?: number;
  tests: TestResult[];
}

export interface TestFail {
  type: Type.test;
  status: TestStatus.fail;
  reason: string;
  description: string;
  start: number;
  length: number;
}

export interface TestPass {
  type: Type.test;
  status: TestStatus.pass;
  description: string;
}

export type TestResult = TestFail | TestPass;

export class SingleFileTester {
  testsResults: TestGroup[] = [];

  constructor(
    private readonly program: ts.Program,
    private readonly sourceFile: ts.SourceFile
  ) {
    this.visit = this.visit.bind(this);
    this.visitTest = this.visitTest.bind(this);
    this.visitAssert = this.visitAssert.bind(this);
  }

  visitAssert(node: ts.CallExpression) {
    const typeChecker = this.program.getTypeChecker();

    const signature = typeChecker.getResolvedSignature(node);

    if (!signature) {
      return;
    }

    const returnType = typeChecker.typeToString(typeChecker.getReturnTypeOfSignature(signature));

    if (returnType.includes('RTT_FAIL')) {
      return {
        type: Type.test,
        status: TestStatus.fail,
        start: node.getStart(),
        length: node.getWidth(),
        reason: returnType.slice(returnType.indexOf('<') + 1, -1),
      } as TestFail;
    }
  }

  visitTest(node: ts.Node) {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'testType') {
      return;
    }

    let testResult = {
      type: Type.test,
      status: TestStatus.pass,
      //@ts-ignore
      description: node.arguments[0]?.text || '',
    } as TestResult;

    const cb = node.arguments[1];
    if (!cb) {
      return;
    }

    if (ts.isFunctionLike(cb)) {
      ts.forEachChild(cb.body, (node) => {
        ts.forEachChild(node, (node) => {
          if (!ts.isCallExpression(node)) {
            return;
          }
          const result = this.visitAssert(node);
          if (result && result.status === TestStatus.fail) {
            testResult = {
              ...testResult,
              ...result,
            };
          }
        });
      });
    }

    if (ts.isArrayLiteralExpression(cb)) {
      cb.elements.forEach((node) => {
        if (!ts.isCallExpression(node)) {
          return;
        }
        const result = this.visitAssert(node);
        if (result && result.status === TestStatus.fail) {
          testResult = {
            ...testResult,
            ...result,
          };
        }
      });
    }

    if (testResult.status === TestStatus.fail) {
      this.testsResults.at(-1)!.status = TestStatus.fail;
    }
    this.testsResults.at(-1)!.tests.push(testResult);
  }

  visit(node: ts.Node) {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'describeType') {
      return;
    }

    this.testsResults.push({
      type: Type.group,
      //@ts-ignore
      description: node.arguments[0]?.text || '',
      status: TestStatus.pass,
      tests: [],
    });

    const cb = node.arguments[1];
    if (!cb || !ts.isFunctionLike(cb)) {
      return;
    }

    ts.forEachChild(cb.body, (node) => {
      ts.forEachChild(node, this.visitTest);
    });
  }

  runTests(): TestGroup[] {
    ts.forEachChild(this.sourceFile, (node) => {
      ts.forEachChild(node, this.visit);
    });
    return this.testsResults;
  }
}