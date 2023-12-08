#!/usr/bin/env node
import ts from 'typescript';
import { ReadableTypesTester } from './utils';
import defaultConfig from '../../rt.config';
//@ts-ignore
import clientConfig from '../../../rt.config';

const rt_options: ts.CompilerOptions = {
  noEmit: true,
};

const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, './');
const program = ts.createProgram(parsedConfig.fileNames, { ...parsedConfig.options, ...rt_options });

const includedRegexs: string[] = clientConfig.testing.include || defaultConfig.testing.include;
const excludedRegexs: string[] = clientConfig.testing.include || defaultConfig.testing.include;

const RTT = new ReadableTypesTester(program, {
  includedRegexs: includedRegexs.map((rgx) => RegExp(`/${rgx}/`)),
  excludedRegexs: excludedRegexs.map((rgx) => RegExp(`/${rgx}/`)),
});

const exitCode = RTT.runTests();
process.exit(exitCode);