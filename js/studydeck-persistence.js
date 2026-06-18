// StudyDeck persistence/storage bootstrap.
// Loaded before app.js by index.html; intentionally uses classic-script globals.

const STORAGE_KEY = 'studydeck_data';
const REVIEW_MARKS_KEY = 'studydeck_review_marks';
const GUIDED_STORAGE_KEY = 'studydeck_guided_proto_v1';
const GUIDED_AUTHOR_DRAFT_KEY = 'studydeck_guided_author_draft_v1';
const GUIDED_SIDECAR_STORAGE_KEY = 'studydeck_guided_sidecars_v1';
const GUIDED_AUTHOR_TAB_KEY = 'studydeck_guided_author_tab_v1';
const GUIDED_NODE_POLICY_KEY = 'studydeck_guided_node_policy_v2';
const GUIDED_NODE_POLICY_LEGACY_KEY = 'studydeck_guided_node_policy_v1';
const GUIDED_NODE_FOOTPRINT_KEY = 'studydeck_guided_node_footprint_v1';
const GUIDED_REWARDS_STORAGE_KEY = 'studydeck_guided_rewards_v1';
const GUIDED_REWARD_ART_DB_PREFIX = 'guidedRewardArt:';
const GUIDED_ENABLED = true;
const DECK_DATA_DB_NAME = 'studydeck_deck_data_v1';
const DECK_DATA_DB_STORE = 'kv';
const DECK_DATA_DB_KEY = 'deckData';
const GUIDED_STATE_DB_KEY = 'guidedState';
const GUIDED_SIDECAR_DB_KEY = 'guidedSidecars';
const GUIDED_REWARDS_DB_KEY = 'guidedRewards';
const GAME_DATA_DB_KEY = 'gameData';
const CRITICAL_PROGRESS_BACKUP_KEY = 'studydeck_critical_progress_backup_v1';
const CRITICAL_PROGRESS_BACKUP_DB_KEY = 'criticalProgressBackup';

