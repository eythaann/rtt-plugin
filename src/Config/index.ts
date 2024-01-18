import path from 'path';
import fs from 'fs';
import ts from 'typescript';

const getClientConfigFile = () => {
  const clientConfigPath = path.join(process.cwd(), 'rt.config.ts');

  if (!fs.existsSync(clientConfigPath)) {
    console.info('Not config file found (rt.config.ts).\n');
    return {};
  }

  try {
    const buffer = fs.readFileSync(clientConfigPath);
    const compiled = ts.transpile(buffer.toString());
    const evalConfig = eval(compiled);
    return evalConfig || {};
  } catch (e) {
    console.error('Error evaluating client config:', e);
    return {};
  }
};

const getConfig = () => {
  const config = {
    verbose: process.argv.includes('--verbose'),
    include: ['.*(\.(spec|test)(-types)?\.ts)$'],
    exclude: ['.*node_modules.*'],
  };

  const clientConfig = getClientConfigFile();

  const includeByConsole = process.argv.find((arg) => arg.includes('--include='))?.split('=')[1];

  console.log(includeByConsole);

  if (includeByConsole) {
    config.include = [includeByConsole];
  } else if (clientConfig?.testing?.include) {
    config.include = clientConfig?.testing?.include;
  }

  const excludeByConsole = process.argv.find((arg) => arg.includes('--exclude='))?.split('=')[1];
  if (excludeByConsole) {
    config.exclude = [excludeByConsole];
  } else if (clientConfig?.testing?.exclude) {
    config.exclude = clientConfig?.testing?.exclude;
  }

  return config;
};

export interface IConfig {
  verbose: boolean;
  include: RegExp[];
  exclude: RegExp[];
}

const preProccesedConfig = getConfig();

export const RTFT_CONFIG: IConfig = {
  ...preProccesedConfig,
  include: preProccesedConfig.include.map((pattern: string) => RegExp(pattern)),
  exclude: preProccesedConfig.exclude.map((pattern: string) => RegExp(pattern)),
};