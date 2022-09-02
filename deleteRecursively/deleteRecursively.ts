// Recursively delete a path like 'foo.bar' from an object
export const deleteRecursively = (obj: unknown, key: string): unknown => {
	if (key === '') return obj;

	if (Array.isArray(obj)) {
		obj.forEach((val) => deleteRecursively(val, key));
	} else if (typeof obj === 'object' && obj != null) {
		// @ts-expect-error -- a more sensible comment is needed here...
		delete obj[key];
		Object.entries(obj).forEach(([, v]) => {
			deleteRecursively(v, key);
		});
	}

	return obj;
};
