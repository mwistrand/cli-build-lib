const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import * as path from 'path';
import { SinonStub, stub } from 'sinon';

import MockModule from '../support/MockModule';

const key = 'build-lib';
const rc = { [key]: { bundles: {} } };
let mockModule: MockModule;

describe('util', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../src/util', require);
		mockModule.dependencies(['fs']);
		mockModule.getMock('fs').existsSync.returns(true);
		mockModule.getMock('fs').mkdtempSync.returns('/tmp');
		mockModule.getMock('fs').readFileSync.returns(JSON.stringify(rc));
		mockModule.getMock('fs').symlinkSync.returns(true);
	});

	afterEach(() => {
		mockModule.destroy();
	});

	describe('moveBuildOptions', () => {
		it('should move the build options to a new file', () => {
			const fs = mockModule.getMock('fs');
			const { moveBuildOptions } = mockModule.getModuleUnderTest();
			const buildOptions = JSON.stringify(rc[key]);

			moveBuildOptions(key);

			assert.isTrue(fs.writeFileSync.calledWith(path.join('/tmp', 'build-options.json'), buildOptions));
			assert.isTrue(fs.writeFileSync.calledWith(path.join(process.cwd(), '.dojorc'), JSON.stringify({ [key]: {} })));
		});

		it('should default to an empty object when the key is missing from the rc', () => {
			const fs = mockModule.getMock('fs');
			const { moveBuildOptions } = mockModule.getModuleUnderTest();
			const buildOptions = JSON.stringify({});

			fs.readFileSync.returns(buildOptions);
			moveBuildOptions(key);

			assert.isTrue(fs.writeFileSync.calledWith(path.join('/tmp', 'build-options.json'), buildOptions));
			assert.isTrue(fs.writeFileSync.calledWith(path.join(process.cwd(), '.dojorc')));
		});

		it('should always write a config even without a dojorc', () => {
			const fs = mockModule.getMock('fs');
			const { moveBuildOptions } = mockModule.getModuleUnderTest();
			const buildOptions = JSON.stringify({});

			fs.existsSync.returns(false);
			moveBuildOptions(key);

			assert.isTrue(fs.writeFileSync.calledWith(path.join('/tmp', 'build-options.json'), buildOptions));
			assert.isFalse(fs.writeFileSync.calledWith(path.join(process.cwd(), '.dojorc')));
		});
	});

	describe('ejected build helper', () => {
		let consoleStub: SinonStub | null;

		afterEach(() => {
			if (consoleStub) {
				consoleStub.restore();
				consoleStub = null;
			}
		});

		it('should generate a shell script for building ejected libraries', () => {
			const { createAndLinkEjectedBuildFile } = mockModule.getModuleUnderTest();
			const content = 'console.log(42)';
			const outputDir = path.join(process.cwd(), 'config', 'build-lib');
			const fs = mockModule.getMock('fs');
			fs.readFileSync.returns(content);
			const ejectedBuildFile = createAndLinkEjectedBuildFile(outputDir);
			const expected = path.join('/tmp', 'dojo-build-lib.js');

			assert.strictEqual(ejectedBuildFile, expected);
			assert.isTrue(fs.chmodSync.calledWith(ejectedBuildFile, '755'));
			assert.isTrue(fs.writeFileSync.calledWith(expected, `#!/usr/bin/env node\n${content}`));
			assert.isTrue(
				fs.symlinkSync.calledWith(
					path.join(outputDir, 'dojo-build-lib.js'),
					path.join(process.cwd(), './dojo-build-lib')
				)
			);
		});

		it('should log errors to the console', () => {
			const { createAndLinkEjectedBuildFile } = mockModule.getModuleUnderTest();
			const content = 'console.log(42)';
			const outputDir = path.join(process.cwd(), 'config', 'build-lib');
			const fs = mockModule.getMock('fs');
			const error = new Error('bad symlink');

			consoleStub = stub(console, 'error');
			fs.readFileSync.returns(content);
			fs.symlinkSync.throws(error);
			createAndLinkEjectedBuildFile(outputDir);

			assert.isTrue(consoleStub.calledWith(error.message));
		});
	});
});
