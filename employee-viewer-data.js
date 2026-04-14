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
})(window.EV);
