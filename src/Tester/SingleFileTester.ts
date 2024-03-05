import chalk from 'chalk';
import ts from 'typescript';
import { indent } from './Logger';

export enum Status {
  pass = 'pass',
  fail = 'fail',
}

export enum Type {
  group = 'group',
  test = 'test',
}

export interface TestGroupResult {
  type: Type.group;
  status: Status;
  description: string;
  start?: number;
  length?: number;
  tests: (TestGroupResult | SingleTestResult)[];
}

interface TestFail {
  type: Type.test;
  status: Status.fail;
  reason: string[];
  description: string;
  start: number;
  length: number;
}

interface TestPass {
  type: Type.test;
  status: Status.pass;
  description: string;
}

type SingleTestResult = TestFail | TestPass;

export class FileTester {
  testsResults: TestGroupResult[] = [];

  constructor(
    private readonly program: ts.Program,
    private readonly sourceFile: ts.SourceFile
  ) {}

  getRecieveAndExpected(node: ts.CallExpression) {
    const typeChecker = this.program.getTypeChecker();
    let recieveTypeString: string | null = null;

    if (ts.isPropertyAccessExpression(node.expression)) {
      const leftExpression = node.expression.expression;
      const assertType = typeChecker.getTypeAtLocation(leftExpression);
      if ((assertType as any)?.resolvedTypeArguments?.[0]) {
        recieveTypeString = typeChecker.typeToString((assertType as any).resolvedTypeArguments[0]);
      }
    }

    const ExpectedType = node.typeArguments?.[0] ? typeChecker.getTypeFromTypeNode(node.typeArguments[0]) : null;

    return {
      recieve: recieveTypeString || 'Error displaying recieve type, please check it in the code manually.',
      expected: ExpectedType ? typeChecker.typeToString(ExpectedType) : null,
    };
  }

  visitAssert(result: SingleTestResult, node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const typeChecker = this.program.getTypeChecker();
      const signature = typeChecker.getResolvedSignature(node);
      const returnType = signature ? typeChecker.typeToString(typeChecker.getReturnTypeOfSignature(signature)) : null;

      if (!returnType || !returnType.includes('RTT_FAIL')) {
        return;
      }

      const errorMessage = returnType.slice(returnType.indexOf('<') + 2, -2);
      const simpleExpected = errorMessage.slice(errorMessage.indexOf('`') + 1, -1);
      const { recieve, expected } = this.getRecieveAndExpected(node);

      Object.assign(result, {
        status: Status.fail,
        start: node.getStart(),
        length: node.getWidth(),
        reason: [
          chalk.red('Recieved:',),
          indent(1) + recieve,
          chalk.green('Expected:',),
          indent(1) + (expected || simpleExpected),
          '',
          chalk.red('Error: ', errorMessage),
        ],
      });
    }

    ts.forEachChild(node, this.visitAssert.bind(this, result));
  }

  visitTest(group: TestGroupResult, node: ts.Node) {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || !['testType', 'test'].includes(node.expression.text)) {
      return;
    }

    const testResult: SingleTestResult = {
      type: Type.test,
      status: Status.pass,
      //@ts-ignore
      description: node.arguments[0]?.text || '',
    } as SingleTestResult;

    const cb = node.arguments[1];
    if (!cb) {
      return;
    }

    if (ts.isFunctionLike(cb)) {
      this.visitAssert(testResult, (cb as any).body);
    }

    if (ts.isArrayLiteralExpression(cb)) {
      cb.elements.forEach((node) => {
        this.visitAssert(testResult, node);
      });
    }

    if (ts.isObjectLiteralExpression(cb)) {
      cb.properties.forEach((node) => {
        if (!ts.isPropertyAssignment(node) || !ts.isCallExpression(node.initializer)) {
          return;
        }
        this.visitAssert(testResult, node.initializer);
      });
    }

    if (testResult.status === Status.fail) {
      group.status = Status.fail;
    }
    group.tests.push(testResult);
  }

  visitDescribes(parentGroup: TestGroupResult | null, node: ts.Node) {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || !['describeType', 'describe'].includes(node.expression.text)) {
      return;
    }

    const cb = node.arguments[1];
    if (!cb || !ts.isFunctionLike(cb)) {
      return;
    }

    const group: TestGroupResult = {
      type: Type.group,
      //@ts-ignore
      description: node.arguments[0]?.text || '',
      status: Status.pass,
      tests: [],
    };

    ts.forEachChild((cb as any).body, (node) => {
      ts.forEachChild(node, this.visitTest.bind(this, group));
      ts.forEachChild(node, this.visitDescribes.bind(this, group));
    });

    if (parentGroup) {
      parentGroup.tests.push(group);

      if (group.status === Status.fail) {
        parentGroup.status = Status.fail;
      }
    } else {
      this.testsResults.push(group);
    }
  }

  runTests(): TestGroupResult[] {
    ts.forEachChild(this.sourceFile, (node) => {
      ts.forEachChild(node, this.visitDescribes.bind(this, null));
    });
    return this.testsResults;
  }
}