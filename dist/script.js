"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compile = void 0;
const typescript_1 = __importDefault(require("typescript"));
const utils_1 = require("./utils");
const rt_options = {
    noEmit: true,
};
function compile() {
    const configFile = typescript_1.default.readConfigFile('tsconfig.json', typescript_1.default.sys.readFile);
    const parsedConfig = typescript_1.default.parseJsonConfigFileContent(configFile.config, typescript_1.default.sys, './');
    const program = typescript_1.default.createProgram(parsedConfig.fileNames, { ...parsedConfig.options, ...rt_options });
    const RTT = new utils_1.ReadableTypesTester(program, {
        includedRegexs: [/.*(\.spec-types\.ts)$/],
    });
    const exitCode = RTT.runTests();
    process.exit(exitCode);
}
exports.compile = compile;
