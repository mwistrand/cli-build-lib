import { Command, EjectOutput, Helper, OptionsHelper } from '@dojo/cli/interfaces';
import * as path from 'path';
import chalk from 'chalk';

const pkgDir = require('pkg-dir');
import build from './build';
import logger from './logger';
import { createAndLinkEjectedBuildFile, moveBuildOptions } from './util';

function buildNpmDependencies(): any {
	try {
		const packagePath = pkgDir.sync(__dirname);
		const packageJsonFilePath = path.join(packagePath, 'package.json');
		const packageJson = require(packageJsonFilePath);

		return {
			[packageJson.name]: packageJson.version,
			...packageJson.dependencies
		};
	} catch (e) {
		throw new Error(`Failed reading dependencies from package.json - ${e.message}`);
	}
}

const command: Command = {
	group: 'build',
	name: 'lib',
	description: 'create a build of your library',
	register(options: OptionsHelper) {
		options('mode', {
			describe: 'the output mode',
			alias: 'm',
			default: 'dist',
			choices: ['dist', 'dev', 'test']
		});

		options('watch', {
			describe: 'watch for file changes: "memory" (dev mode only) or "file" (all modes; default)',
			alias: 'w'
		});

		options('serve', {
			describe: 'start a webserver',
			alias: 's',
			type: 'boolean'
		});

		options('legacy', {
			describe: 'Build with legacy support',
			alias: 'l',
			type: 'boolean'
		});

		options('port', {
			describe: 'used in conjunction with the serve option to specify the webserver port',
			alias: 'p',
			default: 9999,
			type: 'number'
		});
	},
	run(helper: Helper, args: any) {
		console.log = () => {};
		return new Promise((resolve, reject) => {
			build(args, (error, stats) => {
				if (error) {
					reject(error);
				}
				if (stats) {
					const message = args.serve ? `Listening on port ${args.port}...` : args.watch ? 'watching...' : '';
					logger(stats, message);
				}
				resolve();
			});
		});
	},
	eject(helper: Helper): EjectOutput {
		const fullName = `${this.group}-${this.name}`;

		return {
			copy: {
				path: __dirname,
				files: [
					createAndLinkEjectedBuildFile(path.join(process.cwd(), 'config', fullName)),
					moveBuildOptions(fullName),
					'./build.js'
				]
			},
			hints: [`to build run ${chalk.underline('./dojo-build-lib --mode={dev|dist|test} --legacy --watch --serve')}`],
			npm: {
				devDependencies: { ...buildNpmDependencies() }
			}
		};
	}
};
export default command;
