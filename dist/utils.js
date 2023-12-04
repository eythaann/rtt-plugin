"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadableTypesTester = exports.getProxy = void 0;
const chalk_1 = __importDefault(require("chalk"));
const typescript_1 = __importDefault(require("typescript"));
const getProxy = (obj) => {
    const proxy = Object.create(null);
    for (const key of Object.keys(obj)) {
        const x = obj[key];
        proxy[key] = ((...args) => x.apply(obj, args));
    }
    return proxy;
};
exports.getProxy = getProxy;
const Logger = {
    recording: false,
    records: [],
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
    end(label) {
        console.timeEnd(label);
        return this;
    },
    log(...v) {
        console.log(...v);
        if (this.recording) {
            this.records.push(v);
        }
        return this;
    },
};
class ReadableTypesTester {
    program;
    config;
    totalFiles = 0;
    totalFailFiles = 0;
    totalPassFiles = 0;
    total = 0;
    totalFail = 0;
    totalPass = 0;
    constructor(program, config) {
        this.program = program;
        this.config = config;
    }
    printDetails() {
        Logger.log()
            .log('Resume:')
            .log()
            .printRecords()
            .log('Tests:', chalk_1.default.red.bold(this.totalFail, 'Failed'), chalk_1.default.green.bold(this.totalPass, 'Passed'), chalk_1.default.grey.bold(this.total, 'total'))
            .log('Tests Suites:', chalk_1.default.red.bold(this.totalFailFiles, 'Failed'), chalk_1.default.green.bold(this.totalPassFiles, 'Passed'), chalk_1.default.grey.bold(this.totalFiles, 'total'))
            .end('Time')
            .log();
    }
    printTestsResults(results, sourceFile) {
        /*
        console.log('    ' + chalk.grey(node.arguments[0].getFullText().slice(1, -1))); */
        results.forEach((describeResult) => {
            if (describeResult.status === TestStatus.fail) {
                Logger.record();
            }
            Logger.log('  ' + chalk_1.default.whiteBright(describeResult.description)).endRecord();
            describeResult.tests.forEach((testResult) => {
                this.total++;
                if (testResult.status === TestStatus.pass) {
                    console.log('    ' + chalk_1.default.green('✓'), chalk_1.default.grey(testResult.description));
                    this.totalPass++;
                    return;
                }
                this.totalFail++;
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(testResult.start);
                Logger.record()
                    .log('    ' + chalk_1.default.red('⨯', testResult.description))
                    .log()
                    .log('      ' + chalk_1.default.red('Error:', testResult.reason))
                    .log('      at ' + chalk_1.default.blue(`${sourceFile.fileName}:${line + 1}:${character + 1}`))
                    .log()
                    .endRecord();
            });
        });
    }
    runTests() {
        console.time('Time');
        const sourceFiles = this.program.getSourceFiles();
        sourceFiles.forEach((sourceFile) => {
            if (!this.config.includedRegexs.some((rgx) => rgx.test(sourceFile.fileName))) {
                return;
            }
            this.totalFiles++;
            const results = this.runIndividualTest(sourceFile);
            if (results.some((result) => result.status === TestStatus.fail)) {
                this.totalFailFiles++;
                Logger.record()
                    .log(chalk_1.default.bgRed.whiteBright(' FAIL '), sourceFile.fileName)
                    .endRecord();
            }
            else {
                this.totalPassFiles++;
                Logger.log(chalk_1.default.bgGreen.whiteBright(' PASS '), sourceFile.fileName);
            }
            this.printTestsResults(results, sourceFile);
        });
        this.printDetails();
        return this.totalFail > 0 ? 1 : 0;
    }
    runIndividualTest(sourceFile) {
        return new FileTester(this.program, this.config, sourceFile).runTests();
    }
}
exports.ReadableTypesTester = ReadableTypesTester;
var TestStatus;
(function (TestStatus) {
    TestStatus["pass"] = "pass";
    TestStatus["fail"] = "fail";
})(TestStatus || (TestStatus = {}));
var Type;
(function (Type) {
    Type["group"] = "group";
    Type["test"] = "test";
})(Type || (Type = {}));
class FileTester {
    program;
    config;
    sourceFile;
    testsResults = [];
    constructor(program, config, sourceFile) {
        this.program = program;
        this.config = config;
        this.sourceFile = sourceFile;
        this.visit = this.visit.bind(this);
        this.visitTest = this.visitTest.bind(this);
        this.visitAssert = this.visitAssert.bind(this);
    }
    visitAssert(node) {
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
            };
        }
    }
    visitTest(node) {
        if (!typescript_1.default.isCallExpression(node) || !typescript_1.default.isIdentifier(node.expression) || node.expression.text !== 'testType') {
            return;
        }
        let testResult = {
            type: Type.test,
            status: TestStatus.pass,
            //@ts-ignore
            description: node.arguments[0]?.text || '',
        };
        const cb = node.arguments[1];
        if (!cb) {
            return;
        }
        if (typescript_1.default.isFunctionLike(cb)) {
            typescript_1.default.forEachChild(cb.body, (node) => {
                typescript_1.default.forEachChild(node, (node) => {
                    if (!typescript_1.default.isCallExpression(node)) {
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
        if (typescript_1.default.isArrayLiteralExpression(cb)) {
            cb.elements.forEach((node) => {
                if (!typescript_1.default.isCallExpression(node)) {
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
            this.testsResults.at(-1).status = TestStatus.fail;
        }
        this.testsResults.at(-1).tests.push(testResult);
    }
    visit(node) {
        if (!typescript_1.default.isCallExpression(node) || !typescript_1.default.isIdentifier(node.expression) || node.expression.text !== 'describeType') {
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
        if (!cb || !typescript_1.default.isFunctionLike(cb)) {
            return;
        }
        typescript_1.default.forEachChild(cb.body, (node) => {
            typescript_1.default.forEachChild(node, this.visitTest);
        });
    }
    runTests() {
        typescript_1.default.forEachChild(this.sourceFile, (node) => {
            typescript_1.default.forEachChild(node, this.visit);
        });
        return this.testsResults;
    }
}
