import { riffraffPrefix } from './riffraff';
import type { Manifest } from './riffraff';

describe('riffraff', () => {
	it('should return the correct S3 prefix', () => {
		const m: Manifest = {
			branch: 'main',
			vcsURL: 'https://github.com/guardian/example',
			revision: 'dev',
			buildNumber: '10',
			projectName: 'example',
			startTime: new Date(),
			buildTool: 'guardian/actions-riff-raff',
		};

		const got = riffraffPrefix(m);
		const want = 'example/10';

		expect(got).toBe(want);
	});
});
