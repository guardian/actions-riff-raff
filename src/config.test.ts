import { getConfiguration } from './config';
import { clearConfig, readConfig } from './test-utils';

describe('Configuration', () => {
	beforeEach(() => {
		clearConfig();
	});

	it('should parse deployments from contentDirectories', () => {
		const input = `dryRun: true
app: foo
stagingDir: staging
contentDirectories: |
  - cdk.out:
    - cdk.out
  - s3-upload:
    - test-data
config: |
  stacks:
    - deploy
  regions:
    - eu-west-1
  deployments:
    s3-upload:
      type: aws-s3
      parameters:
        bucket: aws-some-bucket
        cacheControl: private
        publicReadAcl: false`;

		readConfig(input);
		const { deployments } = getConfiguration();

		const expected = [
			{ name: 'cdk.out', sources: ['cdk.out'] },
			{ name: 's3-upload', sources: ['test-data'] },
		];

		expect(deployments).toEqual(expected);
	});
});
