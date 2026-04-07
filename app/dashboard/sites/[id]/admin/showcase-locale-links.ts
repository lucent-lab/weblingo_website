export function buildShowcaseLocaleLinks(
  websitePath: string,
  targetLangs: string[],
  defaultLang: string | null,
) {
  const seen = new Set<string>();
  const links = targetLangs
    .filter((targetLang) => {
      if (!targetLang || seen.has(targetLang)) {
        return false;
      }
      seen.add(targetLang);
      return true;
    })
    .map((targetLang) => ({
      targetLang,
      isDefault: targetLang === defaultLang,
      url: `https://t2.weblingo.app/${websitePath}/${targetLang}`,
    }));
  const defaultLinks = links.filter((link) => link.isDefault);
  const nonDefaultLinks = links.filter((link) => !link.isDefault);
  return [...defaultLinks, ...nonDefaultLinks];
}
