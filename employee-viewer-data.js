/* FileMaker script calls and JSON callbacks from the Web Viewer. */
(function (EV) {
  var state = EV.state;
  var DEFAULT_LIMIT = EV.DEFAULT_LIMIT;
  var FIELD_MAP = EV.FIELD_MAP;

  EV.runFileMakerScript = function (offset, limit) {
    EV.clearRowHighlight();
    state.offset = offset || 0;
    var param = JSON.stringify({
      offset: state.offset,
      limit: limit || DEFAULT_LIMIT,
      sortField: FIELD_MAP[state.sortKey] || '氏名',
      sortOrder: state.sortDir,
      locationFilter: state.locationFilter
    });
    if (typeof FileMaker !== 'undefined') {
      FileMaker.PerformScript('GetData', param);
    }
  };

  window.filterByLocation = function (value) {
    state.locationFilter = value;
    EV.runFileMakerScript(0, DEFAULT_LIMIT);
  };

  window.changePage = function (direction) {
    var newOffset = state.offset + (direction * DEFAULT_LIMIT);
    if (newOffset < 0) newOffset = 0;
    if (newOffset >= state.totalCount) return;
    EV.runFileMakerScript(newOffset, DEFAULT_LIMIT);
  };

  window.receiveLocations = function (resultJson) {
    var parsed;
    try {
      parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
    } catch (e) {
      return;
    }

    var select = document.getElementById('locationFilter');
    if (!select) return;

    var locations = parsed.locations || [];
    select.innerHTML = '<option value="">全事業所</option>';
    locations.forEach(function (loc) {
      if (!loc) return;
      var opt = document.createElement('option');
      opt.value = loc;
      opt.textContent = loc;
      select.appendChild(opt);
    });
  };

  window.receiveDataFromFileMaker = function (resultJson) {
    var parsed;
    try {
      parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
    } catch (e) {
      console.error('receiveDataFromFileMaker: JSON parse error', e);
      return;
    }

    var records = [];
    try {
      records = parsed.response.data;
      state.totalCount = parsed.response.dataInfo.foundCount || 0;

      var totalEl = document.getElementById('total');
      if (totalEl) totalEl.textContent = '(全 ' + state.totalCount + ' 件)';

      var pageEl = document.getElementById('pageInfo');
      if (pageEl) {
        var from = state.offset + 1;
        var to = Math.min(state.offset + DEFAULT_LIMIT, state.totalCount);
        pageEl.textContent = from + ' 〜 ' + to;
      }

      var btnPrev = document.getElementById('btnPrev');
      var btnNext = document.getElementById('btnNext');
      if (btnPrev) btnPrev.disabled = state.offset <= 0;
      if (btnNext) btnNext.disabled = (state.offset + DEFAULT_LIMIT) >= state.totalCount;

      document.querySelectorAll('th[data-key]').forEach(function (th) {
        var key = th.getAttribute('data-key');
        var label = th.getAttribute('data-label') || th.textContent.replace(/ [▲▼]$/, '');
        th.setAttribute('data-label', label);
        th.textContent = label + (key === state.sortKey ? (state.sortDir === 'ascend' ? ' ▲' : ' ▼') : '');
      });
    } catch (e) {
      console.error('receiveDataFromFileMaker: unexpected response structure', e);
      return;
    }

    state.rows = records.map(function (rec) {
      var f = rec.fieldData || {};
      var flag = String(f['在籍フラグ'] || '');
      return {
        recordId: rec.recordId,
        apiRecordId: String(rec.recordId || ''),
        modId: String(rec.modId || ''),
        fullName: f['氏名'] || '',
        location: f['事業所略称'] || '',
        status: flag === '1' ? '在籍' : '退職',
        statusFlag: flag === '1' ? '1' : '0',
        joinDate: EV.formatDate(f['入社　年月日'] || ''),
        leaveDate: EV.formatDate(f['退職　年月日'] || ''),
        joinDateRaw: f['入社　年月日'] || '',
        leaveDateRaw: f['退職　年月日'] || ''
      };
    });

    state.filtered = state.rows.slice();
    EV.render();
  };

  window.receiveDeleteResult = function (resultJson) {
    var parsed;
    try {
      parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
    } catch (e) {
      return;
    }
    if (parsed.messages && parsed.messages[0] && parsed.messages[0].code === '0') {
      var newOffset = state.offset;
      if (state.filtered.length === 1 && newOffset > 0) {
        newOffset = Math.max(0, newOffset - DEFAULT_LIMIT);
      }
      setTimeout(function () {
        EV.runFileMakerScript(newOffset, DEFAULT_LIMIT);
      }, 100);
      return;
    }
    var msg = (parsed.messages && parsed.messages[0] && parsed.messages[0].message) || '削除に失敗しました。';
    EV.clearRowHighlight();
    alert(msg);
  };

  window.receiveUpdateResult = function (resultJson) {
    var parsed;
    try {
      parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
    } catch (e) {
      return;
    }
    if (parsed.messages && parsed.messages[0] && parsed.messages[0].code === '0') {
      EV.runFileMakerScript(state.offset, DEFAULT_LIMIT);
      return;
    }
    var msg = (parsed.messages && parsed.messages[0] && parsed.messages[0].message) || '更新に失敗しました。';
    alert(msg);
  };

  var EXT_PRIV_LABELS = {
    fmapp: 'FileMaker Pro / Go からのアクセス',
    fmwebdirect: 'WebDirect によるアクセス',
    fmxml: 'XML Web 公開（カスタム Web 公開）',
    fmphp: 'PHP からのカスタム Web 公開',
    fmurlscript: 'fmp URL スキームによるスクリプト実行',
    fmextscriptaccess: '外部スクリプト（AppleScript / ActiveXなど）',
    fmxdbc: 'ODBC / JDBC（XDBC）',
    fmrest: 'FileMaker Data API（REST）',
    fmreauthenticate10: '\u518d\u8a8d\u8a3c\u306e\u9593\u9694\uff0810 \u5206\uff09\u306a\u3069\u3001fmreauthenticate \u7cfb\u306e\u62e1\u5f35\u30a2\u30af\u30bb\u30b9',
    fmscriptdatasourcessde: 'スクリプトによる外部 SQL データソースへのアクセス',
    fmsas: 'Server Admin Console からのスケジュール実行',
    fmclientdataprovider: 'カード、外部データソース連携（クライアント）',
    fmclientdataproviderwriteback: '\u5916\u90e8\u30c7\u30fc\u30bf\u3078\u306e\u66f8\u304d\u623b\u3057\uff08\u30af\u30e9\u30a4\u30a2\u30f3\u30c8\uff09'
  };

  function recordAccessDescription(code) {
    var n = parseInt(code, 10);
    var map = {
      0: '未判定、またはデータベースがクライアントで開かれていません',
      1: 'レコードへのアクセスなし',
      2: '表示のみ',
      3: '限定された修正（削除不可など）',
      4: 'レコードの編集が可能'
    };
    if (map[n] === undefined) return 'コード: ' + String(code);
    return map[n] + '（' + n + '）';
  }

  function layoutAccessDescription(code) {
    var n = parseInt(code, 10);
    var map = {
      0: '未判定、またはデータベースがクライアントで開かれていません',
      1: 'レイアウトへのアクセスなし',
      2: '表示のみ',
      3: 'レイアウトおよびレコードの変更が可能'
    };
    if (map[n] === undefined) return 'コード: ' + String(code);
    return map[n] + '（' + n + '）';
  }

  function splitExtendedPrivilegeKeywords(raw) {
    if (raw == null || raw === '') return [];
    return String(raw)
      .split(/\r\n|\r|\n/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function parseSecurityPayload(resultJson) {
    var raw = resultJson;
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
          /* keep string wrapper */
        }
      }
      return o;
    } catch (e) {
      throw e;
    }
  }

  function firstSecurityArgument(args) {
    var i;
    for (i = 0; i < args.length; i++) {
      var a = args[i];
      if (a !== undefined && a !== null && a !== '') return a;
    }
    return undefined;
  }

  function coerceBoolean(v) {
    if (v === true || v === 1) return true;
    if (typeof v === 'string') {
      var s = v.toLowerCase();
      if (s === 'true' || s === '1') return true;
    }
    return false;
  }

  window.receiveUiCapabilities = function () {
    var rawIn = firstSecurityArgument(arguments);
    var parsed;
    try {
      parsed = parseSecurityPayload(rawIn);
    } catch (e) {
      console.error('receiveUiCapabilities: JSON parse error', e);
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    state.canEditDelete = coerceBoolean(parsed.canEditDelete);
    if (typeof EV.render === 'function') EV.render();
  };

  window.receiveSecurityInfo = function () {
    var rawIn = firstSecurityArgument(arguments);
    var parsed;
    try {
      parsed = parseSecurityPayload(rawIn);
    } catch (e) {
      console.error('receiveSecurityInfo: JSON parse error', e);
      alert('\u6a29\u9650\u60c5\u5831\u306e\u89e3\u6790\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002FileMaker \u306e\u30b9\u30af\u30ea\u30d7\u30c8\u3068 Web Viewer \u306e\u30d1\u30e9\u30e1\u30fc\u30bf\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      alert('\u6a29\u9650\u60c5\u5831\u304c\u7a7a\u3067\u3059\u3002GetSecurityInfo \u3067 Perform JavaScript \u306e\u30d1\u30e9\u30e1\u30fc\u30bf\u306b GetAsText ( $json ) \u3092\u6e21\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u8a2d\u5b9a\u30c0\u30a4\u30a2\u30ed\u30b0\u3067\u30d1\u30e9\u30e1\u30fc\u30bf\u304c\u7a7a\u306b\u306a\u3063\u3066\u3044\u306a\u3044\u304b\u3082\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002');
      return;
    }

    var accEl = document.getElementById('secAccount');
    var privEl = document.getElementById('secPrivilegeSet');
    var layEl = document.getElementById('secLayoutAccess');
    var recEl = document.getElementById('secRecordAccess');
    var listEl = document.getElementById('secActionsList');
    var emptyEl = document.getElementById('secActionsEmpty');
    var overlay = document.getElementById('securityModal');
    if (!accEl || !privEl || !layEl || !recEl || !listEl || !emptyEl || !overlay) {
      console.warn('receiveSecurityInfo: missing modal DOM (reload HTML / clear Web Viewer cache)');
      alert('\u6a29\u9650\u30e2\u30fc\u30c0\u30eb\u7528\u306e HTML \u304c\u53e4\u3044\u307e\u3059\u3002employee-viewer.html \u3092\u518d\u914d\u7f6e\u3057\u3001Web Viewer \u3092\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u304f\u3060\u3055\u3044\u3002');
      return;
    }

    accEl.textContent = parsed.accountName != null && String(parsed.accountName) !== '' ? String(parsed.accountName) : '—';
    privEl.textContent = parsed.privilegeSetName != null && String(parsed.privilegeSetName) !== '' ? String(parsed.privilegeSetName) : '—';

    if (parsed.layoutAccess === undefined || parsed.layoutAccess === null || parsed.layoutAccess === '') {
      layEl.textContent = '—';
    } else {
      layEl.textContent = layoutAccessDescription(parsed.layoutAccess);
    }

    if (parsed.recordAccess === undefined || parsed.recordAccess === null || parsed.recordAccess === '') {
      recEl.textContent = '—';
    } else {
      recEl.textContent = recordAccessDescription(parsed.recordAccess);
    }

    var keys = splitExtendedPrivilegeKeywords(parsed.extendedPrivilegesRaw);
    listEl.innerHTML = '';
    if (!keys.length) {
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
      keys.forEach(function (kw) {
        var li = document.createElement('li');
        var lower = kw.toLowerCase();
        var label = EXT_PRIV_LABELS[kw] || EXT_PRIV_LABELS[lower];
        if (label) {
          li.appendChild(document.createTextNode(label + ' '));
          var codeEl = document.createElement('code');
          codeEl.textContent = kw;
          li.appendChild(codeEl);
        } else {
          li.appendChild(document.createTextNode('\u30ad\u30fc\u30ef\u30fc\u30c9: '));
          var c2 = document.createElement('code');
          c2.textContent = kw;
          li.appendChild(c2);
        }
        listEl.appendChild(li);
      });
    }

    var ev = window.EV;
    if (!ev || typeof ev.showModalOverlay !== 'function') {
      overlay.style.display = 'flex';
      return;
    }
    ev.showModalOverlay(overlay);
  };
})(window.EV);
