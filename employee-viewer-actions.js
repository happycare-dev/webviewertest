/* Delete / edit modals, security info, PerformScript for Update / Delete. */
(function (EV) {
  var state = EV.state;
  var DEFAULT_LIMIT = EV.DEFAULT_LIMIT;

  window.confirmDelete = function (recordId) {
    if (!state.canEditDelete) return;
    state.pendingDeleteId = recordId;
    var nameEl = document.getElementById('deleteModalFullName');
    if (nameEl) {
      var row = EV.findRowByRecordId(recordId);
      nameEl.textContent = row && row.fullName ? String(row.fullName) : '—';
    }
    EV.showModalOverlay(document.getElementById('deleteModal'));
  };

  window.cancelDelete = function () {
    state.pendingDeleteId = null;
    var nameEl = document.getElementById('deleteModalFullName');
    if (nameEl) nameEl.textContent = '';
    document.getElementById('deleteModal').style.display = 'none';
    EV.clearRowHighlight();
  };

  window.executeDelete = function () {
    if (!state.canEditDelete) return;
    document.getElementById('deleteModal').style.display = 'none';
    if (!state.pendingDeleteId) return;
    var param = JSON.stringify({ recordId: String(state.pendingDeleteId) });
    state.pendingDeleteId = null;
    if (typeof FileMaker !== 'undefined') {
      FileMaker.PerformScript('DeleteRecord', param);
    }
  };

  EV.openEditModal = function (row, sourceEl) {
    if (!state.canEditDelete) return;
    state.editingRow = row;
    if (sourceEl) EV.highlightRowForElement(sourceEl);
    document.getElementById('editFullName').value = row.fullName || '';
    document.getElementById('editLocation').value = row.location || '';
    document.getElementById('editJoinDate').value = row.joinDate || '';
    document.getElementById('editLeaveDate').value = row.leaveDate || '';
    EV.showModalOverlay(document.getElementById('editModal'));
  };

  EV.closeEditModal = function () {
    state.editingRow = null;
    document.getElementById('editModal').style.display = 'none';
    EV.clearRowHighlight();
  };

  EV.saveEditModal = function () {
    if (!state.canEditDelete) return;
    var row = state.editingRow;
    if (!row) return;
    var apiId = row.apiRecordId;
    if (!apiId) {
      alert('Data API の recordId がありません。receiveDataFromFileMaker の行マッピングで apiRecordId を設定してください。');
      return;
    }
    var fullName = document.getElementById('editFullName').value.trim();
    var location = document.getElementById('editLocation').value.trim();
    var joinDisp = document.getElementById('editJoinDate').value.trim();
    var leaveDisp = document.getElementById('editLeaveDate').value.trim();

    var fieldData = {
      '氏名': fullName,
      '事業所略称': location,
      '入社\u3000年月日': joinDisp ? EV.displayToFmDate(joinDisp) : '',
      '退職\u3000年月日': leaveDisp ? EV.displayToFmDate(leaveDisp) : ''
    };

    var payload = {
      recordId: String(apiId),
      fieldData: fieldData
    };
    var modNum = parseInt(row.modId, 10);
    if (!isNaN(modNum) && modNum >= 1) payload.modId = String(modNum);

    EV.closeEditModal();
    if (typeof FileMaker !== 'undefined') {
      FileMaker.PerformScript('UpdateEmployeeDataAPI', JSON.stringify(payload));
    } else {
      console.log('UpdateEmployeeDataAPI', payload);
    }
  };

  window.openSecurityInfo = function () {
    if (typeof FileMaker !== 'undefined') {
      FileMaker.PerformScript('GetSecurityInfo', '');
      return;
    }
    window.receiveSecurityInfo(JSON.stringify({
      accountName: '（FileMaker 環境外のため取得できません）',
      privilegeSetName: '',
      extendedPrivilegesRaw: '',
      recordAccess: '',
      layoutAccess: ''
    }));
  };

  window.closeSecurityModal = function () {
    var el = document.getElementById('securityModal');
    if (el) el.style.display = 'none';
  };
})(window.EV);
