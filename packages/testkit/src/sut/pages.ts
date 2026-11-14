// sut.pages: the module's pages as a person reads them, over HTTP and without a browser (ADR 0131). A page is parsed
// with happy-dom, and a test finds its elements with Testing Library's queries: by role, accessible name, label and
// text, never by a tag, a class or a test ID.
import { createRequire } from "node:module";
import * as dom from "@testing-library/dom";
import { Window } from "happy-dom";

// dom-accessibility-api's types are not reachable through its package exports.
const { computeAccessibleName } = createRequire(import.meta.url)("dom-accessibility-api") as {
  computeAccessibleName(element: unknown): string;
};

/** What a role query can ask besides the role, as Testing Library's `ByRoleOptions`. */
export interface RoleOptions {
  name?: string | RegExp;
  level?: number;
  current?: boolean | string;
  checked?: boolean;
  selected?: boolean;
}

/** The queries of a page or of an element in it. A `get` query fails unless exactly one element matches. */
export interface Queries {
  getByRole(role: string, options?: RoleOptions): Found;
  queryByRole(role: string, options?: RoleOptions): Found | undefined;
  getAllByRole(role: string, options?: RoleOptions): Found[];
  queryAllByRole(role: string, options?: RoleOptions): Found[];
  getByText(text: string | RegExp): Found;
  queryByText(text: string | RegExp): Found | undefined;
  getAllByText(text: string | RegExp): Found[];
  getByLabelText(label: string | RegExp): Found;
}

/** An element of a page, found by a query. */
export interface Found extends Queries {
  /** The accessible name, as a screen reader reads it. */
  name: string;
  /** The text inside the element, with its whitespace collapsed. */
  text: string;
  /** The value of the attribute, such as a link's `href`, or undefined when the element has none. */
  attribute(name: string): string | undefined;
}

/** A form of the page: where it sends its fields, and its name when it has one (only a named form has a role). */
export interface PageForm {
  name: string;
  method: string;
  action: string;
}

export interface Page extends Queries {
  status: number;
  /** The path and query of the page, after every redirect that was followed. */
  path: string;
  headers: Record<string, string>;
  /** Where a redirect that was not followed points. */
  location: string | undefined;
  title: string;
  /** The text of the body, with its whitespace collapsed. */
  text: string;
  /** The seconds after which the page reloads itself, from its `<meta http-equiv="refresh">`. */
  refresh: number | undefined;
  /** The addresses of the page's stylesheets. */
  stylesheets: string[];
  /** Whether the page has a script, inline or loaded. */
  hasScript: boolean;
  forms: PageForm[];
  /** Opens the link with this accessible name, with the page's headers and the scenario's cookies. */
  follow(link: string | RegExp): Promise<Page>;
  /**
   * Presses the button with this accessible name and sends its form: its fields as the page has them, with the
   * fields named by these labels set to these values. Follows a redirect unless `follow` is false.
   */
  submit(
    button: string | RegExp,
    fields?: Record<string, string>,
    options?: { follow?: boolean; headers?: Record<string, string> },
  ): Promise<Page>;
}

export interface Pages {
  /**
   * Opens the page at this path of the server sut.http started, as a browser would: with the cookies of the
   * scenario and these headers, which the page's links and forms send again, following every redirect.
   */
  open(path: string, options?: { headers?: Record<string, string> }): Promise<Page>;
  /**
   * Sends these fields to the path as a form does (`POST`, `application/x-www-form-urlencoded`), with the scenario's
   * cookies and these headers, as a program would that sends a form no page offers it. Follows a redirect unless
   * `follow` is false.
   */
  send(
    path: string,
    fields: Record<string, string>,
    options?: { headers?: Record<string, string>; follow?: boolean },
  ): Promise<Page>;
}

const SETTINGS = {
  disableJavaScriptEvaluation: true,
  disableJavaScriptFileLoading: true,
  disableCSSFileLoading: true,
  disableIframePageLoading: true,
  handleDisabledFileLoadingAsSuccess: true,
};

// Testing Library's functions are typed with the DOM of a browser, which the testkit's types do not include: the
// testkit sees an element only through these members.
interface Element {
  textContent: string | null;
  getAttribute(name: string): string | null;
}
interface Node {
  nodeType: number;
  textContent: string | null;
  localName?: string;
  childNodes: ArrayLike<Node>;
}
const queries = (container: Element) => dom.within(container as never) as unknown as ElementQueries;
interface ElementQueries {
  getByRole(role: string, options?: RoleOptions): Element;
  queryByRole(role: string, options?: RoleOptions): Element | null;
  getAllByRole(role: string, options?: RoleOptions): Element[];
  queryAllByRole(role: string, options?: RoleOptions): Element[];
  getByText(text: string | RegExp): Element;
  queryByText(text: string | RegExp): Element | null;
  getAllByText(text: string | RegExp): Element[];
  getByLabelText(label: string | RegExp): Element;
}

const collapse = (text: string | null | undefined): string => (text ?? "").replace(/\s+/g, " ").trim();

/** The text of the node, with a space around each element inside it, as a person reads the words of two cells apart. */
function words(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? "";
  if (node.localName === "script" || node.localName === "style") return "";
  return Array.from(node.childNodes, (child) => (child.nodeType === 3 ? words(child) : ` ${words(child)} `)).join("");
}
const textOf = (element: unknown): string => collapse(words(element as Node));

