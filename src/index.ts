import * as fs from 'fs';
import * as core from '@actions/core';
import { context } from '@actions/github';
import { S3Client } from '@aws-sdk/client-s3';
import * as yaml from 'js-yaml';
import { getConfiguration } from './config';
import { cp, printDir, write } from './file';
import { commentOnPullRequest } from './pr-comment';
import type { Deployment } from './riffraff';
import { manifest, riffraffPrefix } from './riffraff';
import { S3Store, sync } from './s3';

interface Options {
	WithSummary: boolean; // Use to disable summary when running locally.
}

export const main = async (options: Options): Promise<void> => {
	const config = getConfiguration();

	core.debug(JSON.stringify(config, null, 2));

	const {
		riffRaffYaml,
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

	const store = new S3Store(new S3Client({ region: 'eu-west-1' }));
	const keyPrefix = riffraffPrefix(mfest);

	core.info(`S3 prefix: ${keyPrefix}`);

	await sync(store, stagingDir, 'riffraff-artifact', keyPrefix);

	// Do this bit last to avoid any race conditions, as this is the file that
	// triggers RR CD.
	await store.put(
		Buffer.from(manifestJSON, 'utf8'),
		'riffraff-builds',
		keyPrefix + '/build.json',
	);

	core.info('Upload complete.');

	const { pull_request } = context.payload;

	if (pull_request) {
		core.info(`Commenting on PR ${pull_request.number}`);
		await commentOnPullRequest(pull_request.number, pullRequestComment);
	} else {
		core.info(
			`Not a pull request, so cannot add a comment. Event is ${context.eventName}`,
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
