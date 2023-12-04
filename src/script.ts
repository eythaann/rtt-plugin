import ts from 'typescript';
import { ReadableTypesTester } from './utils';

const rt_options: ts.CompilerOptions = {
  noEmit: true,
};

export function compile() {
  const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, './');
  const program = ts.createProgram(parsedConfig.fileNames, { ...parsedConfig.options, ...rt_options });

  const RTT = new ReadableTypesTester(program, {
    includedRegexs: [/.*(\.spec-types\.ts)$/],
  });

  const exitCode = RTT.runTests();
  process.exit(exitCode);
}