// ── PERSISTENCE ──
var _storageFailureNoticeShown = false;
var STORAGE_CAPACITY_WARN_LIMIT = 5 * 1024 * 1024 * 0.8;
var _storageCapacityWarningShown = false;
var SAVE_DEBOUNCE_MS = 250;
var _saveDataTimer = null;
var _saveDataPending = false;
var _deckDataMutationVersion = 0;
var _startupDeckDataNeedsSave = false;
var _guidedRuntimeStoresHydrated = false;
function notifyStorageFailure(label) {
  if (_storageFailureNoticeShown) return;
  _storageFailureNoticeShown = true;
  var msg = 'Saving failed — changes may not persist. Browser storage may be full or disabled.';
  if (typeof showXpToast === 'function') showXpToast(msg, 5200);
}
function safeSetLocalStorage(key, value, label, options) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch(e) {
    if (!(options && options.quiet)) notifyStorageFailure(label);
    return false;
  }
}
function guidedNormalizeStoredDeckData(parsed) {
  if (Array.isArray(parsed)) return { decks: parsed, tagGroups: [], savedAt: '' };
  if (parsed && Array.isArray(parsed.decks)) {
    return {
      decks: parsed.decks,
      tagGroups: Array.isArray(parsed.tagGroups) ? parsed.tagGroups : [],
      savedAt: parsed.savedAt || parsed.updatedAt || ''
    };
  }
  return null;
}
function guidedParseStoredDeckData(raw) {
  if (!raw) return null;
  try {
    return guidedNormalizeStoredDeckData(JSON.parse(String(raw).replace(/^\uFEFF/, '')));
  } catch(e) {
    return null;
  }
}
function guidedDeckDataPayload() {
  return JSON.stringify({ decks: decks, tagGroups: tagGroups, savedAt: new Date().toISOString() });
}
function guidedStoredDeckCardCount(data) {
  if (!data || !Array.isArray(data.decks)) return 0;
  return data.decks.reduce(function(total, deck){
    return total + ((deck && Array.isArray(deck.cards)) ? deck.cards.length : 0);
  }, 0);
}
function guidedStoredDeckTimestamp(data) {
  if (!data || !data.savedAt) return 0;
  var value = Date.parse(data.savedAt);
  return Number.isFinite(value) ? value : 0;
}
function guidedIndexedDbAvailable() {
  return typeof indexedDB !== 'undefined';
}
function guidedOpenDeckDataDb() {
  return new Promise(function(resolve, reject){
    if (!guidedIndexedDbAvailable()) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    var request = indexedDB.open(DECK_DATA_DB_NAME, 1);
    request.onupgradeneeded = function(){
      var db = request.result;
      if (!db.objectStoreNames.contains(DECK_DATA_DB_STORE)) db.createObjectStore(DECK_DATA_DB_STORE);
    };
    request.onsuccess = function(){ resolve(request.result); };
    request.onerror = function(){ reject(request.error || new Error('Could not open deck data storage.')); };
  });
}
function guidedWriteDeckDataToIndexedDb(payload) {
  return guidedOpenDeckDataDb().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(DECK_DATA_DB_STORE, 'readwrite');
      tx.objectStore(DECK_DATA_DB_STORE).put(payload, DECK_DATA_DB_KEY);
      tx.oncomplete = function(){ db.close(); resolve(true); };
      tx.onerror = function(){ var err = tx.error || new Error('Could not save deck data.'); db.close(); reject(err); };
      tx.onabort = function(){ var err = tx.error || new Error('Deck data save was aborted.'); db.close(); reject(err); };
    });
  });
}
function guidedReadDeckDataFromIndexedDb() {
  return guidedOpenDeckDataDb().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(DECK_DATA_DB_STORE, 'readonly');
      var request = tx.objectStore(DECK_DATA_DB_STORE).get(DECK_DATA_DB_KEY);
      request.onsuccess = function(){ resolve(guidedParseStoredDeckData(request.result)); };
      request.onerror = function(){ reject(request.error || new Error('Could not read deck data.')); };
      tx.oncomplete = function(){ db.close(); };
      tx.onerror = function(){ db.close(); };
      tx.onabort = function(){ db.close(); };
    });
  });
}
function guidedWriteAppValueToIndexedDb(key, value) {
  return guidedOpenDeckDataDb().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(DECK_DATA_DB_STORE, 'readwrite');
      tx.objectStore(DECK_DATA_DB_STORE).put(value, key);
      tx.oncomplete = function(){ db.close(); resolve(true); };
      tx.onerror = function(){ var err = tx.error || new Error('Could not save app data.'); db.close(); reject(err); };
      tx.onabort = function(){ var err = tx.error || new Error('App data save was aborted.'); db.close(); reject(err); };
    });
  });
}
function guidedReadAppValueFromIndexedDb(key) {
  return guidedOpenDeckDataDb().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(DECK_DATA_DB_STORE, 'readonly');
      var request = tx.objectStore(DECK_DATA_DB_STORE).get(key);
      request.onsuccess = function(){ resolve(request.result); };
      request.onerror = function(){ reject(request.error || new Error('Could not read app data.')); };
      tx.oncomplete = function(){ db.close(); };
      tx.onerror = function(){ db.close(); };
      tx.onabort = function(){ db.close(); };
    });
  });
}
function guidedDeleteAppValueFromIndexedDb(key) {
  return guidedOpenDeckDataDb().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(DECK_DATA_DB_STORE, 'readwrite');
      tx.objectStore(DECK_DATA_DB_STORE).delete(key);
      tx.oncomplete = function(){ db.close(); resolve(true); };
      tx.onerror = function(){ var err = tx.error || new Error('Could not delete app data.'); db.close(); reject(err); };
      tx.onabort = function(){ var err = tx.error || new Error('App data delete was aborted.'); db.close(); reject(err); };
    });
  });
}
function guidedParseIndexedJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch(e) {}
  return null;
}
function guidedStoreUpdatedAt(value) {
  if (!value || typeof value !== 'object') return 0;
  var raw = value.updatedAt || value.savedAt || 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  var parsed = Date.parse(String(raw || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
function guidedStoreIsNewer(candidate, current) {
  var candidateTime = guidedStoreUpdatedAt(candidate);
  var currentTime = guidedStoreUpdatedAt(current);
  return candidateTime > 0 && candidateTime > currentTime;
}
function guidedSafeJsonClone(value) {
  if (value == null) return null;
  try { return JSON.parse(JSON.stringify(value)); } catch(e) {}
  return null;
}
function guidedCriticalDeckSnapshot() {
  if (!Array.isArray(decks) || !decks.length) return null;
  return {
    decks: guidedSafeJsonClone(decks) || [],
    tagGroups: guidedSafeJsonClone(tagGroups) || [],
    savedAt: new Date().toISOString()
  };
}
function guidedCriticalProgressSnapshot(reason, options) {
  options = options || {};
  var snapshot = {
    version: 1,
    savedAt: Date.now(),
    savedAtIso: new Date().toISOString(),
    reason: reason || 'snapshot',
    gameData: (typeof gd !== 'undefined') ? normalizeGameData(guidedSafeJsonClone(gd) || gd) : null,
    guidedState: (typeof guidedState !== 'undefined') ? guidedSafeJsonClone(guidedState) : null,
    guidedRewards: (typeof guidedRewardSettings === 'function') ? guidedSafeJsonClone(guidedRewardSettings()) : null
  };
  if (options.includeSidecars && typeof guidedSidecarStore !== 'undefined') {
    snapshot.guidedSidecars = guidedSafeJsonClone(guidedSidecarStore);
  }
  if (options.includeDecks) snapshot.deckData = guidedCriticalDeckSnapshot();
  return snapshot;
}
var guidedCriticalProgressBackupCache = null;
function guidedShouldKeepProgressBackup(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (gameDataHasProgress(snapshot.gameData)) return true;
  if (snapshot.guidedState && snapshot.guidedState.run) return true;
  if (snapshot.guidedSidecars && Array.isArray(snapshot.guidedSidecars.sidecars) && snapshot.guidedSidecars.sidecars.length) return true;
  if (snapshot.deckData && Array.isArray(snapshot.deckData.decks) && snapshot.deckData.decks.length) return true;
  return false;
}
function guidedMergeCriticalProgressBackupSnapshot(snapshot, existing) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  existing = guidedParseCriticalProgressBackup(existing) || null;
  if (existing && !snapshot.deckData && existing.deckData && Array.isArray(existing.deckData.decks) && existing.deckData.decks.length) {
    snapshot.deckData = guidedSafeJsonClone(existing.deckData);
  }
  if (existing && !snapshot.guidedSidecars && existing.guidedSidecars && Array.isArray(existing.guidedSidecars.sidecars) && existing.guidedSidecars.sidecars.length) {
    snapshot.guidedSidecars = guidedSafeJsonClone(existing.guidedSidecars);
  }
  return snapshot;
}
function guidedWriteCriticalProgressBackupSnapshot(snapshot) {
  if (!guidedShouldKeepProgressBackup(snapshot)) return false;
  guidedCriticalProgressBackupCache = guidedSafeJsonClone(snapshot);
  var payload = JSON.stringify(snapshot);
  // IndexedDB is the primary home for this backup. localStorage is only a small fallback.
  if (payload.length < 1800000) safeSetLocalStorage(CRITICAL_PROGRESS_BACKUP_KEY, payload, 'critical progress backup', { quiet: true });
  if (guidedIndexedDbAvailable()) {
    guidedWriteAppValueToIndexedDb(CRITICAL_PROGRESS_BACKUP_DB_KEY, payload).catch(function(){});
  }
  return true;
}
function writeCriticalProgressBackup(reason, options) {
  var snapshot = guidedCriticalProgressSnapshot(reason, options);
  var localExisting = guidedCriticalProgressBackupCache;
  try { localExisting = localExisting || guidedParseCriticalProgressBackup(localStorage.getItem(CRITICAL_PROGRESS_BACKUP_KEY)); } catch(e) {}
  snapshot = guidedMergeCriticalProgressBackupSnapshot(snapshot, localExisting);
  if (!guidedShouldKeepProgressBackup(snapshot)) return false;
  if (guidedIndexedDbAvailable()) {
    guidedReadAppValueFromIndexedDb(CRITICAL_PROGRESS_BACKUP_DB_KEY).then(function(raw){
      guidedWriteCriticalProgressBackupSnapshot(guidedMergeCriticalProgressBackupSnapshot(snapshot, raw || localExisting));
    }).catch(function(){
      guidedWriteCriticalProgressBackupSnapshot(snapshot);
    });
    return true;
  }
  return guidedWriteCriticalProgressBackupSnapshot(snapshot);
}
function guidedParseCriticalProgressBackup(raw) {
  var parsed = guidedParseIndexedJson(raw);
  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null;
  return parsed;
}
function guidedReadCriticalProgressBackup() {
  function localBackup() {
    try { return guidedParseCriticalProgressBackup(localStorage.getItem(CRITICAL_PROGRESS_BACKUP_KEY)); } catch(e) {}
    return null;
  }
  if (!guidedIndexedDbAvailable()) {
    var localOnly = localBackup();
    if (localOnly) guidedCriticalProgressBackupCache = guidedSafeJsonClone(localOnly);
    return Promise.resolve(localOnly);
  }
  return guidedReadAppValueFromIndexedDb(CRITICAL_PROGRESS_BACKUP_DB_KEY).then(function(raw){
    var snapshot = guidedParseCriticalProgressBackup(raw) || localBackup();
    if (snapshot) guidedCriticalProgressBackupCache = guidedSafeJsonClone(snapshot);
    return snapshot;
  }).catch(function(){
    var snapshot = localBackup();
    if (snapshot) guidedCriticalProgressBackupCache = guidedSafeJsonClone(snapshot);
    return snapshot;
  });
}
function maybeWarnStorageCapacity(serialized, label) {
  if (_storageCapacityWarningShown || !serialized) return;
  if (serialized.length >= STORAGE_CAPACITY_WARN_LIMIT) {
    _storageCapacityWarningShown = true;
    var msg = 'Storage is getting full — export a backup soon.';
    if (typeof showXpToast === 'function') showXpToast(msg, 5200);
  }
}
function writeDataNow() {
  var payload = guidedDeckDataPayload();
  _deckDataMutationVersion += 1;
  maybeWarnStorageCapacity(payload, 'deck data');
  writeCriticalProgressBackup('deck_data_autosave', { includeDecks: true, includeSidecars: false });
  if (guidedIndexedDbAvailable()) {
    guidedWriteDeckDataToIndexedDb(payload).then(function(){
      try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
    }).catch(function(){
      notifyStorageFailure('deck data');
    });
    return true;
  }
  var localOk = safeSetLocalStorage(STORAGE_KEY, payload, 'deck data');
  if (!localOk) notifyStorageFailure('deck data');
  return localOk;
}
function writeDataNowPersistent() {
  var payload = guidedDeckDataPayload();
  _deckDataMutationVersion += 1;
  maybeWarnStorageCapacity(payload, 'deck data');
  writeCriticalProgressBackup('deck_data_persistent_save', { includeDecks: true, includeSidecars: false });
  if (guidedIndexedDbAvailable()) {
    return guidedWriteDeckDataToIndexedDb(payload).then(function(){
      try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
      return true;
    }).catch(function(err){
      notifyStorageFailure('deck data');
      throw err;
    });
  }
  var localOk = safeSetLocalStorage(STORAGE_KEY, payload, 'deck data');
  if (!localOk) {
    notifyStorageFailure('deck data');
    return Promise.reject(new Error('Could not save deck data.'));
  }
  return Promise.resolve(true);
}
function activateManifestLink() {
  var link = document.getElementById('app-manifest-link');
  if (!link || location.protocol === 'file:') return;
  var href = link.getAttribute('data-href');
  if (href) link.setAttribute('href', href);
}
function saveData() {
  _saveDataPending = true;
  if (_saveDataTimer) clearTimeout(_saveDataTimer);
  _saveDataTimer = setTimeout(flushSaveData, SAVE_DEBOUNCE_MS);
  return true;
}
function flushSaveData() {
  if (_saveDataTimer) clearTimeout(_saveDataTimer);
  _saveDataTimer = null;
  if (!_saveDataPending) return true;
  _saveDataPending = false;
  return writeDataNow();
}
function saveDataImmediate() {
  _saveDataPending = true;
  return flushSaveData();
}
function saveDataImmediatePersistent() {
  if (_saveDataTimer) clearTimeout(_saveDataTimer);
  _saveDataTimer = null;
  _saveDataPending = false;
  return writeDataNowPersistent();
}
function loadData() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    return guidedParseStoredDeckData(raw);
  } catch(e) {}
  return null;
}
function guidedShouldApplyIndexedDbDeckData(data) {
  if (!data || !Array.isArray(data.decks) || !data.decks.length) return false;
  if (typeof _saved === 'undefined' || !_saved) return true;
  var idbTime = guidedStoredDeckTimestamp(data);
  var localTime = guidedStoredDeckTimestamp(_saved);
  if (idbTime && localTime && idbTime > localTime) return true;
  if (!localTime && idbTime && guidedStoredDeckCardCount(data) > guidedStoredDeckCardCount(_saved)) return true;
  return false;
}
function guidedApplyStoredDeckData(data, sourceLabel) {
  if (!data || !Array.isArray(data.decks) || !data.decks.length) return false;
  decks = data.decks;
  tagGroups = Array.isArray(data.tagGroups) ? data.tagGroups : [];
  _saved = data;
  ensureUIDs();
  repairAllCardLinks();
  if (typeof guidedState !== 'undefined') {
    guidedState = guidedSanitizeState(guidedState || loadGuidedState() || guidedDefaultState());
  }
  renderHome();
  renderDecks();
  if (typeof renderProfile === 'function') renderProfile();
  if (typeof renderGuidedEntry === 'function') renderGuidedEntry();
  if (typeof renderGuidedView === 'function' && document.getElementById('guided')) renderGuidedView();
  if (typeof guidedAuthorRefreshCurrentTab === 'function') guidedAuthorRefreshCurrentTab();
  return true;
}
function guidedHydrateDeckDataFromIndexedDb() {
  if (!guidedIndexedDbAvailable()) return Promise.resolve(false);
  var versionAtStart = _deckDataMutationVersion;
  return guidedReadDeckDataFromIndexedDb().then(function(data){
    if (_deckDataMutationVersion !== versionAtStart) return false;
    if (!guidedShouldApplyIndexedDbDeckData(data)) return false;
    var applied = guidedApplyStoredDeckData(data, 'IndexedDB');
    if (applied) saveData();
    return applied;
  }).catch(function(){
    return false;
  });
}
