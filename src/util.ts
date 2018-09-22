import { Config } from '@dojo/cli/interfaces';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * @private
 * Clear the rc data for the specified key (e.g., "build-lib") from the dojorc and return
 * the cleared data.
 *
 * @param key The rc key
 * @return The cleared data
 */
function clearBuildOptions(key: string): Config {
	const rcPath = path.join(process.cwd(), '.dojorc');
	if (fs.existsSync(rcPath)) {
		const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
		const config = rc[key] || {};
		rc[key] = {};
		fs.writeFileSync(rcPath, JSON.stringify(rc));
		return config;
	}
	return {};
}

/**
 * Generate a shell script for building ejected applications and add a symlink to the project's root directory.
 * The shell script is added to a temp directory, and it is copied to the project by `@dojo/cli`.
 */
export function createAndLinkEjectedBuildFile(ejectOutputPath: string) {
	const tmpDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
	const tmpBinFile = path.join(tmpDir, './dojo-build-lib.js');
	const binFileContents = fs.readFileSync(path.join(__dirname, './build-ejected.js'), 'utf8');
	fs.writeFileSync(tmpBinFile, `#!/usr/bin/env node\n${binFileContents}`);
	fs.chmodSync(tmpBinFile, '755');
	try {
		fs.symlinkSync(path.join(ejectOutputPath, './dojo-build-lib.js'), path.join(process.cwd(), './dojo-build-lib'));
	} catch (error) {
		console.error(error.message);
	}
	return tmpBinFile;
}

/**
 * Extract the rc data for the provided key to a temporary file and remove it from the dojorc.
 * This utility is necessary given that "eject" is treated as a full command (see
 * https://github.com/dojo/cli/issues/192 for more details).
 *
 * @param key The rc key (e.g., "build-lib")
 * @return The path to the temporary file
 */
export function moveBuildOptions(key: string): string {
	const tmpDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
	const tmpRc = path.join(tmpDir, 'build-options.json');
	const rc = clearBuildOptions(key);
	fs.writeFileSync(tmpRc, JSON.stringify(rc));
	return tmpRc;
}
