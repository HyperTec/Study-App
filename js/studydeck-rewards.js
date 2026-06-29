// StudyDeck Guided rewards helpers.
// Loaded before app.js by index.html; intentionally uses classic-script globals.
// Contains Guided completion reward settings, art selection, award ledger helpers, and Rewards Author Tools UI.

// Guided reward settings, art defaults, and selectors
var guidedRewardSettingsCache = null;
var guidedRewardArtDataCache = {};
var guidedRewardArtLoading = {};
var guidedRewardArtPreloadPromises = {};
var guidedRewardImageDecodeCache = {};
var guidedRewardArtWarmupScheduled = false;
var guidedRewardArtWarmupSignature = '';

function guidedRewardFileUrl(path) {
  return 'file://' + encodeURI(path);
}
function guidedRewardDefaultPhrases(label) {
  return {
    perfect: [label ? label + ' approves.' : 'Perfect run.'],
    strong: ['Strong finish.'],
    pass: ['Node complete.'],
    low: ['Finished. Keep the path moving.']
  };
}
function guidedDefaultRewardArt() {
  return [
    ['flying_spaghetti_monster', 'Flying Spaghetti Monster'],
    ['firm_stick', 'Firm Stick'],
    ['doug_shelf', 'Doug Shelf'],
    ['wet_box', 'Wet Box'],
    ['uni_farting_turtle', 'Uni Farting Turtle'],
    ['omni_purple', 'Omni Purple'],
    ['roland_closet_goblin', 'Roland the Closet Goblin'],
    ['puff', 'Puff']
  ].map(function(item){
    return {
      id: item[0],
      label: item[1],
      src: '',
      enabled: true,
      phrases: guidedRewardDefaultPhrases(item[1])
    };
  });
}
function guidedDefaultRewardSettings() {
  return {
    version: 1,
    rewardTable: {
      first: {
        perfect: { xp: 30, shekels: 30 },
        strong: { xp: 24, shekels: 24 },
        pass: { xp: 15, shekels: 15 },
        low: { xp: 8, shekels: 8 }
      },
      repeat: {
        perfect: { xp: 10, shekels: 10 },
        strong: { xp: 8, shekels: 8 },
        pass: { xp: 5, shekels: 5 },
        low: { xp: 2, shekels: 2 }
      }
    },
    art: guidedDefaultRewardArt(),
    updatedAt: Date.now()
  };
}
function guidedNormalizeRewardPhrases(value, label) {
  var defaults = guidedRewardDefaultPhrases(label || '');
  var phrases = (value && typeof value === 'object') ? value : {};
  ['perfect', 'strong', 'pass', 'low'].forEach(function(band){
    var list = phrases[band];
    if (typeof list === 'string') list = list.split(/\n+/);
    if (!Array.isArray(list)) list = defaults[band];
    phrases[band] = list.map(function(line){ return String(line || '').trim(); }).filter(Boolean);
    if (!phrases[band].length) phrases[band] = defaults[band].slice();
  });
  return phrases;
}
function guidedNormalizeRewardAmount(value, fallback) {
  var num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.floor(num));
}
function guidedNormalizeRewardTable(raw, fallback) {
  var table = {};
  ['first', 'repeat'].forEach(function(mode){
    table[mode] = {};
    ['perfect', 'strong', 'pass', 'low'].forEach(function(band){
      var entry = raw && raw[mode] && raw[mode][band] || {};
      var fb = fallback.rewardTable[mode][band];
      table[mode][band] = {
        xp: guidedNormalizeRewardAmount(entry.xp, fb.xp),
        shekels: guidedNormalizeRewardAmount(entry.shekels, fb.shekels)
      };
    });
  });
  return table;
}
function guidedNormalizeRewardArtId(value, fallback) {
  var raw = String(value || fallback || '').toLowerCase();
  return raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || String(fallback || 'completion_art');
}
function guidedRewardPhraseSignature(phrases, label) {
  var normalized = guidedNormalizeRewardPhrases(phrases, label || '');
  return JSON.stringify({
    perfect: normalized.perfect || [],
    strong: normalized.strong || [],
    pass: normalized.pass || [],
    low: normalized.low || []
  });
}
function guidedRewardArtCandidateScore(item, fallbackItem) {
  item = (item && typeof item === 'object') ? item : {};
  fallbackItem = (fallbackItem && typeof fallbackItem === 'object') ? fallbackItem : {};
  var score = 0;
  if (item.enabled === false) score += 2;
  if (item.label && fallbackItem.label && String(item.label) !== String(fallbackItem.label)) score += 3;
  if (item.phrases && guidedRewardPhraseSignature(item.phrases, item.label || fallbackItem.label) !== guidedRewardPhraseSignature(fallbackItem.phrases, fallbackItem.label)) score += 5;
  if (item.imageKey && item.imageKey !== fallbackItem.imageKey) score += 2;
  if (item.src && fallbackItem.src && String(item.src) !== String(fallbackItem.src)) score += 1;
  if (item.uploadedAt) score += 1;
  return score;
}
function guidedNormalizeRewardArtItem(item, idx, fallbackItem) {
  item = (item && typeof item === 'object') ? item : {};
  fallbackItem = (fallbackItem && typeof fallbackItem === 'object') ? fallbackItem : {};
  var id = guidedNormalizeRewardArtId(item.id || fallbackItem.id, 'art_' + idx);
  var label = String(item.label || fallbackItem.label || 'Completion art').trim() || 'Completion art';
  return {
    id: id,
    label: label,
    src: item.src ? String(item.src) : (fallbackItem.src ? String(fallbackItem.src) : ''),
    imageKey: item.imageKey ? String(item.imageKey) : (fallbackItem.imageKey ? String(fallbackItem.imageKey) : ''),
    enabled: item.enabled !== false,
    phrases: guidedNormalizeRewardPhrases(item.phrases || fallbackItem.phrases, label),
    uploadedAt: item.uploadedAt || fallbackItem.uploadedAt || null
  };
}
function guidedNormalizeRewardSettings(raw) {
  var fallback = guidedDefaultRewardSettings();
  var settings = (raw && typeof raw === 'object') ? raw : {};
  var savedArt = Array.isArray(settings.art) ? settings.art : [];
  var fallbackById = {};
  fallback.art.forEach(function(item){
    fallbackById[guidedNormalizeRewardArtId(item.id, '')] = item;
  });
  var savedById = {};
  var savedScoreById = {};
  savedArt.forEach(function(item, idx){
    if (!item || typeof item !== 'object') return;
    var id = guidedNormalizeRewardArtId(item.id, 'art_' + idx);
    var score = guidedRewardArtCandidateScore(item, fallbackById[id]);
    if (!savedById[id] || score >= (savedScoreById[id] || 0)) {
      savedById[id] = item;
      savedScoreById[id] = score;
    }
  });
  var defaultIds = {};
  var art = fallback.art.map(function(defaultItem, idx){
    var id = guidedNormalizeRewardArtId(defaultItem.id, '');
    defaultIds[id] = true;
    return guidedNormalizeRewardArtItem(savedById[id] || defaultItem, idx, defaultItem);
  });
  savedArt.forEach(function(item, idx){
    if (!item || typeof item !== 'object') return;
    var id = guidedNormalizeRewardArtId(item.id, 'art_' + idx);
    if (!id || defaultIds[id]) return;
    if (savedById[id] !== item) return;
    var normalized = guidedNormalizeRewardArtItem(item, art.length + idx, null);
    if (normalized.src || normalized.imageKey) art.push(normalized);
  });
  return {
    version: 1,
    rewardTable: guidedNormalizeRewardTable(settings.rewardTable || {}, fallback),
    art: art,
    updatedAt: settings.updatedAt || Date.now()
  };
}
function guidedRewardSettings() {
  if (guidedRewardSettingsCache) return guidedRewardSettingsCache;
  var parsed = null;
  try {
    var raw = localStorage.getItem(GUIDED_REWARDS_STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch(e) {}
  guidedRewardSettingsCache = guidedNormalizeRewardSettings(parsed);
  if (parsed && Array.isArray(parsed.art) && parsed.art.length !== guidedRewardSettingsCache.art.length) {
    guidedPersistRewardSettings(guidedRewardSettingsCache);
  }
  return guidedRewardSettingsCache;
}
function guidedPersistRewardSettings(settings) {
  var payload = JSON.stringify(settings);
  var localOk = safeSetLocalStorage(GUIDED_REWARDS_STORAGE_KEY, payload, 'Guided reward settings', { quiet: guidedIndexedDbAvailable() });
  if (guidedIndexedDbAvailable()) {
    guidedWriteAppValueToIndexedDb(GUIDED_REWARDS_DB_KEY, payload).catch(function(){
      if (!localOk) notifyStorageFailure('Guided reward settings');
    });
  } else if (!localOk) {
    notifyStorageFailure('Guided reward settings');
  }
  return localOk;
}
function guidedSaveRewardSettings(settings) {
  guidedRewardSettingsCache = guidedNormalizeRewardSettings(settings);
  guidedRewardSettingsCache.updatedAt = Date.now();
  guidedRewardArtWarmupSignature = '';
  guidedPersistRewardSettings(guidedRewardSettingsCache);
  guidedScheduleRewardArtWarmup({ force: true });
  return guidedRewardSettingsCache;
}
function guidedRewardBandForScore(scorePct) {
  scorePct = Number(scorePct || 0);
  if (scorePct >= 100) return 'perfect';
  if (scorePct >= 80) return 'strong';
  if (scorePct >= 60) return 'pass';
  return 'low';
}
function guidedRewardBandLabel(band) {
  return band === 'perfect' ? 'Perfect'
    : band === 'strong' ? 'Strong'
    : band === 'pass' ? 'Complete'
    : 'Finished';
}
function guidedSimpleHash(value) {
  var str = String(value || '');
  var hash = 0;
  for (var i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
function guidedRewardArtStorageKey(id) {
  return GUIDED_REWARD_ART_DB_PREFIX + String(id || '');
}
function guidedRewardArtSource(item) {
  if (!item) return '';
  if (item.src) return item.src;
  if (!item.imageKey) return '';
  if (guidedRewardArtDataCache[item.imageKey]) return guidedRewardArtDataCache[item.imageKey];
  if (!guidedRewardArtLoading[item.imageKey]) {
    guidedRewardArtLoading[item.imageKey] = true;
    guidedReadAppValueFromIndexedDb(item.imageKey).then(function(value){
      if (value) guidedRewardArtDataCache[item.imageKey] = String(value);
    }).catch(function(){}).then(function(){
      guidedRewardArtLoading[item.imageKey] = false;
      if (guidedState && (guidedState.screen === GUIDED_SCREEN_NODE_SUMMARY || guidedState.screen === GUIDED_SCREEN_AUTHOR_TOOLS)) renderGuidedView();
    });
  }
  return '';
}
function guidedDecodeRewardImageSource(src) {
  if (!src || guidedRewardImageDecodeCache[src]) return guidedRewardImageDecodeCache[src] || Promise.resolve();
  var promise = Promise.resolve();
  try {
    var img = new Image();
    img.decoding = 'async';
    img.src = src;
    if (img.decode) promise = img.decode().catch(function(){});
  } catch(e) {
    promise = Promise.resolve();
  }
  guidedRewardImageDecodeCache[src] = promise;
  return promise;
}
function guidedPreloadRewardArt(item, options) {
  if (!item) return Promise.resolve('');
  if (item.src) return guidedDecodeRewardImageSource(item.src).then(function(){ return item.src; });
  if (!item.imageKey) return Promise.resolve('');
  if (typeof guidedReadAppValueFromIndexedDb !== 'function') return Promise.resolve('');
  if (guidedRewardArtDataCache[item.imageKey]) {
    return guidedDecodeRewardImageSource(guidedRewardArtDataCache[item.imageKey]).then(function(){
      return guidedRewardArtDataCache[item.imageKey];
    });
  }
  if (guidedRewardArtPreloadPromises[item.imageKey]) return guidedRewardArtPreloadPromises[item.imageKey];
  guidedRewardArtLoading[item.imageKey] = true;
  guidedRewardArtPreloadPromises[item.imageKey] = guidedReadAppValueFromIndexedDb(item.imageKey)
    .then(function(value){
      if (value) {
        guidedRewardArtDataCache[item.imageKey] = String(value);
        return guidedDecodeRewardImageSource(guidedRewardArtDataCache[item.imageKey]).then(function(){
          return guidedRewardArtDataCache[item.imageKey];
        });
      }
      return '';
    })
    .catch(function(){ return ''; })
    .then(function(value){
      guidedRewardArtLoading[item.imageKey] = false;
      delete guidedRewardArtPreloadPromises[item.imageKey];
      if (options && options.renderWhenReady && guidedState && (guidedState.screen === GUIDED_SCREEN_NODE_SUMMARY || guidedState.screen === GUIDED_SCREEN_AUTHOR_TOOLS) && typeof renderGuidedView === 'function') {
        renderGuidedView();
      }
      return value || '';
    });
  return guidedRewardArtPreloadPromises[item.imageKey];
}
function guidedPreloadRewardArtForSession(session) {
  var key = session && (session.rewardAttemptId || session.nodeId);
  if (!key) return;
  ['perfect', 'strong', 'pass', 'low'].forEach(function(band){
    guidedPreloadRewardArt(guidedSelectRewardArt(band, key), { renderWhenReady: true });
  });
}
function guidedRewardArtWarmupKey(item) {
  if (!item) return '';
  return [
    item.id || '',
    item.enabled === false ? 'off' : 'on',
    item.src || '',
    item.imageKey || '',
    item.uploadedAt || ''
  ].join(':');
}
function guidedWarmRewardArtPool(options) {
  options = options || {};
  var settings = guidedRewardSettings();
  var pool = (settings.art || []).filter(function(item){
    return item && item.enabled !== false && (item.src || item.imageKey);
  });
  if (!pool.length) return Promise.resolve([]);
  var signature = pool.map(guidedRewardArtWarmupKey).join('|');
  if (!options.force && signature && signature === guidedRewardArtWarmupSignature) return Promise.resolve([]);
  guidedRewardArtWarmupSignature = signature;
  var limit = Math.max(1, Number(options.limit) || 24);
  var items = pool.slice(0, limit);
  var jobs = items.map(function(item){
    return guidedPreloadRewardArt(item, { renderWhenReady: true }).catch(function(){ return ''; });
  });
  return Promise.all(jobs);
}
function guidedScheduleRewardArtWarmup(options) {
  options = options || {};
  if (guidedRewardArtWarmupScheduled) return;
  guidedRewardArtWarmupScheduled = true;
  var run = function(){
    guidedRewardArtWarmupScheduled = false;
    guidedWarmRewardArtPool(options);
  };
  if (!options.immediate && typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 1200 });
  } else {
    setTimeout(run, Math.max(0, Number(options.delayMs) || 0));
  }
}
function guidedSelectRewardArt(scoreBand, key) {
  var settings = guidedRewardSettings();
  var pool = (settings.art || []).filter(function(item){ return item && item.enabled !== false; });
  if (!pool.length) pool = (settings.art || []).filter(Boolean);
  if (!pool.length) return null;
  return pool[guidedSimpleHash(String(scoreBand || '') + ':' + String(key || '')) % pool.length];
}
function guidedSelectRewardPhrase(art, scoreBand, key) {
  if (!art || !art.phrases) return '';
  var list = art.phrases[scoreBand] || [];
  if (!list.length) return '';
  return list[guidedSimpleHash(String(key || '') + ':' + art.id + ':' + scoreBand) % list.length];
}

// Guided completion reward ledger and award helpers
function guidedEnsureCompletionRewardLedger() {
  if (!gd.guidedNodeRewards || typeof gd.guidedNodeRewards !== 'object') gd.guidedNodeRewards = {};
  if (!gd.guidedNodeRewards.nodes || typeof gd.guidedNodeRewards.nodes !== 'object') gd.guidedNodeRewards.nodes = {};
  if (!gd.guidedNodeRewards.attempts || typeof gd.guidedNodeRewards.attempts !== 'object') gd.guidedNodeRewards.attempts = {};
  return gd.guidedNodeRewards;
}
function guidedRewardAmountsForSummary(summary, repeat) {
  var settings = guidedRewardSettings();
  var band = guidedRewardBandForScore(summary && summary.scorePct);
  var mode = repeat ? 'repeat' : 'first';
  var row = settings.rewardTable && settings.rewardTable[mode] && settings.rewardTable[mode][band] || { xp: 0, shekels: 0 };
  return {
    band: band,
    mode: mode,
    xp: guidedNormalizeRewardAmount(row.xp, 0),
    shekels: guidedNormalizeRewardAmount(row.shekels, 0)
  };
}
function guidedDecorateCompletionSummary(summary, rewardRecord) {
  summary = summary || {};
  var band = rewardRecord && rewardRecord.band || guidedRewardBandForScore(summary.scorePct);
  var art = guidedSelectRewardArt(band, summary.rewardAttemptId || summary.nodeId || '');
  summary.scoreBand = band;
  summary.scoreBandLabel = guidedRewardBandLabel(band);
  if (art) {
    summary.rewardArtId = art.id;
    summary.rewardArtLabel = art.label;
    summary.rewardPhrase = guidedSelectRewardPhrase(art, band, summary.rewardAttemptId || summary.nodeId || '');
  }
  return summary;
}
function guidedApplyNodeCompletionRewards(summary, session) {
  summary = summary || {};
  var ledger = guidedEnsureCompletionRewardLedger();
  var attemptId = summary.rewardAttemptId || (session && session.rewardAttemptId) || (summary.nodeId + ':' + Date.now());
  summary.rewardAttemptId = attemptId;
  if (ledger.attempts[attemptId]) {
    summary.reward = Object.assign({}, ledger.attempts[attemptId], { alreadyApplied: true });
    summary.streakExtended = !!ledger.attempts[attemptId].streakExtended;
    summary.streakCount = ledger.attempts[attemptId].streakCount || gd.streak || 0;
    return guidedDecorateCompletionSummary(summary, summary.reward);
  }
  var nodeKey = String(summary.nodeId || 'guided_node');
  var nodeLedger = ledger.nodes[nodeKey] || { completionCount: 0, totalXp: 0, totalShekels: 0 };
  var repeat = (nodeLedger.completionCount || 0) > 0;
  var reward = guidedRewardAmountsForSummary(summary, repeat);
  var streakResult = touchStreak() || { extendedToday: false, streak: gd.streak || 0 };
  gd.xp = (Number(gd.xp) || 0) + reward.xp;
  gd.shekels = (Number(gd.shekels) || 0) + reward.shekels;
  var newBadges = checkBadges();
  var record = {
    attemptId: attemptId,
    nodeId: nodeKey,
    band: reward.band,
    mode: reward.mode,
    repeat: repeat,
    xp: reward.xp,
    shekels: reward.shekels,
    scorePct: summary.scorePct || 0,
    streakExtended: !!streakResult.extendedToday,
    streakCount: streakResult.streak || gd.streak || 0,
    newBadges: newBadges,
    awardedAt: Date.now()
  };
  nodeLedger.completionCount = (nodeLedger.completionCount || 0) + 1;
  nodeLedger.totalXp = (nodeLedger.totalXp || 0) + reward.xp;
  nodeLedger.totalShekels = (nodeLedger.totalShekels || 0) + reward.shekels;
  nodeLedger.lastCompletedAt = record.awardedAt;
  nodeLedger.lastScorePct = record.scorePct;
  ledger.nodes[nodeKey] = nodeLedger;
  ledger.attempts[attemptId] = record;
  saveGameDataImmediate();
  renderHomeGamification();
  summary.reward = record;
  summary.streakExtended = record.streakExtended;
  summary.streakCount = record.streakCount;
  return guidedDecorateCompletionSummary(summary, record);
}

// Guided Author Tools Rewards tab
function guidedAuthorRewardBandKeys() {
  return ['perfect', 'strong', 'pass', 'low'];
}
function guidedAuthorRewardModeKeys() {
  return ['first', 'repeat'];
}
function guidedAuthorRewardModeLabel(mode) {
  return mode === 'repeat' ? 'Repeat completion' : 'First completion';
}
function guidedAuthorRewardSetAmount(mode, band, field, value, skipRender) {
  var settings = guidedRewardSettings();
  if (guidedAuthorRewardModeKeys().indexOf(mode) === -1 || guidedAuthorRewardBandKeys().indexOf(band) === -1 || ['xp', 'shekels'].indexOf(field) === -1) return;
  if (!settings.rewardTable[mode]) settings.rewardTable[mode] = {};
  if (!settings.rewardTable[mode][band]) settings.rewardTable[mode][band] = { xp: 0, shekels: 0 };
  settings.rewardTable[mode][band][field] = guidedNormalizeRewardAmount(value, 0);
  guidedSaveRewardSettings(settings);
  if (!skipRender) renderGuidedView();
}
function guidedAuthorRewardFindArt(settings, id) {
  return (settings.art || []).find(function(item){ return item && item.id === id; }) || null;
}
function guidedAuthorRewardSetArtEnabled(id, checked) {
  var settings = guidedRewardSettings();
  var item = guidedAuthorRewardFindArt(settings, id);
  if (!item) return;
  item.enabled = !!checked;
  guidedSaveRewardSettings(settings);
  renderGuidedView();
}
function guidedAuthorRewardSetArtLabel(id, value, skipRender) {
  var settings = guidedRewardSettings();
  var item = guidedAuthorRewardFindArt(settings, id);
  if (!item) return;
  item.label = String(value || '').trim() || 'Completion art';
  guidedSaveRewardSettings(settings);
  if (!skipRender) renderGuidedView();
}
function guidedAuthorRewardSetArtPhrases(id, band, value, skipRender) {
  var settings = guidedRewardSettings();
  var item = guidedAuthorRewardFindArt(settings, id);
  if (!item || guidedAuthorRewardBandKeys().indexOf(band) === -1) return;
  if (!item.phrases) item.phrases = {};
  item.phrases[band] = String(value || '').split(/\n+/).map(function(line){ return line.trim(); }).filter(Boolean);
  if (!item.phrases[band].length) item.phrases[band] = guidedRewardDefaultPhrases(item.label || '')[band];
  guidedSaveRewardSettings(settings);
  if (!skipRender) renderGuidedView();
}
function guidedAuthorRewardRemoveArt(id) {
  var settings = guidedRewardSettings();
  var item = guidedAuthorRewardFindArt(settings, id);
  settings.art = (settings.art || []).filter(function(entry){ return entry && entry.id !== id; });
  guidedSaveRewardSettings(settings);
  if (item && item.imageKey) guidedDeleteAppValueFromIndexedDb(item.imageKey).catch(function(){});
  renderGuidedView();
}
function guidedAuthorRewardsUploadImage(input) {
  var file = input && input.files && input.files[0];
  if (input) input.value = '';
  if (!file) return;
  if (['image/png', 'image/webp'].indexOf(file.type) === -1) {
    if (typeof showXpToast === 'function') showXpToast('Use a PNG or WebP image.');
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    if (typeof showXpToast === 'function') showXpToast('Completion art must be 4 MB or smaller.');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(){
    var dataUrl = String(reader.result || '');
    var img = new Image();
    img.onload = function(){
      if (Math.abs(img.width - img.height) > 2) {
        if (typeof showXpToast === 'function') showXpToast('Use square completion art.');
        return;
      }
      var id = 'custom_' + Date.now().toString(36);
      var imageKey = guidedRewardArtStorageKey(id);
      guidedWriteAppValueToIndexedDb(imageKey, dataUrl).then(function(){
        guidedRewardArtDataCache[imageKey] = dataUrl;
        var label = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Completion art';
        var settings = guidedRewardSettings();
        settings.art.push({
          id: id,
          label: label,
          imageKey: imageKey,
          enabled: true,
          phrases: guidedRewardDefaultPhrases(label),
          uploadedAt: Date.now()
        });
        guidedSaveRewardSettings(settings);
        renderGuidedView();
      }).catch(function(){
        if (typeof showXpToast === 'function') showXpToast('Could not save completion art.');
      });
    };
    img.onerror = function(){
      if (typeof showXpToast === 'function') showXpToast('Could not read that image.');
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}
function guidedAuthorRenderRewardTable(settings) {
  return '<div class="guided-reward-table">'
    + guidedAuthorRewardModeKeys().map(function(mode){
      return '<div class="guided-reward-mode">'
        + '<div class="guided-reward-mode-head">'
          + '<div><div class="guided-section-kicker">' + guidedEsc(guidedAuthorRewardModeLabel(mode)) + '</div><div class="guided-card-sub">' + guidedEsc(mode === 'first' ? 'Used the first time a learner completes a node.' : 'Used when a learner repeats an already completed node.') + '</div></div>'
        + '</div>'
        + guidedAuthorRewardBandKeys().map(function(band){
          var row = settings.rewardTable[mode][band];
          return '<div class="guided-reward-row">'
            + '<div><strong>' + guidedEsc(guidedRewardBandLabel(band)) + '</strong><span>' + guidedEsc(band === 'perfect' ? '100%' : band === 'strong' ? '80-99%' : band === 'pass' ? '60-79%' : 'Below 60%') + '</span></div>'
            + '<label>XP<input type="number" min="0" max="999" value="' + guidedEsc(row.xp) + '" oninput="guidedAuthorRewardSetAmount(\'' + guidedEsc(mode) + '\',\'' + guidedEsc(band) + '\',\'xp\',this.value,true)" onchange="guidedAuthorRewardSetAmount(\'' + guidedEsc(mode) + '\',\'' + guidedEsc(band) + '\',\'xp\',this.value)"></label>'
            + '<label>Shekels<input type="number" min="0" max="999" value="' + guidedEsc(row.shekels) + '" oninput="guidedAuthorRewardSetAmount(\'' + guidedEsc(mode) + '\',\'' + guidedEsc(band) + '\',\'shekels\',this.value,true)" onchange="guidedAuthorRewardSetAmount(\'' + guidedEsc(mode) + '\',\'' + guidedEsc(band) + '\',\'shekels\',this.value)"></label>'
            + '</div>';
        }).join('')
      + '</div>';
    }).join('')
    + '</div>';
}
function guidedAuthorRenderRewardArtCard(item) {
  var src = guidedRewardArtSource(item);
  return '<div class="guided-reward-art-card">'
    + '<div class="guided-reward-art-preview">' + (src ? '<img src="' + guidedEsc(src) + '" alt="' + guidedEsc(item.label || 'Completion art') + '">' : '<span>Loading art</span>') + '</div>'
    + '<div class="guided-reward-art-fields">'
      + '<label class="guided-author-check"><input type="checkbox"' + (item.enabled === false ? '' : ' checked') + ' onchange="guidedAuthorRewardSetArtEnabled(\'' + guidedEsc(item.id) + '\',this.checked)"> Enabled</label>'
      + '<label>Label<input value="' + guidedEsc(item.label || '') + '" maxlength="60" oninput="guidedAuthorRewardSetArtLabel(\'' + guidedEsc(item.id) + '\',this.value,true)" onchange="guidedAuthorRewardSetArtLabel(\'' + guidedEsc(item.id) + '\',this.value)"></label>'
      + '<div class="guided-reward-phrase-grid">'
      + guidedAuthorRewardBandKeys().map(function(band){
          return '<label>' + guidedEsc(guidedRewardBandLabel(band)) + ' phrases<textarea rows="2" oninput="guidedAuthorRewardSetArtPhrases(\'' + guidedEsc(item.id) + '\',\'' + guidedEsc(band) + '\',this.value,true)" onchange="guidedAuthorRewardSetArtPhrases(\'' + guidedEsc(item.id) + '\',\'' + guidedEsc(band) + '\',this.value)">' + guidedEsc((item.phrases && item.phrases[band] || []).join('\n')) + '</textarea></label>';
        }).join('')
      + '</div>'
      + (item.imageKey ? '<button class="btn btn-soft" onclick="guidedAuthorRewardRemoveArt(\'' + guidedEsc(item.id) + '\')">Remove uploaded art</button>' : '')
    + '</div>'
    + '</div>';
}
function guidedAuthorRenderRewardsTab() {
  var settings = guidedRewardSettings();
  var enabledCount = (settings.art || []).filter(function(item){ return item && item.enabled !== false; }).length;
  return ''
	    + '<div class="guided-card guided-author-start-card guided-reward-start-card">'
	    +   '<div class="guided-kicker">Rewards</div>'
	    +   '<div class="guided-card-title">' + guidedAuthorHelpTitle('Tune completion rewards', 'rewards-art-storage', 'This screen controls the little reward moment shown after Guided nodes finish. Uploaded reward art is stored inside the browser, not inside a sidecar JSON file. The labels, phrases, enabled state, XP amounts, and Shekel amounts are also browser-local reward settings. Changing these settings affects the reward screen, but it does not rewrite deck cards, sidecar questions, or map data. Use this area when you want to tune the feel of completion, not the learning content itself.') + '</div>'
	    +   '<div class="guided-card-sub">Control what learners see after a Guided node: the image, phrase, XP, and Shekels.</div>'
    +   '<div class="guided-progress-row"><span class="guided-progress-pill">' + guidedEsc(String((settings.art || []).length)) + ' images</span><span class="guided-progress-pill">' + guidedEsc(String(enabledCount)) + ' enabled</span><span class="guided-progress-pill">PNG/WebP, square, 4 MB max</span></div>'
    + '</div>'
    + '<div class="guided-card guided-reward-upload-card">'
    +   '<div><div class="guided-section-kicker">Add reward art</div><div class="guided-card-sub">Use square PNG or WebP art. Transparent images usually sit best on the completion screen.</div></div>'
    +   '<button class="btn btn-gold" onclick="document.getElementById(\'guided-reward-art-upload\').click()">Choose image</button>'
    +   '<input id="guided-reward-art-upload" type="file" accept="image/png,image/webp" style="display:none" onchange="guidedAuthorRewardsUploadImage(this)">'
    + '</div>'
    + '<div class="guided-card guided-reward-panel-card"><div class="guided-reward-section-head"><div><div class="guided-section-kicker">Reward amounts</div><div class="guided-card-sub">Set the points paid for each completion result.</div></div></div>' + guidedAuthorRenderRewardTable(settings) + '</div>'
    + '<div class="guided-card guided-reward-panel-card"><div class="guided-reward-section-head"><div><div class="guided-section-kicker">Art and phrases</div><div class="guided-card-sub">Enable images, rename them, and edit the phrases used by score band.</div></div></div><div class="guided-reward-art-list">' + (settings.art || []).map(guidedAuthorRenderRewardArtCard).join('') + '</div></div>';
}

// Guided completion summary reward presentation helpers
function guidedCompletionSummaryHeadline(summary) {
  if (!summary) return 'Node complete';
  if ((summary.scorePct || 0) >= 100) return 'Perfect lesson!';
  if ((summary.scorePct || 0) >= 80) return 'Strong finish!';
  return 'Node complete';
}
function guidedCompletionArtForSummary(summary) {
  var settings = guidedRewardSettings();
  var artId = summary && summary.rewardArtId;
  var art = artId ? (settings.art || []).find(function(item){ return item.id === artId; }) : null;
  return art || guidedSelectRewardArt(summary && summary.scoreBand, summary && (summary.rewardAttemptId || summary.nodeId));
}
function guidedRenderCompletionArt(summary) {
  var art = guidedCompletionArtForSummary(summary);
  var src = guidedRewardArtSource(art);
  if (!src) return '<div class="guided-completion-art guided-completion-art-placeholder"><span>Completion art</span></div>';
  return '<div class="guided-completion-art"><img src="' + guidedEsc(src) + '" alt="' + guidedEsc((art && art.label) || 'Completion art') + '" loading="eager" decoding="sync" fetchpriority="high" onerror="guidedHandleCompletionArtError(this)"></div>';
}
function guidedHandleCompletionArtError(img) {
  var frame = img && img.closest ? img.closest('.guided-completion-art') : null;
  if (frame) frame.classList.add('is-missing');
  if (img && img.remove) img.remove();
}
function guidedRenderCompletionMetric(label, value, tone) {
  return '<div class="guided-completion-metric is-' + guidedEsc(tone || 'blue') + '"><div class="guided-completion-metric-label">' + guidedEsc(label) + '</div><div class="guided-completion-metric-value">' + guidedEsc(value) + '</div></div>';
}
