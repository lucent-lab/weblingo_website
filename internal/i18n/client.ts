export type ClientMessages = Record<string, string>;

export function createClientTranslator(messages: ClientMessages) {
  return (key: string, fallback?: string, vars?: Record<string, string>) => {
    const template = key in messages ? messages[key] : (fallback ?? key);
    if (vars == null) return template;
    return Object.entries(vars).reduce(
      (acc, [varKey, value]) => acc.replace(new RegExp(`{${varKey}}`, "g"), value),
      template,
    );
  };
}
