# Debt Table 313

A small, fast publishing site with a built-in admin panel. Content is stored in this repository, and the admin panel publishes by committing to GitHub through the GitHub Contents API. GitHub Pages serves the result.

## Live URLs

- Site: `https://alie50.github.io/Debt-Table313/`
- Admin: `https://alie50.github.io/Debt-Table313/admin.html`

## How it works

```
admin.html  ──(GitHub Contents API)──►  data/posts.json
                                        data/sections.json
                                        data/site.json
                                             │
                                      GitHub Pages build
                                             │
index.html / post.html  ◄────────────────────┘
```

There is no server, no database, and no build step. Every save in the admin panel is a Git commit, so the full history of every change is preserved.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Public home page: sections, featured post, post grid, search |
| `post.html` | Single post page (`post.html?slug=...`) |
| `admin.html` | Admin panel (write, edit, publish, sections, settings) |
| `assets/css/site.css` | Public site styles |
| `assets/css/admin.css` | Admin panel styles |
| `assets/js/common.js` | Shared helpers and card rendering |
| `assets/js/site.js` | Home page logic |
| `assets/js/post.js` | Single post logic |
| `assets/js/admin.js` | Admin panel logic and GitHub API client |
| `assets/vendor/purify.min.js` | Vendored DOMPurify build used to sanitize post HTML |
| `assets/images/` | Local seed images used by the sample posts |
| `data/posts.json` | All posts (published and drafts) |
| `data/sections.json` | Sections and their branches, in display order |
| `data/site.json` | Site name, tagline, description, footer, accent color |
| `assets/uploads/` | Images uploaded from the admin panel |

## Admin password

`admin.html` is gated by a password before the token screen appears:

- Default password: `MD_alie50`
- The password is stored in `assets/js/admin.js` as a **SHA-256 hash**, not as plain text.
- An unlock lasts for the browser session (`sessionStorage`); closing the browser or signing out locks the panel again.
- Wrong attempts are throttled: five failures trigger a 30-second pause.

> **This is a client-side gate, not real authentication.** Anyone who can load `admin.html` can read the JavaScript, modify it, or set the session flag manually. It keeps casual visitors out of the interface, but the actual write protection is the GitHub token — never commit a token or store one in the site code.

To change the password, compute its SHA-256 hash and replace `PASSWORD_HASH` in `assets/js/admin.js`:

```bash
printf 'your-new-password' | sha256sum
```

## Admin setup

1. Open `admin.html` and enter the admin password.
2. Create a **fine-grained** GitHub token:
   - Repository access: **Only select repositories** → `Alie50/Debt-Table313`
   - Repository permissions: **Contents: Read and write**
   - Nothing else is required.
3. Paste the token into the admin panel and connect.

The token is stored only in the browser (`sessionStorage`, or `localStorage` if "remember me" is checked) and is sent only to `api.github.com`. It is never committed to the repository.

> A classic token with the `repo` scope also works, but it is much broader than necessary. Prefer a fine-grained token.

## Publishing flow

- **حفظ كمسودة** saves with `status: "draft"`; drafts are hidden from the public site.
- **نشر** saves with `status: "published"` and sets `publishedAt`.
- Each post belongs to a **section** and may optionally belong to a **branch** inside it (`section` + `branch` fields).
- Branches are managed inside each section in **الأقسام والفروع**: add, rename, or delete a branch. A branch cannot be deleted while posts reference it. A section cannot be deleted while posts reference it; if it still has empty branches, deletion asks for confirmation and removes them too.
- The public pages read `data/posts.json` with cache busting, so changes appear after the GitHub Pages build finishes (usually under a minute).
- Site identity and the accent color are managed from **الإعدادات**.

## Local preview

Because the site fetches JSON files, open it through a local server rather than `file://`:

```bash
python3 -m http.server 8080
# http://localhost:8080
```

The admin panel works locally too: it still commits to the real repository.

## Notes

- Images uploaded from the editor are limited to 2 MB and stored in `assets/uploads/`.
- The public site sanitizes post HTML with the vendored DOMPurify build before rendering.
- `admin.html` is marked `noindex` and blocked in `robots.txt`, but it is still a public URL. The password gate and the token are access controls; anyone without a valid token can only see the interface, and the token is the real protection.
- Drafts are hidden from the public UI, but `data/posts.json` itself is served publicly by GitHub Pages. Do not put secrets or sensitive personal data in drafts.
- To rotate access, revoke the old token on GitHub and connect with a new one.
