/* Login page for FileMaker Web Viewer (Login layout). Calls script LoginValidate. */
(function () {
  var ALERT_EMPTY_ACCOUNT = 'アカウントを入力してください。';
  var ALERT_EMPTY_PASSWORD = 'パスワードを入力してください。';
  var ALERT_WRONG_PASSWORD = 'パスワードが正しくありません。';
  var ALERT_NO_ACCOUNT = '該当するアカウントがありません。';
  var ALERT_NOT_ACTIVE = '在籍でないためログインできません。';
  var ALERT_PARSE = 'ログイン結果の取得に失敗しました。FileMaker のスクリプトを確認してください。';
  var MSG_NO_CALLBACK =
    'FileMaker から結果が返っていません。次を確認してください：① Web Viewer のオブジェクト名が「web」であること ② スクリプト「LoginValidate」が存在し、手動実行でもエラーにならないこと ③ Perform JavaScript の関数が「receiveLoginResult」であること。';
  var BTN_DEFAULT = 'ログイン';
  var BTN_BUSY = 'ログイン中…';

  function tryAlert(msg) {
    try {
      alert(msg);
    } catch (e) {
      /* Web Viewer によっては alert が無効 */
    }
  }

  function setFeedback(kind, text) {
    var el = document.getElementById('loginFeedback');
    if (!el) return;
    if (!text) {
      el.textContent = '';
      el.hidden = true;
      el.classList.remove('is-error', 'is-info');
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.classList.remove('is-error', 'is-info');
    if (kind === 'error') el.classList.add('is-error');
    else if (kind === 'info') el.classList.add('is-info');
  }

  function firstArgument(args) {
    var i;
    for (i = 0; i < args.length; i++) {
      var a = args[i];
      if (a !== undefined && a !== null && a !== '') return a;
    }
    return undefined;
  }

  function parsePayload(raw) {
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return raw;
    var s = typeof raw === 'string' ? raw : String(raw);
    s = s.replace(/^\uFEFF/, '').trim();
    if (!s) return null;
    try {
      var o = JSON.parse(s);
      if (typeof o === 'string') {
        try {
          o = JSON.parse(o);
        } catch (e2) {
          /* keep */
        }
      }
      return typeof o === 'object' && o !== null ? o : null;
    } catch (e) {
      return null;
    }
  }

  var busyTimerId = null;
  var watchdogId = null;

  function clearTimers() {
    if (busyTimerId != null) {
      clearTimeout(busyTimerId);
      busyTimerId = null;
    }
    if (watchdogId != null) {
      clearTimeout(watchdogId);
      watchdogId = null;
    }
  }

  window.receiveLoginResult = function () {
    clearTimers();

    var raw = firstArgument(arguments);
    var parsed = parsePayload(raw);
    setBusy(false);

    if (!parsed) {
      setFeedback('error', ALERT_PARSE);
      // tryAlert(ALERT_PARSE);
      return;
    }

    if (parsed.ok === true) {
      setFeedback('info', 'ログインに成功しました。画面を切り替えています…');
      return;
    }

    var err = parsed.error != null ? String(parsed.error) : '';
    if (err === 'wrong_password') {
      setFeedback('error', ALERT_WRONG_PASSWORD);
      // tryAlert(ALERT_WRONG_PASSWORD);
      return;
    }
    if (err === 'no_account') {
      setFeedback('error', ALERT_NO_ACCOUNT);
      // tryAlert(ALERT_NO_ACCOUNT);
      return;
    }
    if (err === 'not_active') {
      setFeedback('error', ALERT_NOT_ACTIVE);
      // tryAlert(ALERT_NOT_ACTIVE);
      return;
    }
    if (err === 'api_error' && parsed.message) {
      var m = String(parsed.message);
      setFeedback('error', m);
      tryAlert(m);
      return;
    }
    setFeedback('error', ALERT_PARSE);
    tryAlert(ALERT_PARSE);
  };

  function setBusy(busy) {
    var btn = document.getElementById('btnSubmit');
    var acc = document.getElementById('account');
    var pwd = document.getElementById('password');
    if (btn) {
      btn.disabled = !!busy;
      btn.textContent = busy ? BTN_BUSY : BTN_DEFAULT;
    }
    if (acc) acc.disabled = !!busy;
    if (pwd) pwd.disabled = !!busy;
  }

  function submitLogin(ev) {
    if (ev) ev.preventDefault();
    var accEl = document.getElementById('account');
    var pwdEl = document.getElementById('password');
    if (!accEl || !pwdEl) return;

    setFeedback('', '');
    var account = String(accEl.value || '').trim();
    var password = String(pwdEl.value || '');

    if (!account) {
      setFeedback('error', ALERT_EMPTY_ACCOUNT);
      // tryAlert(ALERT_EMPTY_ACCOUNT);
      accEl.focus();
      return;
    }
    if (!password) {
      setFeedback('error', ALERT_EMPTY_PASSWORD);
      pwdEl.focus();
      return;
    }

    var payload = JSON.stringify({ account: account, password: password });

    if (typeof FileMaker === 'undefined' || !FileMaker.PerformScript) {
      setFeedback('error', 'FileMaker の Web Viewer 内で開いてください。');
      tryAlert('FileMaker の Web Viewer 内で開いてください。');
      return;
    }

    setBusy(true);
    clearTimers();

    watchdogId = setTimeout(function () {
      watchdogId = null;
      var btn = document.getElementById('btnSubmit');
      if (btn && btn.disabled) {
        setFeedback('error', MSG_NO_CALLBACK);
      }
    }, 2500);

    busyTimerId = setTimeout(function () {
      busyTimerId = null;
      setBusy(false);
      var fb = document.getElementById('loginFeedback');
      if (fb && !fb.textContent) {
        setFeedback('error', MSG_NO_CALLBACK);
      }
    }, 12000);

    try {
      FileMaker.PerformScript('LoginValidate', payload);
    } catch (e) {
      clearTimers();
      setBusy(false);
      setFeedback('error', ALERT_PARSE);
      tryAlert(ALERT_PARSE);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('loginForm');
    if (form) form.addEventListener('submit', submitLogin);
  });
})();
