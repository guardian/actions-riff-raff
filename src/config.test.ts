import { validateDeploymentNames } from './config';
import type { Deployment, RiffraffYaml } from './riffraff';

describe('validateDeploymentNames', () => {
	it('should pass when deployment names match exactly', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {
				upload: { type: 'aws-s3' },
				lambda: { type: 'aws-lambda' },
			},
		};

		const deployments: Deployment[] = [
			{ name: 'upload', sources: ['dist/upload'] },
			{ name: 'lambda', sources: ['dist/lambda'] },
		];

		expect(() =>
			validateDeploymentNames(riffRaffYaml, deployments),
		).not.toThrow();
	});

	it('should fail when content directory is not in riff-raff.yaml', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {
				upload: { type: 'aws-s3' },
			},
		};

		const deployments: Deployment[] = [
			{ name: 'upload', sources: ['dist/upload'] },
			{ name: 'misnamed-deployment', sources: ['dist/lambda'] },
		];

		expect(() => validateDeploymentNames(riffRaffYaml, deployments)).toThrow(
			'Content directories [misnamed-deployment] are not defined in riff-raff.yaml deployments.',
		);
	});

	it('should fail when riff-raff.yaml deployment has no matching content directory', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {
				upload: { type: 'aws-s3' },
				lambda: { type: 'aws-lambda' },
			},
		};

		const deployments: Deployment[] = [
			{ name: 'upload', sources: ['dist/upload'] },
		];

		expect(() => validateDeploymentNames(riffRaffYaml, deployments)).toThrow(
			'Deployments [lambda] in riff-raff.yaml have no matching content directories.',
		);
	});

	it('should report both types of mismatches when present', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {
				upload: { type: 'aws-s3' },
				lambda: { type: 'aws-lambda' },
			},
		};

		const deployments: Deployment[] = [
			{ name: 'upload', sources: ['dist/upload'] },
			{ name: 'typo-lambda', sources: ['dist/lambda'] },
		];

		expect(() => validateDeploymentNames(riffRaffYaml, deployments)).toThrow(
			'Deployment name mismatch between riff-raff.yaml and contentDirectories:',
		);
	});

	it('should pass when deployments are empty on both sides', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {},
		};

		const deployments: Deployment[] = [];

		expect(() =>
			validateDeploymentNames(riffRaffYaml, deployments),
		).not.toThrow();
	});
});
