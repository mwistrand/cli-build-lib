import { spawn } from 'child_process';
import { copy } from 'cpx';
import * as chokidar from 'chokidar';
import * as express from 'express';
import * as fs from 'fs';
import * as globby from 'globby';
import * as ora from 'ora';
import * as path from 'path';
import * as rimraf from 'rimraf';

const postcss = require('postcss');
const postcssClean = require('postcss-clean');
const postcssCustomProperties = require('postcss-custom-properties');
const postcssImport = require('postcss-import');
const postcssModules = require('postcss-modules');
const postcssPresetEnv = require('postcss-preset-env');

const assetExtensions = ['gif', 'png', 'jpg', 'jpeg', 'svg', 'eot', 'ttf', 'woff', 'woff2'];
const allExtensions = [...assetExtensions, 'css', 'ts'];
const basePath = process.cwd();
const srcPath = path.join(basePath, 'src');
const allPaths = path.join(basePath, '{src,tests}');
const srcFiles = path.join(srcPath, `**/*.{${allExtensions}}`);
const allFiles = path.join(allPaths, `**/*.{${allExtensions}}`);
const noop = () => {};

export interface LibraryStats {
	path: string;
	assets: Array<{ name: string; size: number }>;
	errors: string[];
}

export type BuildCallback = (error: Error | null, stats?: LibraryStats) => void;

function createChildProcess(command: string, args: string[], errors: string[] = []): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const child = spawn(path.join(basePath, 'node_modules/.bin', command), args, {
			cwd: basePath,
			shell: process.platform.startsWith('win')
		});
		const processErrors: string[] = [];
		child.stdout.on('data', (data: Buffer) => {
			processErrors.push(data.toString('utf8'));
		});
		child.stderr.on('data', (data: Buffer) => {
			processErrors.push(data.toString('utf8'));
		});
		child.on('error', reject);
		child.on('exit', code => (code !== 0 ? resolve([...errors, ...processErrors]) : resolve(errors)));
	});
}

function createTask(callback: any, errors: string[] = []): Promise<string[]> {
	return new Promise(resolve => {
		callback((error?: Error) => {
			if (error) {
				resolve([...errors, error.message]);
			}
			resolve(errors);
		});
	});
}

function getDirectorySize(dirname: string, size = 0): number {
	return fs.readdirSync(dirname).reduce((size, file) => {
		const filePath = path.join(dirname, file);
		const stats = fs.statSync(filePath);
		return stats.isDirectory() ? getDirectorySize(filePath, size) : size + stats.size;
	}, size);
}

function generateStats(dirname: string, errors: string[]): LibraryStats {
	const assets = fs.readdirSync(dirname).map(file => {
		const filePath = path.join(dirname, file);
		const stats = fs.statSync(filePath);
		const size = stats.isDirectory() ? getDirectorySize(filePath) : stats.size;

		return {
			...stats,
			name: stats.isDirectory() ? `${file}/` : file,
			size
		};
	});
	return {
		path: dirname,
		assets,
		errors
	};
}

function wrapUmd(content: string): string {
	return `(function (root, factory) {
if (typeof define === 'function' && define.amd) {
	define([], function () { return (factory()); });
} else if (typeof module === 'object' && module.exports) {
	module.exports = factory();
}
}(this, function () {
	return ${content};
}));`;
}

