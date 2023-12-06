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
) {
	const comment = getCommentMessage(config);
	const octokit = getOctokit(config.githubToken);

	const comments = await octokit.rest.issues.listComments({
		...context.repo,
		issue_number: pullRequestNumber,
	});

	debug(`Total comments: ${comments.data.length}`);

	const previousComment = comments.data.find((comment) => {
		const fromBot = comment.user?.login === 'github-actions[bot]';
		const fromMe = comment.body?.includes(marker(config.projectName)) ?? false;
		return fromBot && fromMe;
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
			issue_number: pullRequestNumber,
			body: comment,
		});
	}
}
