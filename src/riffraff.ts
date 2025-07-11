export type Manifest = {
	branch: string;
	vcsURL: string;
	revision: string;
	buildNumber: string;
	projectName: string;
	startTime: Date;
	buildTool: string;
};

export const getManifest = (
	projectName: string,
	buildNumber: string,
	branch: string,
	vcsURL: string,
	revision: string,
	buildTool: string,
): Manifest => {
	return {
		branch,
		vcsURL,
		revision,
		buildNumber,
		projectName,
		startTime: new Date(),
		buildTool,
	};
};

export type Deployment = {
	name: string;
	sources: string[];
};

export type RiffraffYaml = {
	stacks: string[];
	regions: string[];
	deployments: Record<string, Record<string, unknown>>;
};

export const riffraffPrefix = (m: Manifest): string => {
	return [m.projectName, m.buildNumber].join('/');
};
