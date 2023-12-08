#!/usr/bin/env node
import ts from 'typescript';
import { ReadableTypesTester } from './utils';
import path from 'path';
import fs from 'fs';

const rt_options: ts.CompilerOptions = {
  noEmit: true,
};

const defaultTestingConfig = {
  include: ['.*(\.(spec|test)(-types)?\.ts)$'],
  exclude: ['.*node_modules.*'],
};

const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, './');
const program = ts.createProgram(parsedConfig.fileNames, { ...parsedConfig.options, ...rt_options });

const getConfig = () => {
  const clientConfigPath = path.join(process.cwd(), 'rt.config.ts');

  if (!fs.existsSync(clientConfigPath)) {
    console.info('Not config file found, using default configs instead.\n');
    return defaultTestingConfig;
  }

  try {
    const buffer = fs.readFileSync(clientConfigPath);
    const compiled = ts.transpile(buffer.toString());
    const evalConfig = eval(compiled);
    return Object.assign(defaultTestingConfig, evalConfig?.testing);
  } catch (e) {
    console.error('Error evaluating client config:', e);
    return defaultTestingConfig;
  }
};

const RTT_CONFIG = getConfig();
const RTT = new ReadableTypesTester(program, {
  include: RTT_CONFIG.include.map((pattern: string) => RegExp(pattern)),
  exclude: RTT_CONFIG.exclude.map((pattern: string) => RegExp(pattern)),
});

const exitCode = RTT.runTests();

if (process.argv.includes('--verbose')) {
  console.log('Used configuration:', RTT.config, '\n');
}

process.exit(exitCode);