function found(element: Element): Found {
  return {
    ...queriesOf(element),
    name: computeAccessibleName(element),
    text: textOf(element),
    attribute: (name) => element.getAttribute(name) ?? undefined,
  };
}

function queriesOf(container: Element): Queries {
  const query = queries(container);
  const one = (element: Element | null): Found | undefined => (element ? found(element) : undefined);
  return {
    getByRole: (role, options) => found(query.getByRole(role, options)),
    queryByRole: (role, options) => one(query.queryByRole(role, options)),
    getAllByRole: (role, options) => query.getAllByRole(role, options).map(found),
    queryAllByRole: (role, options) => query.queryAllByRole(role, options).map(found),
    getByText: (text) => found(query.getByText(text)),
    queryByText: (text) => one(query.queryByText(text)),
    getAllByText: (text) => query.getAllByText(text).map(found),
    getByLabelText: (label) => found(query.getByLabelText(label)),
  };
}

const REDIRECTS = 10;

export function makePages(base: () => string, onStop: (stop: () => Promise<unknown>) => void): Pages {
  const cookies = new Map<string, string>();
  const windows: Window[] = [];
  onStop(async () => {
    for (const window of windows.splice(0)) await window.happyDOM.close();
  });

  const remember = (response: Response): void => {
    for (const header of response.headers.getSetCookie()) {
      const [pair = "", ...attributes] = header.split(";");
      const [name = "", ...value] = pair.split("=");
      const cleared = attributes.some((attribute) => /^\s*max-age\s*=\s*0\s*$/i.test(attribute));
      if (cleared) cookies.delete(name.trim());
      else cookies.set(name.trim(), value.join("=").trim());
    }
  };

  async function request(
    url: URL,
    headers: Record<string, string>,
    form: URLSearchParams | undefined,
    follow: boolean,
  ): Promise<Page> {
    let next = url;
    let body = form;
    for (let hop = 0; hop <= REDIRECTS; hop++) {
      if (!["127.0.0.1", "localhost", "[::1]"].includes(next.hostname))
        throw new Error(`sut.pages opens only pages on loopback, not ${next.href}`);
      const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
      const response = await fetch(next, {
        method: body ? "POST" : "GET",
        headers: {
          ...headers,
          ...(cookie ? { cookie } : {}),
          ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        },
        body: body?.toString(),
        redirect: "manual",
      });
      remember(response);
      const location = response.headers.get("location");
      if (follow && location && response.status >= 300 && response.status < 400) {
        await response.arrayBuffer();
        next = new URL(location, next);
        body = undefined;
        continue;
      }
      return page(next, response, await response.text(), headers);
    }
    throw new Error(`sut.pages: more than ${REDIRECTS} redirects from ${url.href}`);
  }

  function page(url: URL, response: Response, html: string, headers: Record<string, string>): Page {
    const window = new Window({ url: url.href, settings: SETTINGS });
    windows.push(window);
    window.document.write(html);
    const document = window.document;
    const body = document.body as unknown as Element;
    const all = (selector: string) => [...document.querySelectorAll(selector)];
    const refresh = document.querySelector('meta[http-equiv="refresh" i]')?.getAttribute("content");
    return {
      ...queriesOf(body),
      status: response.status,
      path: url.pathname + url.search,
      headers: Object.fromEntries(response.headers),
      location: response.headers.get("location") ?? undefined,
      title: collapse(document.title),
      text: textOf(document.body),
      refresh: refresh ? Number.parseInt(refresh, 10) : undefined,
      stylesheets: all('link[rel~="stylesheet" i]').map((link) => link.getAttribute("href") ?? ""),
      hasScript: all("script").length > 0,
      forms: all("form").map((form) => ({
        name: computeAccessibleName(form as unknown as Element),
        method: (form.getAttribute("method") ?? "get").toLowerCase(),
        action: form.getAttribute("action") ?? "",
      })),
      async follow(link) {
        const href = queriesOf(body).getByRole("link", { name: link }).attribute("href") ?? "";
        return request(new URL(href, url), headers, undefined, true);
      },
      async submit(button, fields = {}, options = {}) {
        const pressed = queries(body).getByRole("button", { name: button }) as unknown as HTMLButton;
        const form = pressed.form;
        if (!form) throw new Error(`sut.pages: the button "${String(button)}" belongs to no form`);
        for (const [label, value] of Object.entries(fields)) {
          const field = queries(form as unknown as Element).getByLabelText(label) as unknown as { value: string };
          field.value = value;
        }
        const data = new URLSearchParams();
        for (const [name, value] of new window.FormData(form as never, pressed as never))
          data.append(name, String(value));
        const action = new URL(form.getAttribute("action") ?? "", url);
        const post = form.getAttribute("method")?.toLowerCase() === "post";
        if (!post) action.search = data.toString();
        return request(action, { ...headers, ...options.headers }, post ? data : undefined, options.follow ?? true);
      },
    };
  }

  return {
    open: (path, options = {}) => request(new URL(path, base()), options.headers ?? {}, undefined, true),
    send: (path, fields, options = {}) =>
      request(new URL(path, base()), options.headers ?? {}, new URLSearchParams(fields), options.follow ?? true),
  };
}

interface HTMLButton {
  form: { getAttribute(name: string): string | null } | null;
}
