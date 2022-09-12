import * as child_process from 'child_process';
import { walk } from './file';
import { readConfig } from './test-utils';
import { main } from '.';

describe('action', () => {
	it('should generate expected file structure', async () => {
		child_process.execSync('rm -rf test-data');
		child_process.execSync('rm -rf staging');

		const input = `dryRun: true
app: foo
stagingDir: staging
contentDirectories: |
  - upload:
    - test-data
config: |
  stacks:
    - deploy
  regions:
    - eu-west-1
  deployments:
    upload:
      type: aws-s3
      parameters:
        bucket: aws-some-bucket
        cacheControl: private
        publicReadAcl: false`;

		const staging = 'staging';
		child_process.execSync('rm -rf staging*');

		const want = [`${staging}/riff-raff.yaml`, `${staging}/upload/foo.txt`];

		child_process.execSync('mkdir test-data');
		child_process.execSync('touch test-data/foo.txt');

		readConfig(input);
		await main();

		const got = walk(staging, (path: string) => path);

		expect(got.sort()).toEqual(want.sort());
	});
});
