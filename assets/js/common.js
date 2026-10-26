/* Shared helpers for the public site and the admin panel. */
window.DT = (function () {
  "use strict";

  const DEFAULTS = {
    site: {
      name: "Debt Table",
      tagline: "دليلك العملي للخروج من الديون وبناء مستقبل مالي أفضل",
      description: "مقالات وأدلة عملية حول إدارة الديون، الميزانية، والتخطيط المالي بالعربية.",
      footer: "Debt Table — محتوى مالي عملي، بلا تعقيد.",
      accent: "#34d399",
    },
    sections: [],
    posts: [],
  };

  async function fetchJson(path) {
    const res = await fetch(path + "?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status + " — " + path);
    return res.json();
  }

  async function loadData() {
    const [site, sections, posts] = await Promise.all([
      fetchJson("data/site.json").catch(() => DEFAULTS.site),
      fetchJson("data/sections.json").catch(() => []),
      fetchJson("data/posts.json"),
    ]);
    return {
      site: Object.assign({}, DEFAULTS.site, site || {}),
      sections: normalizeSections(sections),
      posts: Array.isArray(posts) ? posts : [],
    };
  }

  function normalizeSections(sections) {
    return (Array.isArray(sections) ? sections : [])
      .filter(function (section) { return section && section.id; })
      .map(function (section) {
        const children = (Array.isArray(section.children) ? section.children : [])
          .filter(function (child) { return child && child.id && child.name; })
          .map(function (child) {
            return Object.assign({}, child, {
              id: String(child.id),
              name: String(child.name),
            });
          });
        return Object.assign({}, section, {
          id: String(section.id),
          name: String(section.name || section.id),
          children: children,
        });
      });
  }

  function formatDate(value, short) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    try {
      return new Intl.DateTimeFormat("ar", {
        calendar: "gregory",
        year: "numeric",
        month: short ? "short" : "long",
        day: "numeric",
      }).format(date);
    } catch (error) {
      return date.toISOString().slice(0, 10);
    }
  }

  function readingTime(html) {
    const el = document.createElement("div");
    el.innerHTML = html || "";
    const words = (el.textContent || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function sanitize(html) {
    if (window.DOMPurify) {
      return window.DOMPurify.sanitize(html || "", {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["target", "rel"],
      });
    }
    const template = document.createElement("template");
    template.innerHTML = html || "";
    template.content
      .querySelectorAll("script,style,iframe,object,embed,form,input,button,link,meta")
      .forEach(function (node) {
        node.remove();
      });
    template.content.querySelectorAll("*").forEach(function (el) {
      Array.from(el.attributes).forEach(function (attr) {
        const name = attr.name.toLowerCase();
        const isUrl = name === "href" || name === "src" || name === "xlink:href";
        if (name.indexOf("on") === 0 || (isUrl && /^\s*javascript:/i.test(attr.value))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return template.innerHTML;
  }

  function hardenLinks(root) {
    if (!root) return;
    root.querySelectorAll("a[href]").forEach(function (link) {
      if (link.target === "_blank") {
        link.rel = "noopener noreferrer";
      }
    });
    root.querySelectorAll("img").forEach(function (img) {
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", function () {
        img.remove();
      });
    });
  }

  function hexToRgb(hex) {
    const clean = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{3,6}$/i.test(clean)) return null;
    const full = clean.length === 3 ? clean.split("").map(function (c) { return c + c; }).join("") : clean;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  function rgbToHsl(rgb) {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const toHex = function (v) {
      return Math.round((v + m) * 255).toString(16).padStart(2, "0");
    };
    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  function applyAccent(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    const hsl = rgbToHsl(rgb);
    const root = document.documentElement;
    root.style.setProperty("--accent", hex);
    root.style.setProperty("--accent-2", hslToHex(hsl.h + 38, Math.min(hsl.s, 85), Math.min(hsl.l + 8, 70)));
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    root.style.setProperty("--accent-ink", luminance > 0.62 ? "#10231b" : "#052e22");
  }

  function applySite(site) {
    applyAccent(site.accent || DEFAULTS.site.accent);
    document.querySelectorAll("[data-site-name]").forEach(function (el) {
      el.textContent = site.name;
    });
    document.querySelectorAll("[data-site-tagline]").forEach(function (el) {
      el.textContent = site.tagline;
    });
    document.querySelectorAll("[data-site-description]").forEach(function (el) {
      el.textContent = site.description;
    });
    document.querySelectorAll("[data-site-footer]").forEach(function (el) {
      el.textContent = site.footer;
    });
    document.querySelectorAll("[data-site-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
    const meta = document.querySelector('meta[name="description"]');
    if (meta && site.description) meta.setAttribute("content", site.description);
    if (site.name) {
      document.title = site.name + " — " + (site.tagline || "");
    }
  }

  function sectionName(id, sections) {
    const found = (sections || []).find(function (section) { return section.id === id; });
    return found ? found.name : "عام";
  }

  function sectionById(id, sections) {
    return (sections || []).find(function (section) { return section.id === id; }) || null;
  }

  function branchesOf(sectionId, sections) {
    const section = sectionById(sectionId, sections);
    return section && Array.isArray(section.children) ? section.children : [];
  }

  function branchName(sectionId, branchId, sections) {
    if (!branchId) return "";
    const found = branchesOf(sectionId, sections).find(function (branch) {
      return branch.id === branchId;
    });
    return found ? found.name : "";
  }

  function hueFor(value) {
    let hash = 0;
    const text = String(value || "general");
    for (let i = 0; i < text.length; i += 1) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return 130 + (Math.abs(hash) % 110);
  }

  function coverMarkup(post, options) {
    const opts = options || {};
    const title = post.title || "مقال";
    const hue = hueFor(post.section);
    const initial = escapeHtml(title.trim().charAt(0) || "D");
    const fallback =
      '<div class="cover-fallback" style="--hue:' + hue + '" aria-hidden="true"><span>' + initial + "</span></div>";
    if (!post.cover) return fallback;
    const loading = opts.eager ? 'loading="eager"' : 'loading="lazy"';
    return (
      fallback +
      '<img src="' + escapeHtml(post.cover) + '" alt="' + escapeHtml(title) + '" ' + loading +
      ' decoding="async" onerror="this.remove()">'
    );
  }

  function postUrl(post) {
    return "post.html?slug=" + encodeURIComponent(post.slug || post.id);
  }

  function published(posts) {
    return (posts || [])
      .filter(function (post) { return post && post.status === "published"; })
      .sort(function (a, b) {
        return new Date(b.publishedAt || b.updatedAt || 0) - new Date(a.publishedAt || a.updatedAt || 0);
      });
  }

  function toast(message) {
    const wrap = document.createElement("div");
    wrap.className = "toast";
    wrap.innerHTML = '<div class="toast-inner" role="status">' + escapeHtml(message) + "</div>";
    document.body.appendChild(wrap);
    setTimeout(function () {
      wrap.style.opacity = "0";
      wrap.style.transition = "opacity .25s";
      setTimeout(function () { wrap.remove(); }, 260);
    }, 2400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (copyError) { ok = false; }
      area.remove();
      return ok;
    }
  }

  function param(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function truncate(text, length) {
    const value = String(text || "").trim();
    if (value.length <= length) return value;
    return value.slice(0, length - 1).trimEnd() + "…";
  }

  function plainText(html) {
    const el = document.createElement("div");
    el.innerHTML = html || "";
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function cardMarkup(post, sections) {
    const url = postUrl(post);
    const title = escapeHtml(post.title || "بدون عنوان");
    const excerpt = escapeHtml(
      post.excerpt || truncate(plainText(post.content), 150) || "اقرأ المقال كاملاً."
    );
    const section = escapeHtml(sectionName(post.section, sections));
    const branchLabel = branchName(post.section, post.branch, sections);
    const branch = branchLabel
      ? '<span class="badge badge-neutral">' + escapeHtml(branchLabel) + "</span>"
      : "";
    const date = formatDate(post.publishedAt || post.updatedAt);
    const dateTime = escapeHtml(post.publishedAt || post.updatedAt || "");
    return (
      '<article class="post-card">' +
      '<a class="card-cover" href="' + url + '" aria-label="' + title + '">' +
      coverMarkup(post) +
      "</a>" +
      '<div class="card-body">' +
      '<div class="card-meta"><span class="badge">' + section + "</span>" + branch +
      (date ? '<time datetime="' + dateTime + '">' + escapeHtml(date) + "</time>" : "") +
      "</div>" +
      "<h3><a href=\"" + url + "\">" + title + "</a></h3>" +
      "<p>" + excerpt + "</p>" +
      '<div class="card-foot"><span>' + readingTime(post.content) + " د قراءة</span>" +
      '<span class="read">اقرأ المقال' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg></span></div>' +
      "</div></article>"
    );
  }

  return {
    DEFAULTS: DEFAULTS,
    fetchJson: fetchJson,
    loadData: loadData,
    formatDate: formatDate,
    readingTime: readingTime,
    escapeHtml: escapeHtml,
    sanitize: sanitize,
    hardenLinks: hardenLinks,
    applySite: applySite,
    applyAccent: applyAccent,
    sectionName: sectionName,
    sectionById: sectionById,
    branchesOf: branchesOf,
    branchName: branchName,
    normalizeSections: normalizeSections,
    hueFor: hueFor,
    coverMarkup: coverMarkup,
    postUrl: postUrl,
    published: published,
    toast: toast,
    copyText: copyText,
    param: param,
    truncate: truncate,
    plainText: plainText,
    cardMarkup: cardMarkup,
  };
})();
