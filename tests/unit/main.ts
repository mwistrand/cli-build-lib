const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import { join } from 'path';
import { stub } from 'sinon';
import chalk from 'chalk';
import MockModule from '../support/MockModule';

let mockModule: MockModule;
let mockStats: any;
let consoleStub = stub(console, 'log');

function getMockConfiguration(config: any = {}) {
	return {
		configuration: {
			get() {
				return { ...config, elements: ['element'] };
			}
		}
	};
}

describe('command', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../src/main', require);
		mockModule.dependencies(['./build', './logger']);
		mockStats = {
			path: 'path/to/output',
			assets: []
		};
		mockModule.getMock('./build').default.callsFake((args: any, callback: Function) => {
			callback(null, mockStats);
			return Promise.resolve();
		});
	});

	afterEach(() => {
		mockModule.destroy();
		consoleStub.restore();
	});

	it('registers the command options', () => {
		const main = mockModule.getModuleUnderTest().default;
		const optionsStub = stub();
		main.register(optionsStub);
		assert.isTrue(
			optionsStub.calledWith('mode', {
				describe: 'the output mode',
				alias: 'm',
				default: 'dist',
				choices: ['dist', 'dev', 'test']
			})
		);
	});

	it('console.log is silenced during run', () => {
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), {}).then(() => {
			console.log('called');
			assert.isTrue(consoleStub.notCalled);
		});
	});

	it('delegates building to build module', () => {
		const args = { mode: 'dev' };
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), args).then(() => {
			assert.isTrue(mockModule.getMock('./build').default.calledWith(args));
		});
	});

	it('should reject on error', () => {
		const main = mockModule.getModuleUnderTest().default;
		const thrown = new Error('error');
		mockModule.getMock('./build').default.callsFake((args: any, callback: Function) => {
			callback(thrown);
		});
		return main.run(getMockConfiguration(), {}).then(
			() => {
				throw new Error('should not resolve');
			},
			(error: Error) => {
				assert.strictEqual(error, thrown);
			}
		);
	});

	it('should display a wait message when serving', () => {
		const args = { mode: 'dev', serve: true, port: 3333 };
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), args).then(() => {
			assert.isTrue(mockModule.getMock('./logger').default.calledWith(mockStats, 'Listening on port 3333...'));
		});
	});

	it('should display a wait message when watching', () => {
		const args = { mode: 'dev', watch: true };
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), args).then(() => {
			assert.isTrue(mockModule.getMock('./logger').default.calledWith(mockStats, 'watching...'));
		});
	});

	describe('eject', () => {
		const basePath = process.cwd();

		beforeEach(() => {
			mockModule.dependencies(['pkg-dir', './util']);
			mockModule.getMock('pkg-dir').ctor.sync = stub().returns(basePath);
		});

		it('outputs the ejected config and updates package dev dependencies', () => {
			const main = mockModule.getModuleUnderTest().default;
			const packageJson = require(join(basePath, 'package.json'));
			const rcFile = 'build-options.json';
			const buildShellFile = 'dojo-build-lib.js';
			mockModule.getMock('./util').moveBuildOptions.returns(rcFile);
			mockModule.getMock('./util').createAndLinkEjectedBuildFile.returns(buildShellFile);

			const ejectOptions = main.eject(getMockConfiguration());
			assert.lengthOf(ejectOptions.copy.files.filter((file: string) => file === rcFile), 1);
			assert.lengthOf(ejectOptions.copy.files.filter((file: string) => file === buildShellFile), 1);

			ejectOptions.copy.files = ejectOptions.copy.files.filter(
				(file: string) => file !== rcFile && file !== buildShellFile
			);
			assert.deepEqual(ejectOptions, {
				copy: {
					path: join(basePath, 'dist/dev/src'),
					files: ['./build.js']
				},
				hints: [`to build run ${chalk.underline('./dojo-build-lib --mode={dev|dist|test} --legacy --watch --serve')}`],
				npm: {
					devDependencies: {
						[packageJson.name]: packageJson.version,
						...packageJson.dependencies
					}
				}
			});
		});

		it('throws an error when ejecting when deps cannot be read', () => {
			const message = 'Keyboard not found. Press F1 to resume.';
			mockModule.getMock('pkg-dir').ctor.sync.throws(() => new Error(message));
			assert.throws(
				() => {
					const main = mockModule.getModuleUnderTest().default;
					main.eject(getMockConfiguration());
				},
				Error,
				`Failed reading dependencies from package.json - ${message}`
			);
		});
	});
});
