/* Shared state and constants for employee-viewer (load first). */
(function (global) {
  global.EV = {
    DEFAULT_LIMIT: 50,
    state: {
      rows: [],
      filtered: [],
      sortKey: 'fullName',
      sortDir: 'ascend',
      offset: 0,
      totalCount: 0,
      locationFilter: '',
      pendingDeleteId: null,
      editingRow: null
    },
    FIELD_MAP: {
      fullName: '氏名',
      location: '事業所略称',
      status: '在籍フラグ',
      joinDate: '入社\u3000年月日',
      leaveDate: '退職\u3000年月日'
    }
  };
})(typeof window !== 'undefined' ? window : this);
