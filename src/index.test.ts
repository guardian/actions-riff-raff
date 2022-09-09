import * as child_process from 'child_process';
import * as yaml from 'js-yaml';
import { walk } from './file';
import { main } from '.';

// Read yaml config and set env vars to mimic GHA
export const readConfig = (yamlConfig: string): void => {
	const config = yaml.load(yamlConfig) as object;
	Object.entries(config).forEach(([k, v]) => {
		const name = `INPUT_${k.replace(/ /g, '_').toUpperCase()}`;
		process.env[name] = v as string;
	});

	// process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || ''
};

describe('action', () => {
	it('should generate expected file structure', async () => {
		const artifactDir = 'test-data';
		const stagingDir = 'staging';

		// ensure we have a clean state
		child_process.execSync(`rm -rf ${artifactDir}`);
		child_process.execSync(`rm -rf ${stagingDir}*`);

		// Create an artifact (`test-data/foo.txt`) to upload
		child_process.execSync(`mkdir ${artifactDir}`);
		child_process.execSync(`touch ${artifactDir}/foo.txt`);
		child_process.execSync(`touch ${artifactDir}/image.jpg`);

		const input = `dryRun: true
app: foo
stagingDir: staging
contentDirectories: |
  upload:
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

		readConfig(input);
		await main();

		const got = walk(stagingDir, (path: string) => path);

		const want = [
			`${stagingDir}/riff-raff.yaml`,
			`${stagingDir}/upload/foo.txt`,
			`${stagingDir}/upload/image.jpg`,
		];

		expect(got.sort()).toEqual(want.sort());
	});
});
