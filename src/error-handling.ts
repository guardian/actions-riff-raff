import * as core from '@actions/core';
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

function defaultS3ErrorMessage(projectName: string) {
	core.error(
		`Error uploading to Riff-Raff. Have you added ${projectName} to https://github.com/guardian/riffraff-platform?`,
	);
}

export async function handleS3UploadError(
	thrownError: unknown,
	octokit: Octokit,
	branchName: string,
	projectName: string,
) {
	if (
		context.eventName === 'pull_request' && // Annotations can only be seen in a PR.
		thrownError instanceof S3ServiceException &&
		thrownError.name === 'AccessDenied'
	) {
		const workflow = envOrUndefined('GITHUB_WORKFLOW_REF') ?? '';
		const regex =
			/^.+\/.+\/(?<filename>\.github\/workflows\/\w+\.(yaml|yml)).*$/;

		const { filename } = regex.exec(workflow)?.groups ?? {};

		if (filename) {
			const workflowFileContent = await getWorkflowFileContent(
				octokit,
				branchName,
				filename,
			);

			if (workflowFileContent) {
				// Add an annotation to the GitHub Workflow file. This should appear on the "files changed" tab of the PR.
				workflowFileContent.split('\n').forEach((line, index) => {
					if (line.includes(projectName)) {
						core.error(
							`Have you added ${projectName} to https://github.com/guardian/riffraff-platform?`,
							{
								title: 'Error uploading to Riff-Raff',
								file: filename,
								startLine: index + 1,
								endLine: index + 1,
							},
						);
					}
				});
			} else {
				defaultS3ErrorMessage(projectName);
			}
		} else {
			defaultS3ErrorMessage(projectName);
		}
	} else {
		defaultS3ErrorMessage(projectName);
	}
}
