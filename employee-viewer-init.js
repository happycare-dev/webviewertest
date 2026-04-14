/* Wire DOM events and initial FileMaker load. */
(function (EV) {
  document.addEventListener('DOMContentLoaded', function () {
    var locationFilter = document.getElementById('locationFilter');
    if (locationFilter) {
      locationFilter.addEventListener('change', function () {
        window.filterByLocation(locationFilter.value);
      });
    }

    var btnPrev = document.getElementById('btnPrev');
    var btnNext = document.getElementById('btnNext');
    if (btnPrev) btnPrev.addEventListener('click', function () { window.changePage(-1); });
    if (btnNext) btnNext.addEventListener('click', function () { window.changePage(1); });

    var btnDeleteYes = document.getElementById('btnDeleteYes');
    var btnDeleteNo = document.getElementById('btnDeleteNo');
    if (btnDeleteYes) btnDeleteYes.addEventListener('click', window.executeDelete);
    if (btnDeleteNo) btnDeleteNo.addEventListener('click', window.cancelDelete);

    var btnEditSave = document.getElementById('btnEditSave');
    var btnEditCancel = document.getElementById('btnEditCancel');
    if (btnEditSave) btnEditSave.addEventListener('click', EV.saveEditModal);
    if (btnEditCancel) btnEditCancel.addEventListener('click', EV.closeEditModal);

    var tbody = document.getElementById('tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var del = e.target.closest('.btn-delete');
        if (del) {
          var id = del.getAttribute('data-record-id');
          if (id != null && id !== '') {
            EV.highlightRowForElement(del);
            window.confirmDelete(id);
          }
          return;
        }
        var ed = e.target.closest('.btn-edit');
        if (ed) {
          var eid = ed.getAttribute('data-edit-id');
          var row = EV.findRowByRecordId(eid);
          if (row) EV.openEditModal(row, ed);
        }
      });
    }

    document.querySelectorAll('th[data-key]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-key');
        if (EV.state.sortKey === key) {
          EV.state.sortDir = EV.state.sortDir === 'ascend' ? 'descend' : 'ascend';
        } else {
          EV.state.sortKey = key;
          EV.state.sortDir = 'ascend';
        }
        EV.runFileMakerScript(0, EV.DEFAULT_LIMIT);
      });
    });

    EV.initDraggableModal('deleteModal');
    EV.initDraggableModal('editModal');

    setTimeout(function () {
      if (typeof FileMaker !== 'undefined') {
        FileMaker.PerformScript('GetLocations', '');
      }
      EV.runFileMakerScript(0, EV.DEFAULT_LIMIT);
    }, 100);
  });
})(window.EV);
