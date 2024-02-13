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

type Sources = Record<string, string[]>;

const isSources = (obj: unknown): obj is Sources => {
	if (typeof obj === 'object') {
		return Object.values(obj as object).every((source) =>
			Array.isArray(source),
		);
	}

	return false;
};

const getDeployments = (): Deployment[] => {
	const input = getInput('contentDirectories', { required: true });

	const contentDirectoriesInput = input ? yaml.load(input) : {};

	if (!isSources(contentDirectoriesInput)) {
		throw new Error(
			`Invalid contentDirectories. Each value must be a list of sources, but got: ${
				input ?? ''
			}`,
		);
	}

	if (isSources(contentDirectoriesInput)) {
		const deployments: Deployment[] = Object.entries(
			contentDirectoriesInput,
		).map(([name, sources]) => ({ name, sources }));

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
	}

	throw new Error(
		`Invalid contentDirectories. Each value must be a list of sources, but got: ${
			input ?? ''
		}`,
	);
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

export interface PullRequestCommentConfig {
	projectName: string;
	buildNumber: string;
	commentingStage: string;
	githubToken: string;
}

export interface Configuration {
	projectName: string;
	roleArn: string;
	riffRaffYaml: RiffraffYaml;
	dryRun: boolean;
	buildNumber: string;
	branchName: string;
	vcsURL: string;
	revision: string;
	deployments: Deployment[];
	stagingDirInput?: string;
	pullRequestComment: PullRequestCommentConfig;
}

const offsetBuildNumber = (buildNumber: string, offset: string): string => {
	const intOffset = parseInt(offset);
	const intBuildNumber = parseInt(buildNumber);
	if (isNaN(intOffset) || isNaN(intBuildNumber)) {
		return buildNumber;
	} else {
		return (intBuildNumber + intOffset).toString();
	}
};

const githubToken = (): string => {
	const token = getInput('githubToken', { required: true });
	if (!token) {
		throw new Error('githubToken not supplied');
	}
	return token;
};

const getRoleArn = (): string => {
	const roleArn = getInput('roleArn', { required: true });
	if (!roleArn) {
		throw new Error('roleArn not supplied');
	}
	return roleArn;
};

export function getConfiguration(): Configuration {
	const riffRaffYaml = getRiffRaffYaml();
	const projectName = getProjectName(riffRaffYaml);
	const roleArn = getRoleArn();
	const dryRunInput = getInput('dryRun');
	const buildNumberInput = getInput('buildNumber');
	const buildNumberOffset = getInput('buildNumberOffset') ?? '0';
	const stagingDirInput = getInput('stagingDir');

	const baseBuildNumber =
		buildNumberInput ?? envOrUndefined('GITHUB_RUN_NUMBER') ?? 'dev';

	const buildNumber = offsetBuildNumber(baseBuildNumber, buildNumberOffset);
	const commentingStage = getInput('commentingStage') ?? 'CODE';

	return {
		projectName,
		roleArn,
		riffRaffYaml,
		dryRun: dryRunInput === 'true',
		buildNumber,
		branchName: branchName() ?? 'dev',
		vcsURL: vcsURL() ?? 'dev',
		revision: envOrUndefined('GITHUB_SHA') ?? 'dev',
		deployments: getDeployments(),
		stagingDirInput,
		pullRequestComment: {
			projectName,
			buildNumber,
			commentingStage,
			githubToken: githubToken(),
		},
	};
}
