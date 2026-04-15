/* Table render, row lookup, client-side filter/sort helpers. */
(function (EV) {
  var state = EV.state;

  EV.applyFilter = function (query) {
    var q = (query || '').toLowerCase();
    state.filtered = state.rows.filter(function (r) {
      return !q ||
        r.fullName.toLowerCase().indexOf(q) >= 0 ||
        r.location.toLowerCase().indexOf(q) >= 0 ||
        r.status.toLowerCase().indexOf(q) >= 0;
    });
    EV.applySort();
  };

  EV.applySort = function () {
    var key = state.sortKey;
    var mult = state.sortDir === 'descend' ? -1 : 1;
    state.filtered.sort(function (a, b) {
      var av = (a[key] || '').toString();
      var bv = (b[key] || '').toString();
      return av.localeCompare(bv, 'ja') * mult;
    });
  };

  EV.findRowByRecordId = function (recordId) {
    var id = String(recordId);
    for (var i = 0; i < state.filtered.length; i++) {
      var r = state.filtered[i];
      if (String(r.apiRecordId) === id || String(r.recordId) === id) return r;
    }
    return null;
  };

  EV.render = function () {
    var tbody = document.getElementById('tbody');
    var emptyEl = document.getElementById('empty');
    var countEl = document.getElementById('count');
    var list = state.filtered;

    countEl.textContent = list.length + ' 件';

    var thAct = document.querySelector('th.col-actions');
    if (thAct) thAct.style.display = state.canEditDelete ? '' : 'none';

    if (list.length === 0) {
      tbody.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    tbody.innerHTML = list.map(function (row, index) {
      var rowNum = state.offset + index + 1;
      var actionsCell = state.canEditDelete
        ? '<td class="td-actions">' +
          '<button type="button" class="btn-edit" data-edit-id="' + EV.escAttr(row.apiRecordId) + '" title="編集">✏️</button>' +
          '<button type="button" class="btn-delete" data-record-id="' + EV.escAttr(row.apiRecordId) + '" title="削除">🗑</button>' +
          '</td>'
        : '<td class="td-actions" style="display:none"></td>';
      return '<tr>' +
        '<td class="col-num">' + rowNum + '</td>' +
        '<td>' + EV.esc(row.fullName) + '</td>' +
        '<td>' + EV.esc(row.location) + '</td>' +
        '<td>' + EV.esc(row.status) + '</td>' +
        '<td>' + EV.esc(row.joinDate) + '</td>' +
        '<td>' + EV.esc(row.leaveDate) + '</td>' +
        actionsCell +
      '</tr>';
    }).join('');
  };
})(window.EV);
