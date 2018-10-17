const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import MockModule from '../support/MockModule';

let mockModule: MockModule;

describe('build-ejected', () => {
	let args: any;

	beforeEach(() => {
		mockModule = new MockModule('../../src/build-ejected', require);
		mockModule.dependencies(['yargs', './build']);
		args = { watch: true };
		mockModule.getMock('yargs').ctor.options = () => ({ argv: args });
	});

	afterEach(() => {
		mockModule.destroy();
	});

	it('calls build with available args', () => {
		mockModule.getModuleUnderTest();
		assert.isTrue(mockModule.getMock('./build').default.calledWith(args));
	});
});