async function buildCss({ mode = 'dist', legacy }: any, errors: string[]) {
	try {
		const outDir = path.join(basePath, 'output', mode);
		const cssFiles = path.join(basePath, outDir, '**/*.css');
		const packageJsonPath = path.join(basePath, 'package.json');
		const packageJson = require(packageJsonPath);
		const postcssPresetConfig = {
			browsers: legacy ? ['last 2 versions', 'ie >= 10'] : ['last 2 versions'],
			features: {
				'nesting-rules': true
			},
			autoprefixer: {
				grid: legacy
			}
		};

		const modulesProcessor = postcss([
			postcssImport(),
			postcssPresetEnv(postcssPresetConfig),
			postcssModules({
				generateScopedName: '[name]__[local]__[hash:base64:5]',
				getJSON: function(cssFileName: string, json: any) {
					const newFilePath = cssFileName + '.js';
					const themeKey = ' _key';
					const packageName = packageJson.name;
					json[themeKey] = `${packageName}/${path.basename(cssFileName, '.m.css')}`;
					fs.writeFileSync(newFilePath, wrapUmd(JSON.stringify(json)));
				}
			}),
			postcssCustomProperties({ preserve: false }),
			postcssClean({ level: 2 })
		]);
		const variablesProcessor = postcss([
			postcssImport(),
			postcssPresetEnv(postcssPresetConfig),
			postcssCustomProperties({ preserve: 'computed' })
		]);

		const files = await globby(cssFiles);
		const moduleFiles = files.filter(file => file.endsWith('.m.css'));
		const variableFiles = files.filter(file => !file.endsWith('.m.css'));
		const processFile = async (file: string) => {
			const processor = file.endsWith('.m.css') ? modulesProcessor : variablesProcessor;
			const { css }: { css: string } = await processor.process(fs.readFileSync(file, 'utf8'), {
				from: file,
				map: true
			});
			fs.writeFileSync(file, css, 'utf8');
		};
		await moduleFiles.map(processFile);
		await variableFiles.map(processFile);
	} catch (error) {
		errors = [...errors, error];
	}

	return errors;
}

async function buildTsc(args: any, errors: string[]) {
	const outDir = path.join(basePath, 'output', args.mode || 'dist');
	const tmpDir = path.join(outDir, 'tmp');
	let tscOptions = ['--outDir', args.mode === 'test' ? outDir : tmpDir];
	if (!args.legacy) {
		tscOptions = [...tscOptions, '-t', 'es6', '-m', 'esnext'];
	}

	if (args.mode === 'test') {
		return createChildProcess('tsc', tscOptions);
	}

	errors = await createChildProcess('tsc', tscOptions, errors);
	errors = await createTask((callback: any) => copy(path.join(tmpDir, 'src/**'), outDir, callback), errors);
	return await createTask((callback: any) => rimraf(tmpDir, callback), errors);
}

async function build(args: any, callback: BuildCallback) {
	const outDir = path.join(basePath, 'output', args.mode || 'dist');
	const assetsDir = args.mode === 'test' ? allPaths : srcPath;
	const assetFiles = path.join(assetsDir, `**/*.{${assetExtensions.join(',')}}`);
	const cssFiles = path.join(assetsDir, '**/*.{css,css.d.ts}');

	const spinner = ora().start('building');
	try {
		let errors: string[] = [];
		errors = await createTask((callback: any) => rimraf(outDir, callback), errors);
		errors = await createChildProcess('tcm', [assetsDir, '*.m.css'], errors);
		errors = await buildTsc(args, errors);
		errors = await createTask((callback: any) => copy(assetFiles, outDir, callback), errors);
		errors = await createTask((callback: any) => copy(cssFiles, outDir, callback), errors);
		errors = await buildCss(args, errors);
		spinner.stop();
		callback(null, generateStats(outDir, errors));
	} catch (error) {
		spinner.stop();
		callback(error);
	}
}

async function serve(args: any, callback: BuildCallback) {
	await build(args, callback);

	const app = express();
	const outDir = path.join(basePath, 'output', args.mode || 'dist');
	app.use(express.static(outDir));

	return new Promise<void>((resolve, reject) => {
		app.listen(args.port, (error: Error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

function watch(args: any, callback: BuildCallback) {
	let isBuilding = false;
	const debounced = async () => {
		if (!isBuilding) {
			isBuilding = true;
			return build(args, (error, stats) => {
				isBuilding = false;
				callback(error, stats);
			});
		}
	};

	chokidar
		.watch(args.mode === 'test' ? allFiles : srcFiles)
		.on('add', debounced)
		.on('change', debounced)
		.on('unlink', debounced)
		.on('error', error => console.error(error));

	return debounced();
}

export default function(args: any, callback: BuildCallback = noop) {
	return args.serve ? serve(args, callback) : args.watch ? watch(args, callback) : build(args, callback);
}
