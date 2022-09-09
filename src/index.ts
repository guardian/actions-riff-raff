import * as fs from 'fs';
import * as core from '@actions/core';
import { S3Client } from '@aws-sdk/client-s3';
import * as yaml from 'js-yaml';
import { getConfiguration } from './config';
import { deleteRecursively } from './deleteRecursively';
import { cp, printDir, write } from './file';
import type { Deployment } from './riffraff';
import { manifest, riffraffPrefix } from './riffraff';
import { S3Store, sync } from './s3';

export const main = async (): Promise<void> => {
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
	} = config;

	// ensure sources doesn't end up in rrYaml as RiffRaff errors with unexpected fields
	const rrObj = deleteRecursively(riffRaffYaml, 'sources');
	const rrYaml = yaml.dump(rrObj);

	const mfest = manifest(
		projectName,
		buildNumber,
		branchName,
		vcsURL,
		revision,
	);
	const manifestJSON = JSON.stringify(mfest);

	// Ensure unique name as multiple steps may run using this action within the
	// same workflow (this has happened!).
	const stagingDir = stagingDirInput ?? fs.mkdtempSync('staging-');

	core.info('writting rr yaml...');
	write(`${stagingDir}/riff-raff.yaml`, rrYaml);

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
};

// execute only if invoked as main script (rather than test)
if (require.main === module) {
	main().catch((err) => {
		if (err instanceof Error) {
			core.error(err);
			core.setFailed(err.message);
		}
	});
}
