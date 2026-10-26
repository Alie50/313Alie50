(function () {
  "use strict";

  const root = document.getElementById("articleRoot");
  const footerSections = document.getElementById("footerSections");

  function setMeta(selector, attribute, value) {
    if (!value) return;
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      const match = selector.match(/\[(.+?)=["'](.+?)["']\]/);
      if (match) el.setAttribute(match[1], match[2]);
      document.head.appendChild(el);
    }
    el.setAttribute(attribute, value);
  }

  function renderFooterSections(sections) {
    footerSections.innerHTML = sections.length
      ? sections
          .map(function (section) {
            return (
              '<a href="index.html?section=' + encodeURIComponent(section.id) + '#latest">' +
              DT.escapeHtml(section.name) + "</a>"
            );
          })
          .join("")
      : '<span style="color:var(--muted-2);font-size:.86rem">لا توجد أقسام بعد</span>';
  }

  function notFound(message) {
    root.innerHTML =
      '<div class="not-found"><div>' +
      '<div class="code">404</div>' +
      "<h1>" + DT.escapeHtml(message || "المقال غير موجود") + "</h1>" +
      "<p>قد يكون الرابط قديماً، أو أن المقال لم يُنشر بعد.</p>" +
      '<a class="btn btn-primary" href="index.html">العودة إلى الرئيسية</a>' +
      "</div></div>";
  }

  function renderError() {
    root.innerHTML =
      '<div class="not-found"><div>' +
      '<div class="code">!</div>' +
      "<h1>تعذر تحميل المقال</h1>" +
      "<p>تحقق من اتصالك بالإنترنت ثم أعد المحاولة.</p>" +
      '<button class="btn btn-primary" type="button" onclick="location.reload()">إعادة المحاولة</button>' +
      "</div></div>";
  }

  function relatedPosts(post, posts) {
    const published = DT.published(posts).filter(function (item) { return item.id !== post.id; });
    let related = published.filter(function (item) { return item.section === post.section; });
    if (related.length < 3) {
      const extra = published.filter(function (item) { return related.indexOf(item) === -1; });
      related = related.concat(extra);
    }
    return related.slice(0, 3);
  }

  function renderPost(post, site, sections, posts) {
    const section = DT.sectionName(post.section, sections);
    const date = DT.formatDate(post.publishedAt || post.updatedAt);
    const minutes = DT.readingTime(post.content);
    const content = DT.sanitize(post.content || "");
    const cover = post.cover
      ? '<figure class="article-cover"><img src="' + DT.escapeHtml(post.cover) + '" alt="' +
        DT.escapeHtml(post.title) + '" onerror="this.remove()"></figure>'
      : '<figure class="article-cover"><div class="cover-fallback" style="--hue:' +
        DT.hueFor(post.section) + '"><span>' + DT.escapeHtml((post.title || "D").trim().charAt(0)) +
        "</span></div></figure>";

    root.innerHTML =
      '<a class="back-link" href="index.html#latest">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>' +
      "العودة إلى المقالات</a>" +
      '<article>' +
      '<header class="article-head">' +
      '<span class="badge">' + DT.escapeHtml(section) + "</span>" +
      "<h1>" + DT.escapeHtml(post.title || "بدون عنوان") + "</h1>" +
      (post.excerpt ? '<p class="article-excerpt">' + DT.escapeHtml(post.excerpt) + "</p>" : "") +
      '<div class="article-meta">' +
      (date ? "<time datetime=\"" + DT.escapeHtml(post.publishedAt || post.updatedAt || "") + "\">" + DT.escapeHtml(date) + "</time>" : "") +
      (date ? '<span class="sep"></span>' : "") +
      "<span>" + minutes + " د قراءة</span>" +
      '<span class="sep"></span><span>' + DT.escapeHtml(site.name) + "</span>" +
      "</div></header>" +
      cover +
      '<div class="article-content" id="articleContent">' + content + "</div>" +
      '<footer class="article-foot">' +
      '<div class="article-tags"><span class="badge badge-neutral">' + DT.escapeHtml(section) + "</span></div>" +
      '<button class="btn btn-ghost btn-sm" id="copyLink" type="button">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
      "نسخ الرابط</button></footer></article>" +
      '<section class="related" id="relatedSection"></section>';

    const contentEl = document.getElementById("articleContent");
    DT.hardenLinks(contentEl);

    const copyButton = document.getElementById("copyLink");
    copyButton.addEventListener("click", async function () {
      const ok = await DT.copyText(window.location.href);
      DT.toast(ok ? "تم نسخ الرابط" : "تعذر نسخ الرابط");
    });

    const related = relatedPosts(post, posts);
    if (related.length) {
      document.getElementById("relatedSection").innerHTML =
        "<h2>مقالات ذات صلة</h2>" +
        '<div class="post-grid">' +
        related.map(function (item) { return DT.cardMarkup(item, sections); }).join("") +
        "</div>";
    }

    document.title = post.title + " — " + site.name;
    setMeta('meta[name="description"]', "content", post.excerpt || DT.truncate(DT.plainText(post.content), 160));
    setMeta('meta[property="og:title"]', "content", post.title);
    setMeta('meta[property="og:description"]', "content", post.excerpt || DT.truncate(DT.plainText(post.content), 160));
    setMeta('meta[property="og:type"]', "content", "article");
    if (post.cover) setMeta('meta[property="og:image"]', "content", post.cover);

    const schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.excerpt || DT.truncate(DT.plainText(post.content), 160),
      datePublished: post.publishedAt || post.updatedAt,
      dateModified: post.updatedAt || post.publishedAt,
      inLanguage: "ar",
      author: { "@type": "Organization", name: site.name },
      publisher: { "@type": "Organization", name: site.name },
    };
    if (post.cover) schema.image = post.cover;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  async function init() {
    const slug = DT.param("slug");
    try {
      const result = await DT.loadData();
      DT.applySite(result.site);
      renderFooterSections(result.sections);

      if (!slug) {
        notFound("لم يتم تحديد مقال");
        return;
      }

      const post = result.posts.find(function (item) {
        return (item.slug || item.id) === slug && item.status === "published";
      });

      if (!post) {
        notFound("المقال غير موجود");
        return;
      }

      renderPost(post, result.site, result.sections, result.posts);
    } catch (error) {
      console.error(error);
      renderError();
    }
  }

  init();
})();
