/* KM exit/login: logout zeros license session; dual login Administrator + User */
(function () {
  'use strict';

  const KM_ADMIN_TOKEN_KEY = 'km_admin_token';
  const KM_USER_SESSION_KEY = 'km_user_session';

  function kmUserPasswordError(pw) {
    var s = String(pw || '');
    if (/[^A-Za-z0-9]/.test(s)) return 'Գաղտնաբառը միայն լատինատառ և թվեր';
    var letters = (s.match(/[A-Za-z]/g) || []).length;
    var digits = (s.match(/\d/g) || []).length;
    if (letters < 2) return 'Գաղտնաբառը պետք է պարունակի 2 լատինատառ';
    if (digits < 6 || digits > 12) return 'Գաղտնաբառը պետք է պարունակի 6-ից 12 թիվ';
    return '';
  }

  function kmSaveUserSession(role, mode, extra) {
    try {
      var es = null;
      var vs = null;
      if (extra && Object.prototype.hasOwnProperty.call(extra, 'editSections')) {
        es = Array.isArray(extra.editSections) ? extra.editSections.slice() : [];
      }
      if (extra && Object.prototype.hasOwnProperty.call(extra, 'viewSections')) {
        vs = Array.isArray(extra.viewSections) ? extra.viewSections.slice() : [];
      }
      localStorage.setItem(KM_USER_SESSION_KEY, JSON.stringify({
        role: role || 'editor',
        mode: mode || 'user',
        savedAt: Date.now(),
        username: (extra && extra.username) || '',
        fullName: (extra && extra.fullName) || '',
        userId: (extra && extra.userId) || '',
        registered: !!(extra && (extra.userId || extra.registered || Array.isArray(es) || Array.isArray(vs))),
        editSections: es,
        viewSections: vs
      }));
    } catch (e) {}
  }

  function kmSleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /** Գրանցված օգտատեր՝ մուտք միայն եթե տողը կա km_app_users.json-ում */
  async function kmFinishRegisteredUserLogin(username, opts) {
    opts = opts || {};
    var un = String(username || '').trim().replace(/\s+/g, ' ');
    if (!un) return { ok: false, error: 'Մուտքանունը բացակայում է' };
    if (!window.kmNative || !window.kmNative.users || !window.kmNative.users.ensure) {
      return { ok: false, error: 'Գրանցման ստուգումը հասանելի չէ' };
    }
    try {
      var ens = null;
      var tries = opts.retry === false ? 1 : 4;
      for (var i = 0; i < tries; i++) {
        ens = await window.kmNative.users.ensure({ username: un });
        if (ens && ens.blocked) break;
        if (ens && ens.ok && ens.user && !ens.notRegistered) break;
        if (i + 1 < tries) await kmSleep(180 * (i + 1));
      }
      if (ens && ens.blocked) {
        return { ok: false, error: ens.error || 'Օգտատերը հեռացված է' };
      }
      if (!ens || !ens.ok || ens.notRegistered || !ens.user) {
        return { ok: false, error: (ens && ens.error) || 'Օգտատերը գրանցված չէ' };
      }
      var userId = ens.user.id || opts.userId || '';
      var editSections = Array.isArray(ens.user.editSections) ? ens.user.editSections.slice() : [];
      var viewSections = Array.isArray(ens.user.viewSections) ? ens.user.viewSections.slice() : [];
      var fullName = String(ens.user.fullName || opts.fullName || '').trim();
      kmApplyAuth('editor', 'user', {
        username: un,
        fullName: fullName,
        userId: userId,
        registered: true,
        editSections: editSections,
        viewSections: viewSections,
        user: ens.user
      });
      return { ok: true, editSections: editSections, viewSections: viewSections, userId: userId, fullName: fullName, user: ens.user };
    } catch (eEns) {
      return { ok: false, error: (eEns && eEns.message) || 'Օգտատերը գրանցված չէ' };
    }
  }

  function kmClearUserSession() {
    try { localStorage.removeItem(KM_USER_SESSION_KEY); } catch (e) {}
  }

  function kmRememberUserOrg(src) {
    src = src || {};
    var corpsId = String(src.corpsId || '').trim();
    var unitId = String(src.unitId || '').trim();
    if (!corpsId || !unitId) return;
    window.kmAuthUserOrg = {
      corpsId: corpsId,
      unitId: unitId,
      corpsName: String(src.corpsName || '').trim(),
      unitName: String(src.unitName || '').trim(),
      unitKod: String(src.unitKod || '').trim(),
      militaryBookNo: String(src.militaryBookNo || '').trim(),
      passportNo: String(src.passportNo || '').trim()
    };
    try { sessionStorage.setItem('km_auth_org', JSON.stringify(window.kmAuthUserOrg)); } catch (e) {}
  }

  function kmApplyAuth(role, mode, extra) {
    extra = extra || {};
    window.kmUserRole = role || 'viewer';
    window.kmRoleUnlocked = true;
    window.kmAuthUsername = extra.username || '';
    window.kmAuthFullName = extra.fullName || '';
    window.kmAuthUserId = extra.userId || '';
    window.kmRegisteredAppUser = !!(extra.userId || extra.registered);
    window.kmSuperAdmin = !!extra.isSuper || (role === 'admin' && String(extra.username || '') === 'Koryun1992');
    window.kmAdminSections = Array.isArray(extra.sections) ? extra.sections.slice() : null;
    window.kmAdminEditSections = Array.isArray(extra.editSections) ? extra.editSections.slice() : (Array.isArray(extra.sections) ? extra.sections.slice() : []);
    window.kmAdminViewSections = Array.isArray(extra.viewSections) ? extra.viewSections.slice() : [];
    window.kmAdminPermissionsConfigured = role === 'admin' && String(extra.pageAccessMode || '') !== 'legacy' && (Array.isArray(extra.editSections) || Array.isArray(extra.viewSections) || !!extra.pageAccessMode);
    window.kmAdminGarrison = extra.garrison || '';
    if (role === 'editor') {
      if (extra.legacy) {
        window.kmEditSections = null;
        window.kmViewSections = null;
      } else {
        window.kmEditSections = Array.isArray(extra.editSections) ? extra.editSections.slice() : [];
        window.kmViewSections = Array.isArray(extra.viewSections) ? extra.viewSections.slice() : [];
        if (extra.userId || extra.registered) window.kmRegisteredAppUser = true;
      }
    } else if (role === 'admin') {
      window.kmEditSections = window.kmAdminEditSections.slice();
      window.kmViewSections = window.kmAdminViewSections.slice();
      window.kmRegisteredAppUser = false;
    }
    sessionStorage.setItem('km_auth_ok', '1');
    sessionStorage.setItem('km_auth_role', window.kmUserRole);
    sessionStorage.setItem('km_auth_mode', mode || window.kmUserRole);
    try {
      sessionStorage.setItem('km_auth_username', window.kmAuthUsername || '');
      sessionStorage.setItem('km_auth_full_name', window.kmAuthFullName || '');
      sessionStorage.setItem('km_auth_user_id', window.kmAuthUserId || '');
      sessionStorage.setItem('km_auth_registered', window.kmRegisteredAppUser ? '1' : '0');
      sessionStorage.setItem('km_auth_super', window.kmSuperAdmin ? '1' : '0');
      sessionStorage.setItem('km_auth_admin_sections', JSON.stringify(window.kmAdminSections || []));
      sessionStorage.setItem('km_auth_edit_sections', window.kmEditSections == null ? '' : JSON.stringify(window.kmEditSections));
      sessionStorage.setItem('km_auth_view_sections', window.kmViewSections == null ? '' : JSON.stringify(window.kmViewSections));
    } catch (e) {}
    if (mode === 'user') kmSaveUserSession(window.kmUserRole, 'user', extra);
    else kmClearUserSession();
    if (mode === 'user' && extra.username) {
      try { localStorage.setItem('km_pc_username', String(extra.username).trim().replace(/\s+/g, ' ')); } catch (ePc) {}
    }
    if (mode === 'user') {
      try {
        localStorage.removeItem('km_admin_token');
        localStorage.removeItem('km_admin_expires');
      } catch (e) {}
      try {
        var orgSrc = extra.user || extra;
        if (orgSrc && orgSrc.corpsId && orgSrc.unitId) kmRememberUserOrg(orgSrc);
      } catch (eOrg) {}
    }
    if (typeof window.kmShowMissedNotes === 'function') {
      try { window.kmShowMissedNotes(); } catch (e) {}
    }
    if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    try {
      const brandText = document.querySelector('.kmBrandText');
      if (brandText) {
        const label = String(window.kmAuthFullName || '').trim() || (mode === 'admin' ? 'Ադմինիստրատոր' : 'Օգտատեր');
        brandText.textContent = label;
        brandText.classList.add('kmBrandMenuLabel');
        brandText.title = label;
      }
    } catch (eB) {}
    if (role === 'editor') kmStartGrantPoll();
  }

  function kmStopGrantPoll() {
    if (window._kmGrantPoll) {
      try { clearInterval(window._kmGrantPoll); } catch (eP) {}
      window._kmGrantPoll = 0;
    }
  }

  function kmStartGrantPoll() {
    kmStopGrantPoll();
    if (typeof window.kmUserGrantsLocked !== 'function' || !window.kmUserGrantsLocked()) return;
    window._kmGrantPoll = setInterval(function () {
      window.kmRefreshUserGrants().catch(function () {});
    }, 24000);
    setTimeout(function () { window.kmRefreshUserGrants().catch(function () {}); }, 1500);
  }

  window.kmRefreshUserGrants = async function () {
    if (window.kmUserRole !== 'editor') return false;
    var un = String(window.kmAuthUsername || '').trim();
    if (!un) return false;
    if (!window.kmNative || !window.kmNative.users || !window.kmNative.users.ensure) return false;
    try {
      var ens = await window.kmNative.users.ensure({ username: un });
      if (!ens || !ens.ok || !ens.user) return false;
      var edit = Array.isArray(ens.user.editSections) ? ens.user.editSections.slice() : [];
      var view = Array.isArray(ens.user.viewSections) ? ens.user.viewSections.slice() : [];
      var beforeE = JSON.stringify(window.kmEditSections || []);
      var beforeV = JSON.stringify(window.kmViewSections || []);
      window.kmEditSections = edit;
      window.kmViewSections = view;
      try {
        sessionStorage.setItem('km_auth_edit_sections', JSON.stringify(edit));
        sessionStorage.setItem('km_auth_view_sections', JSON.stringify(view));
      } catch (eS) {}
      kmSaveUserSession('editor', 'user', {
        username: un,
        fullName: window.kmAuthFullName || un,
        userId: window.kmAuthUserId || ens.user.id || '',
        registered: true,
        editSections: edit,
        viewSections: view
      });
      var unlocked = edit.length + view.length > 0 || (edit.indexOf('*') >= 0);
      if (unlocked) kmStopGrantPoll();
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
      if (unlocked && beforeE === '[]' && beforeV === '[]') {
        if (typeof window.kmNotify === 'function') window.kmNotify('Ադմինը հաստատեց ձեր հասանելիությունը', 'ok');
        setTimeout(function () {
          if (typeof window.kmOpenPage === 'function') {
            try { window.kmOpenPage('home'); } catch (eO) {}
          }
        }, 80);
      }
      return unlocked;
    } catch (eR) {
      return false;
    }
  };

  function kmClearAuthState() {
    sessionStorage.removeItem('km_auth_ok');
    sessionStorage.removeItem('km_auth_role');
    sessionStorage.removeItem('km_auth_mode');
    sessionStorage.removeItem('km_license_bypass');
    localStorage.removeItem(KM_ADMIN_TOKEN_KEY);
    localStorage.removeItem('km_admin_expires');
    kmClearUserSession();
    kmStopGrantPoll();
    window.kmLicenseBypass = false;
    window.kmRoleUnlocked = false;
    window.kmUserRole = 'viewer';
    window.kmEditSections = [];
    window.kmViewSections = [];
    window.kmAuthUsername = '';
    window.kmAuthFullName = '';
    try {
      sessionStorage.removeItem('km_auth_full_name');
    } catch (eFn) {}
    try {
      const brandText = document.querySelector('.kmBrandText');
      if (brandText) {
        brandText.textContent = 'KM';
        brandText.classList.remove('kmBrandMenuLabel');
        brandText.removeAttribute('title');
      }
    } catch (e) {}
  }

  function kmEyeSvg(open) {
    if (open) {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>';
    }
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  }

  function kmBindCodeReveal(input, btn, labels) {
    if (!input || !btn) return;
    var showL = (labels && labels.show) || 'Ցույց տալ';
    var hideL = (labels && labels.hide) || 'Թաքցնել';
    btn.innerHTML = kmEyeSvg(false);
    btn.title = showL;
    btn.setAttribute('aria-label', showL);
    btn.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = kmEyeSvg(show);
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.title = show ? hideL : showL;
      btn.setAttribute('aria-label', btn.title);
      try { input.focus(); } catch (err) {}
    };
  }

  async function kmTryRestoreAdminSession() {
    if (!window.kmNative || !window.kmNative.security || !window.kmNative.security.verifySession) return false;
    const token = localStorage.getItem(KM_ADMIN_TOKEN_KEY);
    if (!token) return false;
    try {
      const r = await window.kmNative.security.verifySession(token);
      if (r && r.ok && r.isAdmin) {
        kmApplyAuth('admin', 'admin', {
          username: r.username || '',
          isSuper: !!r.isSuper || String(r.username || '') === 'Koryun1992',
          sections: r.sections || [],
          editSections: r.editSections || r.sections || [],
          viewSections: r.viewSections || [],
          pageAccessMode: r.pageAccessMode || '',
          garrison: r.garrison || ''
        });
        if (r.mustChangePassword && typeof window.kmPromptFirstPasswordChange === 'function') {
          window.kmPromptFirstPasswordChange();
        } else {
          try {
            const sec = window.kmNative.security.get && await window.kmNative.security.get();
            if (sec && sec.mustChangePassword && typeof window.kmPromptFirstPasswordChange === 'function') {
              window.kmPromptFirstPasswordChange();
            }
          } catch (e2) {}
        }
        return true;
      }
    } catch (e) {}
    localStorage.removeItem(KM_ADMIN_TOKEN_KEY);
    localStorage.removeItem('km_admin_expires');
    return false;
  }

  async function kmTryRestoreUserSession() {
    function sessionUsername() {
      try {
        if (sessionStorage.getItem('km_auth_ok') === '1' && sessionStorage.getItem('km_auth_mode') !== 'admin') {
          return String(sessionStorage.getItem('km_auth_username') || '').trim();
        }
      } catch (eS) {}
      try {
        const saved = JSON.parse(localStorage.getItem(KM_USER_SESSION_KEY) || 'null');
        if (saved && saved.mode === 'user' && saved.username) return String(saved.username).trim();
      } catch (eL) {}
      return '';
    }
    const un = sessionUsername();
    if (!un) return false;
    if (!window.kmNative || !window.kmNative.users || !window.kmNative.users.ensure) {
      kmClearUserSession();
      return false;
    }
    try {
      const ens = await window.kmNative.users.ensure({ username: un });
      if (!ens || !ens.ok || ens.notRegistered || !ens.user) {
        kmClearUserSession();
        return false;
      }
      kmApplyAuth('editor', 'user', {
        username: un,
        fullName: ens.user.fullName || un,
        userId: ens.user.id || '',
        registered: true,
        editSections: Array.isArray(ens.user.editSections) ? ens.user.editSections : [],
        viewSections: Array.isArray(ens.user.viewSections) ? ens.user.viewSections : [],
        user: ens.user
      });
      return true;
    } catch (e) {
      kmClearUserSession();
      return false;
    }
  }

  async function kmTryKodAutoUserLogin() {
    if (!window.kmNative || !window.kmNative.kod || !window.kmNative.kod.consumeAutoLogin) return false;
    try {
      const r = await window.kmNative.kod.consumeAutoLogin();
      if (!r || !r.ok) return false;
      if (window.kmNative.license) {
        window.kmLicenseStatus = await window.kmNative.license.status();
      }
      /* kod-ը միայն արտոնագիր է տալիս — օգտատերը պետք է գրանցվի մուտքանունով/գաղտնաբառով */
      return false;
    } catch (e) {}
    return false;
  }

  function kmUnblockLicenseGate() {
    document.body.classList.remove('km-license-blocked');
    document.getElementById('kmLicenseGate')?.remove();
  }

  async function kmShowDualLogin(opts) {
    opts = opts || {};
    if (!window.kmNative || !window.kmNative.security) return;

    let adminHintUser = 'Koryun1992';
    try {
      if (typeof window.kmNative.security.loginHint === 'function') {
        const hint = await window.kmNative.security.loginHint();
        if (hint && hint.ok) {
          adminHintUser = String(hint.username || adminHintUser);
        }
      }
    } catch (eHint) {}

    const sec = await window.kmNative.security.get();
    let loginMode = 'admin';
    let licenseOk = true;

    if (window.kmNative.license) {
      const lst = await window.kmNative.license.status();
      window.kmLicenseStatus = lst;
      licenseOk = !!(lst.valid || lst.universalUser || lst.userAccess);
    }

    const existing = document.getElementById('kmLoginOverlay');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'kmLoginOverlay';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:300000;background:transparent;display:flex;align-items:center;justify-content:center;padding:20px;-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0)';
    wrap.innerHTML = `<style id="kmLoginPrettyCss">
      #kmLoginOverlay .kmLoginCard{background:linear-gradient(180deg,#fffdf6 0%,#fff 48px);border-radius:16px;padding:22px 22px 18px;min-width:340px;max-width:560px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 12px 40px rgba(11,26,51,.38);border:1px solid #d4b45a;color:#0b1a33;-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0);opacity:1}
      #kmLoginOverlay .kmLoginCard h3{font-size:20px;letter-spacing:.02em;color:#0b1a33!important;font-weight:800;-webkit-text-fill-color:#0b1a33}
      #kmLoginOverlay .kmLoginCard,#kmLoginOverlay .kmLoginCard label,#kmLoginOverlay .kmLoginCard p,#kmLoginOverlay .kmLoginCard span,#kmLoginOverlay .kmLoginCard .muted,#kmLoginOverlay #kmLoginSubtitle{color:#0b1a33!important;-webkit-text-fill-color:#0b1a33;opacity:1!important}
      #kmLoginOverlay .kmLoginCard .muted,#kmLoginOverlay #kmLoginSubtitle{color:#15222d!important;-webkit-text-fill-color:#15222d;opacity:1!important;font-weight:700}
      #kmLoginOverlay .kmLoginCard button:not(.primary){background:#fff!important;color:#0b1a33!important;-webkit-text-fill-color:#0b1a33!important;border-color:#c5d0dc!important;font-weight:700}
      #kmLoginOverlay .kmLoginCard button.primary{color:#fff!important;-webkit-text-fill-color:#fff!important}
      #kmLoginOverlay .kmLoginCard input,#kmLoginOverlay .kmLoginCard select{background:#fff!important;color:#0b1a33!important;-webkit-text-fill-color:#0b1a33!important;caret-color:#0b1a33;opacity:1!important;-webkit-transform:translateZ(0);transform:translateZ(0)}
      #kmLoginOverlay .kmLoginCard input:-webkit-autofill{-webkit-text-fill-color:#0b1a33!important;box-shadow:0 0 0 1000px #fff inset!important}
      #kmLoginOverlay .kmRegGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #kmLoginOverlay .kmRegField{display:block;margin-bottom:10px}
      #kmLoginOverlay .kmRegField span{display:block;font-size:12px;font-weight:800;color:#0b1a33!important;margin-bottom:5px}
      #kmLoginOverlay .kmRegField input,#kmLoginOverlay .kmRegField select{width:100%;padding:9px 10px;box-sizing:border-box;border:1px solid #c5d0dc;border-radius:8px;background:#fff;font-size:14px}
      #kmLoginOverlay .kmRegField input:focus,#kmLoginOverlay .kmRegField select:focus{outline:2px solid #c9a227;border-color:#c9a227}
      #kmLoginOverlay .kmRegHero{margin-bottom:12px;padding:12px 14px;border:1px solid #e4d3a0;border-radius:12px;background:linear-gradient(180deg,#fff8e6,#f7f9fc)}
      @media (max-width:520px){#kmLoginOverlay .kmRegGrid{grid-template-columns:1fr}}
    </style>
    <div class="kmLoginCard">
      <div style="text-align:center;margin:0 0 14px">
        <img src="assets/km_logo_square.jpg?v=006.5.222" alt="KM" style="width:92px;height:92px;object-fit:cover;border-radius:50%;background:#0b1a33;box-shadow:0 6px 16px rgba(0,0,0,.28)">
      </div>
      <h3 style="margin:0 0 4px">${opts.title || 'KM մուտք համակարգ'}</h3>
      <p id="kmLoginSubtitle" class="muted" style="margin:0 0 14px;font-size:12px">${opts.subtitle || 'Ընտրեք Administrator կամ Օգտատեր'}</p>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button type="button" id="kmLoginTabAdmin" class="primary" style="flex:1;padding:10px">Administrator</button>
        <button type="button" id="kmLoginTabUser" style="flex:1;padding:10px">Օգտատեր</button>
      </div>
      <div id="kmLoginAdminPane">
        <label style="display:block;margin-bottom:10px"><span>Օգտանուն</span>
          <div style="position:relative;margin-top:6px">
            <input id="kmLoginUser" type="text" style="width:100%;padding:8px 40px 8px 8px;box-sizing:border-box" autocomplete="off" spellcheck="false">
            <button type="button" id="kmLoginUserClear" title="Ջնջել մուտքանունը" aria-label="Ջնջել մուտքանունը" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;background:transparent;cursor:pointer;color:#5a6a7a;font-size:22px;line-height:1">×</button>
          </div>
        </label>
        <label style="display:block;margin-bottom:12px"><span>Գաղտնաբառ</span>
          <div class="kmCodeReveal" style="position:relative;margin-top:6px">
            <input id="kmLoginPw" type="password" autocomplete="new-password" style="width:100%;padding:10px 44px 10px 10px;box-sizing:border-box">
            <button type="button" id="kmLoginPwEye" class="kmCodeRevealBtn" title="Ցույց տալ գաղտնաբառը" aria-label="Ցույց տալ գաղտնաբառը" aria-pressed="false" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:transparent;border-radius:8px;cursor:pointer;color:#4a5a6a;padding:0;display:flex;align-items:center;justify-content:center"></button>
          </div>
        </label>
        <p class="muted" style="font-size:12px;margin:0 0 10px">Admin մուտքը պահպանվում է 1 տարի — երկրորդ անգամ գաղտնաբառ չի պահանջվի։</p>
      </div>
      <div id="kmLoginUserPane" style="display:none">
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button type="button" id="kmUserSubReg" class="primary" style="flex:1;padding:8px">Գրանցվել</button>
          <button type="button" id="kmUserSubLogin" style="flex:1;padding:8px">Մուտք</button>
        </div>
        <div id="kmUserRegPane">
          <div class="kmRegHero">
            <div style="font-weight:800;margin-bottom:10px;color:#0b1a33">Անձնական տվյալներ</div>
            <div class="kmRegGrid">
              <label class="kmRegField"><span>Անուն</span>
                <input id="kmRegGivenName" type="text" lang="hy" autocomplete="off" spellcheck="false" placeholder="միայն հայատառ">
              </label>
              <label class="kmRegField"><span>Ազգանուն</span>
                <input id="kmRegFamilyName" type="text" lang="hy" autocomplete="off" spellcheck="false" placeholder="միայն հայատառ">
              </label>
            </div>
            <label class="kmRegField" style="margin-bottom:0"><span>Հայրանուն</span>
              <input id="kmRegPatronymic" type="text" lang="hy" autocomplete="off" spellcheck="false" placeholder="միայն հայատառ">
            </label>
          </div>
          <div class="kmRegGrid">
            <label class="kmRegField"><span>Զինգրքույկի համար</span>
              <input id="kmRegMilitaryBook" type="text" autocomplete="off" spellcheck="false" placeholder="օր. 1234567">
            </label>
            <label class="kmRegField"><span>Անձնագրի համար</span>
              <input id="kmRegPassport" type="text" autocomplete="off" spellcheck="false" placeholder="օր. AM1234567">
            </label>
          </div>
          <label class="kmRegField"><span>Բանակային կորպուս</span>
            <select id="kmRegCorps"><option value="">Բեռնվում է…</option></select>
          </label>
          <label class="kmRegField"><span>Զորամաս</span>
            <select id="kmRegUnit" disabled><option value="">Նախ ընտրեք կորպուսը</option></select>
          </label>
          <label class="kmRegField"><span>Մուտքանուն</span>
            <div style="position:relative">
              <input id="kmRegUserName" type="text" style="padding-right:40px" autocomplete="off" spellcheck="false" placeholder="լատինատառ և թվեր">
              <button type="button" id="kmRegUserNameClear" title="Ջնջել մուտքանունը" aria-label="Ջնջել մուտքանունը" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;background:transparent;cursor:pointer;color:#5a6a7a;font-size:22px;line-height:1">×</button>
            </div>
          </label>
          <p class="muted" style="font-size:12px;margin:0 0 10px">Մուտքանունը՝ միայն լատինատառ A–Z և թվեր։ Առավելագույնը 10 տառ և 6 թիվ։</p>
          <label class="kmRegField"><span>Գաղտնաբառ (ստեղծել)</span>
            <div class="kmCodeReveal" style="position:relative">
              <input id="kmRegPassword" type="password" autocomplete="new-password" placeholder="օր. Ab123456" style="padding-right:44px">
              <button type="button" id="kmRegPasswordEye" class="kmCodeRevealBtn" title="Ցույց տալ գաղտնաբառը" aria-label="Ցույց տալ գաղտնաբառը" aria-pressed="false" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:transparent;border-radius:8px;cursor:pointer;color:#4a5a6a;padding:0;display:flex;align-items:center;justify-content:center"></button>
            </div>
          </label>
          <p class="muted" style="font-size:12px;margin:0 0 10px">Պարտադիր՝ 2 լատինատառ և 6-ից 12 թիվ։ Օրինակ՝ <b>Ab123456</b>։</p>
          <label class="kmRegField"><span>Կրկնել գաղտնաբառը</span>
            <div class="kmCodeReveal" style="position:relative">
              <input id="kmRegPassword2" type="password" autocomplete="new-password" style="padding-right:44px">
              <button type="button" id="kmRegPassword2Eye" class="kmCodeRevealBtn" title="Ցույց տալ գաղտնաբառը" aria-label="Ցույց տալ գաղտնաբառը" aria-pressed="false" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:transparent;border-radius:8px;cursor:pointer;color:#4a5a6a;padding:0;display:flex;align-items:center;justify-content:center"></button>
            </div>
          </label>
          <p id="kmRegHint" class="muted" style="font-size:12px;margin:0 0 8px">Մեկանգամյա կոդը և զորամասի txt կոդը Hub-ը կհատկացնի ավտոմատ՝ «Գրանցել» սեղմելիս։</p>
        </div>
        <div id="kmUserLoginPane" style="display:none">
          <label style="display:block;margin-bottom:10px"><span>Մուտքանուն</span>
            <div style="position:relative;margin-top:6px">
              <input id="kmLoginUserName" type="text" style="width:100%;padding:8px 40px 8px 8px;box-sizing:border-box" autocomplete="username" spellcheck="false" placeholder="լատինատառ մուտքանուն">
              <button type="button" id="kmLoginUserNameClear" title="Ջնջել մուտքանունը" aria-label="Ջնջել մուտքանունը" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;background:transparent;cursor:pointer;color:#5a6a7a;font-size:22px;line-height:1">×</button>
            </div>
          </label>
          <label style="display:block;margin-bottom:10px"><span>Գաղտնաբառ</span>
            <div class="kmCodeReveal" style="position:relative;margin-top:6px">
              <input id="kmLoginUserPassword" type="password" autocomplete="current-password" style="width:100%;padding:10px 44px 10px 10px;box-sizing:border-box">
              <button type="button" id="kmLoginUserPasswordEye" class="kmCodeRevealBtn" title="Ցույց տալ գաղտնաբառը" aria-label="Ցույց տալ գաղտնաբառը" aria-pressed="false" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:transparent;border-radius:8px;cursor:pointer;color:#4a5a6a;padding:0;display:flex;align-items:center;justify-content:center"></button>
            </div>
          </label>
          <p class="muted" style="font-size:12px;margin:0">Մեկանգամյա կոդ այլևս պետք չէ։ ×-ով ջնջում եք այս համակարգչի պահված մուտքանունը։</p>
        </div>
      </div>
      <div id="kmLoginErr" style="color:#a43b3b;min-height:18px;margin-bottom:8px"></div>
      <button type="button" id="kmLoginBtn" class="primary" style="width:100%">Մուտք</button>
    </div>`;
    document.body.appendChild(wrap);
    if (typeof window.kmForceUiPaint === 'function') window.kmForceUiPaint(wrap);

    const KM_SAVED_USERS_KEY = 'km_saved_user_logins';
    const KM_PC_USERNAME_KEY = 'km_pc_username';
    const HY_LETTER = '\u0531-\u0556\u0561-\u0587';
    const HY_NAME_RE = new RegExp('^[' + HY_LETTER + ']+(?:\\s+[' + HY_LETTER + ']+){1,2}$');
    let usernameTouched = false;

    function sanitizeHyNameLive(s) {
      var t = String(s || '');
      try { t = t.normalize('NFC'); } catch (eN) {}
      t = t.replace(new RegExp('[^' + HY_LETTER + '\\s]', 'g'), '');
      t = t.replace(/^\s+/, '').replace(/[ \t\u00A0]+/g, ' ');
      var parts = t.split(' ').filter(function (p) { return p; });
      if (parts.length > 3) {
        t = parts.slice(0, 3).join(' ');
      }
      return t;
    }
    function sanitizeHyWordLive(s) {
      var t = String(s || '');
      try { t = t.normalize('NFC'); } catch (eN) {}
      return t.replace(new RegExp('[^' + HY_LETTER + ']', 'g'), '');
    }
    function sanitizeLatinUserLive(s) {
      var t = String(s || '');
      var letters = 0;
      var digits = 0;
      var out = '';
      for (var i = 0; i < t.length; i++) {
        var ch = t.charAt(i);
        if (/[A-Za-z]/.test(ch)) {
          if (letters >= 10) continue;
          letters += 1;
          out += ch;
        } else if (/\d/.test(ch)) {
          if (digits >= 6) continue;
          digits += 1;
          out += ch;
        }
      }
      return out;
    }
    function sanitizeLoginUsernameLive(s) {
      var t = String(s || '');
      try { t = t.normalize('NFC'); } catch (eN) {}
      if (new RegExp('[' + HY_LETTER + ']').test(t)) return sanitizeHyNameLive(t);
      return sanitizeLatinUserLive(t);
    }
    function bindLiveSanitize(el, sanitizer) {
      if (!el || typeof sanitizer !== 'function') return;
      el.removeAttribute('readonly');
      el.readOnly = false;
      el.addEventListener('input', function () {
        usernameTouched = true;
        var pos = el.selectionStart;
        var next = sanitizer(el.value);
        if (el.value !== next) {
          el.value = next;
          try {
            var p = Math.max(0, Math.min(Number(pos) || next.length, next.length));
            el.setSelectionRange(p, p);
          } catch (eC) {}
        }
        err.textContent = '';
      });
    }
    function bindHyNameInput(el) {
      if (!el) return;
      el.setAttribute('lang', 'hy');
      el.setAttribute('inputmode', 'text');
      bindLiveSanitize(el, sanitizeHyNameLive);
    }
    function bindHyWordInput(el) {
      if (!el) return;
      el.setAttribute('lang', 'hy');
      el.setAttribute('inputmode', 'text');
      bindLiveSanitize(el, sanitizeHyWordLive);
    }
    function bindLatinUserInput(el) {
      if (!el) return;
      el.setAttribute('lang', 'en');
      el.setAttribute('spellcheck', 'false');
      el.setAttribute('autocapitalize', 'off');
      bindLiveSanitize(el, sanitizeLatinUserLive);
    }
    function bindLoginUsernameInput(el) {
      if (!el) return;
      el.setAttribute('spellcheck', 'false');
      el.setAttribute('autocapitalize', 'off');
      bindLiveSanitize(el, sanitizeLoginUsernameLive);
    }

    const tabAdmin = wrap.querySelector('#kmLoginTabAdmin');
    const tabUser = wrap.querySelector('#kmLoginTabUser');
    const paneAdmin = wrap.querySelector('#kmLoginAdminPane');
    const paneUser = wrap.querySelector('#kmLoginUserPane');
    const user = wrap.querySelector('#kmLoginUser');
    const pw = wrap.querySelector('#kmLoginPw');
    if (user && adminHintUser) user.value = adminHintUser;
    const subReg = wrap.querySelector('#kmUserSubReg');
    const subLogin = wrap.querySelector('#kmUserSubLogin');
    const regPane = wrap.querySelector('#kmUserRegPane');
    const loginPane = wrap.querySelector('#kmUserLoginPane');
    const regUserName = wrap.querySelector('#kmRegUserName');
    const regGivenName = wrap.querySelector('#kmRegGivenName');
    const regFamilyName = wrap.querySelector('#kmRegFamilyName');
    const regPatronymic = wrap.querySelector('#kmRegPatronymic');
    const regPassword = wrap.querySelector('#kmRegPassword');
    const regPassword2 = wrap.querySelector('#kmRegPassword2');
    const regMilitaryBook = wrap.querySelector('#kmRegMilitaryBook');
    const regPassport = wrap.querySelector('#kmRegPassport');
    const regCorps = wrap.querySelector('#kmRegCorps');
    const regUnit = wrap.querySelector('#kmRegUnit');
    const loginUserName = wrap.querySelector('#kmLoginUserName');
    const loginUserPassword = wrap.querySelector('#kmLoginUserPassword');
    const pwEyeLabels = { show: 'Ցույց տալ գաղտնաբառը', hide: 'Թաքցնել գաղտնաբառը' };
    kmBindCodeReveal(pw, wrap.querySelector('#kmLoginPwEye'), pwEyeLabels);
    kmBindCodeReveal(regPassword, wrap.querySelector('#kmRegPasswordEye'), pwEyeLabels);
    kmBindCodeReveal(regPassword2, wrap.querySelector('#kmRegPassword2Eye'), pwEyeLabels);
    kmBindCodeReveal(loginUserPassword, wrap.querySelector('#kmLoginUserPasswordEye'), pwEyeLabels);
    const loginSubtitle = wrap.querySelector('#kmLoginSubtitle');
    const btn = wrap.querySelector('#kmLoginBtn');
    const err = wrap.querySelector('#kmLoginErr');
    /* Ադմինի մուտքանունը չի նախալրացվում — յուրաքանչյուր PC-ում մուտքագրում են նորից */
    let userSubMode = 'register';

    async function maybeWipeLoginUi() {
      /* Setup-ից հետո մուտքանունը չի ջնջվում այս PC-ում */
      try {
        if (window.kmNative && window.kmNative.login && window.kmNative.login.consumeUiWipe) {
          await window.kmNative.login.consumeUiWipe();
        }
      } catch (e) {}
    }
    await maybeWipeLoginUi();

    function loadSavedUsers() {
      try {
        const raw = JSON.parse(localStorage.getItem(KM_SAVED_USERS_KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw
          .map((x) => (typeof x === 'string' ? { username: x } : x))
          .filter((x) => x && String(x.username || '').trim())
          .map((x) => ({
            username: String(x.username).trim().replace(/\s+/g, ' '),
            codeHint: x.codeHint ? String(x.codeHint) : '',
            savedAt: x.savedAt || null
          }));
      } catch (e) {
        return [];
      }
    }

    function saveSavedUsers(list) {
      try {
        localStorage.setItem(KM_SAVED_USERS_KEY, JSON.stringify(list || []));
      } catch (e) {}
    }

    function upsertSavedUser(username, codeHint) {
      const un = String(username || '').trim().replace(/\s+/g, ' ');
      if (!un) return;
      try { localStorage.setItem(KM_PC_USERNAME_KEY, un); } catch (ePc) {}
      const list = loadSavedUsers().filter((x) => x.username !== un);
      list.unshift({
        username: un,
        codeHint: codeHint ? String(codeHint) : '',
        savedAt: new Date().toISOString()
      });
      saveSavedUsers(list.slice(0, 40));
    }

    let pcUsername = '';

    function fillUserSelect(prefer, force) {
      if (usernameTouched && !force) return;
      const un = String(prefer || pcUsername || (loginUserName && loginUserName.value) || '').trim().replace(/\s+/g, ' ');
      if (loginUserName && un) loginUserName.value = un;
      if (regUserName && isLoginUsername(un)) regUserName.value = un;
    }

    async function forgetStoredUsername() {
      usernameTouched = true;
      pcUsername = '';
      if (loginUserName) loginUserName.value = '';
      if (regUserName) regUserName.value = '';
      if (regGivenName) regGivenName.value = '';
      if (regFamilyName) regFamilyName.value = '';
      if (regPatronymic) regPatronymic.value = '';
      try { localStorage.removeItem(KM_PC_USERNAME_KEY); } catch (e) {}
      try { localStorage.removeItem(KM_SAVED_USERS_KEY); } catch (e2) {}
      try {
        if (window.kmNative && window.kmNative.users && window.kmNative.users.clearDeviceBound) {
          await window.kmNative.users.clearDeviceBound();
        }
      } catch (e3) {}
    }

    async function restorePcUsername() {
      try {
        if (window.kmNative.users && window.kmNative.users.deviceBound) {
          const bound = await window.kmNative.users.deviceBound();
          if (bound && bound.username) {
            pcUsername = String(bound.username).trim().replace(/\s+/g, ' ');
          }
        }
      } catch (eB) {}
      if (!pcUsername) {
        try {
          pcUsername = String(localStorage.getItem(KM_PC_USERNAME_KEY) || '').trim().replace(/\s+/g, ' ');
        } catch (eLs) {}
      }
      if (!pcUsername) {
        const saved = loadSavedUsers();
        if (saved.length) pcUsername = saved[0].username;
      }
      if (pcUsername) {
        try { localStorage.setItem(KM_PC_USERNAME_KEY, pcUsername); } catch (eS) {}
        fillUserSelect(pcUsername);
      }
    }

    function isHyUsername(name) {
      var un = String(name || '');
      try { un = un.normalize('NFC'); } catch (eN) {}
      un = un.trim().replace(/\s+/g, ' ');
      if (!un || un.length < 5) return false;
      return HY_NAME_RE.test(un);
    }
    function isHyNamePart(name) {
      var t = String(name || '');
      try { t = t.normalize('NFC'); } catch (eN) {}
      t = t.trim();
      if (!t || t.length < 2 || t.length > 40) return false;
      return new RegExp('^[' + HY_LETTER + ']+$').test(t);
    }
    function isLoginUsername(name) {
      var t = String(name || '').trim();
      if (!t || /[^A-Za-z0-9]/.test(t)) return false;
      var letters = (t.match(/[A-Za-z]/g) || []).length;
      var digits = (t.match(/\d/g) || []).length;
      if (letters < 1 || letters > 10) return false;
      if (digits > 6) return false;
      return true;
    }
    function isStoredUserName(name) {
      return isLoginUsername(name) || isHyUsername(name);
    }
    function kmUserLoginError(name) {
      if (isLoginUsername(name)) return '';
      if (isHyUsername(name)) return '';
      return 'Մուտքանունը՝ լատինատառ և թվեր (մինչև 10 տառ և 6 թիվ)';
    }

    async function diskUserRegistered(un) {
      var name = String(un || '').trim();
      if (!name || !window.kmNative || !window.kmNative.users || !window.kmNative.users.ensure) return false;
      try {
        var ens = await window.kmNative.users.ensure({ username: name });
        return !!(ens && ens.ok && ens.user && !ens.notRegistered);
      } catch (eD) {
        return false;
      }
    }

    async function refreshLicenseUi() {
      if (!window.kmNative || !window.kmNative.license) return;
      try {
        const lst = await window.kmNative.license.status();
        window.kmLicenseStatus = lst;
        licenseOk = !!(lst.valid || lst.universalUser || lst.userAccess);
      } catch (e) {}
    }
    await refreshLicenseUi();
    await restorePcUsername();

    function setUserSubMode(sub) {
      userSubMode = sub === 'login' ? 'login' : 'register';
      const isReg = userSubMode === 'register';
      if (regPane) regPane.style.display = isReg ? 'block' : 'none';
      if (loginPane) loginPane.style.display = isReg ? 'none' : 'block';
      if (subReg) subReg.classList.toggle('primary', isReg);
      if (subLogin) subLogin.classList.toggle('primary', !isReg);
      err.textContent = '';
      btn.style.display = 'block';
      btn.textContent = isReg ? 'Գրանցել' : 'Մուտք (Օգտատեր)';
      if (loginSubtitle && loginMode === 'user') {
        loginSubtitle.textContent = isReg
          ? 'Գրանցում՝ Ա․Ա․Հ․, փաստաթղթեր, կորպուս և զորամաս։ Կոդերը Hub-ը կհատկացնի ինքնուրույն'
          : 'Մուտք՝ մուտքանուն և գաղտնաբառ';
      }
      if (!isReg) {
        if (!usernameTouched) fillUserSelect();
        if (loginUserName) loginUserName.focus();
      } else if (regGivenName) {
        regGivenName.focus();
      } else if (regUserName) {
        regUserName.focus();
      }
    }

    function setMode(mode) {
      loginMode = mode === 'user' ? 'user' : 'admin';
      const isAdmin = loginMode === 'admin';
      paneAdmin.style.display = isAdmin ? 'block' : 'none';
      paneUser.style.display = isAdmin ? 'none' : 'block';
      tabAdmin.classList.toggle('primary', isAdmin);
      tabUser.classList.toggle('primary', !isAdmin);
      err.textContent = '';
      if (isAdmin) {
        btn.style.display = 'block';
        btn.textContent = 'Մուտք (Administrator)';
        if (loginSubtitle) loginSubtitle.textContent = 'Administrator մուտք՝ օգտանուն և գաղտնաբառ';
      } else {
        setUserSubMode(userSubMode || 'register');
      }
    }
    tabAdmin.onclick = () => setMode('admin');
    tabUser.onclick = async () => {
      setMode('user');
      await refreshLicenseUi();
      loadRegOrgSelects().catch(function () {});
    };
    if (subReg) subReg.onclick = () => setUserSubMode('register');
    if (subLogin) subLogin.onclick = () => setUserSubMode('login');

    if (regGivenName) bindHyWordInput(regGivenName);
    if (regFamilyName) bindHyWordInput(regFamilyName);
    if (regPatronymic) bindHyWordInput(regPatronymic);
    if (regUserName) bindLatinUserInput(regUserName);
    if (loginUserName) bindLoginUsernameInput(loginUserName);
    const adminUserClear = wrap.querySelector('#kmLoginUserClear');
    if (adminUserClear) {
      adminUserClear.onclick = function () {
        if (user) { user.value = ''; user.focus(); }
      };
    }
    const loginNameClear = wrap.querySelector('#kmLoginUserNameClear');
    if (loginNameClear) {
      loginNameClear.onclick = function () {
        forgetStoredUsername();
        if (loginUserName) loginUserName.focus();
      };
    }
    const regNameClear = wrap.querySelector('#kmRegUserNameClear');
    if (regNameClear) {
      regNameClear.onclick = function () {
        usernameTouched = true;
        if (regUserName) { regUserName.value = ''; regUserName.focus(); }
      };
    }

    function escAttr(s) {
      return String(s || '').replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    }
    function sanitizeDocNoLive(s) {
      return String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
    }
    if (regMilitaryBook) bindLiveSanitize(regMilitaryBook, sanitizeDocNoLive);
    if (regPassport) bindLiveSanitize(regPassport, sanitizeDocNoLive);

    async function loadRegOrgSelects() {
      if (!regCorps || !regUnit) return;
      var seed = { corps: [], units: [] };
      try {
        if (window.kmNative && window.kmNative.orgEntry && window.kmNative.orgEntry.seedGet) {
          var r = await window.kmNative.orgEntry.seedGet();
          if (r && r.ok) seed = r;
        }
      } catch (eS) {}
      var prevC = String(regCorps.value || '');
      var prevU = String(regUnit.value || '');
      var corpsHtml = '<option value="">Ընտրեք բանակային կորպուսը</option>';
      (seed.corps || []).filter(function (c) {
        return c && c.id && c.id !== '_super' && String(c.kind || '') !== 'central';
      }).sort(function (a, b) {
        return (Number(a.ord) || 0) - (Number(b.ord) || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'hy');
      }).forEach(function (c) {
        corpsHtml += '<option value="' + escAttr(c.id) + '"' + (c.id === prevC ? ' selected' : '') + '>' + escAttr(c.name) + '</option>';
      });
      if ((seed.corps || []).length === 0) {
        corpsHtml = '<option value="">Hub-ում կորպուս չկա</option>';
      }
      regCorps.innerHTML = corpsHtml;
      function fillUnits() {
        var cid = String(regCorps.value || '');
        var html = '<option value="">Ընտրեք զորամասը</option>';
        (seed.units || []).filter(function (u) {
          return u && u.id && String(u.corpsId || '') === cid;
        }).forEach(function (u) {
          html += '<option value="' + escAttr(u.id) + '"' + (u.id === prevU ? ' selected' : '') + '>' + escAttr(u.name) + '</option>';
        });
        regUnit.innerHTML = html;
        regUnit.disabled = !cid;
      }
      fillUnits();
      regCorps.onchange = function () {
        prevU = '';
        err.textContent = '';
        fillUnits();
      };
    }
    loadRegOrgSelects().catch(function () {});

    async function onKodLicenseActive(tryReg) {
      kmUnblockLicenseGate();
      if (loginMode !== 'user') setMode('user');
      var unCheck = String((regUserName && regUserName.value) || (loginUserName && loginUserName.value) || pcUsername || '').trim();
      var already = await diskUserRegistered(unCheck);
      if (already) {
        setUserSubMode('login');
        if (loginUserName && unCheck) loginUserName.value = unCheck;
        err.textContent = 'Արտոնագիրն ակտիվ է։ Մուտք գործեք մուտքանունով և գաղտնաբառով։';
        if (loginUserPassword) loginUserPassword.focus();
        return;
      }
      setUserSubMode('register');
      var hint = wrap.querySelector('#kmRegHint');
      if (hint) hint.textContent = 'Արտոնագիրն ակտիվ է։ Լրացրեք տվյալները և սեղմեք «Գրանցել» — կոդերը կհատկացվեն ավտոմատ։';
      var pwFill = String((regPassword && regPassword.value) || '');
      var pw2Fill = String((regPassword2 && regPassword2.value) || '');
      var pwErr = kmUserPasswordError(pwFill);
      if (!pwErr && pwFill && pwFill !== pw2Fill) pwErr = 'Գաղտնաբառերը չեն համընկնում';
      if (pwErr) {
        err.textContent = 'Արտոնագիրն ակտիվ է, բայց գրանցումը չկատարվեց։ ' + pwErr + ' Օրինակ՝ Ab123456';
        if (regPassword) regPassword.focus();
        if (typeof window.kmNotify === 'function') window.kmNotify('Գաղտնաբառը սխալ է — գրանցեք նորից', 'warn');
        return;
      }
      err.textContent = 'Արտոնագիրն ակտիվ է։ Սեղմեք «Գրանցել»՝ օգտատիրոջը ցուցակում պահելու համար։';
      if (typeof window.kmNotify === 'function') window.kmNotify('Արտոնագիրն ակտիվ է — սեղմեք Գրանցել', 'ok');
      var unFill = String((regUserName && regUserName.value) || '').trim();
      var givenFill = String((regGivenName && regGivenName.value) || '').trim();
      var familyFill = String((regFamilyName && regFamilyName.value) || '').trim();
      var patronymicFill = String((regPatronymic && regPatronymic.value) || '').trim();
      if (isLoginUsername(unFill) && isHyNamePart(givenFill) && isHyNamePart(familyFill) && isHyNamePart(patronymicFill) && !kmUserPasswordError(pwFill) && pwFill === pw2Fill && typeof tryReg === 'function') {
        await tryReg();
      }
    }

    await new Promise((resolve) => {
      const finish = () => { clearInterval(licPoll); wrap.remove(); resolve(); };

      const licPoll = setInterval(async () => {
        if (!document.getElementById('kmLoginOverlay')) { clearInterval(licPoll); return; }
        await refreshLicenseUi();
        if (window.kmNative.kod && window.kmNative.kod.consumeAutoLogin) {
          try {
            const auto = await window.kmNative.kod.consumeAutoLogin();
            if (auto && auto.ok) {
              await onKodLicenseActive(typeof tryUserLogin === 'function' ? tryUserLogin : null);
            }
          } catch (eA) {}
        }
      }, 3000);

      const tryAdminLogin = async () => {
        const r = window.kmNative.security.loginAdmin
          ? await window.kmNative.security.loginAdmin({ username: user.value, password: pw.value })
          : await window.kmNative.security.verify({ username: user.value, password: pw.value });
        if (!r.ok || !r.isAdmin) {
          err.textContent = r.message || (r.locked ? 'Մուտքը ժամանակավորապես արգելափակված է' : 'Սխալ մուտքանուն կամ գաղտնաբառ');
          return;
        }
        if (r.token) {
          localStorage.setItem(KM_ADMIN_TOKEN_KEY, r.token);
          if (r.expiresAt) localStorage.setItem('km_admin_expires', r.expiresAt);
        }
        kmUnblockLicenseGate();
        kmApplyAuth('admin', 'admin', {
          username: r.username || user.value,
          isSuper: !!r.isSuper || String(r.username || user.value) === 'Koryun1992',
          sections: r.sections || [],
          editSections: r.editSections || r.sections || [],
          viewSections: r.viewSections || [],
          pageAccessMode: r.pageAccessMode || '',
          garrison: r.garrison || ''
        });
        if (typeof window.kmNotify === 'function') window.kmNotify('Administrator մուտք', 'ok');
        finish();
        if (r.mustChangePassword && typeof window.kmPromptFirstPasswordChange === 'function') {
          window.kmPromptFirstPasswordChange();
        }
      };

      const finishUserLicenseLogin = async function (un, extra) {
        extra = extra || {};
        localStorage.removeItem(KM_ADMIN_TOKEN_KEY);
        localStorage.removeItem('km_admin_expires');
        kmUnblockLicenseGate();
        const fr = await kmFinishRegisteredUserLogin(un || '', extra);
        if (!fr || !fr.ok) {
          err.textContent = (fr && fr.error) || 'Մուտքը չհաջողվեց';
          return false;
        }
        const nEdit = (fr.editSections || []).length;
        const nView = (fr.viewSections || []).length;
        const n = nEdit + nView;
        const modeLabel = nEdit ? 'փոփոխություն' : (nView ? 'միայն դիտում' : '');
        if (typeof window.kmNotify === 'function') {
          window.kmNotify(
            n ? ('Օգտատեր մուտք · ' + n + ' բաժին' + (modeLabel ? (' · ' + modeLabel) : '')) : 'Օգտատեր մուտք · սպասում է ադմինի թույլտվությանը',
            n ? 'ok' : 'warn'
          );
        }
        finish();
        return true;
      };

      const tryUserLogin = async () => {
        let un = '';
        if (userSubMode === 'register') {
          const given = String((regGivenName && regGivenName.value) || '').trim();
          const family = String((regFamilyName && regFamilyName.value) || '').trim();
          const patronymic = String((regPatronymic && regPatronymic.value) || '').trim();
          un = String((regUserName && regUserName.value) || '').trim();
          const pw1 = String((regPassword && regPassword.value) || '');
          const pw2 = String((regPassword2 && regPassword2.value) || '');
          const militaryBook = String((regMilitaryBook && regMilitaryBook.value) || '').trim().toUpperCase();
          const passportNo = String((regPassport && regPassport.value) || '').trim().toUpperCase();
          const corpsId = String((regCorps && regCorps.value) || '').trim();
          const unitId = String((regUnit && regUnit.value) || '').trim();
          if (!isHyNamePart(given)) {
            err.textContent = 'Անունը պարտադիր է և միայն հայատառ';
            if (regGivenName) regGivenName.focus();
            return;
          }
          if (!isHyNamePart(family)) {
            err.textContent = 'Ազգանունը պարտադիր է և միայն հայատառ';
            if (regFamilyName) regFamilyName.focus();
            return;
          }
          if (!isHyNamePart(patronymic)) {
            err.textContent = 'Հայրանունը պարտադիր է և միայն հայատառ';
            if (regPatronymic) regPatronymic.focus();
            return;
          }
          if (!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(militaryBook)) {
            err.textContent = 'Զինգրքույկի համարը՝ 4–20 տառ և թիվ';
            if (regMilitaryBook) regMilitaryBook.focus();
            return;
          }
          if (!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(passportNo)) {
            err.textContent = 'Անձնագրի համարը՝ 4–20 տառ և թիվ';
            if (regPassport) regPassport.focus();
            return;
          }
          if (!corpsId) {
            err.textContent = 'Ընտրեք բանակային կորպուսը';
            if (regCorps) regCorps.focus();
            return;
          }
          if (!unitId) {
            err.textContent = 'Ընտրեք զորամասը';
            if (regUnit) regUnit.focus();
            return;
          }
          if (!isLoginUsername(un)) {
            err.textContent = 'Մուտքանունը՝ լատինատառ և թվեր (մինչև 10 տառ և 6 թիվ)';
            if (regUserName) regUserName.focus();
            return;
          }
          var pwErr = kmUserPasswordError(pw1);
          if (pwErr) {
            err.textContent = pwErr;
            if (regPassword) regPassword.focus();
            return;
          }
          if (pw1 !== pw2) {
            err.textContent = 'Գաղտնաբառերը չեն համընկնում';
            if (regPassword2) regPassword2.focus();
            return;
          }
          if (!window.kmNative.users || !window.kmNative.users.register) {
            err.textContent = 'Գրանցման API բացակայում է';
            return;
          }
          try {
            err.textContent = 'Գրանցում…';
            const reg = await window.kmNative.users.register({
              username: un,
              password: pw1,
              givenName: given,
              familyName: family,
              patronymic: patronymic,
              militaryBookNo: militaryBook,
              passportNo: passportNo,
              corpsId: corpsId,
              unitId: unitId
            });
            if (!reg || !reg.ok) {
              err.textContent = (reg && reg.error) || 'Գրանցումը չհաջողվեց';
              if (reg && reg.alreadyRegistered) setUserSubMode('login');
              return;
            }
            if (reg.user) kmRememberUserOrg(reg.user);
            var unitHint = String(reg.unitKod || (reg.user && reg.user.unitKod) || '').trim();
            var oneHint = String(reg.oneTimeCode || '').trim();
            err.style.color = '#1a5c38';
            err.innerHTML = 'Գրանցումը հաջողվեց։' +
              (unitHint ? ('<br>Ձեր զորամասի կոդը՝ <b>' + escAttr(unitHint) + '</b>') : '') +
              (oneHint ? ('<br>Մեկանգամյա կոդ՝ <b>' + escAttr(oneHint) + '</b>') : '');
            if (typeof window.kmNotify === 'function') {
              window.kmNotify(unitHint ? ('Զորամասի կոդ՝ ' + unitHint) : 'Գրանցումը հաջողվեց', 'ok');
            }
            const logged = await finishUserLicenseLogin(un, {
              userId: reg.userId || (reg.user && reg.user.id) || '',
              fullName: (reg.user && reg.user.fullName) || (given + ' ' + family + ' ' + patronymic),
              editSections: reg.editSections || [],
              viewSections: reg.viewSections || [],
              user: reg.user
            });
            if (!logged) {
              err.textContent = err.textContent || 'Գրանցումը չպահպանվեց։ Կրկին փորձեք կամ մուտք գործեք գաղտնաբառով։';
              return;
            }
            window.kmLicenseStatus = { valid: true, userAccess: true };
            upsertSavedUser(un, '');
          } catch (e) {
            err.textContent = e.message || 'Գրանցումը չհաջողվեց';
          }
          return;
        }
        un = String((loginUserName && loginUserName.value) || '').trim().replace(/\s+/g, ' ');
        const pw = String((loginUserPassword && loginUserPassword.value) || '');
        var loginErr = kmUserLoginError(un);
        if (loginErr) {
          err.textContent = loginErr;
          if (loginUserName) loginUserName.focus();
          return;
        }
        if (!pw) {
          err.textContent = 'Մուտքագրեք գաղտնաբառը';
          if (loginUserPassword) loginUserPassword.focus();
          return;
        }
        try {
          const r = await window.kmNative.users.loginUser({ username: un, password: pw });
          if (!r || !r.ok) {
            err.textContent = (r && r.error) || 'Մուտքը չհաջողվեց';
            if (r && (r.needRegister || r.notRegistered)) {
              if (regUserName && un) regUserName.value = un;
              setUserSubMode('register');
              err.textContent = (r && r.error) || 'Օգտատերը գրանցված չէ։ Լրացրեք Ա․Ա․Հ․, գաղտնաբառը (օր. Ab123456) և սեղմեք Գրանցել։';
            }
            return;
          }
          const loggedIn = await finishUserLicenseLogin(un, {
            userId: r.userId || '',
            fullName: r.fullName || '',
            editSections: r.editSections || [],
            viewSections: r.viewSections || [],
            user: r.user
          });
          if (!loggedIn) return;
          window.kmLicenseStatus = { valid: true, userAccess: true };
          upsertSavedUser(un, '');
        } catch (e) {
          err.textContent = e.message || 'Մուտքը չհաջողվեց';
        }
      };

      if (window.kmNative.onLicenseChanged) {
        window.kmNative.onLicenseChanged(async () => {
          await refreshLicenseUi();
          if (window.kmNative.kod && window.kmNative.kod.consumeAutoLogin) {
            try {
              const auto = await window.kmNative.kod.consumeAutoLogin();
              if (auto && auto.ok) {
                await onKodLicenseActive(tryUserLogin);
              }
            } catch (e) {}
          }
        });
      }

      const tryLogin = async () => {
        err.textContent = '';
        btn.disabled = true;
        try {
          if (loginMode === 'admin') await tryAdminLogin();
          else await tryUserLogin();
        } finally {
          btn.disabled = false;
        }
      };

      btn.onclick = tryLogin;
      pw.onkeydown = (e) => { if (e.key === 'Enter') tryLogin(); };
      user.onkeydown = (e) => { if (e.key === 'Enter') pw.focus(); };
      if (regGivenName) {
        regGivenName.onkeydown = (e) => { if (e.key === 'Enter' && regFamilyName) regFamilyName.focus(); };
      }
      if (regFamilyName) {
        regFamilyName.onkeydown = (e) => { if (e.key === 'Enter' && regPatronymic) regPatronymic.focus(); };
      }
      if (regPatronymic) {
        regPatronymic.onkeydown = (e) => { if (e.key === 'Enter' && regUserName) regUserName.focus(); };
      }
      if (regUserName) {
        regUserName.onkeydown = (e) => { if (e.key === 'Enter' && regPassword) regPassword.focus(); };
      }
      if (regPassword) {
        regPassword.onkeydown = (e) => { if (e.key === 'Enter' && regPassword2) regPassword2.focus(); };
      }
      if (regPassword2) {
        regPassword2.onkeydown = (e) => { if (e.key === 'Enter') tryLogin(); };
      }
      if (loginUserName) {
        loginUserName.onkeydown = (e) => { if (e.key === 'Enter' && loginUserPassword) loginUserPassword.focus(); };
      }
      if (loginUserPassword) {
        loginUserPassword.onkeydown = (e) => { if (e.key === 'Enter') tryLogin(); };
      }
      setMode(opts.defaultTab || (isStoredUserName(pcUsername) ? 'user' : 'admin'));
      if ((opts.defaultTab || (isStoredUserName(pcUsername) ? 'user' : 'admin')) === 'user') {
        setUserSubMode(opts.userSub || (isStoredUserName(pcUsername) ? 'login' : 'register'));
        if (isStoredUserName(pcUsername) && loginUserPassword) loginUserPassword.focus();
      } else user.focus();
    });

    if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    if (typeof window.kmStartBgSlideshow === 'function') {
      try { window.kmStartBgSlideshow(); } catch (eBg) {}
    }
    if (typeof window.kmLoadDeferredModules === 'function') {
      try { window.kmLoadDeferredModules(); } catch (eDef) {}
    }
    /* Մուտքից հետո՝ idle (մենյու փակ, Հիմնական չբացել) */
    try {
      document.body.classList.add('km-boot-idle');
      var side = document.querySelector('aside.side');
      if (side) side.classList.remove('km-side-open');
      var brand = document.getElementById('kmBrandHomeBtn');
      if (brand) brand.setAttribute('aria-expanded', 'false');
      if (typeof page !== 'undefined') page = '';
      window.page = '';
      var host = document.getElementById('content');
      if (host) host.innerHTML = '';
      var pt = document.getElementById('pageTitle');
      if (pt) pt.textContent = '';
      if (typeof window.kmEnsureOrgPicker === 'function') window.kmEnsureOrgPicker();
        try { if (typeof window.kmMountAdminHomeOrgPicker === 'function') { window.kmMountAdminHomeOrgPicker(); setTimeout(function(){ try{ window.kmMountAdminHomeOrgPicker(); }catch(e){} }, 400); } } catch (eHp) {}
    } catch (eIdle) {}
  }

  window.kmShowDualLogin = kmShowDualLogin;
  window.kmEnsureSecurity = async function kmEnsureSecurityDual(skipLicense) {
    let mustCode = false;
    if (window.kmNative && window.kmNative.license) {
      try {
        window.kmLicenseStatus = await window.kmNative.license.status();
        mustCode = !(window.kmLicenseStatus.valid || window.kmLicenseStatus.universalUser || window.kmLicenseStatus.userAccess);
      } catch (e) {}
    }
    if (!mustCode && typeof window.kmEnsureOwnerVault === 'function') {
      try {
        const vok = await window.kmEnsureOwnerVault();
        if (vok === false) return;
      } catch (eV) {}
    }

    if (await kmTryRestoreAdminSession()) {
      try {
        document.body.classList.add('km-boot-idle');
        if (typeof page !== 'undefined') page = '';
        window.page = '';
        var hAdm = document.getElementById('content');
        if (hAdm) hAdm.innerHTML = '';
      } catch (eAdmIdle) {}
      if (typeof window.kmEnsureOrgPicker === 'function') window.kmEnsureOrgPicker();
        try { if (typeof window.kmMountAdminHomeOrgPicker === 'function') { window.kmMountAdminHomeOrgPicker(); setTimeout(function(){ try{ window.kmMountAdminHomeOrgPicker(); }catch(e){} }, 400); } } catch (eHp) {}
      return;
    }
    if (await kmTryKodAutoUserLogin()) {
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
      if (typeof window.kmStartBgSlideshow === 'function') try { window.kmStartBgSlideshow(); } catch (e1) {}
      if (typeof window.kmLoadDeferredModules === 'function') try { window.kmLoadDeferredModules(); } catch (e2) {}
      try {
        document.body.classList.add('km-boot-idle');
        if (typeof page !== 'undefined') page = '';
        window.page = '';
        var h1 = document.getElementById('content');
        if (h1) h1.innerHTML = '';
      } catch (eIdle1) {}
      if (typeof window.kmEnsureOrgPicker === 'function') window.kmEnsureOrgPicker();
        try { if (typeof window.kmMountAdminHomeOrgPicker === 'function') { window.kmMountAdminHomeOrgPicker(); setTimeout(function(){ try{ window.kmMountAdminHomeOrgPicker(); }catch(e){} }, 400); } } catch (eHp) {}
      return;
    }
    if (!mustCode && await kmTryRestoreUserSession()) {
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
      if (typeof window.kmStartBgSlideshow === 'function') try { window.kmStartBgSlideshow(); } catch (e3) {}
      if (typeof window.kmLoadDeferredModules === 'function') try { window.kmLoadDeferredModules(); } catch (e4) {}
      try {
        document.body.classList.add('km-boot-idle');
        if (typeof page !== 'undefined') page = '';
        window.page = '';
        var h2 = document.getElementById('content');
        if (h2) h2.innerHTML = '';
      } catch (eIdle2) {}
      if (typeof window.kmEnsureOrgPicker === 'function') window.kmEnsureOrgPicker();
        try { if (typeof window.kmMountAdminHomeOrgPicker === 'function') { window.kmMountAdminHomeOrgPicker(); setTimeout(function(){ try{ window.kmMountAdminHomeOrgPicker(); }catch(e){} }, 400); } } catch (eHp) {}
      return;
    }

    await kmShowDualLogin();
  };

  window.kmExitSystem = async function kmExitSystem() {
    let admin = false;
    let registeredUser = false;
    try {
      admin = window.kmUserRole === 'admin' || sessionStorage.getItem('km_auth_mode') === 'admin';
      registeredUser = !admin && !!(window.kmRegisteredAppUser || window.kmAuthUserId || sessionStorage.getItem('km_auth_registered') === '1');
    } catch (e) {}
    if (!admin) {
      const ok = confirm(
        'Ելք համակարգից?\n\n' +
        '• Մուտքը կփակվի\n' +
        '• Հաջորդ անգամ՝ մուտքանուն և գաղտնաբառ (մեկանգամյա կոդ այլևս պետք չէ)'
      );
      if (!ok) return;
    }

    try {
      if (typeof save === 'function') await save(true);
    } catch (e) {}

    /* Գրանցված օգտատիրոջ ելքը չի զրոյացնում արտոնագիրը և կոդը — մուտքը գաղտնաբառով է */
    if (!admin && !registeredUser) {
      try {
        if (window.kmNative && window.kmNative.license && window.kmNative.license.resetOnLogout) {
          await window.kmNative.license.resetOnLogout();
        }
      } catch (e) {}
    }

    kmClearAuthState();
    if (typeof window.kmClearOrgContext === 'function') window.kmClearOrgContext();
    kmUnblockLicenseGate();

    try {
      if (window.kmNative && window.kmNative.security && window.kmNative.security.clearSession) {
        await window.kmNative.security.clearSession();
      }
    } catch (e) {}

    try {
      if (window.kmNative && window.kmNative.audit) {
        await window.kmNative.audit.append({
          action: 'logout',
          detail: admin ? 'Administrator ելք համակարգից' : (registeredUser ? 'Գրանցված օգտատեր ելք' : 'Ելք համակարգից — license session reset')
        });
      }
    } catch (e) {}

    document.getElementById('kmLoginOverlay')?.remove();
    await kmShowDualLogin({
      title: 'KM մուտք համակարգ',
      subtitle: admin
        ? 'Administrator ելք։ Ընտրեք Administrator կամ Օգտատեր'
        : 'Մուտք՝ պահպանված մուտքանուն և կոդ',
      defaultTab: admin ? 'admin' : 'user',
      userSub: admin ? 'register' : 'login'
    });
  };

  window.kmLogoutAuth = window.kmExitSystem;

  window.kmCloseSystem = async function kmCloseSystem() {
    const ok = confirm('Փակե՞լ համակարգը։\n\nԾրագիրը կփակվի։');
    if (!ok) return;
    try {
      if (typeof save === 'function') await save(true);
    } catch (e) {}
    try {
      if (window.kmNative && window.kmNative.audit) {
        await window.kmNative.audit.append({ action: 'quit', detail: 'Փակել համակարգը' });
      }
    } catch (e) {}
    try {
      if (window.kmNative && window.kmNative.app && typeof window.kmNative.app.quit === 'function') {
        await window.kmNative.app.quit();
        return;
      }
    } catch (e) {}
    try { window.close(); } catch (e) {}
  };
})();
