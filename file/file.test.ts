import * as child_process from 'child_process';
import { walk } from './file';

// Really we should create an abstraction over the file system, but it's too
// much hassle. I wish Node had something like:
// https://benjamincongdon.me/blog/2021/01/21/A-Tour-of-Go-116s-iofs-package/.
describe('walk', () => {
	it('should walk a directory and apply my function to each file item', () => {
		// create directory
		const target = 'file/test';

		child_process.execSync(`mkdir -p ${target}/foo/bar`);
		child_process.execSync(`touch  ${target}/apple.txt`);
		child_process.execSync(`touch  ${target}/foo/pear.txt`);
		child_process.execSync(`touch  ${target}/foo/bar/blackberry.txt`);

		// walk and list items
		const got = walk(target, (p: string) => {
			return p;
		});

		const want = [
			`${target}/apple.txt`,
			`${target}/foo/pear.txt`,
			`${target}/foo/bar/blackberry.txt`,
		];

		expect(got.sort()).toEqual(want.sort());

		child_process.execSync(`rm -rf ${target}`);
	});
});
