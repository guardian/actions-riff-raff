import * as fs from 'fs';
import * as core from '@actions/core';
import { context } from '@actions/github';
import { S3Client } from '@aws-sdk/client-s3';
import { fromWebToken } from '@aws-sdk/credential-providers';
import * as yaml from 'js-yaml';
import { getConfiguration } from './config';
import { cp, printDir, write } from './file';
import { commentOnPullRequest, getPullRequestNumber } from './pr-comment';
import type { Deployment } from './riffraff';
import { manifest, riffraffPrefix } from './riffraff';
import { S3Store } from './s3';

/**
 * Amazon STS expects OIDC tokens with the `aud` (audience) field set to `sts.amazonaws.com`
 */
const GITHUB_OIDC_AUDIENCE = 'sts.amazonaws.com';

interface Options {
	WithSummary: boolean; // Use to disable summary when running locally.
}

class RiffRaffUploadError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RiffRaffUploadError';
	}
}

function validateTopics(topics: string[]): void {
	const deployableTopics = ['production', 'hackday', 'prototype', 'learning'];
	const hasValidTopic = topics.some((topic) =>
		deployableTopics.includes(topic),
	);
	if (!hasValidTopic) {
		const topicList = deployableTopics.join(', ');
		throw new RiffRaffUploadError(
			`No valid repository topic found. Add one of ${topicList}. See https://github.com/guardian/recommendations/blob/main/github.md#topics.`,
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
	} = config;

	const mfest = manifest(
		projectName,
		buildNumber,
		branchName,
		vcsURL,
		revision,
		'guardian/actions-riff-raff',
	);
	const manifestJSON = JSON.stringify(mfest);

	// Ensure unique name as multiple steps may run using this action within the
	// same workflow (this has happened!).
	const stagingDir = stagingDirInput ?? fs.mkdtempSync('staging-');

	if (options.WithSummary) {
		await core.summary
			.addHeading('Riff-Raff')
			.addTable([
				['Project name', projectName],
				['Build number', buildNumber],
			])
			.write();
	}

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
	const keyPrefix = riffraffPrefix(mfest);

	core.info(`S3 prefix: ${keyPrefix}`);

	await store.putDirectory('riffraff-artifact', keyPrefix, stagingDir);

	// Do this bit last to avoid any race conditions, as this is the file that
	// triggers RR CD.
	await store.putObject(
		'riffraff-builds',
		keyPrefix + '/build.json',
		Buffer.from(manifestJSON, 'utf8'),
	);

	core.info('Upload complete.');

	const pullRequestNumber = await getPullRequestNumber(pullRequestComment);
	if (pullRequestNumber) {
		core.info(`Commenting on PR ${pullRequestNumber}`);
		await commentOnPullRequest(pullRequestNumber, pullRequestComment);
	} else {
		core.info(
			`Unable to calculate Pull Request number, so cannot add a comment. Event is ${context.eventName}`,
		);
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
