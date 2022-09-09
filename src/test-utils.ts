import * as yaml from 'js-yaml';

// Read yaml config and set env vars to mimic GHA
export const readConfig = (yamlConfig: string): void => {
	const config = yaml.load(yamlConfig) as object;
	Object.entries(config).forEach(([k, v]) => {
		const name = `INPUT_${k.replace(/ /g, '_').toUpperCase()}`;
		process.env[name] = v as string;
	});

	// process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || ''
};

export const clearConfig = () => {
	Object.keys(process.env)
		.filter((_) => _.startsWith('INPUT_'))
		.forEach((_) => delete process.env[_]);
};
