export type Manifest = {
	branch: string;
	vcsURL: string;
	revision: string;
	buildNumber: string;
	projectName: string;
	startTime: Date;
};

export const manifest = (
	projectName: string,
	buildNumber: string,
	branch: string,
	vcsURL: string,
	revision: string,
): Manifest => {
	return {
		branch,
		vcsURL,
		revision,
		buildNumber,
		projectName,
		startTime: new Date(),
	};
};

export type Deployment = {
	name: string;
	sources: string[];
	data: object;
};

export type RiffraffYaml = {
	stacks: string[];
	regions: string[];
	deployments: Record<
		string,
		{
			sources?: string[];
			[name: string]: unknown;
		}
	>;
};

export const riffraffPrefix = (m: Manifest): string => {
	return [m.projectName, m.buildNumber].join('/');
};
