import * as core from '@actions/core';
import * as yaml from 'js-yaml';
import { read } from './file';
import type { Deployment, RiffraffYaml } from './riffraff';

// getInput is like core.getInput but returns undefined for the empty string.
const getInput = (
	name: string,
	options?: core.InputOptions,
): string | undefined => {
	const got = core.getInput(name, options);
	return got === '' ? undefined : got;
};

const readConfigFile = (path: string): object => {
	const data = read(path);
	return yaml.load(data) as object;
};

const getProjectName = ({ stacks }: RiffraffYaml): string => {
	const appInput = getInput('app');
	const projectNameInput = getInput('projectName');

	if (!appInput && !projectNameInput) {
		throw new Error('Must specify either app or projectName.');
	}

	if (projectNameInput) {
		return projectNameInput;
	}

	const numberOfStacks = stacks.length;

	if (numberOfStacks === 1 && appInput) {
		const stack = stacks[0] as string;
		return `${stack}::${appInput}`;
	} else {
		throw new Error(
			`Unable to generate a project name as multiple stacks detected (${stacks.join(
				',',
			)}).`,
		);
	}
};

const getDeployments = (): Deployment[] => {
	const input = getInput('contentDirectories', { required: true });

	const contentDirectoriesInput = input
		? (yaml.load(input) as Record<string, string[]>)
		: {};

	const deployments: Deployment[] = Object.entries(contentDirectoriesInput).map(
		([name, sources]) => ({ name, sources }),
	);

	const totalDeployments: number = deployments.reduce(
		(acc, { sources }) => acc + sources.length,
		0,
	);

	if (totalDeployments === 0) {
		throw new Error(
			'Not configured with any deployment sources, no files will be uploaded to Riff-Raff.',
		);
	}

	return deployments;
};

const getRiffRaffYaml = (): RiffraffYaml => {
	const configInput = getInput('config');
	const configPathInput = getInput('configPath');

	if (!configInput && !configPathInput) {
		throw new Error('Must specify either config or configPath.');
	}

	const configObjFromInput = (
		configInput
			? yaml.load(configInput)
			: readConfigFile(configPathInput as string)
	) as RiffraffYaml;

	return {
		/*
    A valid `riff-raff.yaml` does not need to have `stacks` at the root level, it can be defined within each individual deployment.
    This action uses the top level `stacks` to create a default project name.
    This is a little hack to enable this behaviour, else we'd have to start validating `stacks` within each deployment.
    We create a default project name if and only if `stacks` has a single value.
     */
		...{ stacks: [] },

		...configObjFromInput,
	};
};

const envOrUndefined = (variableName: string): string | undefined => {
	const maybeEnvVar = process.env[variableName];
	return maybeEnvVar && maybeEnvVar.trim() !== ''
		? maybeEnvVar.trim()
		: undefined;
};

const branchName = (): string | undefined => {
	// `GITHUB_HEAD_REF` is only set for pull request events and represents the branch name (e.g. `feature-branch-1`).
	// `GITHUB_REF` is the branch or tag ref that triggered the workflow (e.g. `refs/heads/feature-branch-1` or `refs/pull/259/merge`).
	// Either can be the empty string ¯\_(ツ)_/¯
	// See https://docs.github.com/en/actions/learn-github-actions/environment-variables
	const branchName =
		envOrUndefined('GITHUB_HEAD_REF') ?? envOrUndefined('GITHUB_REF');
	return branchName ? branchName.replace('refs/heads/', '') : undefined;
};

const vcsURL = (): string | undefined => {
	const repoFromEnv = envOrUndefined('GITHUB_REPOSITORY');
	return repoFromEnv ? `https://github.com/${repoFromEnv}` : undefined;
};

export interface Configuration {
	projectName: string;
	riffRaffYaml: RiffraffYaml;
	dryRun: boolean;
	buildNumber: string;
	branchName: string;
	vcsURL: string;
	revision: string;
	deployments: Deployment[];
	stagingDirInput?: string;
}

const offsetBuildNumber = (buildNumber: string, offset: string | undefined): string => {
	if(typeof offset === 'undefined') {
		return buildNumber;
	}
	const intOffset = parseInt(offset);
	const intBuildNumber = parseInt(buildNumber);
	if(isNaN(intOffset) || isNaN(intBuildNumber)) {
		return buildNumber;
	} else {
		return `${intBuildNumber + intOffset}`;
	}
}

export function getConfiguration(): Configuration {
	const riffRaffYaml = getRiffRaffYaml();
	const projectName = getProjectName(riffRaffYaml);
	const dryRunInput = getInput('dryRun');
	const buildNumberInput = getInput('buildNumber');
	const buildNumberOffset = getInput('buildNumberOffset');
	const stagingDirInput = getInput('stagingDir');

	const baseBuildNumber =
		buildNumberInput ?? envOrUndefined('GITHUB_RUN_NUMBER') ?? 'dev';

	const buildNumber = offsetBuildNumber(baseBuildNumber, buildNumberOffset);

	return {
		projectName,
		riffRaffYaml,
		dryRun: dryRunInput === 'true',
		buildNumber,
		branchName: branchName() ?? 'dev',
		vcsURL: vcsURL() ?? 'dev',
		revision: envOrUndefined('GITHUB_SHA') ?? 'dev',
		deployments: getDeployments(),
		stagingDirInput,
	};
}
