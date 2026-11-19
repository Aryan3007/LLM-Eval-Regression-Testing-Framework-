const VAR = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

/** Env vars whose names look like credentials are never baked into hashes or cache keys. */
export const SECRET_NAME = /KEY|TOKEN|SECRET|PASSWORD|AUTH|CREDENTIAL/i;

export interface InterpolateResult<T> {
  /** Every `${VAR}` replaced with its value. Use this to run. */
  value: T;
  /** Same, but secret-looking vars stay as `${NAME}`. Use this for hashing/caching. */
  hashable: T;
  missing: string[];
}

/** Replace `${VAR}` and `${VAR:-default}` in every string inside a parsed YAML value. */
export function interpolateEnv<T>(
  input: T,
  env: Record<string, string | undefined>,
): InterpolateResult<T> {
  const missing = new Set<string>();

  const walk = (value: unknown, keepSecrets: boolean): unknown => {
    if (typeof value === 'string') {
      return value.replace(VAR, (match, name: string, fallback: string | undefined) => {
        if (keepSecrets && SECRET_NAME.test(name)) return match;
        const resolved = env[name] ?? fallback;
        if (resolved === undefined) {
          missing.add(name);
          return match;
        }
        return resolved;
      });
    }
    if (Array.isArray(value)) return value.map((v) => walk(v, keepSecrets));
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, walk(v, keepSecrets)]),
      );
    }
    return value;
  };

  const value = walk(input, false) as T;
  const hashable = walk(input, true) as T;
  return { value, hashable, missing: [...missing].sort() };
}
