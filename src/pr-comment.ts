import { debug } from '@actions/core';
import { context } from '@actions/github';
import type { PullRequestCommentConfig } from './config';
import type { Octokit } from './types';

function getDeployUrl(config: PullRequestCommentConfig): URL {
	const url = new URL('https://riffraff.gutools.co.uk/deployment/deployAgain');

	url.searchParams.set('project', config.projectName);
	url.searchParams.set('build', config.buildNumber);
	url.searchParams.set('stage', config.commentingStage);
	url.searchParams.set('updateStrategy', 'MostlyHarmless');
	url.searchParams.set('action', 'deploy');

	return url;
}

function getPreviewUrl(config: PullRequestCommentConfig): URL {
	const url = new URL('https://riffraff.gutools.co.uk/preview/yaml');

	url.searchParams.set('project', config.projectName);
	url.searchParams.set('build', config.buildNumber);
	url.searchParams.set('stage', config.commentingStage);
	url.searchParams.set('updateStrategy', 'MostlyHarmless');

	return url;
}

function getWhatsOnUrl(config: PullRequestCommentConfig): URL {
	const url = new URL('https://riffraff.gutools.co.uk/deployment/history');

	url.searchParams.set('projectName', config.projectName);
	url.searchParams.set('stage', config.commentingStage);

	return url;
}

const marker = (projectName: string) => {
	return `<!-- guardian/actions-riff-raff for ${projectName} -->`;
};

function getCommentMessage(config: PullRequestCommentConfig): string {
	const { buildNumber, commentingStage, projectName } = config;
	const deployUrl = getDeployUrl(config).toString();
	const previewUrl = getPreviewUrl(config).toString();
	const whatsOnUrl = getWhatsOnUrl(config).toString();

	const mainMessage = `[Deploy build ${buildNumber} of \`${projectName}\` to ${commentingStage}](${deployUrl})`;

	return [
		`### ${mainMessage}`,
		'<details>',
		'<summary>All deployment options</summary>',
		'',
		`- ${mainMessage}`,
		`- [Deploy parts of build ${buildNumber} to ${commentingStage} by previewing it first](${previewUrl})`,
		`- [What's on ${commentingStage} right now?](${whatsOnUrl})`,
		'</details>',
		'',
		'---',
		'_From [guardian/actions-riff-raff](https://github.com/guardian/actions-riff-raff)._',
		marker(projectName),
	].join('\n');
}

export async function commentOnPullRequest(
	pullRequestNumber: number,
	config: PullRequestCommentConfig,
	octokit: Octokit,
) {
	const comment = getCommentMessage(config);

	const comments = await octokit.rest.issues.listComments({
		...context.repo,
		issue_number: pullRequestNumber,
	});

	debug(`Total comments: ${comments.data.length}`);

	const previousComments = comments.data.filter((comment) => {
		const fromBot = comment.user?.login === 'github-actions[bot]';
		const fromMe = comment.body?.includes(marker(config.projectName)) ?? false;
		return fromBot && fromMe;
	});

	if (previousComments.length > 0) {
		debug(`Found ${previousComments.length} comments by github-actions[bot]`);

		await Promise.all(
			previousComments.map(async (previousComment) => {
				debug(`Updating comment with id: ${previousComment.id}.`);
				await octokit.rest.issues.updateComment({
					...context.repo,
					comment_id: previousComment.id,
					body: comment,
				});
			}),
		);
	} else {
		debug(`No previous comment found. Creating one.`);
		await octokit.rest.issues.createComment({
			...context.repo,
			issue_number: pullRequestNumber,
			body: comment,
		});
	}
}

export async function getPullRequestNumber(
	octokit: Octokit,
): Promise<number | undefined> {
	const { eventName } = context;
	const { pull_request } = context.payload;

	if (pull_request) {
		debug(
			`Identified PR number as ${pull_request.number} from payload. Trigger was ${eventName}.`,
		);
		return Promise.resolve(pull_request.number);
	}

	debug(`Attempting to get PR number from commit ${context.sha}`);

	const result = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
		...context.repo,
		commit_sha: context.sha,
	});

	const openPrs = result.data.filter(({ state }) => state === 'open');
	const pr =
		openPrs.find((_) => context.ref === `refs/heads/${_.head.ref}`) ??
		openPrs.at(0);

	if (!pr) {
		debug(
			`Failed to identify PR number from commit. Trigger was ${eventName}.`,
		);
		return undefined;
	}

	debug(
		`Identified PR number as ${pr.number} from commit. Trigger was ${eventName}.`,
	);
	debug(JSON.stringify(pr, null, 2));
	return pr.number;
}
