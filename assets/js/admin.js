/* =========================================================
   Debt Table — admin panel logic
   GitHub Contents API is the storage layer. The token never
   leaves this browser except for requests to api.github.com.
   ========================================================= */

(function () {
  "use strict";

  const OWNER = "Alie50";
  const REPO = "Debt-Table313";
  const BRANCH = "main";
  const API = "https://api.github.com";
  const TOKEN_KEY = "dt_github_token";
  const UNLOCK_KEY = "dt_admin_unlocked";
  const PASSWORD_HASH = "e8233489eeec92a4f636dbd1c734bb46ca1afd5c66aa6cfffc379d81503336f3";
  const MAX_LOCK_ATTEMPTS = 5;
  const LOCKOUT_MS = 30000;

  const VIEW_TITLES = {
    dashboard: "لوحة التحكم",
    posts: "المقالات",
    editor: "محرر المقال",
    sections: "الأقسام",
    settings: "الإعدادات",
  };

  const $ = function (id) { return document.getElementById(id); };

  const els = {
    lockView: $("lockView"),
    lockForm: $("lockForm"),
    adminPassword: $("adminPassword"),
    togglePassword: $("togglePassword"),
    lockBtn: $("lockBtn"),
    lockError: $("lockError"),
    connectView: $("connectView"),
    connectForm: $("connectForm"),
    tokenInput: $("tokenInput"),
    rememberToken: $("rememberToken"),
    toggleToken: $("toggleToken"),
    connectBtn: $("connectBtn"),
    connectError: $("connectError"),
    appView: $("appView"),
    sidebar: $("sidebar"),
    sidebarOverlay: $("sidebarOverlay"),
    menuBtn: $("menuBtn"),
    viewTitle: $("viewTitle"),
    syncStatus: $("syncStatus"),
    userName: $("userName"),
    userAvatar: $("userAvatar"),
    repoLabel: $("repoLabel"),
    settingsUser: $("settingsUser"),
    logoutBtn: $("logoutBtn"),
    logoutBtn2: $("logoutBtn2"),
    statPublished: $("statPublished"),
    statDrafts: $("statDrafts"),
    statSectionsAdmin: $("statSectionsAdmin"),
    statBranchesNote: $("statBranchesNote"),
    statLastUpdate: $("statLastUpdate"),
    recentPosts: $("recentPosts"),
    postsSummary: $("postsSummary"),
    postsSearch: $("postsSearch"),
    postsStatusFilter: $("postsStatusFilter"),
    postsSectionFilter: $("postsSectionFilter"),
    postsBranchFilter: $("postsBranchFilter"),
    postsList: $("postsList"),
    editorTitle: $("editorTitle"),
    editorStatus: $("editorStatus"),
    postTitle: $("postTitle"),
    postSlug: $("postSlug"),
    postSection: $("postSection"),
    postBranch: $("postBranch"),
    postExcerpt: $("postExcerpt"),
    excerptCount: $("excerptCount"),
    postContent: $("postContent"),
    editorToolbar: $("editorToolbar"),
    wordCount: $("wordCount"),
    readTime: $("readTime"),
    coverPreview: $("coverPreview"),
    postCover: $("postCover"),
    uploadCoverBtn: $("uploadCoverBtn"),
    clearCoverBtn: $("clearCoverBtn"),
    coverFile: $("coverFile"),
    sideStatus: $("sideStatus"),
    sideDate: $("sideDate"),
    sideUpdated: $("sideUpdated"),
    sideLink: $("sideLink"),
    deletePanel: $("deletePanel"),
    deletePostBtn: $("deletePostBtn"),
    previewBtn: $("previewBtn"),
    saveDraftBtn: $("saveDraftBtn"),
    publishBtn: $("publishBtn"),
    sectionsList: $("sectionsList"),
    sectionForm: $("sectionForm"),
    sectionName: $("sectionName"),
    settingsForm: $("settingsForm"),
    siteNameInput: $("siteNameInput"),
    siteTaglineInput: $("siteTaglineInput"),
    siteDescriptionInput: $("siteDescriptionInput"),
    siteFooterInput: $("siteFooterInput"),
    siteAccentInput: $("siteAccentInput"),
    siteAccentText: $("siteAccentText"),
    saveSettingsBtn: $("saveSettingsBtn"),
    previewModal: $("previewModal"),
    previewBody: $("previewBody"),
    toasts: $("toasts"),
  };

  const state = {
    token: null,
    user: null,
    posts: [],
    sections: [],
    site: Object.assign({}, DT.DEFAULTS.site),
    view: "dashboard",
    editingId: null,
    dirty: false,
    saving: false,
    deletedIds: new Set(),
  };

  let slugTouched = false;
  let savedRange = null;
  let searchTimer = null;
  let previewReturnFocus = null;
  const connectBtnHTML = els.connectBtn.innerHTML;
  const lockBtnHTML = els.lockBtn.innerHTML;
  let lockAttempts = 0;
  let lockBlockedUntil = 0;

  /* ---------------- small helpers ---------------- */

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function slugify(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0670]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function uniqueSlug(base, id) {
    const root = slugify(base) || "post";
    let candidate = root;
    let index = 2;
    while (state.posts.some(function (post) { return post.id !== id && post.slug === candidate; })) {
      candidate = root + "-" + index;
      index += 1;
    }
    return candidate;
  }

  function uniqueSectionId(base) {
    const root = slugify(base) || "section";
    let candidate = root;
    let index = 2;
    while (state.sections.some(function (section) { return section.id === candidate; })) {
      candidate = root + "-" + index;
      index += 1;
    }
    return candidate;
  }

  function allBranches() {
    const list = [];
    state.sections.forEach(function (section) {
      (section.children || []).forEach(function (branch) {
        list.push({ section: section, branch: branch });
      });
    });
    return list;
  }

  function findBranch(branchId) {
    for (let i = 0; i < state.sections.length; i += 1) {
      const section = state.sections[i];
      const children = section.children || [];
      const index = children.findIndex(function (branch) { return branch.id === branchId; });
      if (index !== -1) return { section: section, branch: children[index], index: index };
    }
    return null;
  }

  function uniqueBranchId(base) {
    const root = slugify(base) || "branch";
    const existing = new Set();
    allBranches().forEach(function (item) { existing.add(item.branch.id); });
    let candidate = root;
    let index = 2;
    while (existing.has(candidate)) {
      candidate = root + "-" + index;
      index += 1;
    }
    return candidate;
  }

  function postBranchName(post) {
    return post && post.branch ? DT.branchName(post.section, post.branch, state.sections) : "";
  }

  function sortByUpdated(posts) {
    return posts.slice().sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });
  }

  function sectionName(id) {
    return DT.sectionName(id, state.sections);
  }

  function toast(message, type) {
    const item = document.createElement("div");
    item.className = "toast-item" + (type ? " " + type : "");
    item.setAttribute("role", "status");
    item.textContent = message;
    els.toasts.appendChild(item);
    setTimeout(function () {
      item.style.opacity = "0";
      item.style.transition = "opacity .25s";
      setTimeout(function () { item.remove(); }, 260);
    }, 3200);
  }

  function setSync(status) {
    const labels = { ok: "متصل", saving: "جاري الحفظ...", error: "فشل الحفظ" };
    els.syncStatus.className = "sync-status" + (status === "ok" ? "" : " " + status);
    els.syncStatus.innerHTML = '<span class="sync-dot"></span> ' + labels[status];
  }

  function globalLoading(on) {
    let overlay = document.getElementById("globalLoading");
    if (on) {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "globalLoading";
        overlay.className = "loading-overlay";
        overlay.innerHTML = '<div class="spinner" aria-label="جاري التحميل"></div>';
        document.body.appendChild(overlay);
      }
    } else if (overlay) {
      overlay.remove();
    }
  }

  function showConnectError(message) {
    if (!message) {
      els.connectError.hidden = true;
      els.connectError.textContent = "";
      return;
    }
    els.connectError.hidden = false;
    els.connectError.textContent = message;
  }

  function mapError(error) {
    if (!navigator.onLine) return "لا يوجد اتصال بالإنترنت.";
    if (error && error.status === 401) {
      return "التوكن غير صالح أو منتهي الصلاحية. أنشئ توكنًا جديدًا وأعد المحاولة.";
    }
    if (error && error.status === 403) {
      return "التوكن لا يملك صلاحية الكتابة على المحتوى. تأكد من منح Contents: Read and write.";
    }
    if (error && error.status === 404) {
      return "لم يتم العثور على المستودع أو الملف. تأكد من اختيار Alie50/Debt-Table313 عند إنشاء التوكن.";
    }
    if (error && error.status === 409) {
      return "حدث تعارض أثناء الحفظ. أعد المحاولة.";
    }
    if (error && error.status === 422) {
      return "بيانات غير مقبولة من GitHub: " + (error.message || "تحقق من الصور والملفات.");
    }
    if (error && error.message && /failed to fetch|network/i.test(error.message)) {
      return "تعذر الاتصال بـ GitHub. تحقق من اتصالك بالإنترنت.";
    }
    return "حدث خطأ: " + (error && error.message ? error.message : "غير معروف");
  }

  async function runSave(task, successMessage) {
    if (state.saving) {
      toast("هناك عملية حفظ جارية، انتظر لحظة.", "error");
      return false;
    }
    state.saving = true;
    setSync("saving");
    try {
      await task();
      setSync("ok");
      if (successMessage) toast(successMessage, "success");
      return true;
    } catch (error) {
      console.error(error);
      setSync("error");
      toast(mapError(error), "error");
      return false;
    } finally {
      state.saving = false;
    }
  }

  /* ---------------- GitHub API ---------------- */

  function authHeaders() {
    return {
      Authorization: "Bearer " + state.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async function api(path, options) {
    const opts = options || {};
    const response = await fetch(API + path, Object.assign({}, opts, {
      headers: Object.assign({}, authHeaders(), opts.headers || {}),
    }));
    if (!response.ok) {
      let message = response.status + " " + response.statusText;
      try {
        const body = await response.json();
        if (body && body.message) message = body.message;
      } catch (error) { /* ignore */ }
      const failure = new Error(message);
      failure.status = response.status;
      throw failure;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function encodeBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function decodeBase64Utf8(base64) {
    const binary = atob(String(base64 || "").replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function getFile(path) {
    const response = await fetch(
      API + "/repos/" + OWNER + "/" + REPO + "/contents/" + path + "?ref=" + BRANCH,
      { headers: authHeaders() }
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      let message = response.status + " " + response.statusText;
      try {
        const body = await response.json();
        if (body && body.message) message = body.message;
      } catch (error) { /* ignore */ }
      const failure = new Error(message);
      failure.status = response.status;
      throw failure;
    }
    const data = await response.json();
    return { sha: data.sha, text: decodeBase64Utf8(data.content) };
  }

  async function getJson(path, fallback) {
    const file = await getFile(path);
    if (!file) return { data: fallback, sha: null };
    try {
      return { data: JSON.parse(file.text), sha: file.sha };
    } catch (error) {
      return { data: fallback, sha: file.sha };
    }
  }

  async function putFile(path, content, message, sha, isBase64) {
    const body = {
      message: message,
      content: isBase64 ? content : encodeBase64Utf8(content),
      branch: BRANCH,
    };
    if (sha) body.sha = sha;
    return api("/repos/" + OWNER + "/" + REPO + "/contents/" + path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function saveJson(path, data, message) {
    const latest = await getFile(path);
    const text = JSON.stringify(data, null, 2) + "\n";
    try {
      await putFile(path, text, message, latest ? latest.sha : undefined);
    } catch (error) {
      if (error.status === 409) {
        const retry = await getFile(path);
        await putFile(path, text, message, retry ? retry.sha : undefined);
      } else {
        throw error;
      }
    }
  }

  async function persistPosts(message) {
    const latest = await getJson("data/posts.json", []);
    const remote = Array.isArray(latest.data) ? latest.data : [];
    const map = new Map();
    remote.forEach(function (post) {
      if (post && post.id) map.set(post.id, post);
    });
    state.posts.forEach(function (post) { map.set(post.id, post); });
    state.deletedIds.forEach(function (id) { map.delete(id); });
    const merged = Array.from(map.values());
    await putFile(
      "data/posts.json",
      JSON.stringify(merged, null, 2) + "\n",
      message,
      latest.sha || undefined
    );
    state.posts = merged;
    state.deletedIds.clear();
  }

  async function persistSections(message) {
    await saveJson("data/sections.json", state.sections, message);
  }

  /* ---------------- connection ---------------- */

  function readToken() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  }

  function storeToken(token, remember) {
    sessionStorage.setItem(TOKEN_KEY, token);
    if (remember) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function setConnectLoading(on) {
    els.connectBtn.disabled = on;
    els.connectBtn.innerHTML = on
      ? '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> جاري الاتصال...'
      : connectBtnHTML;
  }

  async function loadRemoteData() {
    const results = await Promise.all([
      getJson("data/posts.json", []),
      getJson("data/sections.json", []),
      getJson("data/site.json", DT.DEFAULTS.site),
    ]);
    state.posts = Array.isArray(results[0].data) ? results[0].data : [];
    state.sections = DT.normalizeSections(results[1].data);
    state.site = Object.assign({}, DT.DEFAULTS.site, results[2].data && !Array.isArray(results[2].data) ? results[2].data : {});
  }

  async function connect(token, remember, silent) {
    state.token = token;
    if (silent) globalLoading(true);
    else setConnectLoading(true);
    showConnectError("");

    try {
      const user = await api("/user");
      await api("/repos/" + OWNER + "/" + REPO);
      state.user = user;
      await loadRemoteData();
      storeToken(token, remember);
      showApp();
    } catch (error) {
      console.error(error);
      state.token = null;
      clearToken();
      showConnectView();
      showConnectError(mapError(error));
    } finally {
      if (silent) globalLoading(false);
      else setConnectLoading(false);
    }
  }

  function showLockView() {
    els.lockView.hidden = false;
    els.connectView.hidden = true;
    els.appView.hidden = true;
    document.title = "دخول لوحة التحكم — Debt Table";
    window.setTimeout(function () { els.adminPassword.focus(); }, 60);
  }

  function showLockError(message) {
    if (!message) {
      els.lockError.hidden = true;
      els.lockError.textContent = "";
      return;
    }
    els.lockError.hidden = false;
    els.lockError.textContent = message;
  }

  async function sha256Hex(text) {
    if (!(window.crypto && window.crypto.subtle)) return null;
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map(function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  async function handleUnlock(event) {
    event.preventDefault();
    if (Date.now() < lockBlockedUntil) {
      const seconds = Math.ceil((lockBlockedUntil - Date.now()) / 1000);
      showLockError("محاولات كثيرة. انتظر " + seconds + " ثانية ثم حاول مجدداً.");
      return;
    }
    const value = els.adminPassword.value;
    if (!value) {
      showLockError("أدخل كلمة المرور أولاً.");
      els.adminPassword.focus();
      return;
    }

    els.lockBtn.disabled = true;
    els.lockBtn.textContent = "جاري التحقق...";
    showLockError("");
    try {
      const hash = await sha256Hex(value);
      if (!hash) {
        showLockError("هذا المتصفح لا يدعم التحقق الآمن. استخدم متصفحاً حديثاً.");
        return;
      }
      if (hash === PASSWORD_HASH) {
        lockAttempts = 0;
        sessionStorage.setItem(UNLOCK_KEY, "1");
        els.adminPassword.value = "";
        const token = readToken();
        if (token) connect(token, localStorage.getItem(TOKEN_KEY) === token, true);
        else showConnectView();
      } else {
        lockAttempts += 1;
        if (lockAttempts >= MAX_LOCK_ATTEMPTS) {
          lockAttempts = 0;
          lockBlockedUntil = Date.now() + LOCKOUT_MS;
          showLockError("تجاوزت عدد المحاولات المسموح. انتظر 30 ثانية ثم حاول مجدداً.");
        } else {
          showLockError("كلمة المرور غير صحيحة. المحاولة " + lockAttempts + " من " + MAX_LOCK_ATTEMPTS + ".");
        }
        els.adminPassword.select();
      }
    } catch (error) {
      console.error(error);
      showLockError("تعذر التحقق من كلمة المرور في هذا المتصفح.");
    } finally {
      els.lockBtn.disabled = false;
      els.lockBtn.innerHTML = lockBtnHTML;
    }
  }

  function showConnectView() {
    els.lockView.hidden = true;
    els.connectView.hidden = false;
    els.appView.hidden = true;
    document.title = "لوحة التحكم — Debt Table";
  }

  function showApp() {
    els.lockView.hidden = true;
    els.connectView.hidden = true;
    els.appView.hidden = false;
    DT.applyAccent(state.site.accent);
    document.title = "لوحة التحكم — " + state.site.name;
    renderUser();
    renderAll();
    const hash = window.location.hash.replace("#", "");
    if (hash === "editor") openEditor(null, { force: true });
    else if (["posts", "sections", "settings"].indexOf(hash) !== -1) navigate(hash, { force: true });
    else navigate("dashboard", { force: true });
  }

  /* ---------------- rendering ---------------- */

  function renderUser() {
    const name = (state.user && (state.user.name || state.user.login)) || "—";
    els.userName.textContent = name;
    els.userAvatar.textContent = name.trim().charAt(0).toUpperCase() || "A";
    if (els.settingsUser) els.settingsUser.textContent = state.user ? "@" + state.user.login : "—";
    if (els.repoLabel) els.repoLabel.textContent = OWNER + "/" + REPO;
    document.querySelectorAll(".admin-brand .brand-name > span").forEach(function (el) {
      el.textContent = state.site.name || "Debt Table";
    });
  }

  function renderBranchSelect(preferred) {
    const sectionId = els.postSection.value;
    const branches = DT.branchesOf(sectionId, state.sections);
    const value = preferred == null ? els.postBranch.value : preferred;
    els.postBranch.innerHTML =
      '<option value="">بدون فرع</option>' +
      branches
        .map(function (branch) {
          return '<option value="' + DT.escapeHtml(branch.id) + '">' + DT.escapeHtml(branch.name) + "</option>";
        })
        .join("");
    els.postBranch.value = branches.some(function (branch) { return branch.id === value; })
      ? value
      : "";
  }

  function renderPostsBranchFilter(preferred) {
    const sectionId = els.postsSectionFilter.value;
    const branches = sectionId === "all" ? [] : DT.branchesOf(sectionId, state.sections);
    const value = preferred == null ? els.postsBranchFilter.value : preferred;
    els.postsBranchFilter.innerHTML =
      '<option value="all">كل الفروع</option>' +
      branches
        .map(function (branch) {
          return '<option value="' + DT.escapeHtml(branch.id) + '">' + DT.escapeHtml(branch.name) + "</option>";
        })
        .join("");
    els.postsBranchFilter.value = branches.some(function (branch) { return branch.id === value; })
      ? value
      : "all";
    els.postsBranchFilter.disabled = !branches.length;
  }

  function renderSectionSelects() {
    const editorValue = els.postSection.value;
    const branchValue = els.postBranch.value;
    const filterValue = els.postsSectionFilter.value;
    const branchFilterValue = els.postsBranchFilter.value;
    const options = state.sections
      .map(function (section) {
        return '<option value="' + DT.escapeHtml(section.id) + '">' + DT.escapeHtml(section.name) + "</option>";
      })
      .join("");
    els.postSection.innerHTML = options || '<option value="">عام</option>';
    els.postsSectionFilter.innerHTML =
      '<option value="all">كل الأقسام</option>' + options;
    if (state.sections.some(function (section) { return section.id === editorValue; })) {
      els.postSection.value = editorValue;
    } else if (state.sections.length) {
      els.postSection.value = state.sections[0].id;
    } else {
      els.postSection.value = "";
    }
    renderBranchSelect(branchValue);
    els.postsSectionFilter.value = state.sections.some(function (section) {
      return section.id === filterValue;
    }) ? filterValue : "all";
    renderPostsBranchFilter(branchFilterValue);
  }

  function renderDashboard() {
    const published = state.posts.filter(function (post) { return post.status === "published"; }).length;
    const drafts = state.posts.length - published;
    const latest = sortByUpdated(state.posts)[0];
    const branchCount = state.sections.reduce(function (total, section) {
      return total + (section.children || []).length;
    }, 0);
    els.statPublished.textContent = published;
    els.statDrafts.textContent = drafts;
    els.statSectionsAdmin.textContent = state.sections.length;
    if (els.statBranchesNote) {
      if (branchCount === 0) els.statBranchesNote.textContent = "لتنظيم المحتوى";
      else if (branchCount === 1) els.statBranchesNote.textContent = "فرع واحد داخل الأقسام";
      else if (branchCount === 2) els.statBranchesNote.textContent = "فرعان داخل الأقسام";
      else if (branchCount <= 10) els.statBranchesNote.textContent = branchCount + " فروع داخل الأقسام";
      else els.statBranchesNote.textContent = branchCount + " فرعاً داخل الأقسام";
    }
    els.statLastUpdate.textContent = latest
      ? DT.formatDate(latest.updatedAt || latest.createdAt, true)
      : "—";

    const recent = sortByUpdated(state.posts).slice(0, 5);
    els.recentPosts.innerHTML = recent.length
      ? recent
          .map(function (post) {
            const status = post.status === "published" ? "published" : "draft";
            const label = status === "published" ? "منشور" : "مسودة";
            return (
              '<div class="recent-item">' +
              '<span class="status-pill ' + status + '">' + label + "</span>" +
              '<div class="recent-main"><strong>' + DT.escapeHtml(post.title || "بدون عنوان") + "</strong>" +
              "<span>" + DT.escapeHtml([sectionName(post.section), postBranchName(post), DT.formatDate(post.updatedAt || post.createdAt, true)].filter(Boolean).join(" · ")) + "</span></div>" +
              '<button type="button" class="icon-btn" data-edit="' + DT.escapeHtml(post.id) + '" aria-label="تعديل المقال">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>' +
              "</button></div>"
            );
          })
          .join("")
      : '<div class="empty-list">لا توجد مقالات بعد. ابدأ بكتابة أول مقال.</div>';
  }

  function renderPostsList() {
    const query = els.postsSearch.value.trim().toLowerCase();
    const status = els.postsStatusFilter.value;
    const section = els.postsSectionFilter.value;
    const branch = els.postsBranchFilter.value;
    let list = sortByUpdated(state.posts);

    if (query) {
      list = list.filter(function (post) {
        return (post.title || "").toLowerCase().indexOf(query) !== -1;
      });
    }
    if (status !== "all") {
      list = list.filter(function (post) { return post.status === status; });
    }
    if (section !== "all") {
      list = list.filter(function (post) { return post.section === section; });
    }
    if (branch !== "all") {
      list = list.filter(function (post) { return post.branch === branch; });
    }

    const published = state.posts.filter(function (post) { return post.status === "published"; }).length;
    els.postsSummary.textContent =
      state.posts.length + " مقالاً · " + published + " منشور · " + (state.posts.length - published) + " مسودة";

    els.postsList.innerHTML = list.length
      ? list
          .map(function (post) {
            const isPublished = post.status === "published";
            const statusClass = isPublished ? "published" : "draft";
            const statusLabel = isPublished ? "منشور" : "مسودة";
            const viewLink = isPublished
              ? '<a class="row-action" href="post.html?slug=' + encodeURIComponent(post.slug || post.id) +
                '" target="_blank" rel="noopener" aria-label="عرض المقال">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg></a>'
              : "";
            return (
              '<div class="post-row">' +
              '<div class="post-row-main"><div class="post-row-title"><strong>' +
              DT.escapeHtml(post.title || "بدون عنوان") + "</strong></div>" +
              '<div class="post-row-meta"><span>' +
              DT.escapeHtml([sectionName(post.section), postBranchName(post)].filter(Boolean).join(" / ")) +
              '</span><span>·</span><time>' + DT.escapeHtml(DT.formatDate(post.updatedAt || post.createdAt, true)) + "</time></div></div>" +
              '<div class="post-row-actions">' +
              '<span class="status-pill ' + statusClass + '">' + statusLabel + "</span>" +
              '<button type="button" class="row-action" data-edit="' + DT.escapeHtml(post.id) + '" aria-label="تعديل">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg></button>' +
              viewLink +
              '<button type="button" class="row-action danger" data-delete="' + DT.escapeHtml(post.id) + '" aria-label="حذف">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6M14 11v6"></path></svg></button>' +
              "</div></div>"
            );
          })
          .join("")
      : '<div class="empty-list">لا توجد مقالات مطابقة. جرّب تغيير البحث أو أنشئ مقالاً جديداً.</div>';
  }

  function renderSectionsList() {
    const pencilIcon =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
    const trashIcon =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>';

    els.sectionsList.innerHTML = state.sections.length
      ? state.sections
          .map(function (section, index) {
            const children = section.children || [];
            const count = state.posts.filter(function (post) {
              return post.section === section.id;
            }).length;
            const branchRows = children.length
              ? children
                  .map(function (branch) {
                    const branchCount = state.posts.filter(function (post) {
                      return post.section === section.id && post.branch === branch.id;
                    }).length;
                    return (
                      '<div class="branch-row">' +
                      '<span class="branch-name">' + DT.escapeHtml(branch.name) +
                      '<span class="branch-count">' + branchCount + "</span></span>" +
                      '<div class="branch-actions">' +
                      '<button type="button" class="row-action" data-rename-branch="' + DT.escapeHtml(branch.id) +
                      '" aria-label="إعادة تسمية الفرع">' + pencilIcon + "</button>" +
                      '<button type="button" class="row-action danger" data-remove-branch="' + DT.escapeHtml(branch.id) +
                      '" aria-label="حذف الفرع">' + trashIcon + "</button>" +
                      "</div></div>"
                    );
                  })
                  .join("")
              : '<div class="branch-empty">لا توجد فروع بعد — أضف أول فرع من الأسفل.</div>';

            return (
              '<div class="section-block">' +
              '<div class="section-row">' +
              '<div class="section-row-main"><strong>' + DT.escapeHtml(section.name) +
              '<span class="section-count">' + count + "</span></strong>" +
              "<small>" + DT.escapeHtml(section.id) + " · " + children.length + " فرع</small></div>" +
              '<div class="section-row-actions">' +
              '<button type="button" class="row-action" data-move="up" data-id="' + DT.escapeHtml(section.id) +
              '" aria-label="تحريك لأعلى"' + (index === 0 ? " disabled" : "") + ">" +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"></path></svg></button>' +
              '<button type="button" class="row-action" data-move="down" data-id="' + DT.escapeHtml(section.id) +
              '" aria-label="تحريك لأسفل"' + (index === state.sections.length - 1 ? " disabled" : "") + ">" +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></button>' +
              '<button type="button" class="row-action" data-rename="' + DT.escapeHtml(section.id) +
              '" aria-label="إعادة تسمية القسم">' + pencilIcon + "</button>" +
              '<button type="button" class="row-action danger" data-remove="' + DT.escapeHtml(section.id) +
              '" aria-label="حذف القسم">' + trashIcon + "</button>" +
              "</div></div>" +
              '<div class="branch-list">' + branchRows +
              '<form class="branch-add" data-branch-form="' + DT.escapeHtml(section.id) + '">' +
              '<input type="text" name="branchName" maxlength="40" autocomplete="off" placeholder="اسم الفرع الجديد" aria-label="اسم الفرع الجديد داخل ' +
              DT.escapeHtml(section.name) + '">' +
              '<button type="submit" class="btn btn-ghost btn-sm">إضافة فرع</button>' +
              "</form></div></div>"
            );
          })
          .join("")
      : '<div class="empty-list">لا توجد أقسام بعد. أضف أول قسم رئيسي من الأعلى.</div>';
  }

  function renderSettings() {
    els.siteNameInput.value = state.site.name || "";
    els.siteTaglineInput.value = state.site.tagline || "";
    els.siteDescriptionInput.value = state.site.description || "";
    els.siteFooterInput.value = state.site.footer || "";
    const accent = /^#[0-9a-f]{6}$/i.test(state.site.accent || "") ? state.site.accent : "#34d399";
    els.siteAccentInput.value = accent;
    els.siteAccentText.value = accent;
  }

  function renderAll() {
    renderUser();
    renderSectionSelects();
    renderDashboard();
    renderPostsList();
    renderSectionsList();
    renderSettings();
  }

  function renderView() {
    document.querySelectorAll(".view").forEach(function (view) {
      view.hidden = view.getAttribute("data-view") !== state.view;
    });
    document.querySelectorAll(".nav-item").forEach(function (item) {
      item.classList.toggle("active", item.getAttribute("data-view") === state.view);
    });
    els.viewTitle.textContent = VIEW_TITLES[state.view] || "";
    if (state.view === "dashboard") renderDashboard();
    if (state.view === "posts") renderPostsList();
    if (state.view === "sections") renderSectionsList();
    if (state.view === "settings") renderSettings();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function navigate(view, options) {
    const opts = options || {};
    if (!opts.force && state.dirty && state.view === "editor" && view !== "editor") {
      if (!window.confirm("لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟")) return;
      state.dirty = false;
    }
    if (view === "editor") {
      openEditor(opts.id || null);
      return;
    }
    state.view = view;
    renderView();
    history.replaceState(null, "", "#" + view);
    closeSidebar();
  }

  function closeSidebar() {
    els.sidebar.classList.remove("open");
    els.sidebarOverlay.hidden = true;
  }

  /* ---------------- editor ---------------- */

  function markDirty() {
    state.dirty = true;
  }

  function updateCounts() {
    const text = els.postContent.innerText.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    els.wordCount.textContent = words + " كلمة";
    const minutes = Math.max(1, Math.ceil(words / 200));
    els.readTime.textContent = "قراءة " + minutes + (minutes === 1 ? " دقيقة" : " دقائق");
  }

  function updateExcerptCount() {
    els.excerptCount.textContent = els.postExcerpt.value.length;
  }

  function updateCoverPreview(src) {
    if (src) {
      els.coverPreview.innerHTML =
        '<img src="' + DT.escapeHtml(src) + '" alt="معاينة الغلاف" onerror="this.remove()">';
    } else {
      els.coverPreview.innerHTML = "<span>لا توجد صورة</span>";
    }
  }

  function updateEditorStatus(post) {
    const published = post && post.status === "published";
    els.editorStatus.textContent = published ? "منشور" : "مسودة";
    els.editorStatus.className = "badge" + (published ? "" : " badge-neutral");
    els.sideStatus.textContent = published ? "منشور" : "مسودة";
    els.publishBtn.textContent = published ? "تحديث المنشور" : "نشر";
  }

  function updateSideMeta(post) {
    els.sideDate.textContent = post && post.publishedAt ? DT.formatDate(post.publishedAt, true) : "—";
    els.sideUpdated.textContent = post && post.updatedAt ? DT.formatDate(post.updatedAt, true) : "—";
    els.sideLink.textContent = (post && post.slug) || els.postSlug.value.trim() || "—";
  }

  function populateEditor(post) {
    els.postTitle.value = post ? post.title || "" : "";
    els.postSlug.value = post ? post.slug || "" : "";
    const knownSection = post && state.sections.some(function (section) {
      return section.id === post.section;
    });
    els.postSection.value = knownSection
      ? post.section
      : (state.sections[0] ? state.sections[0].id : "");
    renderBranchSelect(post ? post.branch || "" : "");
    els.postExcerpt.value = post ? post.excerpt || "" : "";
    els.postContent.innerHTML = post ? DT.sanitize(post.content || "") : "";
    els.postCover.value = post ? post.cover || "" : "";
    updateCoverPreview(post ? post.cover || "" : "");
    updateCounts();
    updateExcerptCount();
    els.editorTitle.textContent = post ? post.title || "تعديل المقال" : "مقال جديد";
    els.deletePanel.hidden = !post;
    els.editorStatus.textContent = post && post.status === "published" ? "منشور" : "مسودة";
    updateEditorStatus(post || { status: "draft" });
    updateSideMeta(post);
    slugTouched = Boolean(post);
    state.editingId = post ? post.id : null;
    state.dirty = false;
  }

  function openEditor(id, options) {
    const opts = options || {};
    if (!opts.force && state.dirty && state.view === "editor") {
      if (!window.confirm("لديك تغييرات غير محفوظة. هل تريد فتح مقال آخر دون حفظ؟")) return;
      state.dirty = false;
    }
    let post = null;
    if (id) {
      post = state.posts.find(function (item) { return item.id === id; }) || null;
      if (!post) {
        toast("المقال غير موجود.", "error");
        return;
      }
    }
    state.view = "editor";
    renderSectionSelects();
    populateEditor(post);
    renderView();
    history.replaceState(null, "", "#editor");
    closeSidebar();
  }

  function collectEditor(mode) {
    const existing = state.posts.find(function (post) { return post.id === state.editingId; });
    const now = new Date().toISOString();
    const content = DT.sanitize(els.postContent.innerHTML.trim());
    const title = els.postTitle.value.trim();
    const status = mode === "publish" ? "published" : "draft";
    const excerpt = els.postExcerpt.value.trim() || DT.truncate(DT.plainText(content), 160);
    const sectionId = els.postSection.value || "";
    const branchId = els.postBranch.value || "";
    return {
      id: state.editingId || uid(),
      slug: els.postSlug.value.trim() || slugify(title) || "post-" + Date.now(),
      title: title,
      section: sectionId,
      branch: DT.branchesOf(sectionId, state.sections).some(function (branch) {
        return branch.id === branchId;
      }) ? branchId : "",
      excerpt: excerpt,
      content: content,
      cover: els.postCover.value.trim(),
      status: status,
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
      publishedAt: status === "published"
        ? (existing && existing.publishedAt) || now
        : (existing && existing.publishedAt) || null,
    };
  }

  async function savePost(mode) {
    if (state.saving) {
      toast("هناك عملية حفظ جارية، انتظر لحظة.", "error");
      return;
    }
    const post = collectEditor(mode);
    if (!post.title) {
      toast("أضف عنواناً للمقال أولاً.", "error");
      els.postTitle.focus();
      return;
    }
    if (!DT.plainText(post.content)) {
      toast("أضف محتوى للمقال أولاً.", "error");
      els.postContent.focus();
      return;
    }

    post.slug = uniqueSlug(post.slug, post.id);
    state.editingId = post.id;
    const index = state.posts.findIndex(function (item) { return item.id === post.id; });
    const previous = index >= 0 ? state.posts[index] : null;
    if (index >= 0) state.posts[index] = post;
    else state.posts.push(post);

    const ok = await runSave(
      function () { return persistPosts((mode === "publish" ? "نشر: " : "مسودة: ") + post.title); },
      mode === "publish" ? "تم نشر المقال." : "تم حفظ المسودة."
    );

    if (!ok) {
      if (index >= 0) state.posts[index] = previous;
      else state.posts.pop();
      state.dirty = true;
      return;
    }

    els.postSlug.value = post.slug;
    slugTouched = true;
    els.editorTitle.textContent = post.title;
    updateEditorStatus(post);
    updateSideMeta(post);
    state.dirty = false;
    renderAll();
    updateEditorStatus(post);
  }

  async function deletePost(id) {
    const post = state.posts.find(function (item) { return item.id === id; });
    if (!post) return;
    if (!window.confirm("هل تريد حذف «" + (post.title || "بدون عنوان") + "» نهائياً؟")) return;

    const index = state.posts.indexOf(post);
    state.posts.splice(index, 1);
    state.deletedIds.add(post.id);

    const ok = await runSave(
      function () { return persistPosts("حذف: " + (post.title || "بدون عنوان")); },
      "تم حذف المقال."
    );

    if (!ok) {
      state.posts.splice(index, 0, post);
      state.deletedIds.delete(post.id);
      return;
    }

    if (state.editingId === post.id) {
      state.editingId = null;
      state.dirty = false;
      navigate("posts", { force: true });
    }
    renderAll();
  }

  /* ---------------- images ---------------- */

  async function uploadImage(file) {
    if (!file.type || file.type.indexOf("image/") !== 0) {
      throw new Error("الملف المختار ليس صورة.");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("حجم الصورة أكبر من 2 ميجابايت. اختر صورة أصغر.");
    }
    const buffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40) || "image";
    const path = "assets/uploads/" + Date.now() + "-" + base + "." + ext;
    await putFile(path, base64, "رفع صورة: " + file.name, undefined, true);
    return path;
  }

  async function handleCoverFile(file) {
    if (!file) return;
    els.uploadCoverBtn.disabled = true;
    els.uploadCoverBtn.textContent = "جاري الرفع...";
    try {
      const path = await uploadImage(file);
      els.postCover.value = path;
      updateCoverPreview(URL.createObjectURL(file));
      markDirty();
      toast("تم رفع الصورة. قد تحتاج دقيقة لتظهر على الموقع.", "success");
    } catch (error) {
      toast(error.message || mapError(error), "error");
    } finally {
      els.uploadCoverBtn.disabled = false;
      els.uploadCoverBtn.textContent = "رفع صورة";
    }
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (els.postContent.contains(range.commonAncestorContainer)) {
      savedRange = range.cloneRange();
    }
  }

  function placeCaretAtEnd() {
    const range = document.createRange();
    range.selectNodeContents(els.postContent);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function restoreSelection() {
    els.postContent.focus();
    if (savedRange) {
      try {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedRange);
        return;
      } catch (error) {
        savedRange = null;
      }
    }
    placeCaretAtEnd();
  }

  async function handleInlineImage(file) {
    if (!file) return;
    toast("جاري رفع الصورة...");
    try {
      const path = await uploadImage(file);
      restoreSelection();
      document.execCommand("insertHTML", false, '<img src="' + path + '" alt="">');
      markDirty();
      updateCounts();
      toast("تمت إضافة الصورة.", "success");
    } catch (error) {
      toast(error.message || mapError(error), "error");
    }
  }

  /* ---------------- preview ---------------- */

  function openPreview() {
    previewReturnFocus = document.activeElement;
    const post = collectEditor("preview");
    const section = DT.escapeHtml(sectionName(post.section));
    const branch = DT.escapeHtml(postBranchName(post));
    const date = post.publishedAt ? DT.formatDate(post.publishedAt, true) : "الآن";
    const cover = post.cover
      ? '<figure class="article-cover"><img src="' + DT.escapeHtml(post.cover) +
        '" alt="' + DT.escapeHtml(post.title) + '" onerror="this.remove()"></figure>'
      : "";
    els.previewBody.innerHTML =
      '<article><header class="article-head">' +
      '<div class="article-badges"><span class="badge">' + section + "</span>" +
      (branch ? '<span class="badge badge-neutral">' + branch + "</span>" : "") +
      "</div>" +
      "<h1>" + DT.escapeHtml(post.title || "بدون عنوان") + "</h1>" +
      (post.excerpt ? '<p class="article-excerpt">' + DT.escapeHtml(post.excerpt) + "</p>" : "") +
      '<div class="article-meta"><span>' + DT.escapeHtml(date) + '</span><span class="sep"></span><span>' +
      DT.readingTime(post.content) + " د قراءة</span></div></header>" +
      cover +
      '<div class="article-content">' + DT.sanitize(post.content) + "</div></article>";
    els.previewModal.hidden = false;
    document.body.style.overflow = "hidden";
    const closeButton = els.previewModal.querySelector(".icon-btn[data-close-preview]");
    if (closeButton) closeButton.focus();
  }

  function closePreview() {
    els.previewModal.hidden = true;
    document.body.style.overflow = "";
    if (previewReturnFocus && document.contains(previewReturnFocus)) {
      previewReturnFocus.focus();
    }
    previewReturnFocus = null;
  }

  /* ---------------- event wiring ---------------- */

  function bindEvents() {
    els.lockForm.addEventListener("submit", handleUnlock);

    els.adminPassword.addEventListener("input", function () {
      if (!els.lockError.hidden) showLockError("");
    });

    els.togglePassword.addEventListener("click", function () {
      const visible = els.adminPassword.type === "text";
      els.adminPassword.type = visible ? "password" : "text";
      els.togglePassword.textContent = visible ? "إظهار" : "إخفاء";
    });

    els.connectForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const token = els.tokenInput.value.trim();
      if (!token) {
        showConnectError("ألصق التوكن أولاً.");
        els.tokenInput.focus();
        return;
      }
      connect(token, els.rememberToken.checked, false);
    });

    els.tokenInput.addEventListener("input", function () {
      if (!els.connectError.hidden) showConnectError("");
    });

    els.toggleToken.addEventListener("click", function () {
      const visible = els.tokenInput.type === "text";
      els.tokenInput.type = visible ? "password" : "text";
      els.toggleToken.textContent = visible ? "إظهار" : "إخفاء";
    });

    document.querySelectorAll("button[data-view], a[data-view]").forEach(function (item) {
      item.addEventListener("click", function (event) {
        event.preventDefault();
        const view = item.getAttribute("data-view");
        if (view === "editor") navigate("editor", { id: null });
        else navigate(view);
      });
    });

    document.querySelectorAll('[data-action="new-post"]').forEach(function (item) {
      item.addEventListener("click", function () { openEditor(null); });
    });

    els.menuBtn.addEventListener("click", function () {
      const open = !els.sidebar.classList.contains("open");
      els.sidebar.classList.toggle("open", open);
      els.sidebarOverlay.hidden = !open;
    });

    els.sidebarOverlay.addEventListener("click", closeSidebar);

    els.logoutBtn.addEventListener("click", logout);
    els.logoutBtn2.addEventListener("click", logout);

    els.postsSearch.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderPostsList, 120);
    });
    els.postsStatusFilter.addEventListener("change", renderPostsList);
    els.postsSectionFilter.addEventListener("change", function () {
      renderPostsBranchFilter("all");
      renderPostsList();
    });
    els.postsBranchFilter.addEventListener("change", renderPostsList);

    els.recentPosts.addEventListener("click", function (event) {
      const button = event.target.closest("[data-edit]");
      if (button) openEditor(button.getAttribute("data-edit"));
    });

    els.postsList.addEventListener("click", function (event) {
      const edit = event.target.closest("[data-edit]");
      if (edit) {
        openEditor(edit.getAttribute("data-edit"));
        return;
      }
      const remove = event.target.closest("[data-delete]");
      if (remove) deletePost(remove.getAttribute("data-delete"));
    });

    els.sectionForm.addEventListener("submit", addSection);

    els.sectionsList.addEventListener("submit", function (event) {
      const form = event.target.closest("[data-branch-form]");
      if (!form) return;
      event.preventDefault();
      const input = form.querySelector('input[name="branchName"]');
      addBranch(form.getAttribute("data-branch-form"), input ? input.value : "");
    });

    els.sectionsList.addEventListener("click", function (event) {
      const renameBranchBtn = event.target.closest("[data-rename-branch]");
      if (renameBranchBtn) {
        renameBranch(renameBranchBtn.getAttribute("data-rename-branch"));
        return;
      }
      const removeBranchBtn = event.target.closest("[data-remove-branch]");
      if (removeBranchBtn) {
        removeBranch(removeBranchBtn.getAttribute("data-remove-branch"));
        return;
      }
      const rename = event.target.closest("[data-rename]");
      if (rename) {
        renameSection(rename.getAttribute("data-rename"));
        return;
      }
      const remove = event.target.closest("[data-remove]");
      if (remove) {
        removeSection(remove.getAttribute("data-remove"));
        return;
      }
      const move = event.target.closest("[data-move]");
      if (move) moveSection(move.getAttribute("data-id"), move.getAttribute("data-move"));
    });

    els.postTitle.addEventListener("input", function () {
      if (!slugTouched) els.postSlug.value = slugify(els.postTitle.value);
      els.editorTitle.textContent = els.postTitle.value.trim() || "مقال جديد";
      markDirty();
    });

    els.postSlug.addEventListener("input", function () {
      slugTouched = true;
      els.sideLink.textContent = els.postSlug.value.trim() || "—";
      markDirty();
    });

    els.postSection.addEventListener("change", function () {
      renderBranchSelect("");
      markDirty();
    });
    els.postBranch.addEventListener("change", markDirty);
    els.postExcerpt.addEventListener("input", function () {
      updateExcerptCount();
      markDirty();
    });

    els.postContent.addEventListener("input", function () {
      updateCounts();
      markDirty();
    });

    els.postContent.addEventListener("paste", function (event) {
      const clipboard = event.clipboardData || window.clipboardData;
      if (!clipboard) return;
      event.preventDefault();
      const html = clipboard.getData("text/html");
      const text = clipboard.getData("text/plain");
      if (html) {
        document.execCommand("insertHTML", false, DT.sanitize(html));
      } else {
        document.execCommand("insertText", false, text);
      }
      updateCounts();
      markDirty();
    });

    document.addEventListener("selectionchange", saveSelection);

    els.editorToolbar.addEventListener("click", async function (event) {
      const button = event.target.closest("button");
      if (!button) return;
      event.preventDefault();
      const command = button.getAttribute("data-cmd");
      const block = button.getAttribute("data-block");
      const action = button.getAttribute("data-action");

      if (command) {
        restoreSelection();
        document.execCommand(command, false, null);
      } else if (block) {
        restoreSelection();
        document.execCommand("formatBlock", false, "<" + block + ">");
      } else if (action === "link") {
        const url = window.prompt("أدخل رابطاً:", "https://");
        if (!url) return;
        const clean = /^(https?:|mailto:|tel:)/i.test(url) ? url : "https://" + url;
        restoreSelection();
        const selection = window.getSelection();
        if (selection && selection.isCollapsed) {
          document.execCommand("insertHTML", false, '<a href="' + DT.escapeHtml(clean) + '">' + DT.escapeHtml(clean) + "</a>");
        } else {
          document.execCommand("createLink", false, clean);
        }
      } else if (action === "image") {
        saveSelection();
        inlineImageInput.click();
      } else if (action === "clear") {
        restoreSelection();
        document.execCommand("removeFormat", false, null);
        document.execCommand("formatBlock", false, "<p>");
      }

      markDirty();
      updateCounts();
    });

    els.uploadCoverBtn.addEventListener("click", function () { els.coverFile.click(); });
    els.coverFile.addEventListener("change", function () {
      const file = els.coverFile.files[0];
      els.coverFile.value = "";
      handleCoverFile(file);
    });

    els.clearCoverBtn.addEventListener("click", function () {
      els.postCover.value = "";
      updateCoverPreview("");
      markDirty();
    });

    els.postCover.addEventListener("input", function () {
      updateCoverPreview(els.postCover.value.trim());
      markDirty();
    });

    els.previewBtn.addEventListener("click", openPreview);
    els.saveDraftBtn.addEventListener("click", function () { savePost("draft"); });
    els.publishBtn.addEventListener("click", function () { savePost("publish"); });
    els.deletePostBtn.addEventListener("click", function () {
      if (state.editingId) deletePost(state.editingId);
    });

    els.previewModal.querySelectorAll("[data-close-preview]").forEach(function (item) {
      item.addEventListener("click", closePreview);
    });

    els.settingsForm.addEventListener("submit", saveSettings);

    els.siteAccentInput.addEventListener("input", function () {
      els.siteAccentText.value = els.siteAccentInput.value;
      DT.applyAccent(els.siteAccentInput.value);
    });

    els.siteAccentText.addEventListener("input", function () {
      const value = els.siteAccentText.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(value)) {
        els.siteAccentInput.value = value;
        DT.applyAccent(value);
      }
    });

    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (!els.previewModal.hidden) closePreview();
        else closeSidebar();
      }
    });

    window.addEventListener("beforeunload", function (event) {
      if (state.dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
  }

  const inlineImageInput = document.createElement("input");
  inlineImageInput.type = "file";
  inlineImageInput.accept = "image/png,image/jpeg,image/webp,image/gif";
  inlineImageInput.hidden = true;
  document.body.appendChild(inlineImageInput);
  inlineImageInput.addEventListener("change", function () {
    const file = inlineImageInput.files[0];
    inlineImageInput.value = "";
    handleInlineImage(file);
  });

  /* ---------------- sections ---------------- */

  async function addSection(event) {
    event.preventDefault();
    const name = els.sectionName.value.trim();
    if (!name) {
      toast("اكتب اسم القسم.", "error");
      return;
    }
    if (state.sections.some(function (section) { return section.name.trim() === name; })) {
      toast("هذا القسم موجود بالفعل.", "error");
      return;
    }
    const section = { id: uniqueSectionId(name), name: name, children: [] };
    state.sections.push(section);
    const ok = await runSave(function () { return persistSections("إضافة قسم: " + name); }, "تمت إضافة القسم.");
    if (!ok) {
      state.sections.pop();
      return;
    }
    els.sectionName.value = "";
    renderAll();
  }

  async function renameSection(id) {
    const section = state.sections.find(function (item) { return item.id === id; });
    if (!section) return;
    const name = window.prompt("اسم القسم الجديد:", section.name);
    if (!name || !name.trim() || name.trim() === section.name) return;
    if (state.sections.some(function (item) {
      return item.id !== id && item.name.trim() === name.trim();
    })) {
      toast("يوجد قسم آخر بهذا الاسم.", "error");
      return;
    }
    const oldName = section.name;
    section.name = name.trim();
    const ok = await runSave(function () { return persistSections("إعادة تسمية قسم: " + oldName); }, "تم تحديث القسم.");
    if (!ok) section.name = oldName;
    else renderAll();
  }

  async function removeSection(id) {
    const section = state.sections.find(function (item) { return item.id === id; });
    if (!section) return;
    const count = state.posts.filter(function (post) { return post.section === id; }).length;
    if (count > 0) {
      toast("لا يمكن حذف قسم يحتوي على " + count + " مقال. انقل المقالات أولاً.", "error");
      return;
    }
    const branchCount = (section.children || []).length;
    if (branchCount > 0 && !window.confirm(
      "قسم «" + section.name + "» يحتوي على " + branchCount + " فرع. سيتم حذف الفروع أيضاً. هل تريد المتابعة؟"
    )) {
      return;
    }
    if (!window.confirm("حذف قسم «" + section.name + "»؟")) return;
    const index = state.sections.indexOf(section);
    state.sections.splice(index, 1);
    const ok = await runSave(function () { return persistSections("حذف قسم: " + section.name); }, "تم حذف القسم.");
    if (!ok) {
      state.sections.splice(index, 0, section);
      return;
    }
    renderAll();
  }

  async function addBranch(sectionId, rawName) {
    const section = state.sections.find(function (item) { return item.id === sectionId; });
    if (!section) return;
    const name = String(rawName || "").trim();
    if (!name) {
      toast("اكتب اسم الفرع.", "error");
      return;
    }
    section.children = section.children || [];
    if (section.children.some(function (branch) { return branch.name.trim() === name; })) {
      toast("هذا الفرع موجود بالفعل داخل القسم.", "error");
      return;
    }
    const branch = { id: uniqueBranchId(name), name: name };
    section.children.push(branch);
    const ok = await runSave(
      function () { return persistSections("إضافة فرع: " + name + " في " + section.name); },
      "تمت إضافة الفرع."
    );
    if (!ok) {
      section.children.pop();
      return;
    }
    renderAll();
  }

  async function renameBranch(branchId) {
    const found = findBranch(branchId);
    if (!found) return;
    const name = window.prompt("اسم الفرع الجديد:", found.branch.name);
    if (!name || !name.trim() || name.trim() === found.branch.name) return;
    if ((found.section.children || []).some(function (branch) {
      return branch.id !== branchId && branch.name.trim() === name.trim();
    })) {
      toast("يوجد فرع آخر بهذا الاسم داخل القسم.", "error");
      return;
    }
    const oldName = found.branch.name;
    found.branch.name = name.trim();
    const ok = await runSave(
      function () { return persistSections("إعادة تسمية فرع: " + oldName); },
      "تم تحديث الفرع."
    );
    if (!ok) found.branch.name = oldName;
    else renderAll();
  }

  async function removeBranch(branchId) {
    const found = findBranch(branchId);
    if (!found) return;
    const count = state.posts.filter(function (post) {
      return post.section === found.section.id && post.branch === branchId;
    }).length;
    if (count > 0) {
      toast("لا يمكن حذف فرع يحتوي على " + count + " مقال. انقل المقالات أولاً.", "error");
      return;
    }
    if (!window.confirm("حذف فرع «" + found.branch.name + "» من قسم «" + found.section.name + "»؟")) return;
    found.section.children.splice(found.index, 1);
    const ok = await runSave(
      function () { return persistSections("حذف فرع: " + found.branch.name); },
      "تم حذف الفرع."
    );
    if (!ok) {
      found.section.children.splice(found.index, 0, found.branch);
      return;
    }
    renderAll();
  }

  async function moveSection(id, direction) {
    const index = state.sections.findIndex(function (section) { return section.id === id; });
    if (index === -1) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= state.sections.length) return;
    const temp = state.sections[index];
    state.sections[index] = state.sections[target];
    state.sections[target] = temp;
    const ok = await runSave(function () { return persistSections("ترتيب الأقسام"); });
    if (!ok) {
      const back = state.sections[index];
      state.sections[index] = state.sections[target];
      state.sections[target] = back;
      return;
    }
    renderAll();
  }

  /* ---------------- settings ---------------- */

  async function saveSettings(event) {
    event.preventDefault();
    const name = els.siteNameInput.value.trim();
    if (!name) {
      toast("اسم الموقع مطلوب.", "error");
      els.siteNameInput.focus();
      return;
    }
    const accent = els.siteAccentText.value.trim();
    if (!/^#[0-9a-f]{6}$/i.test(accent)) {
      toast("اللون يجب أن يكون بصيغة #RRGGBB.", "error");
      return;
    }
    const previous = state.site;
    state.site = Object.assign({}, state.site, {
      name: name,
      tagline: els.siteTaglineInput.value.trim(),
      description: els.siteDescriptionInput.value.trim(),
      footer: els.siteFooterInput.value.trim(),
      accent: accent.toLowerCase(),
    });
    const ok = await runSave(
      function () { return saveJson("data/site.json", state.site, "تحديث إعدادات الموقع"); },
      "تم حفظ الإعدادات."
    );
    if (!ok) {
      state.site = previous;
      DT.applyAccent(previous.accent || DT.DEFAULTS.site.accent);
      renderSettings();
      return;
    }
    DT.applyAccent(state.site.accent);
    renderUser();
    document.title = "لوحة التحكم — " + state.site.name;
  }

  /* ---------------- auth actions ---------------- */

  function logout() {
    if (state.dirty && !window.confirm("لديك تغييرات غير محفوظة. هل تريد تسجيل الخروج؟")) return;
    clearToken();
    sessionStorage.removeItem(UNLOCK_KEY);
    state.token = null;
    window.location.reload();
  }

  /* ---------------- init ---------------- */

  bindEvents();

  if (sessionStorage.getItem(UNLOCK_KEY) !== "1") {
    showLockView();
  } else {
    els.lockView.hidden = true;
    const savedToken = readToken();
    if (savedToken) {
      connect(savedToken, localStorage.getItem(TOKEN_KEY) === savedToken, true);
    } else {
      showConnectView();
    }
  }
})();
