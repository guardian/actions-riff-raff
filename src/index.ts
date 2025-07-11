import * as fs from 'fs';
import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { S3Client } from '@aws-sdk/client-s3';
import { fromWebToken } from '@aws-sdk/credential-providers';
import * as yaml from 'js-yaml';
import { getConfiguration } from './config';
import { handleS3UploadError } from './error-handling';
import { cp, printDir, write } from './file';
import { commentOnPullRequest, getPullRequestNumber } from './pr-comment';
import type { Deployment } from './riffraff';
import { getManifest, riffraffPrefix } from './riffraff';
import { S3Store, sync } from './s3';
import type { Octokit } from './types';

/**
 * Amazon STS expects OIDC tokens with the `aud` (audience) field set to `sts.amazonaws.com`
 */
const GITHUB_OIDC_AUDIENCE = 'sts.amazonaws.com';

interface Options {
	WithSummary: boolean; // Use to disable summary when running locally.
}

function validateTopics(topics: string[]): void {
	const deployableTopics = ['production', 'hackday', 'prototype', 'learning'];
	const hasValidTopic = topics.some((topic) =>
		deployableTopics.includes(topic),
	);
	if (!hasValidTopic) {
		const topicList = deployableTopics.join(', ');
		throw new Error(
			`No valid repository topic found. Add one of ${topicList}. See https://github.com/guardian/recommendations/blob/main/github.md#topics`,
		);
	} else {
		core.info('Valid topic found');
	}
}

export const main = async (options: Options): Promise<void> => {
	/*
  Print the context early.
  This is useful for debugging.
  See https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging.
   */
	core.debug(JSON.stringify(context, null, 2));

	const config = getConfiguration();
	validateTopics(context.payload.repository?.topics as string[]);

	core.debug(JSON.stringify(config, null, 2));

	const {
		riffRaffYaml,
		roleArn,
		projectName,
		dryRun,
		buildNumber,
		branchName,
		vcsURL,
		revision,
		deployments,
		stagingDirInput,
		pullRequestComment,
		githubToken,
	} = config;

	const octokit: Octokit = getOctokit(githubToken);

	const manifest = getManifest(
		projectName,
		buildNumber,
		branchName,
		vcsURL,
		revision,
		'guardian/actions-riff-raff',
	);
	const manifestJSON = JSON.stringify(manifest);

	// Ensure unique name as multiple steps may run using this action within the
	// same workflow (this has happened!).
	const stagingDir = stagingDirInput ?? fs.mkdtempSync('staging-');

	core.info('writing rr yaml...');
	write(`${stagingDir}/riff-raff.yaml`, yaml.dump(riffRaffYaml));

	deployments.forEach((deployment: Deployment) => {
		cp(deployment.sources, `${stagingDir}/${deployment.name}`);
	});

	if (dryRun) {
		core.info('Output (dryRun=true):');
		core.info(printDir(stagingDir));
		return;
	}

	const idToken = await core.getIDToken(GITHUB_OIDC_AUDIENCE);

	const store = new S3Store(
		new S3Client({
			region: 'eu-west-1',
			credentials: fromWebToken({
				roleArn: roleArn,
				webIdentityToken: idToken,
			}),
		}),
	);
	const keyPrefix = riffraffPrefix(manifest);

	core.info(`S3 prefix: ${keyPrefix}`);

	try {
		await sync(store, stagingDir, 'riffraff-artifact', keyPrefix);

		// Do this bit last to avoid any race conditions, as this is the file that
		// triggers RR CD.
		await store.put(
			Buffer.from(manifestJSON, 'utf8'),
			'riffraff-builds',
			keyPrefix + '/build.json',
		);

		core.info('Upload complete.');

		if (options.WithSummary) {
			await core.summary
				.addHeading('Riff-Raff')
				.addTable([
					['Project name', projectName],
					['Build number', buildNumber],
				])
				.write();
		}
	} catch (err) {
		await handleS3UploadError(err, octokit, branchName, projectName);

		// re-throw to fail the action
		throw err;
	}

	if (pullRequestComment.commentingEnabled) {
		try {
			const pullRequestNumber = await getPullRequestNumber(octokit);
			if (pullRequestNumber) {
				core.info(`Commenting on PR ${pullRequestNumber}`);
				await commentOnPullRequest(
					pullRequestNumber,
					pullRequestComment,
					octokit,
				);
			} else {
				core.info(
					`Unable to calculate Pull Request number, so cannot add a comment. Event is ${context.eventName}`,
				);
			}
		} catch (err) {
			core.error(
				'Error commenting on PR. Do you have the correct permissions?',
			);

			// throw to fail the action
			throw err;
		}
	} else {
		core.info('commentingEnabled is `false`, skipping comment');
	}
};

// execute only if invoked as main script (rather than test)
if (require.main === module) {
	main({ WithSummary: true }).catch((err) => {
		if (err instanceof Error) {
			core.error(err);
			core.setFailed(err.message);
		}
	});
}
