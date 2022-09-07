import * as fs from 'fs';
import * as core from '@actions/core';
import { S3Client } from '@aws-sdk/client-s3';
import * as yaml from 'js-yaml';
import { deleteRecursively } from './deleteRecursively';
import { cp, printDir, read, write } from './file';
import type { Deployment, RiffraffYaml } from './riffraff';
import { manifest, riffraffPrefix } from './riffraff';
import { S3Store, sync } from './s3';

const readConfigFile = (path: string): object => {
	const data = read(path);
	return yaml.load(data) as object;
};

const defaultProjectName = (app: string, stacks: string[]): string => {
	if (stacks.length < 1) {
		throw new Error('Must provide at least one stack.');
	}

	// eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- length is checked above
	return `${stacks[0]}::${app}`;
};

// getInput is like core.getInput but returns undefined for the empty string.
const getInput = (
	name: string,
	options?: core.InputOptions,
): string | undefined => {
	const got = core.getInput(name, options);
	return got === '' ? undefined : got;
};

export const main = async (): Promise<void> => {
	const app = getInput('app');
	const config = getInput('config');
	const configPath = getInput('configPath');
	const projectName = getInput('projectName');
	const dryRun = getInput('dryRun');
	const buildNumber = getInput('buildNumber');
	const stagingDirOverride = getInput('stagingDir');

	if (!config && !configPath) {
		throw new Error('Must specify either config or configPath.');
	}

	if (!app && !projectName) {
		throw new Error('Must specify either app or projectName.');
	}

	const configObjFromInput = (
		config ? yaml.load(config) : readConfigFile(configPath as string)
	) as RiffraffYaml;

	const configObj: RiffraffYaml = {
		/*
    A valid `riff-raff.yaml` does not need to have `stacks` at the root level, it can be defined within each individual deployment.
    This action uses the top level `stacks` to create a default project name.
    This is a little hack to enable this behaviour, else we'd have to start validating `stacks` within each deployment.
    We create a default project name if and only if `stacks` has a single value.
     */
		...{ stacks: [] },

		...configObjFromInput,
	};

	if (configObj.stacks.length !== 1 && !projectName) {
		throw new Error(
			`Unable to determine project name as 'projectName' is not set and unable to determine a unique stack value from the loaded config. If deploying to multiple stacks, explicitly set the 'projectName' input.`,
		);
	}

	const deployments: Deployment[] = Object.entries(configObj.deployments).map(
		([name, { sources = [], ...rest }]) => {
			return {
				name: name,
				sources: sources.map((source) => source.trim()),
				data: rest,
			};
		},
	);

	// ensure sources doesn't end up in rrYaml as RiffRaff errors with unexpected fields
	const rrObj = deleteRecursively(configObj, 'sources');
	const rrYaml = yaml.dump(rrObj);

	const name = projectName
		? projectName
		: defaultProjectName(app as string, configObj.stacks);
	const mfest = manifest(name, buildNumber);
	const manifestJSON = JSON.stringify(mfest);

	// Ensure unique name as multiple steps may run using this action within the
	// same workflow (this has happened!).
	const stagingDir = stagingDirOverride ?? fs.mkdtempSync('staging-');

	core.info('writting rr yaml...');
	write(`${stagingDir}/riff-raff.yaml`, rrYaml);

	deployments.forEach((deployment: Deployment) => {
		cp(deployment.sources, `${stagingDir}/${deployment.name}`);
	});

	if (dryRun === 'true') {
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
