import { deleteRecursively } from './deleteRecursively';

it('should remove unsupported fields from config', () => {
	const myObj = {
		deployments: {
			cfn: { sources: ['foo', 'bar'], apple: 'tree', count: 100 },
			s3: { sources: ['zap'], count: 20 },
		},
	};

	const want = {
		deployments: {
			cfn: { apple: 'tree', count: 100 },
			s3: { count: 20 },
		},
	};

	const got = deleteRecursively(myObj, 'sources');
	expect(got).toEqual(want);
});
