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
			{ name: 'missing-deployment', sources: ['dist/lambda'] },
		];

		expect(() => validateDeploymentNames(riffRaffYaml, deployments)).toThrow(
			'Content directories [missing-deployment] are not defined in riff-raff.yaml deployments.',
		);
	});

	it('should pass when riff-raff.yaml deployment has no matching content directory', () => {
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

	it('should pass when content directory name matches a contentDirectory field in riff-raff.yaml', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {
				'asg-upload-eu-west-1-deploy-grafana': {
					type: 'autoscaling',
					contentDirectory: 'grafana',
				},
				'cfn-eu-west-1-deploy-grafana': {
					type: 'cloud-formation',
					contentDirectory: 'cdk.out',
				},
			},
		};

		const deployments: Deployment[] = [
			{ name: 'grafana', sources: ['dist/grafana.zip'] },
			{ name: 'cdk.out', sources: ['cdk/cdk.out/template.json'] },
		];

		expect(() =>
			validateDeploymentNames(riffRaffYaml, deployments),
		).not.toThrow();
	});

	it('should fail only for content directories not matching any deployment name or contentDirectory field', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {
				'asg-upload-eu-west-1-deploy-grafana': {
					type: 'autoscaling',
					contentDirectory: 'grafana',
				},
				'cfn-eu-west-1-deploy-grafana': {
					type: 'cloud-formation',
					contentDirectory: 'cdk.out',
				},
			},
		};

		const deployments: Deployment[] = [
			{ name: 'cdk.out2', sources: ['cdk/cdk.out/template.json'] },
			{ name: 'grafana', sources: ['dist/grafana.zip'] },
		];

		expect(() => validateDeploymentNames(riffRaffYaml, deployments)).toThrow(
			'Content directories [cdk.out2] are not defined in riff-raff.yaml deployments.',
		);
	});

	it('should pass with a mix of deployment name matches and contentDirectory field matches', () => {
		const riffRaffYaml: RiffraffYaml = {
			stacks: ['deploy'],
			regions: ['eu-west-1'],
			deployments: {
				upload: { type: 'aws-s3' },
				'cfn-deploy': {
					type: 'cloud-formation',
					contentDirectory: 'cdk.out',
				},
			},
		};

		const deployments: Deployment[] = [
			{ name: 'upload', sources: ['dist/upload'] },
			{ name: 'cdk.out', sources: ['cdk/cdk.out/template.json'] },
		];

		expect(() =>
			validateDeploymentNames(riffRaffYaml, deployments),
		).not.toThrow();
	});
});
