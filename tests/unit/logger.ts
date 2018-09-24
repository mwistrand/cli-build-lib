const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import * as fs from 'fs';
import * as path from 'path';
import * as logSymbols from 'log-symbols';
import chalk from 'chalk';
import * as sinon from 'sinon';
import MockModule from '../support/MockModule';
import { SinonStub } from 'sinon';

const stripAnsi = require('strip-ansi');
const columns = require('cli-columns');

let mockModule: MockModule;

function assertOutput(isServing = false) {
	const logger = mockModule.getModuleUnderTest().default;
	const runningMessage = isServing ? 'running...' : undefined;
	const stats = {
		path: path.join(__dirname, '..', 'fixtures'),
		errors: [],
		assets: [
			{
				name: 'my-widget/',
				size: 1000
			}
		]
	};
	logger(stats, runningMessage);

	let assetOne = `my-widget/ ${chalk.yellow('(1.00kb)')}`;
	let signOff = chalk.green('The build completed successfully.');
	if (runningMessage) {
		signOff += `\n\n${runningMessage}`;
	}

	const expectedLog = `
${logSymbols.info} cli-build-lib: 9.9.9
${logSymbols.info} typescript: 1.1.1
${logSymbols.error} errors: 0
${''}${''}
${chalk.yellow('assets:')}
${columns([assetOne])}
${chalk.yellow(`output at: ${chalk.cyan(chalk.underline(`file:///${path.join(__dirname, '..', 'fixtures')}`))}`)}

${signOff}
	`;
	const mockedLogUpdate: SinonStub = mockModule.getMock('log-update').ctor;
	assert.strictEqual(mockedLogUpdate.firstCall.args[0], expectedLog);
}

describe('logger', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../src/logger', require);
		mockModule.dependencies(['typescript', 'jsonfile', 'log-update']);
		mockModule.getMock('jsonfile').readFileSync = sinon.stub().returns({ version: '9.9.9' });
		mockModule.getMock('typescript').version = '1.1.1';
	});

	afterEach(() => {
		mockModule.destroy();

		const existsSync = fs.existsSync as any;
		if (typeof existsSync.restore === 'function') {
			existsSync.restore();
		}
	});

	it('logging output with no errors', () => {
		assertOutput();
	});

	it('logging output while serving', () => {
		sinon.stub(fs, 'existsSync').returns(false);
		assertOutput(true);
	});

	it('logging output with errors', () => {
		const errors: any = ['error'];
		const logger = mockModule.getModuleUnderTest().default;
		const stats = {
			path: path.join(__dirname, '..', 'fixtures'),
			errors,
			assets: [
				{
					name: 'my-widget/',
					size: 1000
				}
			]
		};
		logger(stats);

		const expectedErrors = `
${chalk.yellow('errors:')}
${chalk.red(errors.map((error: string) => stripAnsi(error)))}
`;
		const expectedLog = `
${logSymbols.info} cli-build-lib: 9.9.9
${logSymbols.info} typescript: 1.1.1
${logSymbols.error} errors: 1
${expectedErrors}
${chalk.yellow('assets:')}
${columns([`my-widget/ ${chalk.yellow('(1.00kb)')}`])}
${chalk.yellow(`output at: ${chalk.cyan(chalk.underline(`file:///${path.join(__dirname, '..', 'fixtures')}`))}`)}

${chalk.red('The build completed with errors.')}
	`;

		const mockedLogUpdate = mockModule.getMock('log-update').ctor;
		assert.isTrue(mockedLogUpdate.calledWith(expectedLog));
	});
});
