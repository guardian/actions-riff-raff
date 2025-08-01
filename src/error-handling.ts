import * as core from '@actions/core';
import type { AnnotationProperties } from '@actions/core';
import { context } from '@actions/github';
import { S3ServiceException } from '@aws-sdk/client-s3';
import { envOrUndefined } from './config';
import type { Octokit } from './types';

async function getWorkflowFileContent(
	octokit: Octokit,
	branchName: string,
	filename: string,
): Promise<string | undefined> {
	const result = await octokit.rest.repos.getContent({
		...context.repo,
		ref: branchName,
		path: filename,
	});

	if (!Array.isArray(result.data) && result.data.type === 'file') {
		return atob(result.data.content);
	}

	return undefined;
}

function accessDeniedErrorMessage(
	projectName: string,
	properties?: AnnotationProperties,
) {
	core.error(
		`Error uploading to Riff-Raff. Have you added ${projectName} to https://github.com/guardian/riffraff-platform?`,
		properties,
	);
}

export async function handleS3UploadError(
	thrownError: unknown,
	octokit: Octokit,
	branchName: string,
	projectName: string,
) {
	const isAccessDeniedError =
		thrownError instanceof S3ServiceException &&
		thrownError.name === 'AccessDenied';

	// Generic error handling for other errors.
	if (!isAccessDeniedError) {
		core.error(`Unknown error. Check logs for more detail.`);
		return;
	}

	// Annotations can only be seen in a PR, return early if not in a PR.
	if (context.eventName !== 'pull_request') {
		accessDeniedErrorMessage(projectName);
		return;
	}

	const workflow = envOrUndefined('GITHUB_WORKFLOW_REF') ?? '';
	const regex = /^.+\/.+\/(?<filename>\.github\/workflows\/\w+\.(yaml|yml)).*$/;

	const { filename } = regex.exec(workflow)?.groups ?? {};

	if (!filename) {
		accessDeniedErrorMessage(projectName);
		return;
	}

	const workflowFileContent = await getWorkflowFileContent(
		octokit,
		branchName,
		filename,
	);

	if (!workflowFileContent) {
		accessDeniedErrorMessage(projectName);
		return;
	}

	// Add an annotation to the GitHub Workflow file. This should appear on the "files changed" tab of the PR.
	workflowFileContent.split('\n').forEach((line, index) => {
		if (line.includes(projectName)) {
			accessDeniedErrorMessage(projectName, {
				title: 'Error uploading to Riff-Raff',
				file: filename,
				startLine: index + 1,
				endLine: index + 1,
			});
		}
	});
}
