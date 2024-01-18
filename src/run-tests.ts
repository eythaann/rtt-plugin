#!/usr/bin/env node

if (process.argv.includes('--help')) {
  console.log(`
usage: rtft [<args>] <?path>
args:
  --verbose             See all the info about tests.
  --include=<regex>     Regex to include files (ignore rt.config.ts).
  --exclude=<regex>     Regex to exclude files (ignore rt.config.ts).

  --help                Show this message.
`);
  process.exit(0);
}

import ts from 'typescript';
import { ReadableTypesTester } from './Tester/index';

const rt_options: ts.CompilerOptions = {
  noEmit: true,
};

const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, './');
const program = ts.createProgram(parsedConfig.fileNames, { ...parsedConfig.options, ...rt_options });

process.exit(new ReadableTypesTester(program).runTests());