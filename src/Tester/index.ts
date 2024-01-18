import chalk from 'chalk';
import { IConfig, RTFT_CONFIG } from '../Config/index';
import { Logger } from './Logger';
import { FileTester, TestGroup, TestStatus } from './SingleFileTester';

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
      .end('Time')
      .log();

    if (this.config.verbose) {
      Logger.log('Used configuration:', this.config, '\n');
    }
  }

  printTestsResults(results: TestGroup[], sourceFile: ts.SourceFile) {
    results.forEach((describeResult) => {
      if (describeResult.status === TestStatus.fail) {
        Logger.record();
        Logger.log('  ' + chalk.whiteBright(describeResult.description)).endRecord();
      } else if (this.config.verbose) {
        Logger.log('  ' + chalk.whiteBright(describeResult.description)).endRecord();
      }

      describeResult.tests.forEach((testResult) => {
        this.total++;

        if (testResult.status === TestStatus.pass) {
          if (this.config.verbose) {
            Logger.log('    ' + chalk.green('✓'), chalk.grey(testResult.description));
          }
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
        !this.config.include.some((rgx) => rgx.test(sourceFile.fileName))
        || this.config.exclude.some((rgx) => rgx.test(sourceFile.fileName))
      ) {
        return;
      }

      this.totalFiles++;
      const results = this.runIndividualTest(sourceFile);

      if (results.some((result) => result.status === TestStatus.fail)) {
        this.totalFailFiles++;
        Logger.record()
          .log(chalk.bgRed.white(' FAIL '), chalk.gray(sourceFile.fileName))
          .endRecord();
      } else {
        this.totalPassFiles++;
        Logger.log(chalk.bgGreen.white(' PASS '), chalk.gray(sourceFile.fileName));
      }

      this.printTestsResults(results, sourceFile);
    });

    this.printDetails();
    return this.totalFail > 0 ? 1 : 0;
  }

  runIndividualTest(sourceFile: ts.SourceFile): TestGroup[] {
    return new FileTester(this.program, sourceFile).runTests();
  }
}
