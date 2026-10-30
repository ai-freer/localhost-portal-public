# Personal Portal

**English** | [简体中文](README.zh-CN.md)

Bring your services, project entry points, and shared resources together in a searchable personal dashboard. You can also ask an AI assistant to maintain links and card artwork. With [Chrome Site Search](#search-from-the-chrome-address-bar), you can search and open portal entries directly from the address bar.

The portal is built with static HTML, CSS, and JavaScript. It has no backend, frontend dependencies, or build step. Services and shared links have separate spaces, with a unified search at the top. Cards support light and dark themes, categories, editing, and configuration import and export. They can use local screenshots with per-card cropping and fall back to SVG artwork or a plain card if an image fails to load; no remote image service is required.

**Licensed under [MIT](LICENSE).** Repository: [ai-freer/localhost-portal-public](https://github.com/ai-freer/localhost-portal-public). All example content and `example.com` addresses are fictional; following an example link does not imply that a real service exists.

The user interface and the linked detailed guides and AI Skill are currently in Chinese; this README explains the main workflows in English.

## Get started

You need Python 3 (tested with 3.13) and a modern browser. Node.js is needed only for development checks, not everyday use. The autostart scripts support macOS; manual HTTP startup works on other systems with Python installed.

After obtaining the project files, open a terminal in the directory containing `index.html` and run:

```bash
python3 portal_server.py --port 7576
```

On Windows, if `python3` is unavailable, use:

```powershell
py -3 portal_server.py --port 7576
```

Open the [local portal](http://127.0.0.1:7576). You should see four example cards under “我的服务” (My Services) and six under “分享链接” (Shared Links). Press `Ctrl+C` in the terminal to stop the server.

Do not open the HTML file directly. If the port is in use, choose another one and change the browser address accordingly. `127.0.0.1` always refers to the current computer; the portal does not install the applications on your cards or create SSH tunnels for you.

The built-in server listens only on the local machine and serves the runtime files explicitly listed in `portal_server.py`, plus PNG, JPEG, WebP, and AVIF images under `assets/`. Git metadata, documentation, scripts, directory listings, and symbolic links are not served. Use this server: a general-purpose directory server does not provide the same protection. Put card images under `assets/card-media/`; use English letters, digits, underscores, or hyphens in directory and file names. Image extensions are case-insensitive. Review and update the server allowlist when adding other runtime resources. Public deployment and access controls require separate design.

## Start automatically on macOS login

Stop the manual HTTP server first to avoid a port conflict. From the project directory, run:

```bash
./install-autostart.sh --port 7576
```

The service starts immediately and whenever the current user logs in; launchd restarts it if it exits. The script finds its own project directory, listens only on localhost, and does not require sudo. It reports an occupied port or an existing installation without stopping other services.

To preview the configuration without installing it:

```bash
./install-autostart.sh --dry-run --port 7576
```

To remove the autostart task:

```bash
./uninstall-autostart.sh
```

Uninstalling preserves project files and browser favorites. For changing ports, moving the directory, switching computers, and logs, see [AUTOSTART.md](AUTOSTART.md) (Chinese). Installation, process recovery, and removal have been tested; a full computer restart or logout/login has not been tested.

## Add your own content

There are two ways to maintain entries:

- **Edit in the page:** add, edit, or delete services and shared links through the card menus. This is convenient for occasional changes.
- **Edit configuration files:** edit JSON yourself or ask an AI assistant to do it. This is useful for bulk organization, categorization, and artwork.

| File | Contents |
| --- | --- |
| `instance.json` | Site labels, category icons and colors, sorting rules, and browser storage keys |
| `services.json` | Service entry points, search aliases, notes, and non-web connection strings |
| `shares.json` | Reports and other shared resources, dates, and artwork references |
| `artwork.json` | SVG line drawings for shared entries |

For example, add an entry like this to the `services` array in `services.json`, then replace the example address with your own:

```json
{
  "id": "my-workbench",
  "name": "My Workbench",
  "url": "https://example.com/my-workbench",
  "category": "工具",
  "aliases": ["workbench"],
  "emoji": "🧰",
  "note": "My everyday workspace"
}
```

The example uses the existing sample category `工具`; choose a category from your instance or configure a new one. Do not replace the entire file with a single entry. See [CONFIGURATION.md](CONFIGURATION.md) and [SHARE_CARD_STYLE.md](SHARE_CARD_STYLE.md) (Chinese) for adding shared links, categories, and artwork. Service probing is disabled in the example instance; set `probeServices` to `true` in `instance.json` to enable it. “Reachable” means an HTTP response was received; it does not prove login or application health.

### Saving and backups

Edits made in the page are saved only in the current browser. They do not write back to JSON or automatically enter Git. To back them up:

1. Export services from the service configuration menu and shared links from the share configuration menu.
2. Review the downloads and merge them into `services.json` and `shares.json` respectively.
3. Keep those files together with `instance.json` and `artwork.json` in your private backup.

Existing browser favorites take precedence over file configuration. If a file change does not appear in the page, first export any browser edits that have not been backed up, merge them, and then import the result. Increasing `version` does not overwrite favorites. Import replaces the selected space; services and shared links are imported separately.

You may choose your own storage prefix when creating an instance, but avoid changing the keys after use. Different ports, `localhost`, and `127.0.0.1` are different browser origins; favorites do not automatically move between them. Export before changing ports or devices.

## Ask an AI assistant to help

The repository includes a [portal-maintainer Skill](skills/portal-maintainer/SKILL.md) (Chinese). An AI that can read project files does not need a plugin; you can give it a prompt such as:

```text
Work in the Personal Portal project directory I specify.
First read AGENTS.md and skills/portal-maintainer/SKILL.md, and consult the other documentation as needed.
Task: start the portal and add the links below to appropriate spaces and categories.
Preserve existing content and check for browser edits that have not been exported; draw matching line artwork for new shared links.
Modify only this instance. Do not install autostart or publish the site unless I ask.
Project directory: insert my project directory
Links: insert titles, full URLs, purposes, and optional categories, dates, or aliases
```

You can instead ask the assistant to change card artwork, export and merge favorites, or install autostart on a specific port. The Skill describes separate workflows for starting, configuring, maintaining, and backing up the portal. Clients that support Skills can install the entire `skills/portal-maintainer` folder themselves; the project does not change client settings automatically. An AI without browser access can edit files but must say that it did not verify the page or browser favorites.

## Search and shortcuts

The top search covers both services and shared links; space-specific search filters only the current space and category. Use `⌘K` / `Ctrl+K` or `/` to focus global search. Add memorable `aliases` to frequently used entries for easier searches.

### Search from the Chrome address bar

After configuring Chrome **Site Search** once, you can search your portal entries from the address bar without first opening the dashboard. It searches entries already in the portal, not the full text of destination websites or the internet. No browser extension or change to the default search engine is needed.

#### One-time setup

1. Start the portal and confirm that its actual address opens in your browser. The example uses the public template's default port `7576`; replace it if your instance uses another port.
2. Open `chrome://settings/searchEngines` in Chrome, or go to Settings → Search engine → Manage search engines and site search.
3. Under **Site search**, choose **Add**, fill in these fields, and save:

| Chrome field | Example | Meaning |
| --- | --- | --- |
| Name (or Search engine in some versions) | `Personal Portal` | A recognizable label |
| Shortcut | `go` | A short keyword not used by another shortcut |
| URL with `%s` in place of query | `http://127.0.0.1:7576/?q=%s` | Keep `%s` unchanged; Chrome replaces it with your search term |

The “地址栏快开” (address-bar shortcut) section at the bottom of the portal displays the URL for the current instance, which you can copy. Use the same hostname and port you normally use to access the portal. Do not casually switch between `127.0.0.1` and `localhost`: their browser storage is separate.

Settings labels may vary by Chrome version and language. See the [official Chrome Site Search guide](https://support.google.com/chrome/answer/95426?hl=en).

#### Everyday use

1. Press `⌘L` on macOS or `Ctrl+L` on Windows/Linux to focus the address bar.
2. Type `go` and press **Tab** to enter the site search mode. Space may also work, depending on Chrome settings.
3. Type an entry's name or alias and press **Enter**. For example: `go` → `Tab` → `workbench` → `Enter`.

Chrome passes the search term to the portal through `?q=`, and the portal searches services and shared links:

- **One match:** an exact name, original name, or alias match starts a three-second countdown; another single match starts a ten-second countdown. The portal then opens the entry or performs its copy-address action. Click Cancel or press Escape to stop the countdown.
- **Multiple matches or no matches:** the results page remains open; no destination is selected automatically.
- **Connection-address services:** the entry's configured action copies the address rather than opening it as a web page. Clipboard access can depend on browser permissions.
- **Typing a search directly in the portal:** no automatic countdown starts.

#### Troubleshooting

- If the portal does not open, check that the local HTTP service is running and that the Site Search URL uses its actual port. For a service that starts at login, see [AUTOSTART.md](AUTOSTART.md) (Chinese).
- If `go` is treated as a normal search term, type `go` and press Tab, then confirm that Personal Portal search mode is active. Check for a conflicting or disabled shortcut.
- If the results differ from your usual favorites, check the Chrome profile, hostname, and port. Browser-saved favorites take precedence over file configuration; do not clear favorites as a troubleshooting step.
- On a new computer, restore and start the portal there and check whether Chrome has the site-search shortcut. `127.0.0.1` does not connect to your old computer. Adding Site Search does not automatically migrate favorites or local autostart settings.

## Public framework and personal instances

Use separate directories: one for the public framework and fictional examples, and another for your complete working program and real configuration. A personal instance can live in a separate private repository for use and recovery.

The two directories do not sync automatically. Develop and verify reusable functionality in the framework directory, then review and update the personal instance using the `framework.json` list. Preserve the four instance JSON files, storage keys, and locally generated autostart configuration. Do not overwrite the whole directory or merge private repository history into the public repository.

A full backup should run without downloading a temporary copy of the public framework. The template does not provide account login, cloud synchronization, or installation of destination services. A private Git repository does not make a deployed website private.

## Development checks

Run these commands in the project root (tested with Node.js 22 and Python 3.13):

```bash
node --test config.test.cjs git-privacy.test.cjs card-media.test.cjs service-presentation.test.cjs
python3 autostart.test.py
python3 server.test.py
node check-public.cjs --identity-file .git/approved-public-identities.json
```

The tests cover configuration, saving rules, autostart, HTTP isolation, and the Git privacy checker. The final command is only for a release candidate that retains fictional examples; owners of personal instances should not delete their real configuration merely to pass it.

The release check examines the current file allowlist, example URLs, and some sensitive patterns. It also reviews reachable commits, authors, committers, taggers, messages, and historical file objects across branches and tags, including deleted files, as well as the identity that would be used for the next commit. It does not modify Git configuration or history.

Public identities must use a GitHub-provided noreply address and an explicitly approved name/email combination. Keep the approval list in an untracked JSON file outside the repository, for example `[{"name":"Public name","email":"GitHub-provided noreply address"}]`, and run `node check-public.cjs --identity-file /path/to/approved-identities.json`. A missing list, noncompliant historical identity, or noncompliant next-commit identity fails the check; do not approve a private email just to suppress a warning. The maintainer's local `.git/approved-public-identities.json` is not committed; other maintainers must create their own list.

This is not a complete secrets scanner: it does not scan unreachable objects, reflogs, or screenshot pixels, and it cannot identify every private domain or piece of private text. Even after a pass, manually review the material to be uploaded and the license.

For visual changes, inspect actual desktop screenshots at 1440×1000 and mobile screenshots at 390×844 in both light and dark themes. Follow the project documentation for layout and artwork requirements.

## Native card images

The portal supports a three-level strategy that prioritizes native content, with per-card cropping. Optional `card-media.json` and `assets/card-media/` belong to the instance; `card-media.js` and `card-media.css` are part of the shared framework. Missing or failed images fall back to the original SVG or plain card without overwriting favorites. See [CONFIGURATION.md](CONFIGURATION.md) and the project [Skill](skills/portal-maintainer/SKILL.md) (Chinese). Include optional assets when backing up an instance.

## License

This project is licensed under the [MIT License](LICENSE), copyright ai-freer.
