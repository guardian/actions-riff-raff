// Recursively delete a path like 'foo.bar' from an object
export const deleteRecursively = (obj: any, key: string): any => {
  if (key === "") return obj;

  if (Array.isArray(obj)) {
    obj.forEach((val) => deleteRecursively(val, key));
  } else if (typeof obj === "object" && obj != null) {
    delete obj[key];
    Object.entries(obj).forEach(([_, v]) => {
      deleteRecursively(v, key);
    });
  }

  return obj;
};
