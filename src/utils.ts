/** Convert a string to a clean kebab-case slug suitable for CLI command names. */
export function kebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[_\s/]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

/** Convert kebab-case to lower camelCase (used to read commander-parsed flag values). */
export function camelCase(input: string): string {
  return input.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

/** Substitute `{var}` placeholders in an OpenAPI server URL using its variables map. */
export function expandServerUrl(
  url: string,
  variables?: Record<string, { default?: string; enum?: string[] }>
): string {
  if (!variables) return url
  return url.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const v = variables[key]
    return v?.default ?? `{${key}}`
  })
}
