/**
 * Spec 50 (D131, D19, invariant 10) : ce qui part vers Sentry ne contient ni phrase, ni lieu, ni coordonnée, ni domicile.
 * Fonctions pures, sans dépendance au SDK : elles reçoivent et rendent des objets de la forme des événements Sentry.
 */

/**
 * Ce que l'on touche d'un événement Sentry ; le reste (pile, contextes techniques) passe tel quel.
 * Sans signature d'index : les types du SDK (`ErrorEvent`, `Breadcrumb`) sont des interfaces.
 */
export interface EvenementSentry {
  message?: string;
  user?: unknown;
  extra?: unknown;
  request?: { url?: string };
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: MietteSentry[];
}

export interface MietteSentry {
  category?: string;
  type?: string;
  message?: string;
  data?: { [cle: string]: unknown };
}

const CATEGORIES_RESEAU = new Set(["http", "fetch", "xhr"]);

/** Une URL réduite à son chemin, sans requête ni fragment ; un texte qui n'est pas une URL perd quand même sa requête. */
export function cheminSeul(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.replace(/[?#].*$/, "");
  }
}

/**
 * Retire d'un texte libre les citations, requêtes d'URL, coordonnées et courriels.
 * Nos messages citent le texte saisi entre guillemets (« … » ou "…") : la citation entière est masquée.
 */
export function masquerTexte(texte: string): string {
  return texte
    .replace(/«[^»]*»/g, "«…»")
    .replace(/"[^"]*"/g, '"…"')
    .replace(/\?[^\s"')»]*/g, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[courriel]")
    .replace(/-?\d{1,3}\.\d{4,}/g, "[coord]");
}

/** `beforeBreadcrumb` : null supprime la miette. */
export function nettoyerMiette<M extends MietteSentry>(miette: M): M | null {
  if (miette.category === "console") return null;
  const propre: M = { ...miette };
  if (propre.message !== undefined) propre.message = masquerTexte(propre.message);
  if (CATEGORIES_RESEAU.has(propre.category ?? "") || propre.type === "http") {
    const d = miette.data ?? {};
    const url = typeof d.url === "string" ? cheminSeul(d.url) : undefined;
    propre.data = {
      ...(d.method !== undefined ? { method: d.method } : {}),
      ...(d.status_code !== undefined ? { status_code: d.status_code } : {}),
      ...(url !== undefined ? { url } : {}),
    };
    return propre;
  }
  if (propre.category === "navigation") {
    const d = miette.data ?? {};
    propre.data = {
      ...(typeof d.from === "string" ? { from: cheminSeul(d.from) } : {}),
      ...(typeof d.to === "string" ? { to: cheminSeul(d.to) } : {}),
    };
    return propre;
  }
  if (propre.data !== undefined) delete propre.data;
  return propre;
}

/** `beforeSend` : l'événement sans rien de personnel. */
export function nettoyerEvenement<E extends EvenementSentry>(evenement: E): E {
  const propre: E = { ...evenement };
  delete propre.user;
  delete propre.extra;
  if (propre.request) {
    // Tout le reste de la requête (corps, en-têtes, cookies, requête d'URL) disparaît.
    const { url } = propre.request;
    propre.request = (url !== undefined ? { url: cheminSeul(url) } : {}) as E["request"];
  }
  if (propre.message !== undefined) propre.message = masquerTexte(propre.message);
  if (propre.exception?.values) {
    propre.exception = {
      ...propre.exception,
      values: propre.exception.values.map((v) => (v.value !== undefined ? { ...v, value: masquerTexte(v.value) } : v)),
    };
  }
  if (propre.breadcrumbs) {
    propre.breadcrumbs = propre.breadcrumbs.map((m) => nettoyerMiette(m)).filter((m) => m !== null) as E["breadcrumbs"];
  }
  return propre;
}
