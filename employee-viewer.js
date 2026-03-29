(function () {

  var state = {
    rows:       [],
    filtered:   [],
    sortKey:    'fullName',
    sortDir:    'ascend',
    offset:     0,
    totalCount: 0,
    locationFilter: '',
    pendingDeleteId: null,
    editingRow: null
  };

  var DEFAULT_LIMIT = 100;


  // Maps JS row key → FileMaker field name for server-side sort
  var FIELD_MAP = {
    fullName:  '氏名',
    location:  '事業所略称',
    status:    '在籍フラグ', // 一覧ソート用（計算フィールド）。編集ペイロードからは除外している。
    joinDate:  '入社\u3000年月日',
    leaveDate: '退職\u3000年月日'
  };
  // ─── Call FileMaker script from JS ───────────────────────────────────────
  function runFileMakerScript(offset, limit) {
    state.offset = offset || 0;
    var param = JSON.stringify({
      // offset: offset || 0,
      offset:    state.offset,
      limit:  limit  || DEFAULT_LIMIT,
      sortField: FIELD_MAP[state.sortKey] || '氏名',
      sortOrder: state.sortDir,
      locationFilter: state.locationFilter
    });
    if (typeof FileMaker !== 'undefined') {
      FileMaker.PerformScript('GetData', param);
    }
  }
  // ─── Location dropdown filter ────────────────────────────────────────────
  window.filterByLocation = function (value) {
    state.locationFilter = value;
    runFileMakerScript(0, DEFAULT_LIMIT);
  };

  // ─── Receive locations for dropdown ─────────────────────────────────────
  window.receiveLocations = function (resultJson) {
    var parsed;
    try {
      parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
    } catch (e) { return; }

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
  // ─── Page navigation (called by buttons in HTML) ─────────────────────────
  window.changePage = function (direction) {
    var newOffset = state.offset + (direction * DEFAULT_LIMIT);
    if (newOffset < 0) newOffset = 0;
    if (newOffset >= state.totalCount) return;
    runFileMakerScript(newOffset, DEFAULT_LIMIT);
  };
  // ─── Delete: show confirmation modal ─────────────────────────────────────
    window.confirmDelete = function (recordId) {
      state.pendingDeleteId = recordId;
      document.getElementById('deleteModal').style.display = 'flex';
    };
  
    window.cancelDelete = function () {
      state.pendingDeleteId = null;
      document.getElementById('deleteModal').style.display = 'none';
    };
  
    window.executeDelete = function () {
      document.getElementById('deleteModal').style.display = 'none';
      if (!state.pendingDeleteId) return;
      var param = JSON.stringify({ recordId: state.pendingDeleteId });
      state.pendingDeleteId = null;
      if (typeof FileMaker !== 'undefined') {
        FileMaker.PerformScript('DeleteRecord', param);
      }
    };
  
  // ─── Receive delete result ────────────────────────────────────────────────
    // window.receiveDeleteResult = function (resultJson) {
    //   var parsed;
    //   try { parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson; }
    //   catch (e) { parsed = {}; }
  
    //   if (parsed.success === false) {
    //     alert('削除に失敗しました。\n' + (parsed.message || ''));
    //     return;
    //   }
    //   // Refresh current page; if last item on page, go one page back
    //   var newOffset = state.offset;
    //   if (state.filtered.length === 1 && newOffset > 0) {
    //     newOffset = Math.max(0, newOffset - DEFAULT_LIMIT);
    //   }
    //   // runFileMakerScript(newOffset, DEFAULT_LIMIT);
    //   // ← Delay lets DeleteRecord script fully exit before GetData is triggered
    //   setTimeout(function () {
    //     runFileMakerScript(newOffset, DEFAULT_LIMIT);
    //   }, 100);
    // };
  //   window.executeDelete = function () {
  //     document.getElementById('deleteModal').style.display = 'none';
  //     if (!state.pendingDeleteId) return;
  
  //     var param = JSON.stringify({
  //         recordId:       state.pendingDeleteId,
  //         offset:         state.filtered.length === 1 && state.offset > 0
  //                             ? Math.max(0, state.offset - DEFAULT_LIMIT)
  //                             : state.offset,
  //         limit:          DEFAULT_LIMIT,
  //         sortField:      FIELD_MAP[state.sortKey] || '氏名',
  //         sortOrder:      state.sortDir,
  //         locationFilter: state.locationFilter
  //     });
  //     state.pendingDeleteId = null;
  //     if (typeof FileMaker !== 'undefined') {
  //         FileMaker.PerformScript('DeleteRecord', param);
  //     }
  // };
  
  
  // ─── Receive data from FileMaker ─────────────────────────────────────────
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
      // if (records.length > 0) {
      //   alert(JSON.stringify(Object.keys(records[0].fieldData)));
      // }
      state.totalCount = parsed.response.dataInfo.foundCount || 0;
      // state.totalCount = parsed.response.dataInfo.totalRecordCount || 0;
      // Update total label
      var totalEl = document.getElementById('total');
      if (totalEl) totalEl.textContent = '(全 ' + state.totalCount + ' 件)';

      // Update page info
      var pageEl = document.getElementById('pageInfo');
      if (pageEl) {
          var from = state.offset + 1;
          var to   = Math.min(state.offset + DEFAULT_LIMIT, state.totalCount);
          pageEl.textContent = from + ' 〜 ' + to;
      }

      // Update button states
      var btnPrev = document.getElementById('btnPrev');
      var btnNext = document.getElementById('btnNext');
      if (btnPrev) btnPrev.disabled = state.offset <= 0;
      if (btnNext) btnNext.disabled = (state.offset + DEFAULT_LIMIT) >= state.totalCount;

      document.querySelectorAll('th[data-key]').forEach(function (th) {
        var key   = th.getAttribute('data-key');
        var label = th.getAttribute('data-label') || th.textContent.replace(/ [▲▼]$/, '');
        th.setAttribute('data-label', label);
        th.textContent = label + (key === state.sortKey ? (state.sortDir === 'ascend' ? ' ▲' : ' ▼') : '');
      });

    } catch (e) {
      console.error('receiveDataFromFileMaker: unexpected response structure', e);
      return;
    }

    // Map EmployeeM fields to row format
    state.rows = records.map(function (rec) {
      var f = rec.fieldData || {};
      // var flag = f['EmployeeM::在籍フラグ'];
      var flag = String(f['在籍フラグ'] || '');
      return {
        // fullName:  f['EmployeeM::氏名']         || '',
        // location:  f['EmployeeM::事業所略名']    || '',
        // status:    flag == 1 ? '在籍' : '退職',
        // joinDate:  f['EmployeeM::入社\u3000年月日']  || '',
        // leaveDate: f['EmployeeM::退職\u3000年月日']  || ''
        recordId:  rec.recordId,
        // recordId:  f['ID'],
        apiRecordId: String(rec.recordId || ''),
        modId: String(rec.modId || ''),
        fullName:  f['氏名']              || '',
        location:  f['事業所略称']         || '',
        status: flag === '1' ? '在籍' : '退職',
        statusFlag: flag === '1' ? '1' : '0', // 表示・将来の在籍編集用（現在は保存しない）
        // status:    flag == 1 ? '在籍' : '退職',
        // joinDate:  f['入社　年月日']   || '',
        // leaveDate: f['退職　年月日']   || ''
        joinDate:  formatDate(f['入社　年月日']  || ''),
        leaveDate: formatDate(f['退職　年月日']  || ''),
        joinDateRaw: f['入社　年月日']  || '',
        leaveDateRaw: f['退職　年月日']  || ''
      };
    });

    state.filtered = state.rows.slice();
    // applyFilter('');
    render();
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function applyFilter(query) {
    var q = (query || '').toLowerCase();
    state.filtered = state.rows.filter(function (r) {
      return !q ||
        r.fullName.toLowerCase().indexOf(q)  >= 0 ||
        r.location.toLowerCase().indexOf(q)  >= 0 ||
        r.status.toLowerCase().indexOf(q)    >= 0;
    });
    applySort();
  }

  function applySort() {
    var key = state.sortKey;
    var dir = state.sortDir;
    state.filtered.sort(function (a, b) {
      var av = (a[key] || '').toString();
      var bv = (b[key] || '').toString();
      return av.localeCompare(bv, 'ja') * dir;
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    // Input: MM/DD/YYYY → Output: YYYY/MM/DD
    var parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    return parts[2] + '/' + parts[0] + '/' + parts[1];
  }
  function displayToFmDate(displayStr) {
    if (!displayStr || !String(displayStr).trim()) return '';
    var p = String(displayStr).trim().split('/');
    if (p.length !== 3) return String(displayStr).trim();
    return p[1] + '/' + p[2] + '/' + p[0];
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  function render() {
    var tbody   = document.getElementById('tbody');
    var emptyEl = document.getElementById('empty');
    var countEl = document.getElementById('count');
    var list    = state.filtered;

    countEl.textContent = list.length + ' 件';

    if (list.length === 0) {
      tbody.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    tbody.innerHTML = list.map(function (row) {
      return '<tr>' +
        '<td>' + esc(row.fullName)  + '</td>' +
        '<td>' + esc(row.location)  + '</td>' +
        '<td>' + esc(row.status)    + '</td>' +
        '<td>' + esc(row.joinDate)  + '</td>' +
        '<td>' + esc(row.leaveDate) + '</td>' +
        // '<td style="text-align:center">' +
        //   '<button type="button" class="btn-delete" data-record-id="' + escAttr(row.recordId) + '" title="削除">🗑</button>' +
        // '</td>' +
        '<td class="td-actions">' +
          '<button type="button" class="btn-edit" data-edit-id="' + escAttr(row.apiRecordId) + '" title="編集">✏️</button>' +
          '<button type="button" class="btn-delete" data-record-id="' + escAttr(row.apiRecordId) + '" title="削除">🗑</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;');
  }
  function openEditModal(row) {
    state.editingRow = row;
    document.getElementById('editFullName').value = row.fullName || '';
    document.getElementById('editLocation').value = row.location || '';
    // 在籍フラグは計算のため編集UIオフ — editStatus 復帰時: row.statusFlag で value をセット
    // var es = document.getElementById('editStatus');
    // if (es) es.value = row.statusFlag === '1' ? '1' : '0';
    document.getElementById('editJoinDate').value = row.joinDate || '';
    document.getElementById('editLeaveDate').value = row.leaveDate || '';
    document.getElementById('editModal').style.display = 'flex';
  }

  function closeEditModal() {
    state.editingRow = null;
    document.getElementById('editModal').style.display = 'none';
  }

  function saveEditModal() {
    var row = state.editingRow;
    if (!row) return;
    var apiId = row.apiRecordId;
    if (!apiId) {
      alert('Data API の recordId がありません。receiveDataFromFileMaker の行マッピングで apiRecordId を設定してください。');
      return;
    }
    var fullName = document.getElementById('editFullName').value.trim();
    var location = document.getElementById('editLocation').value.trim();
    // var statusFlag = document.getElementById('editStatus').value;
    var joinDisp = document.getElementById('editJoinDate').value.trim();
    var leaveDisp = document.getElementById('editLeaveDate').value.trim();

    var fieldData = {
      '氏名': fullName,
      '事業所略称': location,
      // '在籍フラグ': statusFlag, // 計算フィールド — 在籍区分などに変更後に復帰
      '入社\u3000年月日': joinDisp ? displayToFmDate(joinDisp) : '',
      '退職\u3000年月日': leaveDisp ? displayToFmDate(leaveDisp) : ''
    };

    var payload = {
      recordId: String(apiId),
      fieldData: fieldData
    };
    var modNum = parseInt(row.modId, 10);
    if (!isNaN(modNum) && modNum >= 1) payload.modId = String(modNum);

    closeEditModal();
    if (typeof FileMaker !== 'undefined') {
      FileMaker.PerformScript('UpdateEmployeeDataAPI', JSON.stringify(payload));
    } else {
      console.log('UpdateEmployeeDataAPI', payload);
    }
  }
  function findRowByRecordId(recordId) {
    var id = String(recordId);
    for (var i = 0; i < state.filtered.length; i++) {
      var r = state.filtered[i];
      if (String(r.apiRecordId) === id || String(r.recordId) === id) return r;
    }
    return null;
  }
  window.receiveUpdateResult = function (resultJson) {
    var parsed;
    try {
      parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
    } catch (e) {
      return;
    }
    var code = '';
    try {
      code = JSON.parse(JSON.stringify(parsed)).messages && parsed.messages[0] && String(parsed.messages[0].code);
    } catch (e2) {}
    if (parsed.messages && parsed.messages[0] && parsed.messages[0].code === '0') {
      runFileMakerScript(state.offset, DEFAULT_LIMIT);
      return;
    }
    var msg = (parsed.messages && parsed.messages[0] && parsed.messages[0].message) || '更新に失敗しました。';
    alert(msg);
  };
  // ─── Sort headers + page load trigger ────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var locationFilter = document.getElementById('locationFilter');
    if (locationFilter) {
      locationFilter.addEventListener('change', function () {
        filterByLocation(locationFilter.value);
      });
    }

    var btnPrev = document.getElementById('btnPrev');
    var btnNext = document.getElementById('btnNext');
    if (btnPrev) btnPrev.addEventListener('click', function () { changePage(-1); });
    if (btnNext) btnNext.addEventListener('click', function () { changePage(1); });

    var btnDeleteYes = document.getElementById('btnDeleteYes');
    var btnDeleteNo = document.getElementById('btnDeleteNo');
    if (btnDeleteYes) btnDeleteYes.addEventListener('click', executeDelete);
    if (btnDeleteNo) btnDeleteNo.addEventListener('click', cancelDelete);
    // ─── Edit modal ────────────────────────────────────────────────────────────
    var btnEditSave = document.getElementById('btnEditSave');
    var btnEditCancel = document.getElementById('btnEditCancel');
    if (btnEditSave) btnEditSave.addEventListener('click', saveEditModal);
    if (btnEditCancel) btnEditCancel.addEventListener('click', closeEditModal);

    var tbody = document.getElementById('tbody');
    if (tbody) {
      // tbody.addEventListener('click', function (e) {
      //   var btn = e.target.closest('.btn-delete');
      //   if (!btn) return;
      //   var id = btn.getAttribute('data-record-id');
      //   if (id != null && id !== '') confirmDelete(id);
      // });
      tbody.addEventListener('click', function (e) {
        var del = e.target.closest('.btn-delete');
        if (del) {
          var id = del.getAttribute('data-record-id');
          if (id != null && id !== '') confirmDelete(id);
          return;
        }
        var ed = e.target.closest('.btn-edit');
        if (ed) {
          var eid = ed.getAttribute('data-edit-id');
          var row = findRowByRecordId(eid);
          if (row) openEditModal(row);
        }
      });
    }

    document.querySelectorAll('th[data-key]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-key');
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'ascend' ? 'descend' : 'ascend';
        } else {
          state.sortKey = key;
          state.sortDir = 'ascend';
        }
        runFileMakerScript(0, DEFAULT_LIMIT);
      });
    });

    setTimeout(function () {
      if (typeof FileMaker !== 'undefined') {
        FileMaker.PerformScript('GetLocations', '');
      }
      runFileMakerScript(0, DEFAULT_LIMIT);
    }, 100);
    // setTimeout(function () {
    //   runFileMakerScript(0, DEFAULT_LIMIT);
    // }, 100);
  });

})();
