import * as path from 'path';

process.env.GITHUB_EVENT_PATH ??= path.resolve(
	import.meta.dirname,
	'../fixtures/github-event.json',
);
