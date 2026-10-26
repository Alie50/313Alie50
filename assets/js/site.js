(function () {
  "use strict";

  const grid = document.getElementById("postGrid");
  const strip = document.getElementById("sectionStrip");
  const footerSections = document.getElementById("footerSections");
  const featuredWrap = document.getElementById("featuredWrap");
  const heroGrid = document.getElementById("heroGrid");
  const emptyState = document.getElementById("emptyState");
  const emptyTitle = document.getElementById("emptyTitle");
  const emptyText = document.getElementById("emptyText");
  const retryBtn = document.getElementById("retryBtn");
  const searchInput = document.getElementById("searchInput");
  const resultCount = document.getElementById("resultCount");
  const statPosts = document.getElementById("statPosts");
  const statSections = document.getElementById("statSections");
  const statUpdated = document.getElementById("statUpdated");

  const data = { site: DT.DEFAULTS.site, sections: [], posts: [] };
  const state = {
    section: DT.param("section") || "all",
    query: "",
  };
  let allPosts = [];

  function countLabel(count) {
    if (count === 1) return "مقال واحد";
    if (count === 2) return "مقالان";
    if (count >= 3 && count <= 10) return count + " مقالات";
    return count + " مقالاً";
  }

  function featuredMarkup(post) {
    const url = DT.postUrl(post);
    const title = DT.escapeHtml(post.title || "بدون عنوان");
    const excerpt = DT.escapeHtml(
      post.excerpt || DT.truncate(DT.plainText(post.content), 180) || "اقرأ المقال كاملاً."
    );
    const section = DT.escapeHtml(DT.sectionName(post.section, data.sections));
    const date = DT.formatDate(post.publishedAt || post.updatedAt);
    return (
      '<a class="featured" href="' + url + '">' +
      '<div class="featured-cover">' + DT.coverMarkup(post, { eager: true }) + "</div>" +
      '<div class="featured-body">' +
      '<div class="card-meta"><span class="badge">' + section + "</span>" +
      (date ? "<time>" + DT.escapeHtml(date) + "</time>" : "") +
      "</div>" +
      "<h2>" + title + "</h2>" +
      "<p>" + excerpt + "</p>" +
      '<span class="featured-link">اقرأ المقال' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg></span>' +
      "</div></a>"
    );
  }

  function renderFeatured() {
    const latest = allPosts[0];
    if (!latest) {
      featuredWrap.hidden = true;
      featuredWrap.innerHTML = "";
      heroGrid.classList.add("single");
      return;
    }
    heroGrid.classList.remove("single");
    featuredWrap.hidden = false;
    featuredWrap.innerHTML = featuredMarkup(latest);
  }

  function renderSections() {
    const items = [{ id: "all", name: "الكل", count: allPosts.length }].concat(
      data.sections.map(function (section) {
        return {
          id: section.id,
          name: section.name,
          count: allPosts.filter(function (post) { return post.section === section.id; }).length,
        };
      })
    );

    if (!items.some(function (item) { return item.id === state.section; })) {
      state.section = "all";
    }

    strip.innerHTML = items
      .map(function (item) {
        const active = item.id === state.section ? " active" : "";
        return (
          '<button type="button" class="section-pill' + active + '" data-section="' +
          DT.escapeHtml(item.id) + '" aria-pressed="' + (item.id === state.section) + '">' +
          DT.escapeHtml(item.name) +
          '<span class="count">' + item.count + "</span></button>"
        );
      })
      .join("");

    footerSections.innerHTML = data.sections.length
      ? data.sections
          .map(function (section) {
            return (
              '<a href="index.html?section=' + encodeURIComponent(section.id) + '#latest">' +
              DT.escapeHtml(section.name) + "</a>"
            );
          })
          .join("")
      : '<span style="color:var(--muted-2);font-size:.86rem">لا توجد أقسام بعد</span>';
  }

  function filteredPosts() {
    let list = allPosts.slice();
    if (state.section !== "all") {
      list = list.filter(function (post) { return post.section === state.section; });
    }
    const query = state.query.trim().toLowerCase();
    if (query) {
      list = list.filter(function (post) {
        const haystack = [
          post.title,
          post.excerpt,
          DT.plainText(post.content),
          DT.sectionName(post.section, data.sections),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.indexOf(query) !== -1;
      });
    }
    return list;
  }

  function renderGrid() {
    const list = filteredPosts();
    grid.innerHTML = list.map(function (post) { return DT.cardMarkup(post, data.sections); }).join("");
    grid.hidden = list.length === 0;
    emptyState.hidden = list.length !== 0;
    retryBtn.hidden = true;
    resultCount.textContent = list.length ? countLabel(list.length) : "";

    if (!list.length) {
      if (!allPosts.length) {
        emptyTitle.textContent = "لا توجد مقالات بعد";
        emptyText.textContent = "ابدأ بنشر أول مقال من لوحة التحكم، وسيظهر هنا مباشرة.";
      } else {
        emptyTitle.textContent = "لا توجد نتائج مطابقة";
        emptyText.textContent = "جرّب كلمة بحث أخرى أو اختر قسماً مختلفاً.";
      }
    }
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    if (state.section === "all") url.searchParams.delete("section");
    else url.searchParams.set("section", state.section);
    url.hash = "latest";
    history.replaceState(null, "", url);
  }

  function renderStats() {
    statPosts.textContent = allPosts.length;
    statSections.textContent = data.sections.length;
    statUpdated.textContent = allPosts.length
      ? DT.formatDate(allPosts[0].publishedAt || allPosts[0].updatedAt, true)
      : "—";
  }

  function showError(error) {
    console.error(error);
    grid.innerHTML = "";
    grid.hidden = true;
    featuredWrap.hidden = true;
    heroGrid.classList.add("single");
    emptyState.hidden = false;
    emptyTitle.textContent = "تعذر تحميل المقالات";
    emptyText.textContent = "تحقق من اتصالك بالإنترنت ثم أعد المحاولة.";
    retryBtn.hidden = false;
    resultCount.textContent = "";
    statPosts.textContent = "—";
    statSections.textContent = "—";
    statUpdated.textContent = "—";
  }

  async function init() {
    try {
      const result = await DT.loadData();
      data.site = result.site;
      data.sections = result.sections;
      data.posts = result.posts;
      allPosts = DT.published(data.posts);
      DT.applySite(data.site);
      renderStats();
      renderSections();
      renderFeatured();
      renderGrid();
    } catch (error) {
      showError(error);
    }
  }

  strip.addEventListener("click", function (event) {
    const button = event.target.closest("[data-section]");
    if (!button) return;
    state.section = button.getAttribute("data-section");
    strip.querySelectorAll(".section-pill").forEach(function (pill) {
      const active = pill.getAttribute("data-section") === state.section;
      pill.classList.toggle("active", active);
      pill.setAttribute("aria-pressed", String(active));
    });
    renderGrid();
    syncUrl();
  });

  let searchTimer = null;
  searchInput.addEventListener("input", function (event) {
    clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = setTimeout(function () {
      state.query = value;
      renderGrid();
    }, 120);
  });

  retryBtn.addEventListener("click", function () {
    window.location.reload();
  });

  init();
})();
