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

	it('should pass when riff-raff.yaml deployment has no matching content directory (e.g., uses actions)', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {
				upload: { type: 'aws-s3' },
				'cloudformation-action': {
					type: 'cloud-formation',
					actions: ['update'],
				},
			},
		};

		const deployments: Deployment[] = [
			{ name: 'upload', sources: ['dist/upload'] },
		];

		expect(() =>
			validateDeploymentNames(riffRaffYaml, deployments),
		).not.toThrow();
	});

	it('should pass when content directories is empty', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {
				'cloudformation-action': {
					type: 'cloud-formation',
					actions: ['update'],
				},
			},
		};

		const deployments: Deployment[] = [];

		expect(() =>
			validateDeploymentNames(riffRaffYaml, deployments),
		).not.toThrow();
	});

	it('should fail with multiple missing content directories', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {
				upload: { type: 'aws-s3' },
			},
		};

		const deployments: Deployment[] = [
			{ name: 'typo-upload', sources: ['dist/upload'] },
			{ name: 'nonexistent', sources: ['dist/other'] },
		];

		expect(() => validateDeploymentNames(riffRaffYaml, deployments)).toThrow(
			'Content directories [typo-upload, nonexistent] are not defined in riff-raff.yaml deployments.',
		);
	});
});
