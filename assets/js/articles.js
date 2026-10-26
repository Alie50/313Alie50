(function () {
  "use strict";

  const table = document.getElementById("articlesTable");
  const empty = document.getElementById("articlesEmpty");
  const search = document.getElementById("articlesSearch");
  const pills = document.querySelectorAll(".filter-pill");
  const countAll = document.getElementById("countAll");
  const countPublished = document.getElementById("countPublished");
  const countDraft = document.getElementById("countDraft");

  let posts = [];
  let filter = "all";
  let query = "";

  function load() {
    DT.loadData()
      .then(function (data) {
        posts = data.posts || [];
        render();
      })
      .catch(function () {
        posts = [];
        render();
      });
  }

  function render() {
    const published = posts.filter(function (p) { return p.status === "published"; }).length;
    const draft = posts.length - published;
    countAll.textContent = posts.length;
    countPublished.textContent = published;
    countDraft.textContent = draft;

    let list = posts.slice();
    if (filter !== "all") {
      list = list.filter(function (p) { return p.status === filter; });
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(function (p) {
        return (p.title || "").toLowerCase().indexOf(q) !== -1;
      });
    }
    list.sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });

    if (!list.length) {
      table.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    table.innerHTML = list
      .map(function (post) {
        const isPub = post.status === "published";
        const date = DT.formatDate(post.publishedAt || post.updatedAt || post.createdAt, true);
        const section = post.section || "—";
        return (
          '<tr>' +
          '<td><div class="cell-title"><strong>' + DT.escapeHtml(post.title || "بدون عنوان") + '</strong>' +
          (post.slug ? '<small>/' + DT.escapeHtml(post.slug) + '</small>' : '') + '</div></td>' +
          '<td>' + DT.escapeHtml(section) + '</td>' +
          '<td><span class="status-pill ' + (isPub ? "published" : "draft") + '">' + (isPub ? "منشور" : "مسودة") + '</span></td>' +
          '<td>' + DT.escapeHtml(date || "—") + '</td>' +
          '<td class="col-actions"><div class="row-actions">' +
          '<a class="btn btn-ghost btn-xs" href="publish.html?id=' + encodeURIComponent(post.id) + '">تعديل</a>' +
          (isPub ? '<a class="btn btn-ghost btn-xs" href="post.html?slug=' + encodeURIComponent(post.slug || post.id) + '" target="_blank">عرض</a>' : '') +
          '</div></td>' +
          '</tr>'
        );
      })
      .join("");
  }

  pills.forEach(function (pill) {
    pill.addEventListener("click", function () {
      pills.forEach(function (p) { p.classList.remove("active"); });
      pill.classList.add("active");
      filter = pill.getAttribute("data-filter") || "all";
      render();
    });
  });

  if (search) {
    search.addEventListener("input", function () {
      query = search.value || "";
      render();
    });
  }

  load();
})();
