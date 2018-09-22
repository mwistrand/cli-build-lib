import * as path from 'path';
import * as logUpdate from 'log-update';
import * as logSymbols from 'log-symbols';
import * as typescript from 'typescript';
import * as jsonFile from 'jsonfile';
import chalk from 'chalk';
import { LibraryStats } from './build';

const pkgDir = require('pkg-dir');
const columns = require('cli-columns');
const stripAnsi = require('strip-ansi');
const version = jsonFile.readFileSync(path.join(pkgDir.sync(), 'package.json')).version;

export default function logger(stats: LibraryStats, runningMessage = '') {
	let errorMsg = '';
	let signOff = chalk.green('The build completed successfully.');
	const assets = stats.assets.map(({ name, size }) => {
		const kbSize = (size / 1000).toFixed(2);
		return `${name} ${chalk.yellow(`(${kbSize}kb)`)}`;
	});

	if (stats.errors.length) {
		signOff = chalk.red('The build completed with errors.');
		errorMsg = `
${chalk.yellow('errors:')}
${chalk.red(stats.errors.map((error: string) => stripAnsi(error)) as any)}
`;
	}

	if (runningMessage) {
		signOff += `\n\n${runningMessage}`;
	}

	logUpdate(`
${logSymbols.info} cli-build-lib: ${version}
${logSymbols.info} typescript: ${typescript.version}
${logSymbols.error} errors: ${stats.errors.length}
${errorMsg}
${chalk.yellow('assets:')}
${columns(assets)}
${chalk.yellow(`output at: ${chalk.cyan(chalk.underline(`file:///${stats.path}`))}`)}

${signOff}
	`);
}
