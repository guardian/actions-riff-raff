import { debug } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import type { PullRequestCommentConfig } from './config';

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

const signature =
	'_From [guardian/actions-riff-raff](https://github.com/guardian/actions-riff-raff)._';

function getCommentMessage(config: PullRequestCommentConfig): string {
	const { buildNumber, commentingStage } = config;
	const deployUrl = getDeployUrl(config).toString();
	const previewUrl = getPreviewUrl(config).toString();

	const mainMessage = `[Deploy build ${buildNumber} to ${commentingStage}](${deployUrl})`;

	return [
		`### ${mainMessage}`,
		'<details>',
		'<summary>All deployment options</summary>',
		'',
		`- ${mainMessage}`,
		`- [Deploy parts of build ${buildNumber} to ${commentingStage} by previewing it first](${previewUrl})`,
		'</details>',
		'',
		'---',
		signature,
	].join('\n');
}

export async function commentOnPullRequest(config: PullRequestCommentConfig) {
	const comment = getCommentMessage(config);
	const { pull_request } = context.payload;

	if (pull_request) {
		const octokit = getOctokit(config.githubToken, {});

		const comments = await octokit.rest.issues.listComments({
			...context.repo,
			issue_number: pull_request.number,
		});

		debug(`Total comments: ${comments.data.length}`);

		const previousComment = comments.data.find((comment) => {
			const fromBot = comment.user?.login === 'github-actions[bot]';
			const fromUs = comment.body?.includes(signature) ?? false;
			return fromBot && fromUs;
		});

		if (previousComment) {
			debug(
				`Found a comment by github-actions[bot] (id: ${previousComment.id}). Updating it.`,
			);
			await octokit.rest.issues.updateComment({
				...context.repo,
				comment_id: previousComment.id,
				body: comment,
			});
		} else {
			debug(`No previous comment found. Creating one.`);
			await octokit.rest.issues.createComment({
				...context.repo,
				issue_number: pull_request.number,
				body: comment,
			});
		}
	}
}
