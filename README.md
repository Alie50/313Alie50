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
| `data/sections.json` | Sections, in display order |
| `data/site.json` | Site name, tagline, description, footer, accent color |
| `assets/uploads/` | Images uploaded from the admin panel |

## Admin setup

1. Open `admin.html`.
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
- The public pages read `data/posts.json` with cache busting, so changes appear after the GitHub Pages build finishes (usually under a minute).
- Sections are managed from **الأقسام**. A section cannot be deleted while posts still reference it.
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
- `admin.html` is marked `noindex` and blocked in `robots.txt`, but it is still a public URL. The token is the real access control; anyone without a valid token can only see the connection screen.
- Drafts are hidden from the public UI, but `data/posts.json` itself is served publicly by GitHub Pages. Do not put secrets or sensitive personal data in drafts.
- To rotate access, revoke the old token on GitHub and connect with a new one.
