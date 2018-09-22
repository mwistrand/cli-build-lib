const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import * as fs from 'fs';
import { join, sep } from 'path';
import { SinonStub, stub } from 'sinon';
import MockModule from '../support/MockModule';

let mockModule: MockModule;
let mockPostcssProcess: SinonStub;
let mockSpinner: any;
let mockStdout: any;
let mockStderr: any;
let chokidarListeners: Map<string, Function>;
let rimrafError: Error | null = null;
let tscCode = 0;
let tcmCode = 0;

describe('build', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../src/build', require);
		mockModule.dependencies([
			'child_process',
			'chokidar',
			'cpx',
			'express',
			'globby',
			'ora',
			'rimraf',
			'postcss',
			'postcss-clean',
			'postcss-custom-properties',
			'postcss-import',
			'postcss-modules',
			'postcss-preset-env'
		]);
		mockSpinner = {
			start: stub().returnsThis(),
			stop: stub().returnsThis()
		};
		mockModule.getMock('ora').ctor.returns(mockSpinner);
		mockModule.getMock('globby').ctor.returns(Promise.resolve([]));
		mockStdout = { on: stub() };
		mockStderr = { on: stub() };
		mockModule.getMock('child_process').spawn.callsFake((commandPath: string) => ({
			stdout: mockStdout,
			stderr: mockStderr,
			on: stub().callsFake((name: string, callback: Function) => {
				if (name === 'exit') {
					const command = commandPath.split(sep).pop();
					const code = command === 'tsc' ? tscCode : command === 'tcm' ? tcmCode : 0;
					callback(code);
				}
			})
		}));
		mockModule.getMock('cpx').copy.callsFake((from: string, to: string, callback: Function) => {
			callback(null);
		});
		mockModule.getMock('rimraf').ctor.callsFake((dirname: string, callback: Function) => {
			callback(rimrafError);
		});
		mockPostcssProcess = stub().returns(Promise.resolve({ css: '' }));
		mockModule.getMock('postcss').ctor.returns({
			process: mockPostcssProcess
		});
		chokidarListeners = new Map<string, Function>();
		const mockWatcher: any = {
			on: stub().callsFake((event: string, callback: Function) => {
				chokidarListeners.set(event, callback);
				return mockWatcher;
			})
		};
		mockModule.getMock('chokidar').watch.returns(mockWatcher);
	});

	afterEach(() => {
		tscCode = 0;
		tcmCode = 0;
		rimrafError = null;
		mockModule.destroy();
	});

	it('should clear the output directory', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		return buildLibrary({}).then(() => {
			const outputPath = join(process.cwd(), 'output/dist');
			assert.isTrue(mockModule.getMock('rimraf').ctor.calledWith(outputPath));
		});
	});

	it('should clear the output directory for the specified mode', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		return buildLibrary({ mode: 'dev' }).then(() => {
			const outputPath = join(process.cwd(), 'output/dev');
			assert.isTrue(mockModule.getMock('rimraf').ctor.calledWith(outputPath));
		});
	});

	it('shows a building spinner on start', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		return buildLibrary({}).then(() => {
			assert.isTrue(mockModule.getMock('ora').ctor.called);
			assert.isTrue(mockSpinner.start.called);
		});
	});

	it('should build esm modules', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		return buildLibrary({ mode: 'dev' }).then(() => {
			const basePath = process.cwd();
			const outputPath = join(basePath, 'output/dev');
			const tmpPath = join(basePath, 'output/dev/tmp');
			const command = join(basePath, 'node_modules/.bin/tsc');
			const { spawn } = mockModule.getMock('child_process');
			assert.isTrue(
				spawn.calledWith(command, ['--outDir', tmpPath, '-t', 'es6', '-m', 'esnext'], {
					cwd: basePath,
					shell: process.platform.startsWith('win')
				})
			);
			assert.isTrue(mockModule.getMock('cpx').copy.calledWith(join(tmpPath, 'src/**'), outputPath));
			assert.isTrue(mockModule.getMock('rimraf').ctor.calledWith(tmpPath));
		});
	});

	it('should build es5 modules with `--legacy`', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		return buildLibrary({ legacy: true, mode: 'dev' }).then(() => {
			const basePath = process.cwd();
			const outputPath = join(basePath, 'output/dev');
			const tmpPath = join(basePath, 'output/dev/tmp');
			const command = join(basePath, 'node_modules/.bin/tsc');
			const { spawn } = mockModule.getMock('child_process');
			assert.isTrue(
				spawn.calledWith(command, ['--outDir', tmpPath], {
					cwd: basePath,
					shell: process.platform.startsWith('win')
				})
			);
			assert.isTrue(mockModule.getMock('cpx').copy.calledWith(join(tmpPath, 'src/**'), outputPath));
			assert.isTrue(mockModule.getMock('rimraf').ctor.calledWith(tmpPath));
		});
	});

	it('should output both src and test files with --mode=test', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		return buildLibrary({ mode: 'test' }).then(() => {
			const basePath = process.cwd();
			const outputPath = join(basePath, 'output/test');
			const command = join(basePath, 'node_modules/.bin/tsc');
			const { spawn } = mockModule.getMock('child_process');
			assert.isTrue(
				spawn.calledWith(command, ['--outDir', outputPath, '-t', 'es6', '-m', 'esnext'], {
					cwd: basePath,
					shell: process.platform.startsWith('win')
				})
			);
		});
	});

	it('should generate CSS module definition files', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		return buildLibrary({}).then(() => {
			const basePath = process.cwd();
			const command = join(basePath, 'node_modules/.bin/tcm');
			const { spawn } = mockModule.getMock('child_process');
			const srcPath = join(process.cwd(), 'src');
			assert.isTrue(
				spawn.calledWith(command, [srcPath, '*.m.css'], {
					cwd: basePath,
					shell: process.platform.startsWith('win')
				})
			);
		});
	});

	it('should copy assets', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		const assetExtensions = 'gif,png,jpg,jpeg,svg,eot,ttf,woff,woff2';
		const assetFiles = join(process.cwd(), `src/**/*.{${assetExtensions}}`);
		return buildLibrary({}).then(() => {
			const outputPath = join(process.cwd(), 'output/dist');
			assert.isTrue(mockModule.getMock('cpx').copy.calledWith(assetFiles, outputPath));
		});
	});

	it('should copy assets to output/test/src/ with --mode=test', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		const assetExtensions = 'gif,png,jpg,jpeg,svg,eot,ttf,woff,woff2';
		const assetFiles = join(process.cwd(), `{src,tests}/**/*.{${assetExtensions}}`);
		return buildLibrary({ mode: 'test' }).then(() => {
			const outputPath = join(process.cwd(), 'output/test');
			assert.isTrue(mockModule.getMock('cpx').copy.calledWith(assetFiles, outputPath));
		});
	});

	it('should copy .css and .css.d.ts files', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		const cssFiles = join(process.cwd(), 'src/**/*.{css,css.d.ts}');
		return buildLibrary({}).then(() => {
			const outputPath = join(process.cwd(), 'output/dist');
			assert.isTrue(mockModule.getMock('cpx').copy.calledWith(cssFiles, outputPath));
		});
	});

	it('should copy .css and .css.d.ts files to output/test/src/ with --mode=test', () => {
		const buildLibrary = mockModule.getModuleUnderTest().default;
		const cssFiles = join(process.cwd(), '{src,tests}/**/*.{css,css.d.ts}');
		return buildLibrary({ mode: 'test' }).then(() => {
			const outputPath = join(process.cwd(), 'output/test');
			assert.isTrue(mockModule.getMock('cpx').copy.calledWith(cssFiles, outputPath));
		});
	});

	describe('css processing', () => {
		const mcssFile = 'file.m.css';
		const cssFile = 'file.css';
		const css = '.root { color: rebeccapurple }';

		let readStub: SinonStub;
		let writeStub: SinonStub;

		beforeEach(() => {
			const readFile = fs.readFileSync;
			readStub = stub(fs, 'readFileSync').callsFake(function(name: string) {
				return name === mcssFile || name === cssFile ? css : readFile.apply(fs, arguments);
			});
			writeStub = stub(fs, 'writeFileSync');
		});

		afterEach(() => {
			readStub && readStub.restore();
			writeStub && writeStub.restore();
		});

		it('should process CSS modules', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;

			mockModule.getMock('globby').ctor.returns(Promise.resolve([mcssFile]));
			mockPostcssProcess.returns(Promise.resolve({ css }));

			return buildLibrary({}).then(() => {
				assert.isTrue(readStub.calledWith(mcssFile, 'utf8'));
				assert.isTrue(writeStub.calledWith(mcssFile, css, 'utf8'));
				assert.isTrue(mockModule.getMock('postcss-import').ctor.called);
				assert.isTrue(mockModule.getMock('postcss-custom-properties').ctor.calledWith({ preserve: false }));
				assert.isTrue(mockModule.getMock('postcss-clean').ctor.calledWith({ level: 2 }));
				assert.isTrue(mockModule.getMock('postcss-modules').ctor.called);
				assert.isTrue(
					mockModule.getMock('postcss-preset-env').ctor.calledWith({
						browsers: ['last 2 versions'],
						features: {
							'nesting-rules': true
						},
						autoprefixer: {
							grid: undefined
						}
					})
				);
			});
		});

		it('should write CSS module JSON to js file', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;

			mockModule.getMock('globby').ctor.returns(Promise.resolve([mcssFile]));
			mockPostcssProcess.returns(Promise.resolve({ css }));

			return buildLibrary({}).then(() => {
				const { getJSON } = mockModule.getMock('postcss-modules').ctor.firstCall.args[0];
				getJSON(mcssFile, { xkcd: 'root' });
				assert.isTrue(writeStub.calledWith(`${mcssFile}.js`));
			});
		});

		it('should hash class names', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;

			mockModule.getMock('globby').ctor.returns(Promise.resolve([mcssFile]));
			mockPostcssProcess.returns(Promise.resolve({ css }));

			return buildLibrary({}).then(() => {
				const { generateScopedName } = mockModule.getMock('postcss-modules').ctor.firstCall.args[0];
				assert.strictEqual(generateScopedName, '[name]__[local]__[hash:base64:5]');
			});
		});

		it('should prefix grid and support ie 10+ in legacy mode', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;

			mockModule.getMock('globby').ctor.returns(Promise.resolve([mcssFile]));
			mockPostcssProcess.returns(Promise.resolve({ css }));

			return buildLibrary({ legacy: true }).then(() => {
				assert.isTrue(
					mockModule.getMock('postcss-preset-env').ctor.calledWith({
						browsers: ['last 2 versions', 'ie >= 10'],
						features: {
							'nesting-rules': true
						},
						autoprefixer: {
							grid: true
						}
					})
				);
			});
		});

		it('should CSS variable files', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;

			mockModule.getMock('globby').ctor.returns(Promise.resolve([cssFile]));
			mockPostcssProcess.returns(Promise.resolve({ css }));

			return buildLibrary({}).then(() => {
				assert.isTrue(readStub.calledWith(cssFile, 'utf8'));
				assert.isTrue(writeStub.calledWith(cssFile, css, 'utf8'));
				assert.isTrue(mockModule.getMock('postcss-import').ctor.called);
				assert.isTrue(mockModule.getMock('postcss-custom-properties').ctor.calledWith({ preserve: 'computed' }));
				assert.isTrue(
					mockModule.getMock('postcss-preset-env').ctor.calledWith({
						browsers: ['last 2 versions'],
						features: {
							'nesting-rules': true
						},
						autoprefixer: {
							grid: undefined
						}
					})
				);
			});
		});
	});

	describe('--watch=true', () => {
		let consoleStub: SinonStub;

		afterEach(() => {
			consoleStub && consoleStub.restore();
		});

		it('should immediately build in watch mode', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;
			return buildLibrary({ watch: true }).then(() => {
				const didBuild = mockModule.getMock('rimraf').ctor.called;
				assert.isTrue(didBuild);
			});
		});

		it('should observe only TypeScript, CSS, image, and font assets', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;
			return buildLibrary({ watch: true }).then(() => {
				const extensions = 'gif,png,jpg,jpeg,svg,eot,ttf,woff,woff2,css,ts';
				const glob = join(process.cwd(), `src/**/*.{${extensions}}`);
				assert.isTrue(mockModule.getMock('chokidar').watch.calledWith(glob));
			});
		});

		it('should observe src/ and tests/ files in test mode', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;
			return buildLibrary({ mode: 'test', watch: true }).then(() => {
				const extensions = 'gif,png,jpg,jpeg,svg,eot,ttf,woff,woff2,css,ts';
				const glob = join(process.cwd(), `{src,tests}/**/*.{${extensions}}`);
				assert.isTrue(mockModule.getMock('chokidar').watch.calledWith(glob));
			});
		});

		it('should build when a file is added', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;
			const rimraf = mockModule.getMock('rimraf').ctor;
			return buildLibrary({ watch: true }).then(() => {
				rimraf.resetHistory();
				const onAdd = chokidarListeners.get('add') as Function;
				assert.isFunction(onAdd);
				onAdd();

				const didBuild = rimraf.called;
				assert.isTrue(didBuild);
			});
		});

		it('should build when a file is modified', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;
			const rimraf = mockModule.getMock('rimraf').ctor;
			return buildLibrary({ watch: true }).then(() => {
				rimraf.resetHistory();
				const onChange = chokidarListeners.get('change') as Function;
				assert.isFunction(onChange);
				onChange();

				const didBuild = rimraf.called;
				assert.isTrue(didBuild);
			});
		});

		it('should build when a file is removed', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;
			const rimraf = mockModule.getMock('rimraf').ctor;
			return buildLibrary({ watch: true }).then(() => {
				rimraf.resetHistory();
				const onDelete = chokidarListeners.get('unlink') as Function;
				assert.isFunction(onDelete);
				onDelete();

				const didBuild = rimraf.called;
				assert.isTrue(didBuild);
			});
		});

		it('should log file errors', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;
			consoleStub = stub(console, 'error');

			return buildLibrary({ watch: true }).then(() => {
				const error = new Error('corrupt file');
				const onError = chokidarListeners.get('error') as Function;
				assert.isFunction(onError);
				onError(error);
				assert.isTrue((console.error as any).calledWith(error));
			});
		});

		it('should wait for the current build to complete before beginning anew', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;
			const rimraf = mockModule.getMock('rimraf').ctor.callsFake((dest: string, callback: Function) => {
				setTimeout(() => {
					callback();
				}, 100);
			});
			return buildLibrary({ watch: true }).then(() => {
				rimraf.resetHistory();
				const onChange = chokidarListeners.get('change') as Function;
				onChange();
				onChange();
				onChange();
				onChange();
				onChange();
				onChange();

				const didBuildOnce = rimraf.called;
				assert.isTrue(didBuildOnce);
			});
		});
	});

	describe('library stats', () => {
		let statStub: SinonStub;
		let readdirStub: SinonStub;

		beforeEach(() => {
			readdirStub = stub(fs, 'readdirSync').returns([]);
			statStub = stub(fs, 'statSync').callsFake((file: string) => {
				return {
					isDirectory: () => !/\.(css|js)$/.test(file),
					size: 1000
				};
			});
		});

		afterEach(() => {
			readdirStub.restore();
			statStub.restore();
		});

		it('passes build stats to a callback on success', () => {
			const buildLibrary = mockModule.getModuleUnderTest().default;
			const callback = stub();
			return buildLibrary({}, callback).then(() => {
				assert.isTrue(
					callback.calledWith(null, {
						path: join(process.cwd(), 'output/dist'),
						errors: [],
						assets: []
					})
				);
			});
		});

		it('combines the file sizes for each top-level directory', () => {
			let callCount = 0;
			readdirStub.callsFake((file: string) => {
				if (callCount === 0) {
					callCount++;
					return ['index.js', 'my-widget'];
				}
				return /my-widget\/styles/.test(file) ? ['my-widget.m.css'] : ['styles', 'my-widget.js'];
			});

			const buildLibrary = mockModule.getModuleUnderTest().default;
			const callback = stub();
			const outputPath = join(process.cwd(), 'output/dist');
			return buildLibrary({}, callback).then(() => {
				const { path, assets } = callback.args[0][1];
				const actual = {
					path,
					assets: assets.map(({ name, size }: any) => ({
						name,
						size
					}))
				};
				assert.deepEqual(actual, {
					path: outputPath,
					assets: [{ size: 1000, name: 'index.js' }, { size: 2000, name: 'my-widget/' }]
				});
			});
		});

		it('should include an error when the output directory cannot be cleared', () => {
			rimrafError = new Error('rimraf error');
			const buildLibrary = mockModule.getModuleUnderTest().default;
			const callback = stub();
			return buildLibrary({}, callback).then(() => {
				const { errors } = callback.args[0][1];
				assert.strictEqual(errors[0], rimrafError!.message);
			});
		});

		it('should include an error when tsc fails', () => {
			tscCode = 1;
			const buildLibrary = mockModule.getModuleUnderTest().default;
			const callback = stub();
			mockStdout.on.callsFake((name: string, callback: Function) => {
				callback('tsc stdout error');
			});
			mockStderr.on.callsFake((name: string, callback: Function) => {
				callback('tsc stderr error');
			});
			return buildLibrary({}, callback).then(() => {
				assert.isTrue(
					callback.calledWith(null, {
						path: join(process.cwd(), 'output/dist'),
						assets: [],
						errors: ['tsc stdout error', 'tsc stderr error']
					})
				);
			});
		});

		it('should include an error when CSS module definition files cannot be generated', () => {
			tcmCode = 1;
			const buildLibrary = mockModule.getModuleUnderTest().default;
			const callback = stub();
			mockStdout.on.callsFake((name: string, callback: Function) => {
				callback('tcm stdout error');
			});
			mockStderr.on.callsFake((name: string, callback: Function) => {
				callback('tcm stderr error');
			});
			return buildLibrary({}, callback).then(() => {
				assert.isTrue(
					callback.calledWith(null, {
						path: join(process.cwd(), 'output/dist'),
						assets: [],
						errors: ['tcm stdout error', 'tcm stderr error']
					})
				);
			});
		});
	});

	describe('serve option', () => {
		let listenStub: SinonStub;
		let useStub: SinonStub;

		beforeEach(() => {
			useStub = stub();
			listenStub = stub().callsFake((port: string, callback: Function) => {
				callback(false);
			});

			const expressMock = mockModule.getMock('express').ctor;
			expressMock.static = stub();
			expressMock.returns({
				listen: listenStub,
				use: useStub
			});
		});

		it('starts a webserver on the specified port', () => {
			const build = mockModule.getModuleUnderTest().default;
			const port = 3000;
			return build({ serve: true, port }).then(() => {
				assert.isTrue(listenStub.calledWith(port));
			});
		});

		it('serves from the output directory', () => {
			const build = mockModule.getModuleUnderTest().default;
			const express = mockModule.getMock('express').ctor;
			const outputDir = join(process.cwd(), 'output', 'dist');
			return build({ serve: true }).then(() => {
				assert.isTrue(express.static.calledWith(outputDir));
			});
		});

		it('can serve and watch simultaneously', () => {});

		it('fails on error', () => {
			const build = mockModule.getModuleUnderTest().default;
			listenStub.callsFake((port: string, callback: Function) => {
				callback(true);
			});
			return build({ serve: true }).then(
				() => {
					throw new Error();
				},
				(e: Error) => {
					assert.isTrue(e);
				}
			);
		});
	});
});
