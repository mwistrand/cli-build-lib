import * as yargs from 'yargs';
import build from './build';

const args = yargs.options({
	mode: {
		describe: 'the output mode',
		alias: 'm',
		default: 'dist',
		choices: ['dist', 'dev', 'test']
	},
	watch: {
		describe: 'watch for file changes: "memory" (dev mode only) or "file" (all modes; default)',
		alias: 'w'
	},
	legacy: {
		describe: 'Build with legacy support',
		alias: 'l',
		type: 'boolean'
	},
	serve: {
		describe: 'start a webserver',
		alias: 's',
		type: 'boolean'
	},
	port: {
		describe: 'used in conjunction with the serve option to specify the webserver port',
		alias: 'p',
		default: 9999,
		type: 'number'
	}
}).argv;

build(args);
