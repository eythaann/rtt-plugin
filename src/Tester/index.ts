import chalk from 'chalk';
import { IConfig, RTFT_CONFIG } from '../Config/index';
import { indent, Logger } from './Logger';
import { FileTester, TestGroupResult, Status, Type } from './SingleFileTester';

export class ReadableTypesTester {
  readonly config: IConfig = RTFT_CONFIG;

  totalFiles = 0;
  totalFailFiles = 0;
  totalPassFiles = 0;

  total = 0;
  totalFail = 0;
  totalPass = 0;

  constructor(private readonly program: ts.Program) {}

  printDetails() {
    Logger.log()
      .log(chalk.whiteBright.bold('Resume:'))
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
      .timeEnd('Time')
      .log();

    if (this.config.verbose) {
      Logger.log('Used configuration:', this.config, '\n');
    }
  }

  printFileTestsResults(results: TestGroupResult[], sourceFile: ts.SourceFile, deep: number = 0) {
    results.forEach((describeResult) => {
      if (describeResult.status === Status.fail) {
        Logger.record();
        Logger.log(indent(deep + 1) + chalk.whiteBright(describeResult.description)).endRecord();
      } else if (this.config.verbose) {
        Logger.log(indent(deep + 1) + chalk.whiteBright(describeResult.description)).endRecord();
      }

      describeResult.tests.forEach((testResult) => {
        if (testResult.type === Type.group) {
          this.printFileTestsResults([testResult], sourceFile, deep + 1);
          return;
        }

        this.total++;

        if (testResult.status === Status.pass) {
          if (this.config.verbose) {
            Logger.log(indent(deep + 2) + chalk.green('✓'), chalk.grey(testResult.description));
          }
          this.totalPass++;
          return;
        }

        this.totalFail++;
        const errorPosition = sourceFile.getLineAndCharacterOfPosition(testResult.start);
        Logger.record()
          .log(indent(deep + 2) + chalk.red('⨯', testResult.description))
          .log();

        testResult.reason.forEach((line) => {
          Logger.log(indent(deep + 3) + line);
        });
        Logger.log();

        const startLineToShow = errorPosition.line < 3 ? errorPosition.line : errorPosition.line - 3;
        Array.from({ length: 7 }, (_v, i) => i + startLineToShow).forEach((line) => {
          const sign = line === errorPosition.line ? chalk.red.bold('> ') : '  ';
          Logger.log(chalk.gray(indent(deep + 2) + `${sign}${line + 1}|` + sourceFile.text.split('\n')[line]));
        });

        Logger
          .log()
          .log(indent(deep + 3) + 'at ' + chalk.blue(`${sourceFile.fileName}:${errorPosition.line + 1}:${errorPosition.character + 1}`))
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
        !this.config.include.some((rgx) => rgx.test(sourceFile.fileName))
        || this.config.exclude.some((rgx) => rgx.test(sourceFile.fileName))
      ) {
        return;
      }

      this.totalFiles++;
      const results = this.runIndividualTest(sourceFile);

      if (results.some((result) => result.status === Status.fail)) {
        this.totalFailFiles++;
        Logger.record()
          .log(chalk.bgRed.white(' FAIL '), chalk.gray(sourceFile.fileName))
          .endRecord();
      } else {
        this.totalPassFiles++;
        Logger.log(chalk.bgGreen.white(' PASS '), chalk.gray(sourceFile.fileName));
      }

      this.printFileTestsResults(results, sourceFile);
    });

    this.printDetails();
    return this.totalFail > 0 ? 1 : 0;
  }

  runIndividualTest(sourceFile: ts.SourceFile): TestGroupResult[] {
    return new FileTester(this.program, sourceFile).runTests();
  }
}
