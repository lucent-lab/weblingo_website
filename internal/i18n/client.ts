export type ClientMessages = Record<string, string>;

export function createClientTranslator(messages: ClientMessages) {
  return (key: string, fallback?: string, vars?: Record<string, string>) => {
    const template = messages[key] ?? fallback ?? key;
    if (!vars) return template;
    return Object.entries(vars).reduce(
      (acc, [varKey, value]) => acc.replace(new RegExp(`{${varKey}}`, "g"), value),
      template,
    );
  };
}
