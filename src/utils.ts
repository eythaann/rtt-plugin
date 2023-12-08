import chalk from 'chalk';
import ts from 'typescript';

export const getProxy = <T extends Record<string, any>>(obj: T): T => {
  const proxy: T = Object.create(null);
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const x = obj[key];
    proxy[key] = ((...args: any[]) => x.apply(obj, args)) as any;
  }
  return proxy;
};

interface Config {
  includedRegexs: RegExp[];
  excludedRegexs: RegExp[];
}

const Logger = {
  recording: false,
  records: [] as any[],
  record() {
    this.recording = true;
    return this;
  },
  printRecords() {
    this.records.forEach((record) => console.log(...[record].flat()));
    return this;
  },
  endRecord() {
    this.recording = false;
    return this;
  },
  end(label: string) {
    console.timeEnd(label);
    return this;
  },
  log(...v: any[]) {
    console.log(...v);
    if (this.recording) {
      this.records.push(v);
    }
    return this;
  },
};

export class ReadableTypesTester {
  totalFiles = 0;
  totalFailFiles = 0;
  totalPassFiles = 0;

  total = 0;
  totalFail = 0;
  totalPass = 0;

  constructor(private readonly program: ts.Program, private readonly config: Config) {}

  printDetails() {
    Logger.log()
      .log('Resume:')
      .log()
      .printRecords()
      .log(
        'Tests:',
        chalk.red.bold(this.totalFail, 'Failed'),
        chalk.green.bold(this.totalPass, 'Passed'),
        chalk.grey.bold(this.total, 'total')
      )
      .log(
        'Tests Suites:',
        chalk.red.bold(this.totalFailFiles, 'Failed'),
        chalk.green.bold(this.totalPassFiles, 'Passed'),
        chalk.grey.bold(this.totalFiles, 'total')
      )
      .end('Time')
      .log();
  }

  printTestsResults(results: TestGroup[], sourceFile: ts.SourceFile) {
    /*
    console.log('    ' + chalk.grey(node.arguments[0].getFullText().slice(1, -1))); */
    results.forEach((describeResult) => {
      if (describeResult.status === TestStatus.fail) {
        Logger.record();
      }

      Logger.log('  ' + chalk.whiteBright(describeResult.description)).endRecord();

      describeResult.tests.forEach((testResult) => {
        this.total++;

        if (testResult.status === TestStatus.pass) {
          console.log('    ' + chalk.green('✓'), chalk.grey(testResult.description));
          this.totalPass++;
          return;
        }

        this.totalFail++;
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(testResult.start);
        Logger.record()
          .log('    ' + chalk.red('⨯', testResult.description))
          .log()
          .log('      ' + chalk.red('Error:', testResult.reason))
          .log('      at ' + chalk.blue(`${sourceFile.fileName}:${line + 1}:${character + 1}`))
          .log()
          .endRecord();
      });
    });
  }

  runTests() {
    console.time('Time');
    const sourceFiles = this.program.getSourceFiles();
    sourceFiles.forEach((sourceFile) => {
      if (
        !this.config.includedRegexs.some((rgx) => rgx.test(sourceFile.fileName))
        || this.config.excludedRegexs.some((rgx) => rgx.test(sourceFile.fileName))
      ) {
        return;
      }

      this.totalFiles++;
      const results = this.runIndividualTest(sourceFile);

      if (results.some((result) => result.status === TestStatus.fail)) {
        this.totalFailFiles++;
        Logger.record()
          .log(chalk.bgRed.whiteBright(' FAIL '), sourceFile.fileName)
          .endRecord();
      } else {
        this.totalPassFiles++;
        Logger.log(chalk.bgGreen.whiteBright(' PASS '), sourceFile.fileName);
      }

      this.printTestsResults(results, sourceFile);
    });

    this.printDetails();
    return this.totalFail > 0 ? 1 : 0;
  }

  runIndividualTest(sourceFile: ts.SourceFile): TestGroup[] {
    return new FileTester(this.program, this.config, sourceFile).runTests();
  }
}

enum TestStatus {
  pass = 'pass',
  fail = 'fail',
}

enum Type {
  group = 'group',
  test = 'test',
}

interface TestGroup {
  type: Type;
  status: TestStatus;
  description: string;
  start?: number;
  length?: number;
  tests: TestResult[];
}

interface TestFail {
  type: Type.test;
  status: TestStatus.fail;
  reason: string;
  description: string;
  start: number;
  length: number;
}

interface TestPass {
  type: Type.test;
  status: TestStatus.pass;
  description: string;
}

type TestResult = TestFail | TestPass;

class FileTester {
  testsResults: TestGroup[] = [];

  constructor(
    private readonly program: ts.Program,
    private readonly config: Config,
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