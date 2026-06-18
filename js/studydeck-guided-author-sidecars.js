// StudyDeck Guided Author Tools sidecar workflow helpers.
// Loaded before app.js by index.html; intentionally uses classic-script globals.
// Owns active sidecar storage, runtime sidecar overlays, sidecar validation/load/save, and Review Edits apply/export.

var guidedAuthorSidecarValidationReport = null;
var guidedAuthorSidecarPasteText = '';
var guidedAuthorValidatedSidecarObject = null;
var guidedAuthorSidecarJustSavedId = '';
var guidedAuthorSidecarJustSavedAt = 0;
var GUIDED_SIDECAR_SNAPSHOT_STORAGE_KEY = 'studydeck_guided_sidecar_snapshot_v1';
var guidedAuthorSidecarSnapshotTargetId = '';
var guidedAuthorSidecarWorkspaceId = '';
var guidedAuthorSidecarLibrarySearch = '';
var guidedAuthorSidecarLibraryFilter = 'all';
var guidedAuthorSidecarSourceLoaderOpen = false;
var guidedAuthorReturnedSidecarOpen = false;
var guidedAuthorReturnedSidecarPasteText = '';
var guidedAuthorReturnedSidecarObject = null;
var guidedAuthorReturnedSidecarReport = null;
var guidedAuthorReturnedSidecarSourceName = '';
var GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INITIAL = 12;
var GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INCREMENT = 12;
var guidedAuthorSidecarLibraryLimit = GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INITIAL;
var guidedAuthorSaveFlowStatus = null;
var guidedAuthorSaveFlowStatusTimer = null;

// Sidecar load/save UI and status panels.
function guidedAuthorDefaultDraftPatch() {
  return {
    version: 1,
    updatedAt: null,
    cardEdits: {},
    questionEdits: {},
    briefingEdits: {},
    eventStructureEdits: {},
    mapEdits: {}
  };
}

function guidedAuthorLoadDraftPatch() {
  try {
    var raw = localStorage.getItem(GUIDED_AUTHOR_DRAFT_KEY);
    if (!raw) return guidedAuthorDefaultDraftPatch();
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return guidedAuthorDefaultDraftPatch();
    if (!parsed.cardEdits || typeof parsed.cardEdits !== 'object') parsed.cardEdits = {};
    if (!parsed.questionEdits || typeof parsed.questionEdits !== 'object') parsed.questionEdits = {};
    if (!parsed.briefingEdits || typeof parsed.briefingEdits !== 'object') parsed.briefingEdits = {};
    if (!parsed.eventStructureEdits || typeof parsed.eventStructureEdits !== 'object') parsed.eventStructureEdits = {};
    if (!parsed.mapEdits || typeof parsed.mapEdits !== 'object') parsed.mapEdits = {};
    parsed.version = parsed.version || 1;
    return parsed;
  } catch(e) {
    return guidedAuthorDefaultDraftPatch();
  }
}

function guidedSidecarDefaultStore() {
  return {
    version: 1,
    updatedAt: null,
    sidecars: []
  };
}

function guidedLoadSidecarStore() {
  try {
    var raw = localStorage.getItem(GUIDED_SIDECAR_STORAGE_KEY);
    if (!raw) return guidedSidecarDefaultStore();
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return guidedSidecarDefaultStore();
    if (!Array.isArray(parsed.sidecars)) parsed.sidecars = [];
    parsed.version = parsed.version || 1;
    parsed.sidecars = parsed.sidecars.filter(function(sidecar){ return sidecar && typeof sidecar === 'object'; });
    return parsed;
  } catch(e) {
    return guidedSidecarDefaultStore();
  }
}

function guidedSaveSidecarStore() {
  guidedSidecarStore.version = 1;
  guidedSidecarStore.updatedAt = new Date().toISOString();
  var payload = JSON.stringify(guidedSidecarStore);
  if (guidedSidecarStore.sidecars && guidedSidecarStore.sidecars.length) {
    writeCriticalProgressBackup('guided_sidecar_autosave', { includeDecks: false, includeSidecars: true });
  }
  var localOk = safeSetLocalStorage(GUIDED_SIDECAR_STORAGE_KEY, payload, 'Guided sidecars', { quiet: guidedIndexedDbAvailable() });
  if (guidedIndexedDbAvailable()) {
    guidedWriteAppValueToIndexedDb(GUIDED_SIDECAR_DB_KEY, payload).catch(function(){
      if (!localOk) notifyStorageFailure('Guided sidecars');
    });
    return true;
  }
  return localOk;
}

function guidedAuthorSetSaveFlowStatus(kind, title, body, options) {
  guidedAuthorSaveFlowStatus = {
    kind: kind || 'info',
    title: title || 'Action finished',
    body: body || '',
    at: Date.now()
  };
  if (guidedAuthorSaveFlowStatusTimer) clearTimeout(guidedAuthorSaveFlowStatusTimer);
  guidedAuthorSaveFlowStatusTimer = setTimeout(function(){
    guidedAuthorSaveFlowStatus = null;
    if (typeof renderGuidedView === 'function') renderGuidedView();
  }, 10000);
  if (!options || !options.skipRender) {
    if (typeof renderGuidedView === 'function') renderGuidedView();
  }
}

function guidedAuthorClearSaveFlowStatus(options) {
  guidedAuthorSaveFlowStatus = null;
  if (guidedAuthorSaveFlowStatusTimer) clearTimeout(guidedAuthorSaveFlowStatusTimer);
  guidedAuthorSaveFlowStatusTimer = null;
  if (!options || !options.skipRender) {
    if (typeof renderGuidedView === 'function') renderGuidedView();
  }
}

function guidedAuthorReportStatus(report, successTitle, successBody, warningTitle, errorTitle) {
  var totals = report && report.totals || {};
  var errors = Number(totals.errors || 0);
  var warnings = Number(totals.warnings || 0);
  if (errors) {
    return {
      kind: 'error',
      title: errorTitle || 'Validation needs attention',
      body: errors + ' error' + (errors === 1 ? '' : 's') + (warnings ? ' · ' + warnings + ' warning' + (warnings === 1 ? '' : 's') : '') + '. Review the issue list before saving this as active.'
    };
  }
  if (warnings) {
    return {
      kind: 'warning',
      title: warningTitle || 'Loaded with warnings',
      body: warnings + ' warning' + (warnings === 1 ? '' : 's') + '. You can inspect the details before deciding whether to save it as active.'
    };
  }
  return {
    kind: 'success',
    title: successTitle || 'Validation passed',
    body: successBody || 'The loaded sidecar is ready to save as active if this is the version you want to use.'
  };
}

function guidedSidecarClone(value) {
  try { return JSON.parse(JSON.stringify(value == null ? null : value)); } catch(e) { return value; }
}

function guidedSidecarCleanKey(value) {
  return normalizeQuizOptionKey(guidedScholarPlainText(value || ''));
}

function guidedSidecarNormalizeUid(value) {
  return String(value || '').trim().toUpperCase();
}

function guidedSidecarCardUid(card) {
  return guidedSidecarNormalizeUid(card && (card.uid || card.cardUid || card.guidedUid || ''));
}

function guidedSidecarDeckMatches(sidecar, deckId, node) {
  if (!sidecar || !deckId) return !deckId;
  var deck = guidedGetDeckById(deckId);
  var meta = sidecar.__studydeckSidecar || {};
  if (meta.matchedDeckId != null && String(meta.matchedDeckId) === String(deckId)) return true;
  if (sidecar.deckId != null && String(sidecar.deckId) === String(deckId)) return true;
  if (sidecar.targetDeckId != null && String(sidecar.targetDeckId) === String(deckId)) return true;
  var deckName = guidedSidecarCleanKey(deck && deck.name);
  var sidecarDeckName = guidedSidecarCleanKey(sidecar.deckName || sidecar.deck || sidecar.targetDeck || sidecar.sourceDeckName || meta.matchedDeckName || meta.sourceDeckName || '');
  if (deckName && sidecarDeckName && (deckName === sidecarDeckName || deckName.indexOf(sidecarDeckName) !== -1 || sidecarDeckName.indexOf(deckName) !== -1)) return true;
  var categoryId = String(sidecar.deckCategory || sidecar.categoryId || meta.deckCategory || '').trim();
  if (categoryId && node && node.categoryId && String(categoryId) === String(node.categoryId)) return true;
  return !sidecarDeckName && !categoryId && meta.matchedDeckId == null;
}

function guidedSidecarFindEntry(sidecar, card) {
  if (!sidecar || !card) return null;
  var uid = guidedSidecarCardUid(card);
  if (!uid) return null;
  var entries = guidedAuthorSidecarCardEntries(sidecar);
  for (var i = 0; i < entries.length; i += 1) {
    var item = entries[i];
    var entry = item && item.entry || {};
    var entryUid = guidedSidecarNormalizeUid(guidedAuthorSidecarEntryUid(item));
    if (uid && entryUid && entryUid === uid) return entry;
  }
  return null;
}

function guidedGetSidecarEntryForCard(card, deckId, node) {
  if (!card || !guidedSidecarStore || !Array.isArray(guidedSidecarStore.sidecars)) return null;
  for (var i = 0; i < guidedSidecarStore.sidecars.length; i += 1) {
    var sidecar = guidedSidecarStore.sidecars[i];
    if (!guidedSidecarDeckMatches(sidecar, deckId, node)) continue;
    var entry = guidedSidecarFindEntry(sidecar, card);
    if (entry) return {
      sidecar: sidecar,
      entry: entry
    };
  }
  return null;
}

function guidedSidecarMergeObject(base, extra) {
  var out = (base && typeof base === 'object' && !Array.isArray(base)) ? guidedSidecarClone(base) : {};
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return out;
  Object.keys(extra).forEach(function(key){
    var value = extra[key];
    if (value === undefined) return;
    if (value && typeof value === 'object' && !Array.isArray(value) && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = guidedSidecarMergeObject(out[key], value);
    } else {
      out[key] = guidedSidecarClone(value);
    }
  });
  return out;
}

function guidedSidecarGuidedPayload(entry) {
  if (!entry || typeof entry !== 'object') return {};
  var payload = {};
  if (entry.guidedLearning && typeof entry.guidedLearning === 'object') payload = guidedSidecarMergeObject(payload, entry.guidedLearning);
  [
    'exactPassageDetails',
    'learnQuestions',
    'learningQuestions',
    'questions',
    'questionBank',
    'mapLocation',
    'practiceQuestions',
    'challengeQuestions',
    'contentQuestions',
    'scholarQuestions',
    'eventStructure',
    'harmSummary',
    'eventSummary',
    'eventType',
    'ethicalTension',
    'actor',
    'reference',
    'passage',
    'helperCue',
    'rememberThis',
    'whyThisMatters',
    'commonMistake',
    'teachingPrompt'
  ].forEach(function(key){
    if (entry[key] !== undefined) payload[key] = guidedSidecarClone(entry[key]);
  });
  payload.__sidecar = {
    cardUid: entry.cardUid || entry.uid || '',
    titleHint: entry.titleHint || '',
    deckAnswer: entry.deckAnswer || '',
    sourceReference: entry.sourceReference || ''
  };
  return payload;
}

function guidedApplySidecarEntryToCard(card, entry) {
  if (!card || !entry) return card;
  var copy = guidedSidecarClone(card) || {};
  copy.guidedLearning = guidedSidecarMergeObject(copy.guidedLearning || {}, guidedSidecarGuidedPayload(entry));
  return copy;
}

function guidedApplySidecarToCard(card, deckId, node) {
  if (!card) return card;
  var match = guidedGetSidecarEntryForCard(card, deckId, node);
  if (!match || !match.entry) return card;
  var copy = guidedApplySidecarEntryToCard(card, match.entry);
  copy.guidedSidecar = {
    sourceName: (match.sidecar.__studydeckSidecar && match.sidecar.__studydeckSidecar.sourceName) || match.sidecar.title || match.sidecar.name || 'Guided sidecar',
    importedAt: match.sidecar.__studydeckSidecar && match.sidecar.__studydeckSidecar.importedAt || ''
  };
  return copy;
}

function guidedSidecarQuestionTotalsForEntry(entry) {
  entry = entry || {};
  var bankQuestions = guidedAuthorSidecarArrayField(entry, 'questions');
  var hasQuestionBank = bankQuestions.length > 0;
  var learnQuestions = hasQuestionBank ? bankQuestions.filter(function(question){ return guidedQuestionEligibleForNode(guidedQuestionAsCanonicalBankEntry(question), 'learn', ''); }) : guidedAuthorLearnPatchQuestions(entry);
  var practiceQuestions = hasQuestionBank ? bankQuestions.filter(function(question){ return guidedQuestionEligibleForNode(guidedQuestionAsCanonicalBankEntry(question), 'practice', ''); }) : guidedAuthorSidecarArrayField(entry, 'practiceQuestions');
  var challengeQuestions = hasQuestionBank ? bankQuestions.filter(function(question){ return guidedQuestionEligibleForNode(guidedQuestionAsCanonicalBankEntry(question), 'challenge', ''); }) : guidedAuthorSidecarArrayField(entry, 'challengeQuestions');
  var scholarQuestions = hasQuestionBank ? bankQuestions.filter(function(question){ return guidedQuestionIsScholarBonus(guidedQuestionAsCanonicalBankEntry(question)); }) : guidedAuthorSidecarArrayField(entry, 'scholarQuestions');
  var briefingScreens = guidedAuthorSidecarArrayField(entry, 'briefingScreens');
  var eventStructure = guidedAuthorSidecarObjectField(entry, 'eventStructure');
  return {
    bankQuestions: hasQuestionBank ? bankQuestions.length : 0,
    learn: learnQuestions.length,
    practice: practiceQuestions.length,
    challenge: challengeQuestions.length,
    scholar: scholarQuestions.length,
    briefingScreens: briefingScreens.length,
    eventStructure: eventStructure ? 1 : 0,
    total: (hasQuestionBank ? bankQuestions.length : (learnQuestions.length + practiceQuestions.length + challengeQuestions.length + scholarQuestions.length)) + (eventStructure ? 1 : 0)
  };
}

function guidedSidecarContentFingerprint(sidecar) {
  var copy = guidedSidecarClone(sidecar || {}) || {};
  if (copy && typeof copy === 'object') delete copy.__studydeckSidecar;
  var text = '';
  try { text = JSON.stringify(copy); } catch(e) { text = String(sidecar && (sidecar.title || sidecar.name || 'sidecar') || 'sidecar'); }
  var hash = 2166136261;
  for (var i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function guidedSidecarMetaNumber(meta, key, fallback) {
  var value = meta && meta[key];
  return value == null ? fallback : (Number(value || 0) || 0);
}

function guidedSidecarPatternCount(patternCounts, key) {
  return Number((patternCounts || {})[key] || 0) || 0;
}

function guidedSidecarInteractionMixText(counts) {
  var parts = [];
  Object.keys(GUIDED_AUTHOR_INTERACTION_LABELS).forEach(function(type){
    var count = Number((counts || {})[type] || 0) || 0;
    if (count) parts.push(guidedAuthorInteractionLabel(type) + ': ' + count);
  });
  return parts.length ? parts.join(' · ') : 'No interaction mix recorded';
}

function guidedSidecarActiveToastMessage(health) {
  var totals = health && health.totals || {};
  var bits = [
    (totals.matchedCards || 0) + '/' + (totals.sidecarCards || 0) + ' UID matches',
    ((totals.questionBankQuestions || totals.questions || 0) + ' bank questions')
  ];
  if (totals.briefingScreens) bits.push(totals.briefingScreens + ' Briefings');
  if (totals.eventStructures) bits.push(totals.eventStructures + ' Event boards');
  if (totals.scholarQuestions) bits.push(totals.scholarQuestions + ' Scholar');
  if (totals.missingCards) bits.push(totals.missingCards + ' missing');
  return 'Sidecar active: ' + bits.join(' · ');
}

function guidedBuildSidecarHealthReport(sidecar) {
  var meta = sidecar && sidecar.__studydeckSidecar || {};
  var entries = guidedAuthorSidecarCardEntries(sidecar);
  var deckMatch = guidedAuthorFindDeckBySidecar(sidecar || {}, entries);
  var deck = deckMatch && deckMatch.deck || null;
  var deckUidLookup = {};
  if (deck && Array.isArray(deck.cards)) {
    deck.cards.forEach(function(card){
      var uid = guidedSidecarCardUid(card);
      if (uid) deckUidLookup[uid] = card;
    });
  }
  var totals = {
    sidecarCards: entries.length,
    matchedCards: 0,
    missingCards: 0,
    entriesMissingUid: 0,
    entriesWithUidNotFound: 0,
	      learnQuestions: 0,
	      practiceQuestions: 0,
	      challengeQuestions: 0,
	      checkpointQuestions: 0,
	      spiralQuestions: 0,
	      scholarQuestions: 0,
    briefingScreens: 0,
    eventStructures: 0,
    questionBankQuestions: 0,
    questions: 0,
    validationErrors: Number(meta.validationErrors || 0) || 0,
    validationWarnings: Number(meta.validationWarnings || 0) || 0,
    usableQuestions: Number(meta.usableQuestions || 0) || 0,
    genericLearnFallbacks: Number(meta.genericLearnFallbacks || 0) || 0
  };
  var interactionCounts = guidedSidecarClone(meta.interactionCounts || guidedAuthorEmptyInteractionCounts()) || guidedAuthorEmptyInteractionCounts();
  var patternCounts = guidedSidecarClone(meta.patternCounts || {}) || {};
  var missingEntries = [];
  entries.forEach(function(item){
    var entry = item && item.entry || {};
    var uid = guidedSidecarNormalizeUid(guidedAuthorSidecarEntryUid(item));
    var q = guidedSidecarQuestionTotalsForEntry(entry);
    totals.questionBankQuestions += q.bankQuestions;
    totals.learnQuestions += q.learn;
    totals.practiceQuestions += q.practice;
    totals.challengeQuestions += q.challenge;
    totals.scholarQuestions += q.scholar;
    totals.briefingScreens += q.briefingScreens;
    totals.eventStructures += q.eventStructure;
    totals.questions += q.total;
    if (!uid) {
      totals.entriesMissingUid += 1;
      totals.missingCards += 1;
      missingEntries.push({ uid: '', titleHint: entry.titleHint || '', reason: 'missing_uid' });
      return;
    }
    if (deck && deckUidLookup[uid]) {
      totals.matchedCards += 1;
      return;
    }
    totals.entriesWithUidNotFound += 1;
    totals.missingCards += 1;
    missingEntries.push({ uid: uid, titleHint: entry.titleHint || entry.deckAnswer || '', reason: deck ? 'uid_not_found' : 'deck_not_found' });
  });
  var validationReport = null;
  try {
    validationReport = guidedAuthorValidateSidecarObject(sidecar || {}, meta.sourceName || sidecar && (sidecar.title || sidecar.name) || 'Stored sidecar');
    if (validationReport && validationReport.totals) {
      totals.validationErrors = Number(validationReport.totals.errors || 0) || 0;
      totals.validationWarnings = Number(validationReport.totals.warnings || 0) || 0;
      totals.usableQuestions = Number(validationReport.totals.usableQuestions || 0) || 0;
      totals.briefingScreens = Number(validationReport.totals.briefingScreens || totals.briefingScreens || 0) || 0;
      interactionCounts = guidedSidecarClone(validationReport.interactionCounts || interactionCounts) || interactionCounts;
      patternCounts = guidedSidecarClone(validationReport.patternCounts || patternCounts) || patternCounts;
      totals.genericLearnFallbacks = guidedSidecarPatternCount(patternCounts, 'generic_card_match');
    }
  } catch(e) {}
  var status = 'ok';
  if (!deck || totals.missingCards || totals.validationErrors) status = 'error';
  else if (totals.validationWarnings) status = 'warning';
  return {
    sidecar: sidecar,
    meta: meta,
    title: meta.sourceName || sidecar && (sidecar.title || sidecar.name || sidecar.deckName || sidecar.deck) || 'Guided sidecar',
    sourceDeckName: meta.sourceDeckName || sidecar && (sidecar.sourceDeckName || sidecar.deckName || sidecar.deck || sidecar.targetDeck) || '',
    sourceTranslation: meta.sourceTranslation || sidecar && (sidecar.sourceTranslation || sidecar.translation || '') || '',
    uidPolicy: meta.createdForDeckUidPolicy || sidecar && sidecar.createdForDeckUidPolicy || 'cardUid',
    matchedDeck: deck ? { id: deck.id, name: deck.name, cardCount: (deck.cards || []).length, reason: deckMatch.reason, score: deckMatch.score || null } : null,
    importedAt: meta.savedAt || meta.importedAt || '',
    contentFingerprint: meta.contentFingerprint || guidedSidecarContentFingerprint(sidecar),
    interactionCounts: interactionCounts,
    patternCounts: patternCounts,
    deckCategory: meta.deckCategory || sidecar && (sidecar.deckCategory || sidecar.categoryId || '') || '',
    totals: totals,
    missingEntries: missingEntries,
    validationReport: validationReport,
    status: status
  };
}

function guidedSidecarHealthMatchesDeck(health, deck) {
  if (!health || !deck) return false;
  if (health.matchedDeck && String(health.matchedDeck.id) === String(deck.id)) return true;
  return guidedSidecarDeckMatches(health.sidecar, deck.id, { categoryId: health.deckCategory || '' });
}

function guidedBuildSidecarCompatibilitySummary(deck) {
  var sidecars = guidedSidecarStore && Array.isArray(guidedSidecarStore.sidecars) ? guidedSidecarStore.sidecars : [];
  var reports = sidecars.map(guidedBuildSidecarHealthReport).filter(function(health){
    return deck ? guidedSidecarHealthMatchesDeck(health, deck) : true;
  });
  if (!reports.length) return null;
  var totals = reports.reduce(function(out, health){
    var t = health.totals || {};
    out.sidecars += 1;
    out.sidecarCards += Number(t.sidecarCards || 0) || 0;
    out.matchedCards += Number(t.matchedCards || 0) || 0;
    out.missingCards += Number(t.missingCards || 0) || 0;
    out.validationErrors += Number(t.validationErrors || 0) || 0;
    out.validationWarnings += Number(t.validationWarnings || 0) || 0;
    return out;
  }, { sidecars: 0, sidecarCards: 0, matchedCards: 0, missingCards: 0, validationErrors: 0, validationWarnings: 0 });
  var ok = totals.missingCards === 0 && totals.validationErrors === 0;
  var label = totals.sidecars === 1 ? 'Active browser sidecar' : 'Active browser sidecars';
  var message = ok
    ? label + ' still matches ' + totals.matchedCards + '/' + totals.sidecarCards + ' cards'
    : label + ' needs review: ' + totals.missingCards + ' card' + (totals.missingCards === 1 ? '' : 's') + ' missing';
  if (!ok && totals.validationErrors) message += ' · ' + totals.validationErrors + ' validation error' + (totals.validationErrors === 1 ? '' : 's');
  return {
    reports: reports,
    totals: totals,
    ok: ok,
    message: message
  };
}

function guidedShowSidecarCompatibilityToast(deck, prefix) {
  var summary = guidedBuildSidecarCompatibilitySummary(deck || null);
  if (!summary || typeof showXpToast !== 'function') return false;
  showXpToast((prefix ? prefix + ' ' : '') + summary.message, summary.ok ? 3200 : 5200);
  return true;
}

function guidedAuthorSaveDraftPatch() {
  guidedAuthorDraftPatch.updatedAt = new Date().toISOString();
  return safeSetLocalStorage(GUIDED_AUTHOR_DRAFT_KEY, JSON.stringify(guidedAuthorDraftPatch), 'Guided author drafts');
}

function guidedAuthorCardDraftKey(deckId, cardId) {
  return String(deckId) + '::' + String(cardId);
}

function guidedAuthorQuestionDraftScope(scope) {
  if (!scope) return '';
  if (typeof scope === 'string') return guidedAuthorNormalizeKey(scope);
  return guidedAuthorNormalizeKey(scope.nodeType || scope.scope || scope.view || '');
}

function guidedAuthorQuestionBankDraftId(question) {
  if (!question || !question.questionBankCanonical) return '';
  return String(
    question.contentQuestionKey
    || question.bankQuestionId
    || question.key
    || ''
  ).trim();
}

function guidedAuthorQuestionDraftKey(question, scope) {
  if (!question) return '';
  var bankQuestionId = guidedAuthorQuestionBankDraftId(question);
  if (bankQuestionId) {
    return [
      'question_bank',
      String(question.deckId == null ? '' : question.deckId),
      String(question.cardId == null ? '' : question.cardId),
      bankQuestionId
    ].join('|');
  }
  var scopeKey = guidedAuthorQuestionDraftScope(scope);
  var stableId = question.id
    || question.questionId
    || question.scholarItemId
    || question.contentQuestionKey
    || question.cardRef
    || question.cardId
    || normalizeQuizOptionKey(question.prompt || '');
  var parts = [
    String(question.kind || 'question'),
    String(question.deckId == null ? '' : question.deckId),
    String(question.cardId == null ? '' : question.cardId),
    String(stableId || '')
  ];
  if (scopeKey) parts.unshift(scopeKey);
  return parts.join('|');
}

function guidedAuthorLegacyQuestionDraftKey(question) {
  if (!question) return '';
  return String(question.kind || 'question') + '|' + String(question.id || question.questionId || '');
}

function guidedAuthorQuestionDraftCandidateKeys(question, scope) {
  if (!question) return [];
  var bankKey = guidedAuthorQuestionDraftKey(question, scope);
  if (guidedAuthorQuestionBankDraftId(question)) return bankKey ? [bankKey] : [];
  return guidedDedupStrings([
    bankKey,
    guidedAuthorQuestionDraftKey(question),
    guidedAuthorLegacyQuestionDraftKey(question)
  ].filter(Boolean));
}

function guidedAuthorDraftMatchesQuestion(edit, question) {
  if (!edit || !question) return false;
  if (edit.interactionType && question.interactionType && guidedNormalizeChallengeInteractionType(edit.interactionType) !== guidedNormalizeChallengeInteractionType(question.interactionType)) {
    return false;
  }
  var bankQuestionId = guidedAuthorQuestionBankDraftId(question);
  if (bankQuestionId && edit.bankQuestionId && String(edit.bankQuestionId) !== bankQuestionId) return false;
  return true;
}

function guidedAuthorDraftLineList(value) {
  if (Array.isArray(value)) {
    return value.map(function(line){ return String(line == null ? '' : line).trim(); }).filter(Boolean);
  }
  return String(value == null ? '' : value)
    .split(/\r?\n/)
    .map(function(line){ return line.trim(); })
    .filter(Boolean);
}

function guidedAuthorEventStructureDraftKey(cardUid) {
  return String(cardUid || '') + '::eventStructure';
}

function guidedAuthorEventStructureCardUid(card, fallbackUid) {
  return String(
    fallbackUid
    || guidedSidecarCardUid(card)
    || card && (card.uid || card.cardUid)
    || ''
  ).trim();
}

function guidedAuthorEventStructureDraftKeyForCard(card, fallbackUid) {
  var uid = guidedAuthorEventStructureCardUid(card, fallbackUid);
  if (uid) return guidedAuthorEventStructureDraftKey(uid);
  if (card && card.id != null) return guidedAuthorEventStructureDraftKey(card.id);
  return '';
}

function guidedAuthorEventStructureDraftKeyForQuestion(question) {
  if (!question) return '';
  var uid = String(question.cardUid || '').trim();
  if (uid) return guidedAuthorEventStructureDraftKey(uid);
  if (question.cardId != null) return guidedAuthorEventStructureDraftKey(question.cardId);
  return '';
}

function guidedAuthorEventStructureEditForCard(card, fallbackUid) {
  var edits = guidedAuthorDraftPatch && guidedAuthorDraftPatch.eventStructureEdits ? guidedAuthorDraftPatch.eventStructureEdits : null;
  if (!edits) return null;
  var key = guidedAuthorEventStructureDraftKeyForCard(card, fallbackUid);
  return key ? edits[key] || null : null;
}

function guidedAuthorEventStructureEditForQuestion(question) {
  var edits = guidedAuthorDraftPatch && guidedAuthorDraftPatch.eventStructureEdits ? guidedAuthorDraftPatch.eventStructureEdits : null;
  if (!edits) return null;
  var key = guidedAuthorEventStructureDraftKeyForQuestion(question);
  return key ? edits[key] || null : null;
}

function guidedAuthorApplyDraftToEventStructure(raw, card, fallbackUid) {
  if (!raw || typeof raw !== 'object') return raw;
  var edit = guidedAuthorEventStructureEditForCard(card, fallbackUid);
  if (!edit) return raw;
  var copy = Object.assign({}, raw);
  ['prompt', 'authority', 'action', 'target', 'reason', 'moralProblem', 'explanation'].forEach(function(key){
    if (Object.prototype.hasOwnProperty.call(edit, key)) copy[key] = guidedLearnBriefingTextFromValue(edit[key]);
  });
  copy.authorDraftEdited = true;
  return copy;
}

function guidedAuthorApplyDraftToEventStructureQuestion(question) {
  if (!question || guidedNormalizeChallengeInteractionType(question.interactionType) !== 'event_structure') return question;
  var edit = guidedAuthorEventStructureEditForQuestion(question);
  if (!edit) return question;
  var copy = Object.assign({}, question);
  var slotValues = {
    authority: edit.authority,
    action: edit.action,
    target: edit.target,
    reason: edit.reason,
    moralProblem: edit.moralProblem
  };
  var slots = GUIDED_ATROCITY_EVENT_STRUCTURE_SLOTS.map(function(spec){
    var answer = guidedLearnBriefingTextFromValue(slotValues[spec.key]);
    return answer ? { key: spec.key, label: spec.label, answer: answer } : null;
  }).filter(Boolean);
  if (Object.prototype.hasOwnProperty.call(edit, 'prompt')) {
    copy.prompt = guidedLearnBriefingTextFromValue(edit.prompt);
    copy.promptHtml = renderMD(copy.prompt || '');
  }
  if (Object.prototype.hasOwnProperty.call(edit, 'explanation')) {
    copy.explanation = guidedLearnBriefingTextFromValue(edit.explanation);
  }
  if (slots.length) {
    copy.eventStructureSlots = slots;
    copy.correctLabel = slots.map(function(slot){ return slot.label + ': ' + slot.answer; }).join('\n');
    copy.options = guidedShuffleWithSeed(slots.map(function(slot){ return slot.answer; }), guidedAuthorEventStructureDraftKeyForQuestion(copy) + ':draft:' + (edit.updatedAt || '')).map(function(label){
      return { label: label, correct: true };
    });
  }
  copy.authorDraftEdited = true;
  return copy;
}

function guidedAuthorClone(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch(e) { return value; }
}

function guidedAuthorCountDraftEdits() {
  return Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.cardEdits) || {}).length
    + Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.questionEdits) || {}).length
    + Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.briefingEdits) || {}).length
    + Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.eventStructureEdits) || {}).length
    + Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.mapEdits) || {}).length;
}

function guidedAuthorContentDraftCount() {
  return Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.cardEdits) || {}).length
    + Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.questionEdits) || {}).length
    + Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.briefingEdits) || {}).length
    + Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.eventStructureEdits) || {}).length
    + Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.mapEdits) || {}).length;
}

function guidedAuthorAnyReviewEditCount() {
  return guidedAuthorContentDraftCount() + guidedNodePolicyLocalEditCount() + guidedNodeFootprintLocalEditCount();
}

function guidedAuthorEnsureSidecarGuidedLearning(entry) {
  if (!entry || typeof entry !== 'object') return {};
  if (!entry.guidedLearning || typeof entry.guidedLearning !== 'object' || Array.isArray(entry.guidedLearning)) entry.guidedLearning = {};
  return entry.guidedLearning;
}

function guidedAuthorFindSidecarEntryByUid(sidecar, uid) {
  uid = guidedSidecarNormalizeUid(uid);
  if (!uid) return null;
  var entries = guidedAuthorSidecarCardEntries(sidecar);
  for (var i = 0; i < entries.length; i += 1) {
    var entryUid = guidedSidecarNormalizeUid(guidedAuthorSidecarEntryUid(entries[i]));
    if (entryUid && entryUid === uid) return entries[i];
  }
  return null;
}

function guidedAuthorCardUidFromDraft(edit) {
  if (!edit) return '';
  var direct = guidedSidecarNormalizeUid(edit.cardUid || edit.uid || edit.cardRef || '');
  if (direct) return direct;
  var card = edit.deckId != null && edit.cardId != null ? guidedGetCardById(edit.deckId, edit.cardId) : null;
  return guidedSidecarCardUid(card);
}

function guidedAuthorFindSidecarQuestionByDraft(sidecar, edit) {
  var bankId = String(edit && (edit.bankQuestionId || edit.questionId || '') || '').trim();
  var wantedUid = guidedAuthorCardUidFromDraft(edit);
  var entries = guidedAuthorSidecarCardEntries(sidecar);
  function findQuestion(ignoreUid) {
    for (var i = 0; i < entries.length; i += 1) {
    var item = entries[i];
    var entryUid = guidedSidecarNormalizeUid(guidedAuthorSidecarEntryUid(item));
    if (!ignoreUid && wantedUid && entryUid && entryUid !== wantedUid) continue;
    var questions = guidedAuthorSidecarArrayField(item.entry, 'questions');
    for (var q = 0; q < questions.length; q += 1) {
      var question = questions[q];
      var id = String(question && (question.id || question.key || '') || '').trim();
      if (bankId && id === bankId) return { entryItem: item, question: question };
    }
  }
    return null;
  }
  return findQuestion(false) || (bankId && wantedUid ? findQuestion(true) : null);
}

function guidedAuthorQuestionSequenceFromDraft(value) {
  return String(value == null ? '' : value)
    .split(/\s*(?:\r?\n|->|→)\s*/g)
    .map(function(item){ return item.trim(); })
    .filter(Boolean);
}

function guidedAuthorApplyQuestionDraftToSidecar(sidecar, key, edit) {
  var match = guidedAuthorFindSidecarQuestionByDraft(sidecar, edit);
  if (!match || !match.question) return false;
  var question = match.question;
  var type = guidedNormalizeChallengeInteractionType(question.interactionType || question.type || edit.interactionType || 'content_choice');
  if (Object.prototype.hasOwnProperty.call(edit, 'prompt')) question.prompt = edit.prompt;
  if (type === 'map_pin_choice') {
    if (Object.prototype.hasOwnProperty.call(edit, 'explanation')) question.explanation = edit.explanation;
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(edit, 'correctLabel')) {
    if (type === 'sequence_order') question.correctOrder = guidedAuthorQuestionSequenceFromDraft(edit.correctLabel);
    else question.answer = edit.correctLabel;
  }
  if (Object.prototype.hasOwnProperty.call(edit, 'distractors')) {
    var lines = guidedAuthorDraftLineList(edit.distractors);
    if (type === 'cloze_drag') {
      var answer = Object.prototype.hasOwnProperty.call(edit, 'correctLabel') ? edit.correctLabel : (question.answer || '');
      question.wordBank = guidedDedupStrings([answer].concat(lines).filter(Boolean));
    } else if (type === 'odd_one_out') {
      question.fittingItems = lines;
    } else if (type !== 'sequence_order') {
      question.distractors = lines;
    }
  }
  if (Object.prototype.hasOwnProperty.call(edit, 'explanation')) question.explanation = edit.explanation;
  return true;
}

function guidedAuthorFindSidecarEntryByBriefingDraft(sidecar, edit) {
  var wantedUid = guidedAuthorCardUidFromDraft(edit);
  var briefingId = String(edit && edit.briefingId || '').trim();
  var entries = guidedAuthorSidecarCardEntries(sidecar);
  for (var i = 0; i < entries.length; i += 1) {
    var item = entries[i];
    var entryUid = guidedSidecarNormalizeUid(guidedAuthorSidecarEntryUid(item));
    if (wantedUid && entryUid && entryUid !== wantedUid) continue;
    var screens = guidedAuthorSidecarArrayField(item.entry, 'briefingScreens');
    if (!briefingId || screens.some(function(screen){ return String(screen && (screen.id || screen.key || '') || '') === briefingId; })) return item;
  }
  return null;
}

function guidedAuthorApplyBriefingDraftToSidecar(sidecar, key, edit) {
  var entryItem = guidedAuthorFindSidecarEntryByBriefingDraft(sidecar, edit);
  if (!entryItem || !entryItem.entry) return false;
  var gl = guidedAuthorEnsureSidecarGuidedLearning(entryItem.entry);
  if (!Array.isArray(gl.briefingScreens)) gl.briefingScreens = guidedAuthorSidecarArrayField(entryItem.entry, 'briefingScreens');
  var briefingId = String(edit.briefingId || '').trim();
  var screen = gl.briefingScreens.find(function(item){ return String(item && (item.id || item.key || '') || '') === briefingId; });
  if (!screen) return false;
  if (Object.prototype.hasOwnProperty.call(edit, 'lines')) screen.lines = guidedAuthorDraftLineList(edit.lines).slice(0, 3);
  if (Object.prototype.hasOwnProperty.call(edit, 'sourceLabel')) screen.sourceLabel = edit.sourceLabel;
  if (Object.prototype.hasOwnProperty.call(edit, 'requiresVisibleEvidence')) screen.requiresVisibleEvidence = guidedAuthorDraftLineList(edit.requiresVisibleEvidence);
  return true;
}

function guidedAuthorFindSidecarEntryByEventDraft(sidecar, edit, key) {
  var wantedUid = guidedAuthorCardUidFromDraft(edit) || String(key || '').split('::')[0];
  var byUid = guidedAuthorFindSidecarEntryByUid(sidecar, wantedUid);
  if (byUid) return byUid;
  var entries = guidedAuthorSidecarCardEntries(sidecar);
  for (var i = 0; i < entries.length; i += 1) {
    if (guidedAuthorSidecarObjectField(entries[i].entry, 'eventStructure')) return entries[i];
  }
  return null;
}

function guidedAuthorApplyEventStructureDraftToSidecar(sidecar, key, edit) {
  var entryItem = guidedAuthorFindSidecarEntryByEventDraft(sidecar, edit, key);
  if (!entryItem || !entryItem.entry) return false;
  var entry = entryItem.entry;
  var gl = guidedAuthorEnsureSidecarGuidedLearning(entry);
  var useTopLevel = entry.eventStructure && typeof entry.eventStructure === 'object' && !gl.eventStructure;
  var target = useTopLevel ? entry.eventStructure : gl.eventStructure;
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    target = guidedSidecarClone(guidedAuthorSidecarObjectField(entry, 'eventStructure') || {});
    if (useTopLevel) entry.eventStructure = target;
    else gl.eventStructure = target;
  }
  ['prompt', 'authority', 'action', 'target', 'reason', 'moralProblem', 'explanation'].forEach(function(field){
    if (Object.prototype.hasOwnProperty.call(edit, field)) target[field] = guidedLearnBriefingTextFromValue(edit[field]);
  });
  return true;
}

function guidedAuthorApplyCardDraftToSidecar(sidecar, key, edit) {
  var uid = guidedAuthorCardUidFromDraft(edit);
  var entryItem = guidedAuthorFindSidecarEntryByUid(sidecar, uid);
  if (!entryItem || !entryItem.entry) return false;
  var entry = entryItem.entry;
  if (Object.prototype.hasOwnProperty.call(edit, 'q')) entry.titleHint = edit.q;
  if (Object.prototype.hasOwnProperty.call(edit, 'a')) {
    entry.deckAnswer = edit.a;
    entry.sourceReference = edit.a;
  }
  var gl = guidedAuthorEnsureSidecarGuidedLearning(entry);
  ['helperCue','rememberThis','whyThisMatters','teachingPrompt','commonMistake'].forEach(function(field){
    if (Object.prototype.hasOwnProperty.call(edit, field)) gl[field] = edit[field];
  });
  return true;
}

function guidedAuthorBuildSidecarWithReviewEdits(sidecar, options) {
  options = options || {};
  var copy = guidedSidecarClone(sidecar || {}) || {};
  var applied = {
    cardEdits: [],
    questionEdits: [],
    briefingEdits: [],
    eventStructureEdits: [],
    mapEdits: [],
    nodePolicy: false,
    nodeFootprint: false
  };
  var missed = [];
  Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.cardEdits) || {}).forEach(function(key){
    if (guidedAuthorApplyCardDraftToSidecar(copy, key, guidedAuthorDraftPatch.cardEdits[key])) applied.cardEdits.push(key);
    else missed.push(key);
  });
  Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.questionEdits) || {}).forEach(function(key){
    if (guidedAuthorApplyQuestionDraftToSidecar(copy, key, guidedAuthorDraftPatch.questionEdits[key])) applied.questionEdits.push(key);
    else missed.push(key);
  });
  Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.briefingEdits) || {}).forEach(function(key){
    if (guidedAuthorApplyBriefingDraftToSidecar(copy, key, guidedAuthorDraftPatch.briefingEdits[key])) applied.briefingEdits.push(key);
    else missed.push(key);
  });
  Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.eventStructureEdits) || {}).forEach(function(key){
    if (guidedAuthorApplyEventStructureDraftToSidecar(copy, key, guidedAuthorDraftPatch.eventStructureEdits[key])) applied.eventStructureEdits.push(key);
    else missed.push(key);
  });
  Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.mapEdits) || {}).forEach(function(key){
    if (guidedAuthorApplyMapDraftToSidecar(copy, key, guidedAuthorDraftPatch.mapEdits[key])) applied.mapEdits.push(key);
    else missed.push(key);
  });
  if (options.includeNodeSettings !== false && guidedNodePolicyLocalEditCount()) {
    copy.guidedNodePolicy = guidedSidecarClone(guidedNodePolicyStore());
    applied.nodePolicy = true;
  }
  if (options.includeNodeSettings !== false && guidedNodeFootprintLocalEditCount()) {
    copy.guidedNodeFootprint = guidedSidecarClone(guidedNodeFootprintStore());
    applied.nodeFootprint = true;
  }
  return { sidecar: copy, applied: applied, missed: missed };
}

function guidedAuthorAppliedReviewEditCount(applied) {
  applied = applied || {};
  return (applied.cardEdits || []).length
    + (applied.questionEdits || []).length
    + (applied.briefingEdits || []).length
    + (applied.eventStructureEdits || []).length
    + (applied.mapEdits || []).length
    + (applied.nodePolicy ? 1 : 0)
    + (applied.nodeFootprint ? 1 : 0);
}

function guidedAuthorClearAppliedReviewEdits(applied) {
  applied = applied || {};
  ['cardEdits', 'questionEdits', 'briefingEdits', 'eventStructureEdits', 'mapEdits'].forEach(function(group){
    (applied[group] || []).forEach(function(key){
      if (guidedAuthorDraftPatch[group]) delete guidedAuthorDraftPatch[group][key];
    });
  });
  guidedAuthorSaveDraftPatch();
  if (applied.nodePolicy) {
    guidedAuthorNodePolicyStore = guidedNodePolicyDefaultStore();
    try { localStorage.removeItem(GUIDED_NODE_POLICY_KEY); } catch(e) {}
    try { localStorage.removeItem(GUIDED_NODE_POLICY_LEGACY_KEY); } catch(e) {}
  }
  if (applied.nodeFootprint) {
    guidedAuthorNodeFootprintStore = guidedNodeFootprintDefaultStore();
    try { localStorage.removeItem(GUIDED_NODE_FOOTPRINT_KEY); } catch(e) {}
  }
}

function guidedAuthorPrepareStoredSidecar(sidecar, report, id) {
  sidecar = guidedSidecarClone(sidecar || {}) || {};
  var previousMeta = sidecar.__studydeckSidecar || {};
  var savedAt = new Date().toISOString();
  id = id || previousMeta.id || guidedSidecarStorageId(sidecar, report);
  sidecar.sourceDeckName = sidecar.sourceDeckName || report.deckName || report.matchedDeck && report.matchedDeck.name || previousMeta.sourceDeckName || '';
  sidecar.sourceTranslation = sidecar.sourceTranslation || sidecar.translation || previousMeta.sourceTranslation || '';
  sidecar.createdForDeckUidPolicy = sidecar.createdForDeckUidPolicy || previousMeta.createdForDeckUidPolicy || 'cardUid';
  sidecar.__studydeckSidecar = {
    id: id,
    sourceName: previousMeta.sourceName || report.sourceName || sidecar.title || sidecar.name || 'Guided sidecar',
    importedAt: previousMeta.importedAt || savedAt,
    savedAt: savedAt,
    matchedDeckId: report.matchedDeck && report.matchedDeck.id,
    matchedDeckName: report.matchedDeck && report.matchedDeck.name,
    sourceDeckName: sidecar.sourceDeckName || '',
    sourceTranslation: sidecar.sourceTranslation || '',
    createdForDeckUidPolicy: sidecar.createdForDeckUidPolicy || 'cardUid',
    contentFingerprint: guidedSidecarContentFingerprint(sidecar),
    deckCategory: report.deckCategory || sidecar.deckCategory || sidecar.categoryId || previousMeta.deckCategory || '',
    validationErrors: report.totals ? Number(report.totals.errors || 0) : 0,
    validationWarnings: report.totals ? Number(report.totals.warnings || 0) : 0,
    usableQuestions: report.totals ? Number(report.totals.usableQuestions || 0) : 0,
    sidecarCards: report.totals ? Number(report.totals.sidecarCards || 0) : 0,
    matchedCards: report.totals ? Number(report.totals.matchedCards || 0) : 0,
    missingCards: report.totals ? Number(report.totals.missingCards || 0) : 0,
    questionBankQuestions: report.totals ? Number(report.totals.questionBankQuestions || 0) : 0,
    learnQuestions: report.totals ? Number(report.totals.learnQuestions || 0) : 0,
    practiceQuestions: report.totals ? Number(report.totals.practiceQuestions || 0) : 0,
    challengeQuestions: report.totals ? Number(report.totals.challengeQuestions || 0) : 0,
    scholarQuestions: report.totals ? Number(report.totals.scholarQuestions || 0) : 0,
    briefingScreens: report.totals ? Number(report.totals.briefingScreens || 0) : 0,
    eventStructures: report.totals ? Number(report.totals.eventStructures || 0) : 0,
    interactionCounts: guidedSidecarClone(report.interactionCounts || guidedAuthorEmptyInteractionCounts()),
    patternCounts: guidedSidecarClone(report.patternCounts || {}),
    genericLearnFallbacks: guidedSidecarPatternCount(report.patternCounts, 'generic_card_match')
  };
  return { id: id, sidecar: sidecar };
}

function guidedAuthorCommitActiveSidecar(sidecar, report, id) {
  var prepared = guidedAuthorPrepareStoredSidecar(sidecar, report, id);
  guidedSidecarStore.sidecars = (guidedSidecarStore.sidecars || []).filter(function(item){
    return !item || !item.__studydeckSidecar || item.__studydeckSidecar.id !== prepared.id;
  });
  guidedSidecarStore.sidecars.push(prepared.sidecar);
  guidedAuthorSidecarJustSavedId = prepared.id;
  guidedAuthorSidecarJustSavedAt = Date.now();
  guidedSaveSidecarStore();
  guidedState.nodeSession = null;
  guidedState.scholarAvailable = [];
  guidedState.scholarSession = null;
  guidedState.currentResults = null;
  saveGuidedState();
  renderGuidedEntry();
  return prepared;
}

function guidedAuthorExportDraftPatch() {
  var exportPatch = guidedSidecarClone(guidedAuthorDraftPatch || guidedAuthorDefaultDraftPatch()) || {};
  exportPatch.guidedNodePolicy = guidedNodePolicyStore();
  exportPatch.guidedNodeFootprint = guidedNodeFootprintStore();
  guidedAuthorExportObject('Guided Author patch', 'This is a patch: only the changed fields, not a full sidecar. To make it canonical, apply these fields to the source sidecar JSON, then open Sidecars, load the updated source file, validate it, and save it as the active sidecar. You can also ask Codex to apply this exported patch to the source sidecar file.', exportPatch);
  guidedAuthorSetSaveFlowStatus('info', 'Patch export opened', 'Use this only when you want a smaller change file instead of a complete sidecar JSON.');
}

function guidedAuthorExportFullDraftedSidecar() {
  var target = guidedAuthorStoredSidecarByDraftTarget();
  if (!target) {
    alert('Save an active sidecar before exporting a full updated sidecar.');
    return;
  }
  var built = guidedAuthorBuildSidecarWithReviewEdits(target, { includeNodeSettings: true });
  var exportSidecar = guidedSidecarClone(built.sidecar) || {};
  delete exportSidecar.__studydeckSidecar;
  var report = guidedAuthorValidateSidecarObject(exportSidecar, guidedAuthorStoredSidecarTitle(target) + ' with drafts');
  var errors = report && report.totals ? Number(report.totals.errors || 0) : 0;
  var warnings = report && report.totals ? Number(report.totals.warnings || 0) : 0;
  guidedAuthorExportObject(
    'Full updated Guided sidecar',
    'This is a complete sidecar JSON with current Review Edits merged in. Validation: ' + errors + ' errors · ' + warnings + ' warnings. Use it to replace the source sidecar file when you want these edits to become canonical.',
    exportSidecar
  );
  guidedAuthorSetSaveFlowStatus('info', 'Full JSON export opened', 'This export includes the active sidecar plus matching local drafts. Save it when the source file should catch up.');
}

async function guidedAuthorSaveFullDraftedSidecarJsonFile() {
  var target = guidedAuthorStoredSidecarByDraftTarget();
  if (!target) {
    alert('Save an active sidecar before saving a full updated sidecar file.');
    return;
  }
  var built = guidedAuthorBuildSidecarWithReviewEdits(target, { includeNodeSettings: true });
  var exportSidecar = guidedSidecarClone(built.sidecar) || {};
  delete exportSidecar.__studydeckSidecar;
  var title = guidedAuthorStoredSidecarTitle(target);
  var report = guidedAuthorValidateSidecarObject(exportSidecar, title + ' with drafts');
  var errors = report && report.totals ? Number(report.totals.errors || 0) : 0;
  var warnings = report && report.totals ? Number(report.totals.warnings || 0) : 0;
  var ok = true;
  if (errors || warnings) {
    ok = confirm('This full sidecar validates with ' + errors + ' errors and ' + warnings + ' warnings. Save the JSON file anyway?');
  }
  if (!ok) return;
  if (typeof saveJsonFileFromBrowser !== 'function') {
    guidedAuthorExportObject(
      'Full updated Guided sidecar',
      'This browser cannot save files directly here, so the full updated sidecar JSON is shown as text instead.',
      exportSidecar
    );
    guidedAuthorSetSaveFlowStatus('warning', 'Full JSON shown as text', 'This browser could not open the save flow, so use the displayed JSON text as the fallback.');
    return;
  }
  var baseName = title || 'guided-sidecar';
  await saveJsonFileFromBrowser(exportSidecar, baseName.replace(/\.json$/i, '') + '-updated.json', 'StudyDeck Guided sidecar JSON');
  guidedAuthorSetSaveFlowStatus('info', 'Full JSON save opened', 'Use the save modal to write the complete updated sidecar file. In the in-app browser, use the local bridge option.');
}

function guidedAuthorApplyDraftsToActiveSidecar(force) {
  var target = guidedAuthorStoredSidecarByDraftTarget();
  if (!target) {
    alert('Save an active sidecar before applying drafts.');
    return;
  }
  var built = guidedAuthorBuildSidecarWithReviewEdits(target, { includeNodeSettings: true });
  var appliedCount = guidedAuthorAppliedReviewEditCount(built.applied);
  if (!appliedCount) {
    if (typeof showXpToast === 'function') showXpToast('No matching Review Edits were found for this active sidecar.');
    return;
  }
  var report = guidedAuthorValidateSidecarObject(built.sidecar, guidedAuthorStoredSidecarTitle(target) + ' with drafts');
  var errors = report && report.totals ? Number(report.totals.errors || 0) : 0;
  if (errors && !force) {
    appConfirm(
      'Apply drafts with validation errors?',
      'The merged active sidecar currently has ' + errors + ' validation error' + (errors === 1 ? '' : 's') + '. It can still be applied, but only valid UID-matched entries should be used live.',
      'Apply anyway',
      'btn-gold',
      function(ok){ if (ok) guidedAuthorApplyDraftsToActiveSidecar(true); }
    );
    return;
  }
  var targetId = guidedAuthorStoredSidecarId(target);
  var prepared = guidedAuthorCommitActiveSidecar(built.sidecar, report, targetId);
  guidedAuthorClearAppliedReviewEdits(built.applied);
  guidedAuthorDraftTargetSidecarId = prepared.id;
  guidedAuthorSetSaveFlowStatus(
    built.missed.length ? 'warning' : 'success',
    'Drafts applied to active sidecar',
    built.missed.length
      ? 'Matching drafts were applied. Drafts for other sidecars stayed in Review Edits.'
      : 'Matching drafts were applied and cleared from Review Edits.',
    { skipRender: true }
  );
  renderGuidedView();
  if (typeof showXpToast === 'function') {
    var note = built.missed.length ? ' Some drafts did not match this sidecar and were left in Review Edits.' : '';
    showXpToast('Review Edits applied to active sidecar.' + note, built.missed.length ? 5200 : 3600);
  }
}

function guidedAuthorClearDraftPatch() {
  appConfirm('Clear Guided draft edits?', 'This removes the local Author Quick Edit drafts. Deck data is not changed.', 'Clear drafts', 'btn-soft', function(ok){
    if (!ok) return;
    guidedAuthorDraftPatch = guidedAuthorDefaultDraftPatch();
    try { localStorage.removeItem(GUIDED_AUTHOR_DRAFT_KEY); } catch(e) {}
    guidedAuthorSetSaveFlowStatus('success', 'Local drafts cleared', 'Temporary Review Edits were removed from this browser.', { skipRender: true });
    renderGuidedView();
    if (typeof showXpToast === 'function') showXpToast('Guided draft edits cleared.');
  });
}

function guidedAuthorSidecarIssue(severity, code, message, detail, uid, questionId) {
  return {
    severity: severity || 'warning',
    code: code || 'sidecar_issue',
    message: message || '',
    detail: detail || '',
    uid: uid || '',
    questionId: questionId || ''
  };
}

function guidedAuthorSidecarCardEntries(sidecar) {
  var raw = sidecar && sidecar.cards;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(function(entry, idx){
      return {
        key: String(entry && (entry.cardUid || entry.uid || entry.id) || idx),
        entry: entry || {}
      };
    });
  }
  if (typeof raw === 'object') {
    return Object.keys(raw).map(function(key){
      return {
        key: key,
        entry: raw[key] || {}
      };
    });
  }
  return [];
}

function guidedAuthorSidecarEntryUid(item) {
  var entry = item && item.entry || {};
  return String(entry.cardUid || entry.uid || item.key || '').trim();
}

function guidedAuthorFindDeckBySidecar(sidecar, entries) {
  var meta = sidecar && sidecar.__studydeckSidecar || {};
  var sidecarDeckName = guidedNormalizeName(sidecar && (sidecar.deckName || sidecar.deck || sidecar.targetDeck || sidecar.sourceDeckName || meta.matchedDeckName || meta.sourceDeckName || ''));
  if (sidecarDeckName) {
    var namedDeck = decks.find(function(deck){
      var deckName = guidedNormalizeName(deck && deck.name);
      return deckName && (deckName === sidecarDeckName || deckName.indexOf(sidecarDeckName) !== -1 || sidecarDeckName.indexOf(deckName) !== -1);
    });
    if (namedDeck) return { deck: namedDeck, reason: 'deckName' };
  }
  var categoryId = String(sidecar && (sidecar.deckCategory || sidecar.categoryId || '') || '').trim();
  var category = categoryId ? guidedResolveCategoryById(categoryId) : null;
  if (category && category.deckId != null) {
    var categoryDeck = guidedGetDeckById(category.deckId);
    if (categoryDeck) return { deck: categoryDeck, reason: 'deckCategory' };
  }
  var uidLookup = {};
  (entries || []).forEach(function(item){
    var uid = guidedAuthorSidecarEntryUid(item);
    if (uid) uidLookup[uid] = true;
  });
  var best = null;
  decks.forEach(function(deck){
    var score = 0;
    (deck.cards || []).forEach(function(card){
      if (card.uid && uidLookup[card.uid]) score += 1;
    });
    if (!best || score > best.score) best = { deck: deck, score: score };
  });
  if (best && best.score > 0) return { deck: best.deck, reason: 'uidOverlap', score: best.score };
  return { deck: null, reason: 'notFound' };
}

function guidedAuthorSidecarFindDeckCard(deck, uid, entry) {
  var match = guidedAuthorSidecarFindDeckCardMatch(deck, uid, entry);
  return match && match.card || null;
}

function guidedAuthorSidecarFindDeckCardMatch(deck, uid, entry) {
  if (!deck || !Array.isArray(deck.cards)) return null;
  uid = guidedSidecarNormalizeUid(uid);
  if (uid) {
    var byUid = deck.cards.find(function(card){ return guidedSidecarCardUid(card) === uid; });
    if (byUid) return { card: byUid, reason: 'uid' };
  }
  var answer = guidedAuthorNormalizeKey(entry && (entry.deckAnswer || entry.sourceReference || entry.reference || ''));
  if (answer) {
    var byAnswer = deck.cards.find(function(card){ return guidedAuthorNormalizeKey(card.a || '') === answer; }) || null;
    if (byAnswer) return { card: byAnswer, reason: 'referenceFallback' };
  }
  return null;
}

function guidedAuthorSidecarHasNote(card, label) {
  var target = guidedAuthorNormalizeKey(label || '');
  return !!(card && (card.notes || []).some(function(note){
    return guidedAuthorNormalizeKey(note.label || '') === target && guidedScholarPlainText(note.text || '').length >= 8;
  }));
}

function guidedAuthorSidecarQuestionOptions(question) {
  var labels = [];
  function add(value) {
    guidedAuthoredChallengeValueList(value).forEach(function(item){
      var label = guidedChallengeOptionLabel(item);
      if (label) labels.push(label);
    });
  }
  add(question && question.answer);
  add(question && question.correctAnswer);
  add(question && question.distractors);
  add(question && question.fittingItems);
  add(question && question.wordBank);
  add(question && question.options);
  add(question && question.choices);
  return guidedDedupStrings(labels);
}

function guidedAuthorSidecarQuestionPattern(question) {
  return guidedAuthorNormalizeKey(question && (question.learnPatternId || question.learnPattern || question.questionPattern || question.pattern || ''));
}

function guidedAuthorSidecarPrompt(question) {
  return guidedTextFromFieldValue(question && (question.prompt || question.question || question.text));
}

function guidedAuthorSidecarSourceLabel(question) {
  return guidedTextFromFieldValue(question && (question.sourceLabel || question.source || question.noteLabel || question.evidenceSource));
}

function guidedAuthorSidecarEvidenceLabels(evidenceNotes) {
  if (!evidenceNotes || typeof evidenceNotes !== 'object') return [];
  return guidedDedupStrings(Object.keys(evidenceNotes).map(function(key){ return guidedTextFromFieldValue(evidenceNotes[key]); }).filter(Boolean));
}

function guidedAuthorValidateSidecarQuestion(question, cardReport, detailLookup) {
  var rawType = question && (question.interactionType || question.type || question.kind || question.questionType || 'content_choice');
  var type = guidedNormalizeChallengeInteractionType(rawType);
  var questionId = String(question && (question.id || question.key || '') || '').trim();
  var issues = [];
  var required = Array.isArray(question && question.requiresDetailKeys) ? question.requiresDetailKeys.slice() : [];
  var evidenceLabels = guidedAuthorQuestionEvidenceLabels(question);
  var answer = guidedTextFromFieldValue(question && (question.answer || question.correctAnswer || question.correctLabel || question.oddOneOut));
  var questionPattern = guidedAuthorSidecarQuestionPattern(question);
  if (!questionId) issues.push(guidedAuthorSidecarIssue('error', 'missing_question_id', 'Question is missing an id.', '', cardReport.uid));
  if (!guidedAuthorSidecarPrompt(question)) issues.push(guidedAuthorSidecarIssue('error', 'missing_prompt', 'Question prompt is blank.', '', cardReport.uid, questionId));
  if (!required.length && !evidenceLabels.length) {
    issues.push(guidedAuthorSidecarIssue('warning', 'missing_evidence_reference', 'Question should include requiresDetailKeys or requiresVisibleEvidence/sourceLabel so the evidence source is clear.', '', cardReport.uid, questionId));
  }
  required.forEach(function(key){
    if (!detailLookup[key]) issues.push(guidedAuthorSidecarIssue('error', 'missing_detail_key', 'Question requires a detail key that does not exist on this sidecar card.', key, cardReport.uid, questionId));
  });
  evidenceLabels.forEach(function(label){
    var allowed = cardReport.evidenceNoteLabels || [];
    if (allowed.length && !guidedAuthorEvidenceLabelMatchesVisible(label, allowed)) {
      issues.push(guidedAuthorSidecarIssue('warning', 'unknown_evidence_label', 'Evidence label does not match a visible card note label.', label, cardReport.uid, questionId));
    }
  });
  if (type !== 'sequence_order' && !answer) {
    issues.push(guidedAuthorSidecarIssue('error', 'missing_answer', 'Question answer is blank.', '', cardReport.uid, questionId));
  }
  if (type === 'cloze_drag') {
    var wordBank = guidedTextArrayFromChallengeField(question && (question.wordBank || question.words || question.choices));
    if (wordBank.length < 4) issues.push(guidedAuthorSidecarIssue('error', 'small_word_bank', 'Fill-blank question needs at least four word-bank options.', '', cardReport.uid, questionId));
    if (answer && wordBank.map(guidedAuthorNormalizeKey).indexOf(guidedAuthorNormalizeKey(answer)) === -1) {
      issues.push(guidedAuthorSidecarIssue('error', 'answer_not_in_word_bank', 'Fill-blank answer is not present in the word bank.', answer, cardReport.uid, questionId));
    }
  } else if (type === 'odd_one_out') {
    var fittingItems = guidedTextArrayFromChallengeField(question && question.fittingItems);
    if (question && question.distractors && !fittingItems.length) {
      issues.push(guidedAuthorSidecarIssue('error', 'odd_one_out_uses_distractors', 'Odd-one-out should use fittingItems for the passage details that belong.', '', cardReport.uid, questionId));
    }
    if (fittingItems.length < 3) issues.push(guidedAuthorSidecarIssue('error', 'too_few_fitting_items', 'Odd-one-out needs at least three fittingItems.', '', cardReport.uid, questionId));
  } else if (type === 'sequence_order') {
    var sequence = guidedOrderedTextArrayFromChallengeField(question && (question.correctOrder || question.sequence || question.correctSequence || question.steps || question.answer));
    if (sequence.length < 3) issues.push(guidedAuthorSidecarIssue('error', 'sequence_too_short', 'Sequence question needs at least three ordered steps.', '', cardReport.uid, questionId));
  } else if (type === 'map_pin_choice') {
    var mapOptions = guidedNormalizeMapPinOptions(question, null);
    if (mapOptions.length < 4) issues.push(guidedAuthorSidecarIssue('warning', 'few_map_pin_options', 'Map Pin questions should provide four pin options.', String(mapOptions.length), cardReport.uid, questionId));
  } else {
    var optionCount = guidedAuthorSidecarQuestionOptions(question).length;
    if (optionCount < 4) issues.push(guidedAuthorSidecarIssue('warning', 'few_choice_options', 'Choice question has fewer than four available options.', String(optionCount), cardReport.uid, questionId));
  }
  issues = issues.concat(guidedAuthorValidateStarterQuestionPattern(question, questionPattern, type, answer, cardReport, questionId));
  var hasError = issues.some(function(issue){ return issue.severity === 'error'; });
  return {
    id: questionId || '(missing id)',
    interactionType: type,
    questionPattern: questionPattern,
    requiresDetailKeys: required,
    usable: !hasError && !!cardReport.deckCardMatched && (!!cardReport.hasPassageEvidence || !!cardReport.usesMapEvidence),
    issues: issues
  };
}

function guidedAuthorSidecarArrayField(entry, key) {
  var values = [];
  [
    entry && entry.guidedLearning && entry.guidedLearning[key],
    entry && entry.guided && entry.guided[key],
    entry && entry[key]
  ].forEach(function(value){
    guidedAuthoredChallengeValueList(value).forEach(function(item){
      if (item != null) values.push(item);
    });
  });
  return values;
}

function guidedAuthorSidecarObjectField(entry, key) {
  return entry && (
    entry.guidedLearning && entry.guidedLearning[key] ||
    entry.guided && entry.guided[key] ||
    entry[key]
  ) || null;
}

function guidedAuthorValidateSidecarLooseQuestion(question, idx, cardReport, nodeStub, scope) {
  var rawType = question && (question.interactionType || question.type || question.kind || question.questionType || 'content_choice');
  var type = guidedNormalizeChallengeInteractionType(rawType);
  var questionId = String(question && (question.id || question.key || '') || '').trim();
  var prompt = guidedAuthorSidecarPrompt(question);
  var answer = guidedTextFromFieldValue(question && (question.answer || question.correctAnswer || question.correctLabel || question.oddOneOut));
  var questionPattern = guidedAuthorSidecarQuestionPattern(question);
  var issues = [];
  if (!questionId) issues.push(guidedAuthorSidecarIssue('error', scope + '_missing_question_id', 'Question is missing an id.', '', cardReport.uid));
  if (!prompt) issues.push(guidedAuthorSidecarIssue('error', scope + '_missing_prompt', 'Question prompt is blank.', '', cardReport.uid, questionId));
  if (prompt && guidedAuthorIsMetaNotePrompt(prompt)) {
    issues.push(guidedAuthorSidecarIssue('error', scope + '_meta_note_prompt', 'Question asks about note/source-layer labels instead of content.', prompt, cardReport.uid, questionId));
  }
  if (type !== 'sequence_order' && !answer) {
    issues.push(guidedAuthorSidecarIssue('error', scope + '_missing_answer', 'Question answer is blank.', '', cardReport.uid, questionId));
  }
  if (type === 'content_choice' || type === 'scholar_note_choice') {
    if (guidedAuthorSidecarQuestionOptions(question).length < 4) {
      issues.push(guidedAuthorSidecarIssue('warning', scope + '_few_choice_options', 'Choice question has fewer than four available options.', '', cardReport.uid, questionId));
    }
  } else if (type === 'cloze_drag') {
    var wordBank = guidedTextArrayFromChallengeField(question && (question.wordBank || question.words || question.choices));
    if (wordBank.length < 4) issues.push(guidedAuthorSidecarIssue('error', scope + '_small_word_bank', 'Fill-blank question needs at least four word-bank options.', '', cardReport.uid, questionId));
    issues = issues.concat(guidedAuthorValidateLearnClozeGrammar(question, answer, cardReport, questionId));
  } else if (type === 'odd_one_out') {
    var fittingItems = guidedTextArrayFromChallengeField(question && question.fittingItems);
    if (fittingItems.length < 3) issues.push(guidedAuthorSidecarIssue('error', scope + '_too_few_fitting_items', 'Odd-one-out needs at least three fittingItems.', '', cardReport.uid, questionId));
  } else if (type === 'sequence_order') {
    var sequence = guidedOrderedTextArrayFromChallengeField(question && (question.correctOrder || question.sequence || question.correctSequence || question.steps || question.answer));
    if (sequence.length < 3) issues.push(guidedAuthorSidecarIssue('error', scope + '_sequence_too_short', 'Sequence question needs at least three ordered steps.', '', cardReport.uid, questionId));
  }
  var normalized = guidedNormalizeAuthoredChallengeQuestion(question, idx, cardReport.deckCard || {}, nodeStub);
  if (!normalized) issues.push(guidedAuthorSidecarIssue('error', scope + '_question_not_normalized', 'Question cannot be read by the current Guided question normalizer.', '', cardReport.uid, questionId));
  var hasError = issues.some(function(issue){ return issue.severity === 'error'; });
  return {
    id: questionId || '(missing id)',
    scope: scope || 'question',
    interactionType: type,
    questionPattern: questionPattern,
    usable: !hasError && !!cardReport.deckCardMatched,
    issues: issues
  };
}

function guidedAuthorValidateSidecarEventStructure(raw, cardReport) {
  var issues = [];
  var slots = [];
  if (raw && typeof raw === 'object') {
    slots = GUIDED_ATROCITY_EVENT_STRUCTURE_SLOTS.map(function(spec){
      var answer = guidedReadAtrocityEventStructureValue(raw, spec);
      return answer ? { key: spec.key, label: spec.label, answer: answer } : null;
    }).filter(Boolean);
  }
  if (!raw || typeof raw !== 'object') {
    issues.push(guidedAuthorSidecarIssue('error', 'event_structure_not_object', 'eventStructure must be an object.', '', cardReport.uid, 'eventStructure'));
  } else if (slots.length < 3) {
    issues.push(guidedAuthorSidecarIssue('error', 'event_structure_too_few_slots', 'eventStructure needs at least three readable slots.', String(slots.length), cardReport.uid, 'eventStructure'));
  }
  var hasError = issues.some(function(issue){ return issue.severity === 'error'; });
  return {
    id: 'eventStructure',
    scope: 'eventStructure',
    interactionType: 'event_structure',
    questionPattern: 'event structure board',
    slotCount: slots.length,
    usable: !hasError && !!cardReport.deckCardMatched,
    issues: issues
  };
}

function guidedAuthorSidecarBriefingScreenLines(screen) {
  if (!screen || typeof screen !== 'object') return [];
  if (Array.isArray(screen.lines)) {
    return screen.lines.map(guidedLearnBriefingTextFromValue).filter(Boolean);
  }
  var text = guidedLearnBriefingTextFromValue(screen.text || screen.body || screen.summary);
  return text ? text.split(/\n+/).map(function(line){ return line.trim(); }).filter(Boolean) : [];
}

function guidedAuthorSidecarBriefingEvidenceLabels(screen) {
  var labels = [];
  [
    screen && screen.sourceLabel,
    screen && screen.source,
    screen && screen.requiresVisibleEvidence,
    screen && screen.evidenceLabels,
    screen && screen.sourceLabels
  ].forEach(function(value){
    guidedAuthoredChallengeValueList(value).forEach(function(item){
      var label = guidedTextFromFieldValue(item);
      if (label) labels.push(label);
    });
  });
  return guidedDedupStrings(labels);
}

function guidedAuthorValidateSidecarBriefingScreen(screen, idx, cardReport) {
  var issues = [];
  var screenId = String(screen && (screen.id || screen.key || '') || '').trim();
  var lines = guidedAuthorSidecarBriefingScreenLines(screen);
  var evidenceLabels = guidedAuthorSidecarBriefingEvidenceLabels(screen);
  var hasMapPanel = !!(screen && typeof screen === 'object' && (screen.mapPanel || screen.mapContext || screen.map));
  var requiresEvidenceLabel = !hasMapPanel && !(cardReport && cardReport.usesMapEvidence);
  if (!screenId) issues.push(guidedAuthorSidecarIssue('error', 'briefing_missing_id', 'Briefing screen is missing an id.', '', cardReport.uid, 'briefingScreen'));
  if (!lines.length && !hasMapPanel) issues.push(guidedAuthorSidecarIssue('error', 'briefing_missing_lines', 'Briefing screen needs one to three line strings, unless it is a map-only briefing screen.', screenId || String(idx + 1), cardReport.uid, screenId));
  if (lines.length > 3) issues.push(guidedAuthorSidecarIssue('error', 'briefing_too_many_lines', 'Briefing screen supports at most three line strings.', String(lines.length), cardReport.uid, screenId));
  if (!evidenceLabels.length && requiresEvidenceLabel) {
    issues.push(guidedAuthorSidecarIssue('warning', 'briefing_missing_evidence_label', 'Briefing screen should include sourceLabel or requiresVisibleEvidence.', screenId, cardReport.uid, screenId));
  } else if (evidenceLabels.length && !hasMapPanel) {
    var allowedLabels = guidedAuthorVisibleNoteLabels(cardReport);
    evidenceLabels.forEach(function(label){
      if (allowedLabels.length && !guidedAuthorEvidenceLabelMatchesVisible(label, allowedLabels)) {
        issues.push(guidedAuthorSidecarIssue('warning', 'briefing_unknown_evidence_label', 'Briefing evidence label does not match a visible card note label.', label, cardReport.uid, screenId));
      }
    });
  }
  return {
    id: screenId || ('briefing_' + (idx + 1)),
    scope: 'briefing',
    lineCount: lines.length,
    usable: !issues.some(function(issue){ return issue.severity === 'error'; }) && !!cardReport.deckCardMatched,
    issues: issues
  };
}

function guidedAuthorSidecarUsesMapEvidence(sidecar) {
  if (!sidecar || typeof sidecar !== 'object') return false;
  var text = [
    sidecar.deckCategory,
    sidecar.categoryId,
    sidecar.deckName,
    sidecar.sourceDeckName,
    sidecar.title
  ].join(' ').toLowerCase();
  if (text.indexOf('geograph') !== -1) return true;
  return guidedAuthorSidecarCardEntries(sidecar).some(function(item){
    var entry = item && item.entry || {};
    return !!(entry.guidedLearning && entry.guidedLearning.mapLocation || entry.mapLocation);
  });
}

function guidedAuthorValidateSidecarObject(sidecar, sourceName) {
  var entries = guidedAuthorSidecarCardEntries(sidecar);
  var deckMatch = guidedAuthorFindDeckBySidecar(sidecar || {}, entries);
  var deck = deckMatch.deck;
  var usesMapEvidence = guidedAuthorSidecarUsesMapEvidence(sidecar);
  var report = {
    generatedAt: new Date().toISOString(),
    sourceName: sourceName || 'Sidecar JSON',
    title: sidecar && (sidecar.title || sidecar.name || '') || '',
    schemaVersion: sidecar && sidecar.schemaVersion || null,
    deckName: sidecar && (sidecar.deckName || sidecar.deck || '') || '',
    deckCategory: sidecar && (sidecar.deckCategory || sidecar.categoryId || '') || '',
    matchedDeck: deck ? { id: deck.id, name: deck.name, cardCount: (deck.cards || []).length, reason: deckMatch.reason, score: deckMatch.score || null } : null,
    totals: {
      sidecarCards: entries.length,
      matchedCards: 0,
      missingCards: 0,
      cardsWithPassageEvidence: 0,
      detailKeys: 0,
      duplicateDetailKeys: 0,
      questions: 0,
      questionBankQuestions: 0,
      usableQuestions: 0,
	      learnQuestions: 0,
	      practiceQuestions: 0,
	      challengeQuestions: 0,
	      checkpointQuestions: 0,
	      spiralQuestions: 0,
	      scholarQuestions: 0,
      briefingScreens: 0,
      eventStructures: 0,
      usableEventStructures: 0,
      errors: deck ? 0 : 1,
      warnings: 0
    },
    interactionCounts: guidedAuthorEmptyInteractionCounts(),
    patternCounts: {},
    cardReports: [],
    issues: []
  };
	  if (!entries.length) report.issues.push(guidedAuthorSidecarIssue('error', 'no_cards', 'Sidecar has no cards object or cards array.'));
	  if (!deck) report.issues.push(guidedAuthorSidecarIssue('error', 'deck_not_found', 'No current deck matched this sidecar.', report.deckName || report.deckCategory || ''));
	  guidedAuthorValidateGuidedNodePolicy(sidecar && sidecar.guidedNodePolicy, report);
	  guidedAuthorValidateGuidedNodeFootprint(sidecar && sidecar.guidedNodeFootprint, report);
  entries.forEach(function(item){
    var entry = item.entry || {};
    var uid = guidedSidecarNormalizeUid(guidedAuthorSidecarEntryUid(item));
    var deckCardMatch = guidedAuthorSidecarFindDeckCardMatch(deck, uid, entry);
    var card = deckCardMatch && deckCardMatch.card || null;
    var previewCard = card ? guidedApplySidecarEntryToCard(card, entry) : null;
    var runtimeMatchedByUid = !!(deckCardMatch && deckCardMatch.reason === 'uid');
    var passageLabel = (entry.evidenceNotes && entry.evidenceNotes.passage) || (sidecar.evidencePolicy && sidecar.evidencePolicy.visibleEvidenceNoteLabel) || 'Bible Excerpt';
    var evidenceNoteLabels = guidedDedupStrings(
      guidedAuthorDeckNoteLabels(card)
        .concat(guidedAuthorSidecarEvidenceLabels(entry.evidenceNotes))
        .concat(usesMapEvidence ? ['Map'] : [])
        .concat([
          passageLabel,
          sidecar.evidencePolicy && sidecar.evidencePolicy.visibleEvidenceNoteLabel,
          sidecar.evidencePolicy && sidecar.evidencePolicy.visibleContextNoteLabel
        ].filter(Boolean))
    );
    var details = Array.isArray(guidedAuthorSidecarObjectField(entry, 'exactPassageDetails')) ? guidedAuthorSidecarObjectField(entry, 'exactPassageDetails') : [];
    var detailLookup = {};
    var duplicateKeys = [];
    details.forEach(function(detail){
      var key = String(detail && detail.key || '').trim();
      if (!key) return;
      if (detailLookup[key]) duplicateKeys.push(key);
      detailLookup[key] = detail;
    });
    var cardReport = {
      uid: uid || '(missing uid)',
      titleHint: entry.titleHint || '',
      deckAnswer: entry.deckAnswer || entry.sourceReference || '',
      deckCardMatched: runtimeMatchedByUid,
      diagnosticCardMatched: !!card,
      matchReason: deckCardMatch ? deckCardMatch.reason : '',
      deckCardId: card ? card.id : null,
      deckCardAnswer: card ? card.a : '',
      hasPassageEvidence: guidedAuthorSidecarHasNote(card, passageLabel),
      usesMapEvidence: usesMapEvidence,
      passageEvidenceLabel: passageLabel,
      evidenceNoteLabels: evidenceNoteLabels,
      detailKeys: Object.keys(detailLookup),
      duplicateDetailKeys: duplicateKeys,
      questions: [],
      questionBankQuestions: 0,
      learnQuestions: 0,
      practiceQuestions: 0,
      challengeQuestions: 0,
      scholarQuestions: 0,
      briefingScreens: 0,
      eventStructure: false,
      errors: 0,
      warnings: 0
    };
    if (runtimeMatchedByUid) report.totals.matchedCards += 1;
    else {
      report.totals.missingCards += 1;
      cardReport.errors += 1;
      if (!uid) {
        report.issues.push(guidedAuthorSidecarIssue('error', 'missing_card_uid', 'Sidecar card is missing cardUid/UID. Runtime sidecars require stable card UIDs.', entry.titleHint || entry.deckAnswer || '', uid));
      } else if (card) {
        report.issues.push(guidedAuthorSidecarIssue('error', 'card_uid_not_found', 'Sidecar card did not match by UID. A reference/answer diagnostic match exists, but runtime will ignore this entry until cardUid is fixed.', entry.titleHint || entry.deckAnswer || '', uid));
      } else {
        report.issues.push(guidedAuthorSidecarIssue('error', 'card_uid_not_found', 'Sidecar card UID does not match a card in the selected deck.', entry.titleHint || entry.deckAnswer || '', uid));
      }
    }
    if (cardReport.hasPassageEvidence) report.totals.cardsWithPassageEvidence += 1;
    else if (!usesMapEvidence) {
      cardReport.warnings += 1;
      report.issues.push(guidedAuthorSidecarIssue('warning', 'missing_passage_evidence', 'Matched card is missing the visible evidence note.', passageLabel, uid));
    }
    duplicateKeys.forEach(function(key){
      cardReport.errors += 1;
      report.totals.duplicateDetailKeys += 1;
      report.issues.push(guidedAuthorSidecarIssue('error', 'duplicate_detail_key', 'Sidecar card repeats an exactPassageDetails key.', key, uid));
    });
    report.totals.detailKeys += Object.keys(detailLookup).length;
    var nodeStub = {
      categoryId: String(sidecar && (sidecar.deckCategory || sidecar.categoryId || '') || ''),
      categoryLabel: '',
	      deckId: deck ? deck.id : null,
	      level: Number(card && card.level || entry.stage || 1) || 1,
	      sidecarPolicy: sidecar && sidecar.guidedNodePolicy || null
	    };
    var bankQuestions = guidedAuthorSidecarArrayField(entry, 'questions');
    var hasQuestionBank = bankQuestions.length > 0;
    var legacyLearnQuestions = guidedAuthorLearnPatchQuestions(entry);
    var legacyPracticeQuestions = guidedAuthorSidecarArrayField(entry, 'practiceQuestions');
    var legacyChallengeQuestions = guidedAuthorSidecarArrayField(entry, 'challengeQuestions');
    var legacyScholarQuestions = guidedAuthorSidecarArrayField(entry, 'scholarQuestions');
    var learnQuestions = hasQuestionBank ? bankQuestions.filter(function(question){ return guidedQuestionEligibleForNode(guidedQuestionAsCanonicalBankEntry(question), 'learn', '', Object.assign({ type:'learn' }, nodeStub)); }) : legacyLearnQuestions;
    var practiceQuestions = hasQuestionBank ? bankQuestions.filter(function(question){ return guidedQuestionEligibleForNode(guidedQuestionAsCanonicalBankEntry(question), 'practice', '', Object.assign({ type:'practice' }, nodeStub)); }) : legacyPracticeQuestions;
    var challengeQuestions = hasQuestionBank ? bankQuestions.filter(function(question){ return guidedQuestionEligibleForNode(guidedQuestionAsCanonicalBankEntry(question), 'challenge', '', Object.assign({ type:'challenge' }, nodeStub)); }) : legacyChallengeQuestions;
    var checkpointQuestions = hasQuestionBank ? bankQuestions.filter(function(question){ return guidedQuestionEligibleForNode(guidedQuestionAsCanonicalBankEntry(question), 'checkpoint', '', Object.assign({ type:'checkpoint' }, nodeStub)); }) : [];
    var spiralQuestions = hasQuestionBank ? bankQuestions.filter(function(question){ return guidedQuestionEligibleForNode(guidedQuestionAsCanonicalBankEntry(question), 'spiral_review', '', Object.assign({ type:'spiral_review' }, nodeStub)); }) : [];
    var scholarQuestions = hasQuestionBank ? bankQuestions.filter(function(question){ return guidedQuestionIsScholarBonus(guidedQuestionAsCanonicalBankEntry(question)); }) : legacyScholarQuestions;
    var briefingScreens = guidedAuthorSidecarArrayField(entry, 'briefingScreens');
    var eventStructure = guidedAuthorSidecarObjectField(entry, 'eventStructure');
    if (hasQuestionBank) {
      cardReport.questionBankQuestions = bankQuestions.length;
      report.totals.questionBankQuestions += bankQuestions.length;
      var shadowedLegacyCount = legacyLearnQuestions.length + legacyPracticeQuestions.length + legacyChallengeQuestions.length + legacyScholarQuestions.length;
      if (shadowedLegacyCount) {
        cardReport.warnings += 1;
        report.issues.push(guidedAuthorSidecarIssue(
          'warning',
          'question_bank_shadows_legacy_arrays',
          'This card has guidedLearning.questions, so legacy per-node question arrays are ignored at runtime.',
          shadowedLegacyCount + ' legacy question' + (shadowedLegacyCount === 1 ? '' : 's') + ' shadowed',
          uid
        ));
      }
    }
    cardReport.learnQuestions = learnQuestions.length;
    cardReport.practiceQuestions = practiceQuestions.length;
	    cardReport.challengeQuestions = challengeQuestions.length;
	    cardReport.checkpointQuestions = checkpointQuestions.length;
	    cardReport.spiralQuestions = spiralQuestions.length;
    cardReport.scholarQuestions = scholarQuestions.length;
    cardReport.briefingScreens = briefingScreens.length;
    report.totals.learnQuestions += learnQuestions.length;
    report.totals.practiceQuestions += practiceQuestions.length;
	    report.totals.challengeQuestions += challengeQuestions.length;
	    report.totals.checkpointQuestions += checkpointQuestions.length;
	    report.totals.spiralQuestions += spiralQuestions.length;
    report.totals.scholarQuestions += scholarQuestions.length;
    report.totals.briefingScreens += briefingScreens.length;
    cardReport.deckCard = previewCard || card || null;
    if (!bankQuestions.length && !learnQuestions.length && !practiceQuestions.length && !challengeQuestions.length && !scholarQuestions.length && !briefingScreens.length && !eventStructure && !Object.keys(detailLookup).length) {
      cardReport.errors += 1;
      report.issues.push(guidedAuthorSidecarIssue('error', 'empty_sidecar_card', 'Sidecar card has no guided content.', '', uid));
    }
    var briefingIdLookup = {};
    briefingScreens.forEach(function(screen, idx){
      var briefingReport = guidedAuthorValidateSidecarBriefingScreen(screen, idx, cardReport);
      cardReport.questions.push(briefingReport);
      if (briefingReport.id) briefingIdLookup[briefingReport.id] = true;
      briefingReport.issues.forEach(function(issue){
        report.issues.push(issue);
        if (issue.severity === 'error') cardReport.errors += 1;
        else cardReport.warnings += 1;
      });
    });
    if (hasQuestionBank) {
      bankQuestions.forEach(function(question, idx){
        var qReport = guidedAuthorValidateQuestionBankQuestion(question, idx, cardReport, nodeStub, detailLookup);
        var requiredBriefings = guidedAuthorQuestionBriefingIds(question);
        if (qReport.eligibleNodes && qReport.eligibleNodes.indexOf('learn') !== -1) {
          if (briefingScreens.length && !requiredBriefings.length) {
            qReport.issues.push(guidedAuthorSidecarIssue('warning', 'bank_missing_briefing_reference', 'Bank question on a briefed card should include requiresBriefingScreens for diagnostics.', '', cardReport.uid, qReport.id));
          }
          requiredBriefings.forEach(function(briefingId){
            if (!briefingIdLookup[briefingId]) {
              qReport.issues.push(guidedAuthorSidecarIssue('warning', 'bank_unknown_briefing_reference', 'Bank question references a briefing screen id that does not exist on this sidecar card.', briefingId, cardReport.uid, qReport.id));
            }
          });
        }
        cardReport.questions.push(qReport);
        report.totals.questions += 1;
        guidedAuthorAddInteractionCount(report.interactionCounts, qReport.interactionType, 1);
        guidedAuthorAddPatternCount(report.patternCounts, qReport.learnPatternId || qReport.questionPattern);
        qReport.issues.forEach(function(issue){
          report.issues.push(issue);
          if (issue.severity === 'error') cardReport.errors += 1;
          else cardReport.warnings += 1;
        });
        if (qReport.usable) report.totals.usableQuestions += 1;
      });
    } else {
    learnQuestions.forEach(function(question, idx){
      var qReport = guidedAuthorValidateLearnPatchQuestion(question, idx, cardReport, nodeStub);
      qReport.scope = 'learn';
      var requiredBriefings = guidedAuthorQuestionBriefingIds(question);
      if (briefingScreens.length && !requiredBriefings.length) {
        qReport.issues.push(guidedAuthorSidecarIssue('warning', 'learn_missing_briefing_reference', 'Learn question on a briefed card should include requiresBriefingScreens for diagnostics.', '', cardReport.uid, qReport.id));
      }
      requiredBriefings.forEach(function(briefingId){
        if (!briefingIdLookup[briefingId]) {
          qReport.issues.push(guidedAuthorSidecarIssue('warning', 'learn_unknown_briefing_reference', 'Learn question references a briefing screen id that does not exist on this sidecar card.', briefingId, cardReport.uid, qReport.id));
        }
      });
      cardReport.questions.push(qReport);
      report.totals.questions += 1;
      guidedAuthorAddInteractionCount(report.interactionCounts, qReport.interactionType, 1);
      guidedAuthorAddPatternCount(report.patternCounts, qReport.learnPatternId || qReport.questionPattern);
      qReport.issues.forEach(function(issue){
        report.issues.push(issue);
        if (issue.severity === 'error') cardReport.errors += 1;
        else cardReport.warnings += 1;
      });
      if (qReport.usable) report.totals.usableQuestions += 1;
    });
    practiceQuestions.forEach(function(question, idx){
      var qReport = guidedAuthorValidateSidecarLooseQuestion(question, idx, cardReport, nodeStub, 'practice');
      cardReport.questions.push(qReport);
      report.totals.questions += 1;
      guidedAuthorAddInteractionCount(report.interactionCounts, qReport.interactionType, 1);
      guidedAuthorAddPatternCount(report.patternCounts, qReport.questionPattern);
      qReport.issues.forEach(function(issue){
        report.issues.push(issue);
        if (issue.severity === 'error') cardReport.errors += 1;
        else cardReport.warnings += 1;
      });
      if (qReport.usable) report.totals.usableQuestions += 1;
    });
    challengeQuestions.forEach(function(question){
      var qReport = guidedAuthorValidateSidecarQuestion(question, cardReport, detailLookup);
      qReport.scope = 'challenge';
      cardReport.questions.push(qReport);
      report.totals.questions += 1;
      guidedAuthorAddInteractionCount(report.interactionCounts, qReport.interactionType, 1);
      guidedAuthorAddPatternCount(report.patternCounts, qReport.learnPatternId || qReport.questionPattern);
      qReport.issues.forEach(function(issue){
        report.issues.push(issue);
        if (issue.severity === 'error') cardReport.errors += 1;
        else cardReport.warnings += 1;
      });
      if (qReport.usable) report.totals.usableQuestions += 1;
    });
    scholarQuestions.forEach(function(question, idx){
      var qReport = guidedAuthorValidateSidecarLooseQuestion(question, idx, cardReport, nodeStub, 'scholar');
      cardReport.questions.push(qReport);
      report.totals.questions += 1;
      guidedAuthorAddInteractionCount(report.interactionCounts, qReport.interactionType, 1);
      guidedAuthorAddPatternCount(report.patternCounts, qReport.questionPattern);
      qReport.issues.forEach(function(issue){
        report.issues.push(issue);
        if (issue.severity === 'error') cardReport.errors += 1;
        else cardReport.warnings += 1;
      });
      if (qReport.usable) report.totals.usableQuestions += 1;
    });
    }
    if (eventStructure) {
      var eventReport = guidedAuthorValidateSidecarEventStructure(eventStructure, cardReport);
      cardReport.eventStructure = true;
      cardReport.questions.push(eventReport);
      report.totals.questions += 1;
      report.totals.eventStructures += 1;
      guidedAuthorAddInteractionCount(report.interactionCounts, eventReport.interactionType, 1);
      guidedAuthorAddPatternCount(report.patternCounts, eventReport.questionPattern);
      eventReport.issues.forEach(function(issue){
        report.issues.push(issue);
        if (issue.severity === 'error') cardReport.errors += 1;
        else cardReport.warnings += 1;
      });
      if (eventReport.usable) {
        report.totals.usableQuestions += 1;
        report.totals.usableEventStructures += 1;
      }
    }
    delete cardReport.deckCard;
    report.totals.errors += cardReport.errors;
    report.totals.warnings += cardReport.warnings;
    report.cardReports.push(cardReport);
  });
  guidedAuthorAddDeclaredCountWarnings(report, sidecar);
  report.totals.errors = report.issues.filter(function(issue){ return issue.severity === 'error'; }).length;
  report.totals.warnings = report.issues.filter(function(issue){ return issue.severity !== 'error'; }).length;
  return report;
}

function guidedAuthorValidateSidecarText(text, sourceName, keepText) {
  guidedAuthorSidecarSourceLoaderOpen = true;
  if (keepText) guidedAuthorSidecarPasteText = text || '';
  else guidedAuthorSidecarPasteText = '';
  try {
    var parsed = JSON.parse(text || '');
    guidedAuthorValidatedSidecarObject = parsed;
    guidedAuthorSidecarValidationReport = guidedAuthorValidateSidecarObject(parsed, sourceName);
  } catch(err) {
    guidedAuthorValidatedSidecarObject = null;
    guidedAuthorSidecarValidationReport = {
      generatedAt: new Date().toISOString(),
      sourceName: sourceName || 'Sidecar JSON',
      parseError: true,
      totals: { sidecarCards: 0, matchedCards: 0, missingCards: 0, cardsWithPassageEvidence: 0, detailKeys: 0, duplicateDetailKeys: 0, questions: 0, usableQuestions: 0, briefingScreens: 0, errors: 1, warnings: 0 },
      interactionCounts: guidedAuthorEmptyInteractionCounts(),
      patternCounts: {},
      cardReports: [],
      issues: [guidedAuthorSidecarIssue('error', 'parse_error', 'Could not parse sidecar JSON.', err.message)]
    };
  }
  var sourceStatus = guidedAuthorReportStatus(
    guidedAuthorSidecarValidationReport,
    'Source preview loaded',
    'The source JSON was checked and is ready to save as active if this is the version you want.',
    'Source preview has warnings',
    'Source preview has errors'
  );
  guidedAuthorSetSaveFlowStatus(sourceStatus.kind, sourceStatus.title, sourceStatus.body, { skipRender: true });
  renderGuidedView();
}

function guidedAuthorSetSidecarSourceLoaderOpen(open) {
  guidedAuthorSidecarSourceLoaderOpen = !!open;
}

function guidedAuthorValidateSidecarPaste() {
  guidedAuthorSidecarSourceLoaderOpen = true;
  var el = document.getElementById('guided-sidecar-paste');
  guidedAuthorValidateSidecarText(el ? el.value : '', 'Pasted sidecar JSON', true);
}

function guidedAuthorTriggerSidecarFile() {
  guidedAuthorSidecarSourceLoaderOpen = true;
  var input = document.getElementById('guided-sidecar-file-input');
  if (input) {
    input.value = '';
    input.click();
  }
}

function guidedAuthorLoadSidecarFile(evt) {
  guidedAuthorSidecarSourceLoaderOpen = true;
  var file = evt && evt.target && evt.target.files && evt.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(){
    guidedAuthorValidateSidecarText(String(reader.result || ''), file.name || 'Sidecar file', false);
  };
  reader.onerror = function(){
    guidedAuthorSetSaveFlowStatus('error', 'File could not be read', 'No sidecar preview was loaded. Try choosing the JSON file again.');
    alert('Could not read the sidecar file.');
  };
  reader.readAsText(file);
}

function guidedAuthorClearSidecarValidation() {
  guidedAuthorSidecarSourceLoaderOpen = true;
  guidedAuthorSidecarValidationReport = null;
  guidedAuthorSidecarPasteText = '';
  guidedAuthorValidatedSidecarObject = null;
  guidedAuthorSetSaveFlowStatus('info', 'Source preview cleared', 'The loaded preview was removed. Active browser sidecars were not changed.', { skipRender: true });
  renderGuidedView();
}

function guidedAuthorSetReturnedSidecarOpen(open) {
  guidedAuthorReturnedSidecarOpen = !!open;
}

function guidedAuthorReturnedSidecarTarget() {
  var id = guidedAuthorSidecarWorkspaceSelectedId();
  return id ? guidedAuthorFindStoredSidecarById(id) : null;
}

function guidedAuthorLooksLikeHandoffPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  var handoffType = String(value.handoffType || value.bundleType || value.type || '').toLowerCase();
  if (handoffType.indexOf('handoff') !== -1) {
    return 'This looks like a handoff wrapper or manifest, not a returned sidecar. Load the sidecar JSON file returned by the content chat, or sidecar.json from the handoff folder.';
  }
  if (value.manifest && (value.deck || value.sidecar || value.files)) {
    return 'This looks like a handoff bundle wrapper. Load only the returned full sidecar JSON, not the whole bundle.';
  }
  if (value.files && (value.summary || value.activeSidecarMetadata || value.validationSummary)) {
    return 'This looks like a handoff manifest. Load the returned sidecar JSON itself.';
  }
  if ((value.deckJson || value.deck) && (value.sidecarJson || value.sidecar || value.activeSidecarJson)) {
    return 'This looks like a handoff package containing both deck and sidecar data. Load only the sidecar JSON.';
  }
  if (value.patch || value.patchList || value.edits || value.replacementCards) {
    return 'This looks like a patch/edit list. Returned Sidecar Import v1 accepts only a full sidecar JSON object.';
  }
  return '';
}

function guidedAuthorReturnedSidecarErrorReport(sourceName, code, message, detail) {
  return {
    generatedAt: new Date().toISOString(),
    sourceName: sourceName || 'Returned sidecar JSON',
    parseError: code === 'parse_error',
    returnedSidecarRejected: true,
    totals: {
      sidecarCards: 0,
      matchedCards: 0,
      missingCards: 0,
      cardsWithPassageEvidence: 0,
      detailKeys: 0,
      duplicateDetailKeys: 0,
      questions: 0,
      questionBankQuestions: 0,
      usableQuestions: 0,
      briefingScreens: 0,
      eventStructures: 0,
      errors: 1,
      warnings: 0
    },
    interactionCounts: guidedAuthorEmptyInteractionCounts(),
    patternCounts: {},
    cardReports: [],
    issues: [guidedAuthorSidecarIssue('error', code || 'returned_sidecar_invalid', message || 'Returned sidecar could not be loaded.', detail || '')]
  };
}

function guidedAuthorCleanReturnedSidecarObject(value) {
  var clean = guidedSidecarClone(value || {}) || {};
  delete clean.__studydeckSidecar;
  return clean;
}

function guidedAuthorSidecarEntryContentOnlyForCompare(entry) {
  var copy = guidedSidecarClone(entry || {}) || {};
  delete copy.mapLocation;
  if (copy.guidedLearning && typeof copy.guidedLearning === 'object') {
    delete copy.guidedLearning.mapLocation;
    delete copy.guidedLearning.maps;
    if (Array.isArray(copy.guidedLearning.briefingScreens)) {
      copy.guidedLearning.briefingScreens = copy.guidedLearning.briefingScreens.map(function(screen){
        var next = guidedSidecarClone(screen || {}) || {};
        delete next.mapPanel;
        return next;
      });
    }
    if (Array.isArray(copy.guidedLearning.questions)) {
      copy.guidedLearning.questions = copy.guidedLearning.questions.map(function(question){
        var next = guidedSidecarClone(question || {}) || {};
        var type = guidedNormalizeChallengeInteractionType(next.interactionType || next.type || next.kind || '');
        if (type === 'map_pin_choice') {
          delete next.mapId;
          delete next.mapOptions;
          delete next.crop;
        }
        return next;
      });
    }
  }
  return copy;
}

function guidedAuthorSidecarEntryMapOnlyForCompare(entry) {
  entry = entry || {};
  var gl = entry.guidedLearning || {};
  var screens = guidedAuthorSidecarArrayField(entry, 'briefingScreens').map(function(screen, idx){
    return {
      id: screen && (screen.id || screen.key || ('screen_' + idx)),
      mapPanel: screen && screen.mapPanel || null
    };
  }).filter(function(row){ return !!row.mapPanel; });
  var questions = guidedAuthorSidecarArrayField(entry, 'questions').map(function(question, idx){
    var type = guidedNormalizeChallengeInteractionType(question && (question.interactionType || question.type || question.kind || ''));
    if (type !== 'map_pin_choice') return null;
    return {
      id: guidedAuthorQuestionIdentity(question, idx),
      mapId: question && question.mapId || '',
      crop: question && question.crop || null,
      mapOptions: question && question.mapOptions || []
    };
  }).filter(Boolean);
  return {
    mapLocation: gl.mapLocation || entry.mapLocation || null,
    briefingMapPanels: screens,
    mapPinQuestions: questions
  };
}

function guidedAuthorBuildReturnedSidecarCompareSummary(activeSidecar, returnedSidecar) {
  if (!activeSidecar || !returnedSidecar) return null;
  var activeMap = guidedAuthorSidecarEntryMap(activeSidecar);
  var returnedMap = guidedAuthorSidecarEntryMap(returnedSidecar);
  var activeUids = Object.keys(activeMap).sort();
  var returnedUids = Object.keys(returnedMap).sort();
  var returnedLookup = {};
  var activeLookup = {};
  returnedUids.forEach(function(uid){ returnedLookup[uid] = true; });
  activeUids.forEach(function(uid){ activeLookup[uid] = true; });
  var onlyActive = activeUids.filter(function(uid){ return !returnedLookup[uid]; });
  var onlyReturned = returnedUids.filter(function(uid){ return !activeLookup[uid]; });
  var shared = activeUids.filter(function(uid){ return returnedLookup[uid]; });
  var contentChanged = [];
  var mapChanged = [];
  shared.forEach(function(uid){
    if (guidedAuthorSidecarSubtreeChanged(guidedAuthorSidecarEntryContentOnlyForCompare(activeMap[uid]), guidedAuthorSidecarEntryContentOnlyForCompare(returnedMap[uid]))) {
      contentChanged.push(uid);
    }
    if (guidedAuthorSidecarSubtreeChanged(guidedAuthorSidecarEntryMapOnlyForCompare(activeMap[uid]), guidedAuthorSidecarEntryMapOnlyForCompare(returnedMap[uid]))) {
      mapChanged.push(uid);
    }
  });
  var globalMapsChanged = guidedAuthorSidecarSubtreeChanged(guidedAuthorSidecarMapStoreForCompare(activeSidecar), guidedAuthorSidecarMapStoreForCompare(returnedSidecar));
  return {
    shared: shared.length,
    onlyActive: onlyActive,
    onlyReturned: onlyReturned,
    contentChanged: contentChanged,
    mapChanged: mapChanged,
    globalMapsChanged: globalMapsChanged,
    fingerprintsMatch: guidedSidecarContentFingerprint(activeSidecar) === guidedSidecarContentFingerprint(returnedSidecar)
  };
}

function guidedAuthorValidateReturnedSidecarText(text, sourceName, keepText) {
  guidedAuthorReturnedSidecarOpen = true;
  guidedAuthorReturnedSidecarSourceName = sourceName || 'Returned sidecar JSON';
  guidedAuthorReturnedSidecarPasteText = keepText ? (text || '') : '';
  try {
    var parsed = JSON.parse(text || '');
    var rejection = guidedAuthorLooksLikeHandoffPayload(parsed);
    if (rejection) {
      guidedAuthorReturnedSidecarObject = null;
      guidedAuthorReturnedSidecarReport = guidedAuthorReturnedSidecarErrorReport(sourceName, 'returned_sidecar_wrapper', rejection);
    } else {
      var clean = guidedAuthorCleanReturnedSidecarObject(parsed);
      guidedAuthorReturnedSidecarObject = clean;
      guidedAuthorReturnedSidecarReport = guidedAuthorValidateSidecarObject(clean, sourceName || 'Returned sidecar JSON');
    }
  } catch(err) {
    guidedAuthorReturnedSidecarObject = null;
    guidedAuthorReturnedSidecarReport = guidedAuthorReturnedSidecarErrorReport(sourceName, 'parse_error', 'Could not parse returned sidecar JSON.', err && err.message || '');
  }
  var returnedStatus = guidedAuthorReportStatus(
    guidedAuthorReturnedSidecarReport,
    'Returned sidecar loaded',
    'The returned JSON was checked and is ready to compare or save as active.',
    'Returned sidecar has warnings',
    'Returned sidecar has errors'
  );
  guidedAuthorSetSaveFlowStatus(returnedStatus.kind, returnedStatus.title, returnedStatus.body, { skipRender: true });
  renderGuidedView();
}

function guidedAuthorValidateReturnedSidecarPaste() {
  var el = document.getElementById('guided-returned-sidecar-paste');
  guidedAuthorValidateReturnedSidecarText(el ? el.value : '', 'Pasted returned sidecar JSON', true);
}

function guidedAuthorTriggerReturnedSidecarFile() {
  guidedAuthorReturnedSidecarOpen = true;
  var input = document.getElementById('guided-returned-sidecar-file-input');
  if (input) {
    input.value = '';
    input.click();
  }
}

function guidedAuthorLoadReturnedSidecarFile(evt) {
  guidedAuthorReturnedSidecarOpen = true;
  var file = evt && evt.target && evt.target.files && evt.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(){
    guidedAuthorValidateReturnedSidecarText(String(reader.result || ''), file.name || 'Returned sidecar file', false);
  };
  reader.onerror = function(){
    guidedAuthorSetSaveFlowStatus('error', 'Returned file could not be read', 'No returned sidecar preview was loaded. Try choosing the JSON file again.');
    alert('Could not read the returned sidecar file.');
  };
  reader.readAsText(file);
}

function guidedAuthorClearReturnedSidecar() {
  guidedAuthorReturnedSidecarOpen = true;
  guidedAuthorReturnedSidecarPasteText = '';
  guidedAuthorReturnedSidecarObject = null;
  guidedAuthorReturnedSidecarReport = null;
  guidedAuthorReturnedSidecarSourceName = '';
  guidedAuthorSetSaveFlowStatus('info', 'Returned sidecar preview cleared', 'The returned preview was removed. The active browser sidecar was not changed.', { skipRender: true });
  renderGuidedView();
}

function guidedAuthorSaveReturnedSidecarAsActive(force) {
  if (!guidedAuthorReturnedSidecarObject || !guidedAuthorReturnedSidecarReport) {
    alert('Load and validate a returned sidecar JSON first.');
    return;
  }
  var report = guidedAuthorReturnedSidecarReport;
  var errors = report && report.totals ? Number(report.totals.errors || 0) : 0;
  var selected = guidedAuthorReturnedSidecarTarget();
  var selectedId = selected ? guidedAuthorStoredSidecarId(selected) : '';
  var selectedTitle = selected ? guidedAuthorStoredSidecarTitle(selected) : 'the matching active sidecar';
  if (errors && !force) {
    appConfirm(
      'Save returned sidecar with validation errors?',
      'The returned sidecar has ' + errors + ' validation error' + (errors === 1 ? '' : 's') + '. It can be saved, but invalid UID-matched content may not run correctly.',
      'Save anyway',
      'btn-gold',
      function(ok){ if (ok) guidedAuthorSaveReturnedSidecarAsActive(true); }
    );
    return;
  }
  appConfirm(
    'Save returned sidecar as active?',
    'This replaces the selected browser-active sidecar, "' + selectedTitle + '", with the returned sidecar. It does not write a source JSON file on disk; use Save full JSON afterward if you want a file copy.',
    'Save returned preview',
    'btn-gold',
    function(ok) {
      if (!ok) return;
      var sidecar = guidedAuthorCleanReturnedSidecarObject(guidedAuthorReturnedSidecarObject);
      var prepared = guidedAuthorCommitActiveSidecar(sidecar, report, selectedId || undefined);
      guidedAuthorSidecarWorkspaceId = prepared.id;
      guidedAuthorDraftTargetSidecarId = prepared.id;
      guidedAuthorReturnedSidecarOpen = false;
      guidedAuthorReturnedSidecarPasteText = '';
      guidedAuthorReturnedSidecarObject = null;
      guidedAuthorReturnedSidecarReport = null;
      guidedAuthorReturnedSidecarSourceName = '';
      guidedAuthorSetSaveFlowStatus('success', 'Returned sidecar saved as active', 'Guided Learning is now using the returned sidecar in this browser. Save full JSON if the source file should match.', { skipRender: true });
      renderGuidedView();
      if (typeof showXpToast === 'function') showXpToast('Returned sidecar saved as active.');
    }
  );
}

function guidedAuthorExportSidecarValidationReport() {
  if (!guidedAuthorSidecarValidationReport) {
    alert('Validate a sidecar first.');
    return;
  }
  guidedAuthorExportObject('Guided sidecar validation report', 'Card matches, evidence-note coverage, detail-key checks, question usability, and validation issues.', guidedAuthorSidecarValidationReport);
  guidedAuthorSetSaveFlowStatus('info', 'Validation report export opened', 'Use this report when you need to inspect source-preview issues outside the app.');
}

function guidedSidecarStorageId(sidecar, report) {
  var matched = report && report.matchedDeck;
  var parts = [
    'guided-sidecar',
    matched && matched.id != null ? ('deck-' + matched.id) : '',
    sidecar && (sidecar.deckCategory || sidecar.categoryId || ''),
    sidecar && (sidecar.deckName || sidecar.deck || sidecar.targetDeck || sidecar.title || sidecar.name || '')
  ].filter(Boolean);
  return guidedSidecarCleanKey(parts.join(' ')) || ('guided-sidecar-' + Date.now());
}

function guidedAuthorSaveValidatedSidecar(force) {
  if (!guidedAuthorValidatedSidecarObject || !guidedAuthorSidecarValidationReport) {
    alert('Validate a sidecar before saving it.');
    return;
  }
  var report = guidedAuthorSidecarValidationReport;
  var errors = report && report.totals ? Number(report.totals.errors || 0) : 0;
  if (errors && !force) {
    appConfirm(
      'Save active sidecar with validation errors?',
      'This sidecar currently has ' + errors + ' validation error' + (errors === 1 ? '' : 's') + '. It can still be saved as the active browser sidecar, but only valid UID-matched entries should be used live.',
      'Save anyway',
      'btn-gold',
      function(ok){ if (ok) guidedAuthorSaveValidatedSidecar(true); }
    );
    return;
  }
  var sidecar = guidedSidecarClone(guidedAuthorValidatedSidecarObject) || {};
  var id = guidedSidecarStorageId(sidecar, report);
  var savedAt = new Date().toISOString();
  sidecar.sourceDeckName = sidecar.sourceDeckName || report.deckName || report.matchedDeck && report.matchedDeck.name || '';
  sidecar.sourceTranslation = sidecar.sourceTranslation || sidecar.translation || '';
  sidecar.createdForDeckUidPolicy = sidecar.createdForDeckUidPolicy || 'cardUid';
  sidecar.__studydeckSidecar = {
    id: id,
    sourceName: report.sourceName || sidecar.title || sidecar.name || 'Guided sidecar',
    importedAt: savedAt,
    savedAt: savedAt,
    matchedDeckId: report.matchedDeck && report.matchedDeck.id,
    matchedDeckName: report.matchedDeck && report.matchedDeck.name,
    sourceDeckName: sidecar.sourceDeckName || '',
    sourceTranslation: sidecar.sourceTranslation || '',
    createdForDeckUidPolicy: sidecar.createdForDeckUidPolicy || 'cardUid',
    contentFingerprint: guidedSidecarContentFingerprint(sidecar),
    deckCategory: report.deckCategory || sidecar.deckCategory || sidecar.categoryId || '',
    validationErrors: errors,
    validationWarnings: report.totals ? Number(report.totals.warnings || 0) : 0,
    usableQuestions: report.totals ? Number(report.totals.usableQuestions || 0) : 0,
    sidecarCards: report.totals ? Number(report.totals.sidecarCards || 0) : 0,
    matchedCards: report.totals ? Number(report.totals.matchedCards || 0) : 0,
    missingCards: report.totals ? Number(report.totals.missingCards || 0) : 0,
    questionBankQuestions: report.totals ? Number(report.totals.questionBankQuestions || 0) : 0,
    learnQuestions: report.totals ? Number(report.totals.learnQuestions || 0) : 0,
    practiceQuestions: report.totals ? Number(report.totals.practiceQuestions || 0) : 0,
    challengeQuestions: report.totals ? Number(report.totals.challengeQuestions || 0) : 0,
    scholarQuestions: report.totals ? Number(report.totals.scholarQuestions || 0) : 0,
    briefingScreens: report.totals ? Number(report.totals.briefingScreens || 0) : 0,
    eventStructures: report.totals ? Number(report.totals.eventStructures || 0) : 0,
    interactionCounts: guidedSidecarClone(report.interactionCounts || guidedAuthorEmptyInteractionCounts()),
    patternCounts: guidedSidecarClone(report.patternCounts || {}),
    genericLearnFallbacks: guidedSidecarPatternCount(report.patternCounts, 'generic_card_match')
  };
  guidedSidecarStore.sidecars = (guidedSidecarStore.sidecars || []).filter(function(item){
    return !item || !item.__studydeckSidecar || item.__studydeckSidecar.id !== id;
  });
  guidedSidecarStore.sidecars.push(sidecar);
  guidedAuthorSidecarJustSavedId = id;
  guidedAuthorSidecarJustSavedAt = Date.now();
  guidedAuthorSidecarSourceLoaderOpen = false;
  guidedAuthorSidecarValidationReport = null;
  guidedAuthorValidatedSidecarObject = null;
  guidedAuthorSidecarPasteText = '';
  guidedAuthorActiveTab = 'sidecars';
  guidedAuthorPersistTab('sidecars');
  guidedSaveSidecarStore();
  guidedState.nodeSession = null;
  guidedState.scholarAvailable = [];
  guidedState.scholarSession = null;
  guidedState.currentResults = null;
  saveGuidedState();
  renderGuidedEntry();
  guidedAuthorSetSaveFlowStatus(
    errors ? 'warning' : 'success',
    'Source preview saved as active',
    errors
      ? 'The sidecar was saved in this browser with validation errors. Review issues before relying on it.'
      : 'Guided Learning is now using this sidecar in the browser. Save full JSON if the disk file should match.',
    { skipRender: true }
  );
  renderGuidedView();
  if (typeof showXpToast === 'function') showXpToast(guidedSidecarActiveToastMessage(guidedBuildSidecarHealthReport(sidecar)), errors ? 5200 : 3600);
  setTimeout(function(){
    var el = document.getElementById('guided-sidecar-health');
    if (el && el.scrollIntoView) {
      try { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      catch(e) { el.scrollIntoView(true); }
    }
  }, 50);
}

function guidedAuthorDeleteSidecar(id) {
  appConfirm(
    'Delete active Guided sidecar?',
    'This removes the saved active sidecar from this browser. The source sidecar file and deck JSON are not changed.',
    'Delete',
    'btn-danger',
    function(ok) {
      if (!ok) return;
      guidedSidecarStore.sidecars = (guidedSidecarStore.sidecars || []).filter(function(sidecar){
        return !sidecar || !sidecar.__studydeckSidecar || sidecar.__studydeckSidecar.id !== id;
      });
      guidedSaveSidecarStore();
      guidedState.nodeSession = null;
      guidedState.scholarAvailable = [];
      guidedState.scholarSession = null;
      guidedState.currentResults = null;
      saveGuidedState();
      renderGuidedEntry();
      guidedAuthorSetSaveFlowStatus('warning', 'Active sidecar deleted', 'This browser copy was removed. Source JSON files on disk were not changed.', { skipRender: true });
      renderGuidedView();
    }
  );
}

function guidedAuthorExportStoredSidecars() {
  guidedAuthorExportObject('Active sidecar store', 'This is the full browser-local sidecar store, including StudyDeck browser metadata. For a normal source JSON file, use Save this active sidecar JSON on an individual sidecar row instead.', guidedSidecarStore);
  guidedAuthorSetSaveFlowStatus('info', 'Browser sidecar backup opened', 'This backup includes browser metadata. Use Save full JSON for a normal source sidecar file.');
}

function guidedAuthorStoredSidecars() {
  return (guidedSidecarStore && Array.isArray(guidedSidecarStore.sidecars)) ? guidedSidecarStore.sidecars : [];
}

function guidedAuthorFindStoredSidecarById(id) {
  var sidecars = guidedAuthorStoredSidecars();
  for (var i = 0; i < sidecars.length; i += 1) {
    var meta = sidecars[i] && sidecars[i].__studydeckSidecar || {};
    if (String(meta.id || '') === String(id || '')) return sidecars[i];
  }
  return null;
}

function guidedAuthorStoredSidecarId(sidecar) {
  var meta = sidecar && sidecar.__studydeckSidecar || {};
  return String(meta.id || guidedSidecarStorageId(sidecar || {}, null) || '');
}

function guidedAuthorStoredSidecarTitle(sidecar) {
  var meta = sidecar && sidecar.__studydeckSidecar || {};
  return meta.sourceName || sidecar && (sidecar.title || sidecar.name || sidecar.deckName || sidecar.deck) || 'Guided sidecar';
}

var guidedAuthorGeographyCopyFixesV1 = {
  briefingTitles: {
    JRU1: "The city tied to David, the temple, and Jesus' final week.",
    BTH1: "The Judean town tied to David's family line and Jesus' birth.",
    SIN1: 'The mountain where Moses received the law.',
    JRD1: "The river tied to Joshua's crossing and Jesus' baptism.",
    JRC1: 'The city whose walls fall as Israel enters the land.',
    GLY1: 'The northern region where many Gospel scenes happen.',
    NAZ1: 'The town where Jesus was raised.',
    SGA1: 'The lake where Jesus calmed a storm and walked on water.',
    JUD1: 'The southern region around Jerusalem.',
    DMS1: "The city tied to Saul's conversion journey.",
    BBL1: 'The eastern empire city tied to exile.',
    EGY1: "The land tied to Joseph, slavery, and the Exodus.",
    ROM1: 'The imperial city Paul reaches as a prisoner.',
    SAM1: 'The region between Judea and Galilee.',
    CPR1: "The lakeside town central to Jesus' Galilee ministry.",
    MOL1: "The ridge east of Jerusalem tied to Jesus' final days.",
    NIN1: 'The Assyrian city Jonah is sent to warn.',
    DSE1: 'The salt sea in the Jordan Valley.',
    PTM1: 'The island where Revelation opens with John.',
    EPH1: 'The Asia Minor city tied to Paul and Revelation.',
    GOL1: 'The place near Jerusalem where Jesus is crucified.',
    BTN1: 'The village near Jerusalem tied to Mary, Martha, and Lazarus.',
    CAN1: "The Galilean town tied to Jesus' first sign.",
    TRS1: "The Cilician city remembered as Paul's birthplace.",
    ANT1: 'The Syrian city that becomes an early missionary base.',
    GSMN: 'The garden where Jesus prays before his arrest.'
  },
  briefingLines: {
    SGA1: {
      SGA1_brief_02: ['Jesus calms a storm, walks on the water, and calls fishermen as disciples in stories tied to this lake.'],
      SGA1_brief_03: ['Find the lake in Galilee, with the Jordan River and nearby Galilee labels as anchors.']
    },
    GLY1: {
      GLY1_brief_03: ['On the map, Galilee sits north of Judea and around the lake.']
    },
    JUD1: {
      JUD1_brief_03: ['On the map, Judea sits south of Galilee and west of the Dead Sea.']
    }
  },
  oldBriefingLines: {
    SGA1: {
      SGA1_brief_02: [
        ['Storm, walking-on-water, and fishermen-disciple stories happen around its shores.']
      ],
      SGA1_brief_03: [
        ['On the map, use the lake shape as the main visual anchor.']
      ]
    },
    GLY1: {
      GLY1_brief_03: [
        ['On the inset map, Galilee sits north of Judea and around the lake.']
      ]
    },
    JUD1: {
      JUD1_brief_03: [
        ['On the inset map, Judea sits south of Galilee and west of the Dead Sea.']
      ]
    }
  }
};

function guidedAuthorIsGeographySidecar(sidecar) {
  if (!sidecar || typeof sidecar !== 'object') return false;
  var meta = sidecar.__studydeckSidecar || {};
  var category = guidedSidecarCleanKey(sidecar.deckCategory || sidecar.categoryId || meta.deckCategory || '');
  var deckName = guidedSidecarCleanKey(sidecar.deckName || sidecar.deck || sidecar.sourceDeckName || meta.sourceDeckName || meta.matchedDeckName || sidecar.title || '');
  if (category === 'geography' || deckName.indexOf('geography') !== -1) return true;
  var cards = sidecar.cards || {};
  return !!(cards && typeof cards === 'object' && (cards.JRU1 || cards.SGA1 || cards.EPH1));
}

function guidedAuthorSidecarExportFileName(sidecar, suffix) {
  var title = guidedAuthorStoredSidecarTitle(sidecar || {}) || 'guided-sidecar';
  return String(title)
    .replace(/\.json$/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    + (suffix || '') + '.json';
}

function guidedAuthorContentHandoffFolderName(sidecar, deck) {
  var name = deck && deck.name || guidedAuthorStoredSidecarTitle(sidecar || {}) || 'guided-sidecar';
  var stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return String(name)
    .replace(/\.json$/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    + '-content-handoff-' + stamp;
}

function guidedAuthorCleanSidecarForHandoff(sidecar) {
  var clean = guidedSidecarClone(sidecar || {}) || {};
  delete clean.__studydeckSidecar;
  return clean;
}

function guidedAuthorContentHandoffPattern(sidecar) {
  if (guidedAuthorIsGeographySidecar(sidecar)) {
    return [
      'Geography: 1 Map Pin, 2 Content Choice, and 2 Cloze questions per card unless the user explicitly changes the pattern.',
      'Geography: usually 3 briefing screens. Use 4 only when a place is genuinely layered and the extra screen teaches a different story/significance layer.',
      'Geography: preserve map locations, label positions, crop settings, atlas asset, and A-D quiz pin coordinates unless the task explicitly asks for map work.'
    ];
  }
  var title = guidedSidecarCleanKey(guidedAuthorStoredSidecarTitle(sidecar || {}));
  if (title.indexOf('atrocities') !== -1 || title.indexOf('atrocity') !== -1) {
    return [
      'Atrocities: preserve the existing 4-briefing structure, event-board structure, Scholar Bonus structure, and source/evidence references.',
      'Atrocities: do not soften, generalize, or euphemize the harm in a way that removes why the card exists.'
    ];
  }
  if (title.indexOf('character') !== -1) {
    return [
      'Characters: preserve the current pilot schema and question count unless the user asks for an expansion.',
      'Characters: make briefings teach why the person matters in the Bible story, not just identify who they are.'
    ];
  }
  return [
    'Preserve the existing sidecar schema and per-card content pattern unless the user explicitly asks for a structural change.',
    'Use the deck JSON as the factual source and the sidecar JSON as the authoring target.'
  ];
}

function guidedAuthorBuildContentHandoffPrompt(sidecar, deck, summary, warnings) {
  var deckName = deck && deck.name || summary.deckName || 'selected deck';
  var sidecarName = summary.sidecarTitle || 'selected active sidecar';
  var pattern = guidedAuthorContentHandoffPattern(sidecar);
  var lines = [
    'Use the StudyDeck Guided Sidecar Content GPT rules.',
    '',
    'Target deck:',
    deckName,
    '',
    'Target sidecar:',
    sidecarName,
    '',
    'Scope:',
    '[Tell the content chat the exact stage, card UIDs, or review area you want handled.]',
    '',
    'Task:',
    '[Examples: review bad prompts, rewrite weak briefings, improve answer variety, add a new stage, or return patch-style edits.]',
    '',
    'Output:',
    '[Choose one: review findings only, patch-style edit list, replacement objects for changed cards only, or full updated sidecar JSON.]',
    '',
    'Current expected content pattern:',
    pattern.map(function(line){ return '- ' + line; }).join('\n'),
    '',
    'Preserve:',
    '- Do not change app code, CSS, deck JSON, runtime behavior, rewards, or schema design.',
    '- Do not change tuned map metadata, pins, labels, crops, or atlas assets unless the task explicitly asks for map work.',
    '- Do not change IDs unless a question meaning changes substantially.',
    '',
    'Files in this handoff folder:',
    '- deck.json: the matched StudyDeck deck JSON.',
    '- sidecar.json: the active browser sidecar JSON, with browser-only StudyDeck metadata removed.',
    '- manifest.json: metadata about the export and validation counts.',
    '- content-gpt-instructions.md: reusable rules for the content chat.',
    '- task.md: this filled-out handoff prompt.',
    '',
    'Before making edits:',
    '1. Identify the sidecar structure.',
    '2. Count cards, briefings, and question types.',
    '3. Tell me what pattern you think this sidecar is using.',
    '4. Tell me any risks or assumptions.',
    '',
    'When returning edits:',
    '1. Say what changed by card UID.',
    '2. Say whether any IDs changed.',
    '3. Say whether map metadata was untouched.',
    '4. Say what still needs human review.',
    '5. Remind me that source sidecar JSON must be loaded, validated, and saved active in StudyDeck before the browser app reflects it.'
  ];
  if (warnings && warnings.length) {
    lines.push('', 'Bundle warnings:', warnings.map(function(item){ return '- ' + item; }).join('\n'));
  }
  return lines.join('\n');
}

function guidedAuthorBuildContentHandoffData(sidecar) {
  var entries = guidedAuthorSidecarCardEntries(sidecar || {});
  var deckMatch = guidedAuthorFindDeckBySidecar(sidecar || {}, entries);
  var deck = deckMatch && deckMatch.deck || null;
  var cleanSidecar = guidedAuthorCleanSidecarForHandoff(sidecar);
  var report = guidedAuthorValidateSidecarObject(cleanSidecar, guidedAuthorStoredSidecarTitle(sidecar || {}));
  var meta = guidedSidecarClone(sidecar && sidecar.__studydeckSidecar || {}) || {};
  var totals = report && report.totals || {};
  var warnings = [];
  if (!deck) warnings.push('No matching deck was found. The handoff folder still includes the sidecar, but deck.json contains null.');
  if (totals.errors) warnings.push('The active sidecar currently validates with ' + totals.errors + ' error' + (totals.errors === 1 ? '' : 's') + '.');
  if (totals.warnings) warnings.push('The active sidecar currently validates with ' + totals.warnings + ' warning' + (totals.warnings === 1 ? '' : 's') + '.');
  var summary = {
    deckName: deck && deck.name || meta.matchedDeckName || cleanSidecar.deckName || cleanSidecar.sourceDeckName || '',
    deckMatchReason: deckMatch && deckMatch.reason || '',
    sidecarTitle: guidedAuthorStoredSidecarTitle(sidecar || {}),
    sidecarId: guidedAuthorStoredSidecarId(sidecar || {}),
    sidecarCards: Number(totals.sidecarCards || entries.length || 0),
    matchedCards: Number(totals.matchedCards || 0),
    questionBankQuestions: Number(totals.questionBankQuestions || totals.questions || 0),
    briefingScreens: Number(totals.briefingScreens || 0),
    validationErrors: Number(totals.errors || 0),
    validationWarnings: Number(totals.warnings || 0)
  };
  var createdAt = new Date().toISOString();
  var handoffPrompt = guidedAuthorBuildContentHandoffPrompt(sidecar, deck, summary, warnings);
  var manifest = {
    schemaVersion: 1,
    handoffType: 'studydeckGuidedContentHandoffFolder',
    createdAt: createdAt,
    purpose: 'Move deck and active sidecar content into a separate content-focused ChatGPT chat without manually gathering files.',
    files: {
      instructions: 'content-gpt-instructions.md',
      task: 'task.md',
      deck: 'deck.json',
      sidecar: 'sidecar.json',
      manifest: 'manifest.json'
    },
    summary: summary,
    warnings: warnings,
    activeSidecarMetadata: meta,
    validationSummary: {
      totals: guidedSidecarClone(totals || {}),
      interactionCounts: guidedSidecarClone(report && report.interactionCounts || {}),
      patternCounts: guidedSidecarClone(report && report.patternCounts || {})
    }
  };
  return {
    createdAt: createdAt,
    deck: deck ? guidedSidecarClone(deck) : null,
    sidecar: cleanSidecar,
    handoffPrompt: handoffPrompt,
    manifest: manifest,
    warnings: warnings,
    summary: summary
  };
}

function guidedAuthorBuildContentHandoffFolderFiles(sidecar) {
  var data = guidedAuthorBuildContentHandoffData(sidecar);
  var taskText = [
    '# StudyDeck Content Handoff Task',
    '',
    'Paste or attach this folder in a separate content-focused ChatGPT chat.',
    '',
    'Start by telling that chat:',
    '',
    '```text',
    data.handoffPrompt,
    '```',
    '',
    'Files in this folder:',
    '',
    '- `content-gpt-instructions.md`: the reusable rules for the content GPT.',
    '- `deck.json`: the source deck content to inspect.',
    '- `sidecar.json`: the current active Guided sidecar to review or modify.',
    '- `manifest.json`: export metadata and validation counts.',
    '',
    'Return an updated sidecar JSON or a patch-style edit list, not this whole handoff folder.'
  ].join('\n');
  return {
    data: data,
    files: [
      {
        name: 'task.md',
        text: taskText
      },
      {
        name: 'deck.json',
        text: JSON.stringify(data.deck, null, 2)
      },
      {
        name: 'sidecar.json',
        text: JSON.stringify(data.sidecar, null, 2)
      },
      {
        name: 'manifest.json',
        text: JSON.stringify(data.manifest, null, 2)
      }
    ]
  };
}

async function guidedAuthorExportContentHandoffBundle(id) {
  var sidecar = guidedAuthorFindStoredSidecarById(id);
  if (!sidecar) {
    alert('That active sidecar is no longer available in this browser.');
    return;
  }
  var entries = guidedAuthorSidecarCardEntries(sidecar || {});
  var deckMatch = guidedAuthorFindDeckBySidecar(sidecar || {}, entries);
  var deck = deckMatch && deckMatch.deck || null;
  var folderName = guidedAuthorContentHandoffFolderName(sidecar, deck);
  var built = guidedAuthorBuildContentHandoffFolderFiles(sidecar);
  if (typeof fetch !== 'function') {
    guidedAuthorSetSaveFlowStatus('error', 'Handoff folder was not created', 'This browser cannot contact the local Author Bridge. No folder was written.');
    alert('This browser cannot contact the local Author Bridge. No handoff folder was written.');
    return;
  }
  try {
    var healthResponse = await fetch(studyDeckAuthorBridgeBaseUrl + '/health');
    var health = await healthResponse.json();
    if (!healthResponse.ok || !health || !health.ok || !health.token) {
      throw new Error('The local bridge did not provide a valid save token.');
    }
    var response = await fetch(studyDeckAuthorBridgeBaseUrl + '/save-handoff-folder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-StudyDeck-Bridge-Token': health.token
      },
      body: JSON.stringify({
        folderName: folderName,
        includeGuidedContentDocs: true,
        files: built.files
      })
    });
    var payload = null;
    try {
      payload = await response.json();
    } catch (parseErr) {
      payload = { error: 'The bridge returned a non-JSON response.' };
    }
    if (!response.ok || !payload || !payload.ok) {
      throw new Error(payload && payload.error ? payload.error : ('Bridge folder export failed with HTTP ' + response.status + '.'));
    }
    guidedAuthorSetSaveFlowStatus('success', 'Content handoff folder saved', 'The folder was written to the handoffs folder with instructions, deck JSON, sidecar JSON, and a manifest.', { skipRender: true });
    if (typeof showXpToast === 'function') showXpToast('Content handoff folder saved.');
    alert(
      'Saved content handoff folder:\n\n' + payload.path +
      '\n\nFiles:\n' + (payload.files || []).map(function(file){ return '- ' + file.name; }).join('\n') +
      '\n\nGive that folder to the content-focused GPT. It should return an updated sidecar JSON or patch list, not the whole folder.'
    );
  } catch (err) {
    console.warn('Content handoff folder export failed.', err);
    guidedAuthorSetSaveFlowStatus('error', 'Handoff folder was not created', 'The local Author Bridge did not save the folder. No folder was written.');
    alert(
      'StudyDeck could not create the content handoff folder. No folder was written.' +
      (err && err.message ? '\n\nDetails: ' + err.message : '') +
      '\n\nRestart the Author Bridge so it has the folder-export endpoint:\n' + studyDeckAuthorBridgeStartScript +
      '\n\nOr run this Terminal command:\n' + studyDeckAuthorBridgeCommand
    );
  }
}

function guidedAuthorSidecarEntryForUid(sidecar, uid) {
  uid = guidedSidecarNormalizeUid(uid);
  if (!sidecar || !uid) return null;
  if (sidecar.cards && !Array.isArray(sidecar.cards) && typeof sidecar.cards === 'object' && sidecar.cards[uid]) return sidecar.cards[uid];
  var entries = guidedAuthorSidecarCardEntries(sidecar);
  for (var i = 0; i < entries.length; i += 1) {
    var item = entries[i];
    if (guidedSidecarNormalizeUid(guidedAuthorSidecarEntryUid(item)) === uid) return item.entry;
  }
  return null;
}

function guidedAuthorSameStringArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (var i = 0; i < a.length; i += 1) {
    if (String(a[i] || '') !== String(b[i] || '')) return false;
  }
  return true;
}

function guidedAuthorApplyGeographyCopyFixes(sidecar) {
  var next = guidedSidecarClone(sidecar || {}) || {};
  var changes = [];
  Object.keys(guidedAuthorGeographyCopyFixesV1.briefingTitles).forEach(function(uid){
    var entry = guidedAuthorSidecarEntryForUid(next, uid);
    if (!entry) return;
    if (!entry.guidedLearning || typeof entry.guidedLearning !== 'object') entry.guidedLearning = {};
    var title = guidedAuthorGeographyCopyFixesV1.briefingTitles[uid];
    var currentTitle = String(entry.guidedLearning.briefingTitle || '').trim();
    if ((!currentTitle || /^study card$/i.test(currentTitle)) && String(currentTitle || '') !== String(title || '')) {
      entry.guidedLearning.briefingTitle = title;
      changes.push(uid + ' briefing title');
    }
  });
  Object.keys(guidedAuthorGeographyCopyFixesV1.briefingLines).forEach(function(uid){
    var entry = guidedAuthorSidecarEntryForUid(next, uid);
    var gl = entry && entry.guidedLearning;
    var screens = gl && Array.isArray(gl.briefingScreens) ? gl.briefingScreens : [];
    var fixes = guidedAuthorGeographyCopyFixesV1.briefingLines[uid] || {};
    Object.keys(fixes).forEach(function(screenId){
      var screen = screens.find(function(item){ return String(item && item.id || '') === String(screenId); });
      if (!screen) return;
      var lines = fixes[screenId];
      var oldOptions = guidedAuthorGeographyCopyFixesV1.oldBriefingLines
        && guidedAuthorGeographyCopyFixesV1.oldBriefingLines[uid]
        && guidedAuthorGeographyCopyFixesV1.oldBriefingLines[uid][screenId] || [];
      var matchesOldLine = oldOptions.some(function(oldLines){
        return guidedAuthorSameStringArray(screen.lines || [], oldLines || []);
      });
      if (matchesOldLine && !guidedAuthorSameStringArray(screen.lines || [], lines)) {
        screen.lines = guidedSidecarClone(lines);
        changes.push(screenId + ' briefing text');
      }
    });
  });
  return { sidecar: next, changes: changes };
}

function guidedAuthorFindStoredGeographySidecar() {
  var sidecars = guidedAuthorStoredSidecars();
  for (var i = 0; i < sidecars.length; i += 1) {
    if (guidedAuthorIsGeographySidecar(sidecars[i])) return sidecars[i];
  }
  return null;
}

async function guidedAuthorSaveStoredSidecarJsonFile(id) {
  var sidecar = guidedAuthorFindStoredSidecarById(id);
  if (!sidecar) {
    alert('That active sidecar is no longer available in this browser.');
    return false;
  }
  var exportSidecar = guidedSidecarClone(sidecar) || {};
  delete exportSidecar.__studydeckSidecar;
  var filename = guidedAuthorSidecarExportFileName(sidecar, '-active');
  if (typeof saveJsonFileFromBrowser !== 'function') {
    guidedAuthorExportObject(
      'Active sidecar JSON',
      'This is the selected active browser-local sidecar as a complete JSON object. Browser metadata has been removed.',
      exportSidecar
    );
    guidedAuthorSetSaveFlowStatus('warning', 'Active JSON shown as text', 'This browser could not open the save flow, so use the displayed JSON text as the fallback.');
    return true;
  }
  await saveJsonFileFromBrowser(exportSidecar, filename, 'StudyDeck active Guided sidecar JSON');
  guidedAuthorSetSaveFlowStatus('info', 'Active JSON save opened', 'Use the save modal to write this browser-active sidecar to a JSON file. In the in-app browser, use the local bridge option.');
  return true;
}

async function guidedAuthorSaveSelectedActiveSidecarJsonFile() {
  var target = guidedAuthorStoredSidecarByDraftTarget();
  if (!target) {
    alert('Save an active sidecar before saving it as JSON.');
    return false;
  }
  return guidedAuthorSaveStoredSidecarJsonFile(guidedAuthorStoredSidecarId(target));
}

function guidedAuthorMergeGeographyCopyFixesIntoActiveSidecar(id) {
  var sidecar = id ? guidedAuthorFindStoredSidecarById(id) : guidedAuthorFindStoredGeographySidecar();
  if (!sidecar) {
    alert('No active Geography sidecar was found. Load, validate, and save the Geography sidecar as active first.');
    return;
  }
  if (!guidedAuthorIsGeographySidecar(sidecar)) {
    alert('This action only applies to the active Geography sidecar.');
    return;
  }
  var result = guidedAuthorApplyGeographyCopyFixes(sidecar);
  if (!result.changes.length) {
    if (typeof showXpToast === 'function') showXpToast('Geography copy fixes are already present in the active sidecar.');
    return;
  }
  var report = guidedAuthorValidateSidecarObject(result.sidecar, guidedAuthorStoredSidecarTitle(sidecar) + ' with Geography copy fixes');
  var errors = report && report.totals ? Number(report.totals.errors || 0) : 0;
  var apply = function(){
    var prepared = guidedAuthorCommitActiveSidecar(result.sidecar, report, guidedAuthorStoredSidecarId(sidecar));
    guidedAuthorDraftTargetSidecarId = prepared.id;
    renderGuidedView();
    if (typeof showXpToast === 'function') {
      showXpToast('Merged ' + result.changes.length + ' Geography copy fix' + (result.changes.length === 1 ? '' : 'es') + ' into the active sidecar.');
    }
  };
  if (errors) {
    appConfirm(
      'Merge copy fixes with validation errors?',
      'The active Geography sidecar would still have ' + errors + ' validation error' + (errors === 1 ? '' : 's') + ' after this narrow copy/title merge. Your map tuning will still be preserved.',
      'Merge anyway',
      'btn-gold',
      function(ok){ if (ok) apply(); }
    );
    return;
  }
  apply();
}

function guidedAuthorDraftReviewCounts() {
  return {
    card: Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.cardEdits) || {}).length,
    question: Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.questionEdits) || {}).length,
    briefing: Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.briefingEdits) || {}).length,
    event: Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.eventStructureEdits) || {}).length,
    map: Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.mapEdits) || {}).length
  };
}

function guidedAuthorDraftMapTargetSidecarIds() {
  var ids = {};
  Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.mapEdits) || {}).forEach(function(key){
    var edit = guidedAuthorDraftPatch.mapEdits[key] || {};
    var targetId = String(edit.targetSidecarId || '').trim();
    if (targetId) ids[targetId] = true;
  });
  return Object.keys(ids);
}

function guidedAuthorPreferredDraftTargetSidecarId() {
  var counts = guidedAuthorDraftReviewCounts();
  var nonMapCount = counts.card + counts.question + counts.briefing + counts.event;
  var mapTargets = guidedAuthorDraftMapTargetSidecarIds();
  if (counts.map > 0 && nonMapCount === 0 && mapTargets.length === 1) return mapTargets[0];
  return '';
}

function guidedAuthorStoredSidecarByDraftTarget() {
  var sidecars = guidedAuthorStoredSidecars();
  if (!sidecars.length) return null;
  if (sidecars.length === 1) return sidecars[0];
  var preferred = guidedAuthorPreferredDraftTargetSidecarId();
  var selected = preferred || guidedAuthorDraftTargetSidecarId;
  var el = typeof document !== 'undefined' ? document.getElementById('guided-author-draft-sidecar-target') : null;
  if (!preferred && el && el.value) selected = el.value;
  if (!selected) selected = guidedAuthorStoredSidecarId(sidecars[0]);
  return guidedAuthorFindStoredSidecarById(selected) || sidecars[0];
}

function guidedAuthorSetDraftSidecarTarget(id) {
  guidedAuthorDraftTargetSidecarId = String(id || '');
}

function guidedAuthorStoredSidecarSelectorHtml() {
  var sidecars = guidedAuthorStoredSidecars();
  if (!sidecars.length) return '<div class="guided-author-edit-note is-warning">No active browser sidecar is saved yet. Load, validate, and save a source sidecar before applying drafts.</div>';
  if (sidecars.length === 1) {
    return '<div class="guided-author-edit-note is-info">Target active sidecar: <strong>' + guidedEsc(guidedAuthorStoredSidecarTitle(sidecars[0])) + '</strong></div>';
  }
  var preferred = guidedAuthorPreferredDraftTargetSidecarId();
  var selected = preferred || guidedAuthorDraftTargetSidecarId || guidedAuthorStoredSidecarId(sidecars[0]);
  if (preferred && guidedAuthorDraftTargetSidecarId !== preferred) guidedAuthorDraftTargetSidecarId = preferred;
  return '<label class="guided-author-field"><span>Target active sidecar</span><select id="guided-author-draft-sidecar-target" onchange="guidedAuthorSetDraftSidecarTarget(this.value)">'
    + sidecars.map(function(sidecar){
      var id = guidedAuthorStoredSidecarId(sidecar);
      return '<option value="' + guidedEsc(id) + '"' + (String(id) === String(selected) ? ' selected' : '') + '>' + guidedEsc(guidedAuthorStoredSidecarTitle(sidecar)) + '</option>';
    }).join('')
    + '</select></label>';
}

function guidedAuthorBuildReviewEditPreflightForTarget(target) {
  var counts = guidedAuthorDraftReviewCounts();
  var policyCount = guidedNodePolicyLocalEditCount();
  var footprintCount = guidedNodeFootprintLocalEditCount();
  var totalDrafts = guidedAuthorDraftTotalFromCounts(counts, policyCount, footprintCount);
  var result = {
    counts: counts,
    policyCount: policyCount,
    footprintCount: footprintCount,
    totalDrafts: totalDrafts,
    sidecarCount: guidedAuthorStoredSidecars().length,
    target: target || null,
    targetTitle: target ? guidedAuthorStoredSidecarTitle(target) : '',
    appliedCount: 0,
    missedCount: totalDrafts,
    errors: null,
    warnings: null,
    willClearText: 'No drafts will be cleared yet.',
    canApply: false
  };
  if (!target) return result;
  var built = guidedAuthorBuildSidecarWithReviewEdits(target, { includeNodeSettings: true });
  var report = guidedAuthorValidateSidecarObject(built.sidecar, guidedAuthorStoredSidecarTitle(target) + ' with drafts');
  result.appliedCount = guidedAuthorAppliedReviewEditCount(built.applied);
  result.missedCount = (built.missed || []).length;
  result.errors = report && report.totals ? Number(report.totals.errors || 0) : 0;
  result.warnings = report && report.totals ? Number(report.totals.warnings || 0) : 0;
  result.canApply = result.appliedCount > 0;
  result.willClearText = result.appliedCount
    ? (result.appliedCount + ' matching draft' + (result.appliedCount === 1 ? '' : 's') + ' will clear after apply. ' + (result.missedCount ? result.missedCount + ' unmatched draft' + (result.missedCount === 1 ? '' : 's') + ' will remain local.' : 'No unmatched drafts will remain.'))
    : 'No drafts match this active sidecar, so applying will not clear anything.';
  return result;
}

function guidedAuthorSidecarWorkspaceSelectedId() {
  var sidecars = guidedAuthorStoredSidecars();
  if (!sidecars.length) {
    guidedAuthorSidecarWorkspaceId = '';
    return '';
  }
  if (guidedAuthorSidecarWorkspaceId && guidedAuthorFindStoredSidecarById(guidedAuthorSidecarWorkspaceId)) return guidedAuthorSidecarWorkspaceId;
  var preferred = guidedAuthorPreferredDraftTargetSidecarId() || guidedAuthorDraftTargetSidecarId || guidedAuthorSidecarSnapshotTargetId;
  if (preferred && guidedAuthorFindStoredSidecarById(preferred)) {
    guidedAuthorSidecarWorkspaceId = preferred;
    return preferred;
  }
  guidedAuthorSidecarWorkspaceId = guidedAuthorStoredSidecarId(sidecars[0]);
  return guidedAuthorSidecarWorkspaceId;
}

function guidedAuthorSelectSidecarWorkspace(id) {
  guidedAuthorSidecarWorkspaceId = String(id || '');
  if (guidedAuthorSidecarWorkspaceId) {
    guidedAuthorDraftTargetSidecarId = guidedAuthorSidecarWorkspaceId;
    guidedAuthorSidecarSnapshotTargetId = guidedAuthorSidecarWorkspaceId;
  }
  renderGuidedView();
}

function guidedAuthorSetSidecarLibrarySearch(value) {
  guidedAuthorSidecarLibrarySearch = String(value || '');
  guidedAuthorSidecarLibraryLimit = GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INITIAL;
  renderGuidedView();
}

function guidedAuthorSetSidecarLibraryFilter(value) {
  guidedAuthorSidecarLibraryFilter = String(value || 'all');
  guidedAuthorSidecarLibraryLimit = GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INITIAL;
  renderGuidedView();
}

function guidedAuthorClearSidecarLibraryFilters() {
  guidedAuthorSidecarLibrarySearch = '';
  guidedAuthorSidecarLibraryFilter = 'all';
  guidedAuthorSidecarLibraryLimit = GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INITIAL;
  renderGuidedView();
}

function guidedAuthorShowMoreSidecars() {
  guidedAuthorSidecarLibraryLimit = Math.max(
    GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INITIAL,
    parseInt(guidedAuthorSidecarLibraryLimit, 10) || GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INITIAL
  ) + GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INCREMENT;
  renderGuidedView();
}

function guidedAuthorOpenWorkspaceReviewEdits(id) {
  if (id) guidedAuthorSetDraftSidecarTarget(id);
  guidedAuthorSetTab('reviewEdits');
}

function guidedAuthorWorkspaceApplyDrafts(id, force) {
  if (id) guidedAuthorSetDraftSidecarTarget(id);
  guidedAuthorApplyDraftsToActiveSidecar(!!force);
}

function guidedAuthorWorkspaceSaveFullWithDrafts(id) {
  if (id) guidedAuthorSetDraftSidecarTarget(id);
  guidedAuthorSaveFullDraftedSidecarJsonFile();
}

function guidedAuthorWorkspaceCopyFullWithDrafts(id) {
  if (id) guidedAuthorSetDraftSidecarTarget(id);
  guidedAuthorExportFullDraftedSidecar();
}

function guidedAuthorWorkspaceSnapshot(id) {
  if (id) guidedAuthorSetSnapshotSidecarTarget(id);
  guidedAuthorTakeActiveSidecarSnapshot();
}

function guidedAuthorPreviewSidecarId() {
  if (!guidedAuthorValidatedSidecarObject || !guidedAuthorSidecarValidationReport) return '';
  return guidedSidecarStorageId(guidedAuthorValidatedSidecarObject, guidedAuthorSidecarValidationReport);
}

function guidedAuthorPreviewSidecarFingerprint() {
  if (!guidedAuthorValidatedSidecarObject) return '';
  return guidedSidecarContentFingerprint(guidedAuthorValidatedSidecarObject);
}

function guidedAuthorPreviewMatchesActiveSidecar() {
  var id = guidedAuthorPreviewSidecarId();
  if (!id) return false;
  var stored = guidedAuthorFindStoredSidecarById(id);
  if (!stored) return false;
  var meta = stored.__studydeckSidecar || {};
  return String(meta.contentFingerprint || guidedSidecarContentFingerprint(stored)) === String(guidedAuthorPreviewSidecarFingerprint());
}

function guidedAuthorLoadSidecarSnapshot() {
  try {
    var raw = localStorage.getItem(GUIDED_SIDECAR_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.sidecar) return null;
    return parsed;
  } catch(e) {
    return null;
  }
}

function guidedAuthorSaveSidecarSnapshot(snapshot) {
  var payload = JSON.stringify(snapshot || {});
  if (typeof safeSetLocalStorage === 'function') {
    return safeSetLocalStorage(GUIDED_SIDECAR_SNAPSHOT_STORAGE_KEY, payload, 'Guided sidecar snapshot');
  }
  try {
    localStorage.setItem(GUIDED_SIDECAR_SNAPSHOT_STORAGE_KEY, payload);
    return true;
  } catch(e) {
    return false;
  }
}

function guidedAuthorSelectedSnapshotSidecarId() {
  var el = typeof document !== 'undefined' ? document.getElementById('guided-sidecar-snapshot-target') : null;
  if (el && el.value) guidedAuthorSidecarSnapshotTargetId = el.value;
  var sidecars = guidedAuthorStoredSidecars();
  if (!guidedAuthorSidecarSnapshotTargetId && sidecars.length) guidedAuthorSidecarSnapshotTargetId = guidedAuthorStoredSidecarId(sidecars[0]);
  return guidedAuthorSidecarSnapshotTargetId || '';
}

function guidedAuthorSelectedSnapshotSidecar() {
  return guidedAuthorFindStoredSidecarById(guidedAuthorSelectedSnapshotSidecarId()) || guidedAuthorStoredSidecars()[0] || null;
}

function guidedAuthorSetSnapshotSidecarTarget(id) {
  guidedAuthorSidecarSnapshotTargetId = String(id || '');
  renderGuidedView();
}

function guidedAuthorSidecarSnapshotSelectorHtml() {
  var sidecars = guidedAuthorStoredSidecars();
  if (!sidecars.length) return '<div class="guided-author-edit-note is-warning">No active browser sidecar is saved yet. Save a sidecar as active before taking a snapshot.</div>';
  var selected = guidedAuthorSelectedSnapshotSidecarId();
  return '<label class="guided-author-field"><span>Active sidecar to protect</span><select id="guided-sidecar-snapshot-target" onchange="guidedAuthorSetSnapshotSidecarTarget(this.value)">'
    + sidecars.map(function(sidecar){
      var id = guidedAuthorStoredSidecarId(sidecar);
      return '<option value="' + guidedEsc(id) + '"' + (String(id) === String(selected) ? ' selected' : '') + '>' + guidedEsc(guidedAuthorStoredSidecarTitle(sidecar)) + '</option>';
    }).join('')
    + '</select></label>';
}

function guidedAuthorTakeActiveSidecarSnapshot() {
  var sidecar = guidedAuthorSelectedSnapshotSidecar();
  if (!sidecar) {
    alert('Save an active sidecar before taking a snapshot.');
    return;
  }
  var meta = sidecar.__studydeckSidecar || {};
  var snapshot = {
    version: 1,
    createdAt: new Date().toISOString(),
    sidecarId: guidedAuthorStoredSidecarId(sidecar),
    title: guidedAuthorStoredSidecarTitle(sidecar),
    fingerprint: meta.contentFingerprint || guidedSidecarContentFingerprint(sidecar),
    sourceName: meta.sourceName || sidecar.title || sidecar.name || '',
    sidecar: guidedSidecarClone(sidecar)
  };
  if (!guidedAuthorSaveSidecarSnapshot(snapshot)) {
    alert('StudyDeck could not save the sidecar snapshot in this browser. No active sidecar was changed.');
    return;
  }
  renderGuidedView();
  if (typeof showXpToast === 'function') showXpToast('Active sidecar snapshot saved.');
}

function guidedAuthorClearActiveSidecarSnapshot() {
  appConfirm(
    'Clear active sidecar snapshot?',
    'This deletes only the browser-local snapshot. It does not change any active sidecar or source JSON file.',
    'Clear snapshot',
    'btn-soft',
    function(ok) {
      if (!ok) return;
      try { localStorage.removeItem(GUIDED_SIDECAR_SNAPSHOT_STORAGE_KEY); } catch(e) {}
      renderGuidedView();
    }
  );
}

function guidedAuthorRestoreActiveSidecarSnapshot() {
  var snapshot = guidedAuthorLoadSidecarSnapshot();
  if (!snapshot || !snapshot.sidecar) {
    alert('No active sidecar snapshot is available to restore.');
    return;
  }
  appConfirm(
    'Restore snapshot as active sidecar?',
    'This replaces the matching active browser sidecar with the saved snapshot. It does not write a source JSON file on disk. Export the active sidecar afterward if you want a file copy.',
    'Restore snapshot',
    'btn-gold',
    function(ok) {
      if (!ok) return;
      var sidecar = guidedSidecarClone(snapshot.sidecar) || {};
      var report = guidedAuthorValidateSidecarObject(sidecar, (snapshot.title || 'Sidecar snapshot') + ' restored snapshot');
      var prepared = guidedAuthorCommitActiveSidecar(sidecar, report, snapshot.sidecarId || guidedSidecarStorageId(sidecar, report));
      guidedAuthorSidecarSnapshotTargetId = prepared.id;
      renderGuidedView();
    }
  );
}

function guidedAuthorStableSidecarValue(value) {
  if (Array.isArray(value)) return value.map(guidedAuthorStableSidecarValue);
  if (value && typeof value === 'object') {
    var out = {};
    Object.keys(value).sort().forEach(function(key){
      if (key === '__studydeckSidecar') return;
      out[key] = guidedAuthorStableSidecarValue(value[key]);
    });
    return out;
  }
  return value;
}

function guidedAuthorSidecarSubtreeText(value) {
  try { return JSON.stringify(guidedAuthorStableSidecarValue(value)); } catch(e) { return String(value == null ? '' : value); }
}

function guidedAuthorSidecarSubtreeChanged(a, b) {
  return guidedAuthorSidecarSubtreeText(a) !== guidedAuthorSidecarSubtreeText(b);
}

function guidedAuthorSidecarEntryMap(sidecar) {
  var map = {};
  guidedAuthorSidecarCardEntries(sidecar).forEach(function(item){
    var uid = guidedSidecarNormalizeUid(guidedAuthorSidecarEntryUid(item));
    if (uid) map[uid] = item.entry || {};
  });
  return map;
}

function guidedAuthorSidecarMapStoreForCompare(sidecar) {
  var maps = sidecar && sidecar.guidedLearning && sidecar.guidedLearning.maps;
  if (Array.isArray(maps)) {
    var keyed = {};
    maps.forEach(function(map, idx){
      if (!map || typeof map !== 'object') return;
      var id = guidedNormalizeMapId(map.id || map.mapId || ('map_' + idx));
      if (id) keyed[id] = map;
    });
    return keyed;
  }
  if (maps && typeof maps === 'object') return maps;
  if (sidecar && sidecar.maps && typeof sidecar.maps === 'object') return sidecar.maps;
  return {};
}

function guidedAuthorSidecarCompareTotals(sidecar) {
  var entries = guidedAuthorSidecarCardEntries(sidecar);
  var totals = { cards: entries.length, questions: 0, briefings: 0, events: 0, maps: 0, labels: 0 };
  entries.forEach(function(item){
    totals.questions += guidedAuthorSidecarArrayField(item.entry, 'questions').length;
    totals.briefings += guidedAuthorSidecarArrayField(item.entry, 'briefingScreens').length;
    if (guidedAuthorSidecarObjectField(item.entry, 'eventStructure')) totals.events += 1;
  });
  var maps = guidedAuthorSidecarMapStoreForCompare(sidecar);
  Object.keys(maps || {}).forEach(function(mapId){
    var map = maps[mapId] || {};
    totals.maps += 1;
    totals.labels += (Array.isArray(map.placeLabels) ? map.placeLabels.length : 0)
      + (Array.isArray(map.landmarkLabels) ? map.landmarkLabels.length : 0);
  });
  return totals;
}

function guidedAuthorQuestionIdentity(question, idx) {
  return String(question && (question.id || question.key || question.questionId || '') || ('question_' + idx));
}

function guidedAuthorQuestionMapById(entry) {
  var out = {};
  guidedAuthorSidecarArrayField(entry, 'questions').forEach(function(question, idx){
    out[guidedAuthorQuestionIdentity(question, idx)] = question;
  });
  return out;
}

function guidedAuthorBuildSidecarCompareReport(activeSidecar, comparisonSidecar, comparisonLabel) {
  var activeMap = guidedAuthorSidecarEntryMap(activeSidecar);
  var compareMap = guidedAuthorSidecarEntryMap(comparisonSidecar);
  var activeUids = Object.keys(activeMap).sort();
  var compareUids = Object.keys(compareMap).sort();
  var compareLookup = {};
  compareUids.forEach(function(uid){ compareLookup[uid] = true; });
  var activeLookup = {};
  activeUids.forEach(function(uid){ activeLookup[uid] = true; });
  var onlyActive = activeUids.filter(function(uid){ return !compareLookup[uid]; });
  var onlyCompare = compareUids.filter(function(uid){ return !activeLookup[uid]; });
  var shared = activeUids.filter(function(uid){ return compareLookup[uid]; });
  var changedCards = [];
  shared.forEach(function(uid){
    var activeEntry = activeMap[uid] || {};
    var compareEntry = compareMap[uid] || {};
    var changes = [];
    if (guidedAuthorSidecarSubtreeChanged(guidedAuthorSidecarObjectField(activeEntry, 'mapLocation'), guidedAuthorSidecarObjectField(compareEntry, 'mapLocation'))) changes.push('map setup');
    if (guidedAuthorSidecarSubtreeChanged(guidedAuthorSidecarArrayField(activeEntry, 'briefingScreens'), guidedAuthorSidecarArrayField(compareEntry, 'briefingScreens'))) changes.push('briefings');
    if (guidedAuthorSidecarSubtreeChanged(guidedAuthorSidecarArrayField(activeEntry, 'questions'), guidedAuthorSidecarArrayField(compareEntry, 'questions'))) changes.push('questions');
    if (guidedAuthorSidecarSubtreeChanged(guidedAuthorSidecarObjectField(activeEntry, 'eventStructure'), guidedAuthorSidecarObjectField(compareEntry, 'eventStructure'))) changes.push('event board');
    if (changes.length) changedCards.push({ uid: uid, changes: changes });
  });
  var activeTotals = guidedAuthorSidecarCompareTotals(activeSidecar);
  var compareTotals = guidedAuthorSidecarCompareTotals(comparisonSidecar);
  var globalMapsChanged = guidedAuthorSidecarSubtreeChanged(guidedAuthorSidecarMapStoreForCompare(activeSidecar), guidedAuthorSidecarMapStoreForCompare(comparisonSidecar));
  var fingerprintActive = guidedSidecarContentFingerprint(activeSidecar);
  var fingerprintCompare = guidedSidecarContentFingerprint(comparisonSidecar);
  return {
    comparisonLabel: comparisonLabel || 'comparison sidecar',
    activeTitle: guidedAuthorStoredSidecarTitle(activeSidecar || {}),
    comparisonTitle: comparisonSidecar && (comparisonSidecar.title || comparisonSidecar.name) || comparisonLabel || 'comparison sidecar',
    fingerprintsMatch: fingerprintActive === fingerprintCompare,
    activeFingerprint: fingerprintActive,
    comparisonFingerprint: fingerprintCompare,
    activeTotals: activeTotals,
    comparisonTotals: compareTotals,
    sharedCards: shared.length,
    onlyActive: onlyActive,
    onlyCompare: onlyCompare,
    changedCards: changedCards,
    globalMapsChanged: globalMapsChanged
  };
}

function guidedAuthorRenderSidecarCompareReport(report) {
  if (!report) return '';
  var status = report.fingerprintsMatch ? 'ok' : 'warning';
  var changedPreview = report.changedCards.slice(0, 10).map(function(row){
    return '<span><strong>' + guidedEsc(row.uid) + '</strong> ' + guidedEsc(row.changes.join(', ')) + '</span>';
  }).join('');
  var countLine = [
    'Cards ' + report.activeTotals.cards + ' → ' + report.comparisonTotals.cards,
    'Questions ' + report.activeTotals.questions + ' → ' + report.comparisonTotals.questions,
    'Briefings ' + report.activeTotals.briefings + ' → ' + report.comparisonTotals.briefings,
    'Maps ' + report.activeTotals.maps + ' → ' + report.comparisonTotals.maps,
    'Labels ' + report.activeTotals.labels + ' → ' + report.comparisonTotals.labels
  ].join(' · ');
  return '<div class="guided-author-sidecar-row is-' + guidedEsc(status) + '">'
    + '<strong>' + guidedEsc(report.comparisonLabel) + '</strong>'
    + '<span>' + guidedEsc(report.fingerprintsMatch ? 'Same content fingerprint as selected active sidecar.' : 'Different from selected active sidecar.') + '</span>'
    + '<span>' + guidedEsc(countLine) + '</span>'
    + '<span>' + guidedEsc(report.sharedCards + ' shared cards · ' + report.onlyActive.length + ' only in active · ' + report.onlyCompare.length + ' only in comparison' + (report.globalMapsChanged ? ' · shared map labels differ' : '')) + '</span>'
    + (changedPreview ? '<div class="guided-author-warning-more">' + changedPreview + (report.changedCards.length > 10 ? '<span>+' + guidedEsc(report.changedCards.length - 10) + ' more changed card' + (report.changedCards.length - 10 === 1 ? '' : 's') + '</span>' : '') + '</div>' : '')
    + '<details class="guided-author-details"><summary><span><strong>Raw compare details</strong><em>Fingerprints and UID-only differences.</em></span><b>Open</b></summary><div class="guided-author-details-body">'
    + '<div class="guided-summary-note"><strong>Fingerprints</strong><br>' + guidedEsc('Active: ' + report.activeFingerprint + ' · Comparison: ' + report.comparisonFingerprint) + '</div>'
    + (report.onlyActive.length ? '<div class="guided-summary-note"><strong>Only in active</strong><br>' + guidedEsc(report.onlyActive.join(', ')) + '</div>' : '')
    + (report.onlyCompare.length ? '<div class="guided-summary-note"><strong>Only in comparison</strong><br>' + guidedEsc(report.onlyCompare.join(', ')) + '</div>' : '')
    + '</div></details>'
    + '</div>';
}

function guidedAuthorCopySidecarMapStores(target, active) {
  if (!target || !active) return 0;
  var copied = 0;
  if (active.guidedLearning && active.guidedLearning.maps) {
    if (!target.guidedLearning || typeof target.guidedLearning !== 'object' || Array.isArray(target.guidedLearning)) target.guidedLearning = {};
    target.guidedLearning.maps = guidedSidecarClone(active.guidedLearning.maps);
    copied += 1;
  }
  if (active.maps) {
    target.maps = guidedSidecarClone(active.maps);
    copied += 1;
  }
  return copied;
}

function guidedAuthorCopyActiveQuestionMapTuning(targetQuestion, activeQuestion) {
  if (!targetQuestion || !activeQuestion) return 0;
  var changed = 0;
  ['mapId', 'mapOptions', 'crop'].forEach(function(key){
    if (activeQuestion[key] !== undefined) {
      targetQuestion[key] = guidedSidecarClone(activeQuestion[key]);
      changed += 1;
    }
  });
  return changed;
}

function guidedAuthorCopyActiveEntryMapTuning(targetEntry, activeEntry) {
  if (!targetEntry || !activeEntry) return { mapLocations: 0, mapPanels: 0, mapQuestions: 0 };
  var out = { mapLocations: 0, mapPanels: 0, mapQuestions: 0 };
  var activeGl = activeEntry.guidedLearning || {};
  var targetGl = guidedAuthorEnsureSidecarGuidedLearning(targetEntry);
  if (activeGl.mapLocation || activeEntry.mapLocation) {
    targetGl.mapLocation = guidedSidecarClone(activeGl.mapLocation || activeEntry.mapLocation);
    out.mapLocations += 1;
  }
  var activeScreens = guidedAuthorSidecarArrayField(activeEntry, 'briefingScreens');
  var targetScreens = guidedAuthorSidecarArrayField(targetEntry, 'briefingScreens');
  if (activeScreens.length && targetScreens.length) {
    if (!Array.isArray(targetGl.briefingScreens)) targetGl.briefingScreens = targetScreens;
    var activeById = {};
    activeScreens.forEach(function(screen, idx){
      var id = String(screen && (screen.id || screen.key || '') || ('screen_' + idx));
      activeById[id] = screen;
    });
    targetGl.briefingScreens.forEach(function(screen, idx){
      if (!screen || typeof screen !== 'object') return;
      var id = String(screen.id || screen.key || '' || ('screen_' + idx));
      var activeScreen = activeById[id];
      if (activeScreen && activeScreen.mapPanel) {
        screen.mapPanel = guidedSidecarClone(activeScreen.mapPanel);
        out.mapPanels += 1;
      }
    });
  }
  var activeQuestions = guidedAuthorQuestionMapById(activeEntry);
  var targetQuestions = guidedAuthorSidecarArrayField(targetEntry, 'questions');
  targetQuestions.forEach(function(question, idx){
    var id = guidedAuthorQuestionIdentity(question, idx);
    var activeQuestion = activeQuestions[id];
    var type = guidedNormalizeChallengeInteractionType(question && (question.interactionType || question.type || question.kind || ''));
    if (activeQuestion && type === 'map_pin_choice' && guidedAuthorCopyActiveQuestionMapTuning(question, activeQuestion)) out.mapQuestions += 1;
  });
  if (targetQuestions.length && targetGl.questions !== targetQuestions && Array.isArray(targetGl.questions)) {
    targetGl.questions = targetQuestions;
  }
  return out;
}

function guidedAuthorBuildSidecarWithActiveMapTuning(sourceSidecar, activeSidecar) {
  var merged = guidedSidecarClone(sourceSidecar || {}) || {};
  var summary = { cards: 0, mapLocations: 0, mapPanels: 0, mapQuestions: 0, mapStores: 0 };
  summary.mapStores = guidedAuthorCopySidecarMapStores(merged, activeSidecar);
  var activeMap = guidedAuthorSidecarEntryMap(activeSidecar);
  var mergedItems = guidedAuthorSidecarCardEntries(merged);
  mergedItems.forEach(function(item){
    var uid = guidedSidecarNormalizeUid(guidedAuthorSidecarEntryUid(item));
    var activeEntry = uid ? activeMap[uid] : null;
    if (!activeEntry) return;
    var copied = guidedAuthorCopyActiveEntryMapTuning(item.entry, activeEntry);
    if (copied.mapLocations || copied.mapPanels || copied.mapQuestions) {
      summary.cards += 1;
      summary.mapLocations += copied.mapLocations;
      summary.mapPanels += copied.mapPanels;
      summary.mapQuestions += copied.mapQuestions;
    }
  });
  return { sidecar: merged, summary: summary };
}

function guidedAuthorMergeActiveMapTuningIntoLoadedPreview() {
  var activeSidecar = guidedAuthorSelectedSnapshotSidecar();
  if (!activeSidecar) {
    alert('Save an active sidecar before merging active map tuning.');
    return;
  }
  if (!guidedAuthorValidatedSidecarObject || !guidedAuthorSidecarValidationReport) {
    alert('Load and validate the updated source sidecar file first. Then this tool can merge active browser map tuning into that loaded preview.');
    return;
  }
  var previewTitle = guidedAuthorSidecarValidationReport.sourceName || guidedAuthorValidatedSidecarObject.title || 'loaded source preview';
  appConfirm(
    'Merge active map tuning into loaded preview?',
    'This replaces the active browser sidecar with the loaded source preview plus map-related tuning copied from the selected active sidecar: card map locations, study-map crops, shared map labels, and Map Pin coordinates/crops. It does not write a source JSON file on disk; export the active sidecar afterward.',
    'Merge and save active',
    'btn-gold',
    function(ok) {
      if (!ok) return;
      var built = guidedAuthorBuildSidecarWithActiveMapTuning(guidedAuthorValidatedSidecarObject, activeSidecar);
      var report = guidedAuthorValidateSidecarObject(built.sidecar, previewTitle + ' merged with active map tuning');
      var id = guidedSidecarStorageId(guidedAuthorValidatedSidecarObject, guidedAuthorSidecarValidationReport);
      var prepared = guidedAuthorCommitActiveSidecar(built.sidecar, report, id);
      guidedAuthorSidecarSnapshotTargetId = prepared.id;
      if (typeof showXpToast === 'function') {
        showXpToast('Merged active map tuning into loaded preview: ' + built.summary.cards + ' card' + (built.summary.cards === 1 ? '' : 's') + ' touched.');
      }
    }
  );
}

function guidedAuthorRenderSidecarSnapshotSummary(snapshot) {
  if (!snapshot || !snapshot.sidecar) return '<div class="guided-author-edit-note is-warning">No snapshot yet. Take a snapshot before loading or saving over an active sidecar if you want a restore point.</div>';
  var totals = guidedAuthorSidecarCompareTotals(snapshot.sidecar);
  return '<div class="guided-author-edit-note is-info"><strong>Snapshot saved:</strong> '
    + guidedEsc(snapshot.title || 'Active sidecar')
    + ' · ' + guidedEsc(guidedFormatTimestamp(snapshot.createdAt || ''))
    + ' · ' + guidedEsc(totals.cards + ' cards · ' + totals.questions + ' questions · ' + totals.briefings + ' briefings · fingerprint ' + (snapshot.fingerprint || guidedSidecarContentFingerprint(snapshot.sidecar)))
    + '</div>';
}

function guidedAuthorRenderSidecarSnapshotPanel() {
  var activeSidecar = guidedAuthorSelectedSnapshotSidecar();
  var snapshot = guidedAuthorLoadSidecarSnapshot();
  var hasPreview = !!(guidedAuthorValidatedSidecarObject && guidedAuthorSidecarValidationReport);
  var canMerge = activeSidecar && hasPreview;
  var previewCompare = activeSidecar && hasPreview
    ? guidedAuthorBuildSidecarCompareReport(activeSidecar, guidedAuthorValidatedSidecarObject, 'Selected active vs loaded source preview')
    : null;
  var snapshotCompare = activeSidecar && snapshot && snapshot.sidecar
    ? guidedAuthorBuildSidecarCompareReport(activeSidecar, snapshot.sidecar, 'Selected active vs saved snapshot')
    : null;
  return ''
    + '<div class="guided-card guided-sidecar-card" id="guided-sidecar-snapshot-merge">'
    +   '<div class="guided-section-kicker">Protect · Compare · Merge</div>'
    +   '<div class="guided-card-title">' + guidedAuthorHelpTitle('Reconcile active work with source files', 'sidecars-snapshot-compare-merge', 'Use this area only when you suspect the active browser copy and the source JSON file on disk are not the same. The active browser copy is what Guided Learning is using right now. The source JSON file is just a file until you load and save it active. Compare before replacing anything so you can see what would change. Merge is for the special case where you want the loaded source copy, but also want to preserve map tuning that currently lives only in the browser copy. Nothing here writes directly to disk; after a merge, save or export the full sidecar JSON if you want a source file to match.') + '</div>'
    +   '<div class="guided-card-sub">This is the recovery lane for active-vs-source drift. It never writes directly to disk. If you merge, export the active sidecar afterward to make a source JSON file match the browser copy.</div>'
    +   '<div class="guided-sidecar-workbench">'
    +     '<section class="guided-sidecar-phase" id="guided-sidecar-protect-section">'
    +       '<div class="guided-section-kicker">1 · Protect active work</div>'
    +       '<h4>Snapshot before replacing or merging</h4>'
    +       '<p>Choose the active browser sidecar that contains work you do not want to lose, then save a browser-local restore point.</p>'
    +       guidedAuthorSidecarSnapshotSelectorHtml()
    +       guidedAuthorRenderSidecarSnapshotSummary(snapshot)
    +       '<div class="guided-author-actions">'
    +         '<button class="btn btn-gold" onclick="guidedAuthorTakeActiveSidecarSnapshot()"' + (activeSidecar ? '' : ' disabled') + '>Snapshot selected active sidecar</button>'
    +         '<button class="btn btn-soft" onclick="guidedAuthorRestoreActiveSidecarSnapshot()"' + (snapshot && snapshot.sidecar ? '' : ' disabled') + '>Restore snapshot as active</button>'
    +         '<button class="btn btn-soft" onclick="guidedAuthorClearActiveSidecarSnapshot()"' + (snapshot && snapshot.sidecar ? '' : ' disabled') + '>Clear snapshot</button>'
    +       '</div>'
    +       (snapshotCompare ? '<div class="guided-sidecar-phase-compare">' + guidedAuthorRenderSidecarCompareReport(snapshotCompare) + '</div>' : '')
    +     '</section>'
    +     '<section class="guided-sidecar-phase" id="guided-sidecar-compare-section">'
    +       '<div class="guided-section-kicker">2 · Compare loaded source</div>'
    +       '<h4>See what differs before saving</h4>'
    +       '<p>The source preview below is inactive until saved. Compare it with the selected active sidecar before replacing browser state.</p>'
    +       (previewCompare ? guidedAuthorRenderSidecarCompareReport(previewCompare) : guidedAuthorEmptyState(
              'No source preview loaded.',
              'Load and validate a source sidecar below when you want to compare it with the selected active browser copy.',
              ''
            ))
    +     '</section>'
    +     '<section class="guided-sidecar-phase is-merge" id="guided-sidecar-merge-section">'
    +       '<div class="guided-section-kicker">3 · Merge only if needed</div>'
    +       '<h4>Keep source copy, preserve map tuning</h4>'
    +       '<p>This action saves the loaded preview as active, then copies selected active map tuning into it: card map locations, study-map crops, shared map labels, and Map Pin coordinates/crops.</p>'
    +       '<div class="guided-author-actions">'
    +         '<button class="btn btn-soft" onclick="guidedAuthorMergeActiveMapTuningIntoLoadedPreview()"' + (canMerge ? '' : ' disabled') + '>Merge active map tuning into loaded preview</button>'
    +       '</div>'
    +       '<div class="guided-author-edit-note is-info"><strong>Safe merge scope:</strong> copy/content/question changes come from the loaded preview. Map tuning comes from the selected active browser sidecar. Nothing is written to disk until you export or save JSON.</div>'
    +     '</section>'
    +   '</div>'
    + '</div>';
}

function guidedAuthorBuildSidecarHealthReports() {
  return (guidedSidecarStore && guidedSidecarStore.sidecars || []).slice().map(guidedBuildSidecarHealthReport);
}

function guidedAuthorBuildSidecarHealthAggregate(reports) {
  return (reports || []).reduce(function(out, health){
    var t = health.totals || {};
    out.sidecarCards += Number(t.sidecarCards || 0) || 0;
    out.matchedCards += Number(t.matchedCards || 0) || 0;
    out.missingCards += Number(t.missingCards || 0) || 0;
    out.errors += Number(t.validationErrors || 0) || 0;
    out.warnings += Number(t.validationWarnings || 0) || 0;
    out.questions += Number(t.questions || 0) || 0;
    out.questionBankQuestions += Number(t.questionBankQuestions || 0) || 0;
    out.practiceQuestions += Number(t.practiceQuestions || 0) || 0;
    out.briefingScreens += Number(t.briefingScreens || 0) || 0;
    out.genericLearnFallbacks += Number(t.genericLearnFallbacks || 0) || 0;
    return out;
  }, { sidecarCards: 0, matchedCards: 0, missingCards: 0, errors: 0, warnings: 0, questions: 0, questionBankQuestions: 0, practiceQuestions: 0, briefingScreens: 0, genericLearnFallbacks: 0 });
}

function guidedAuthorBuildSidecarHealthRowModel(health) {
  var sidecar = health.sidecar || {};
  var meta = health.meta || {};
  var totals = health.totals || {};
  var id = meta.id || guidedSidecarStorageId(sidecar, null);
  var sourceBits = [];
  if (health.sourceDeckName) sourceBits.push('Source deck: ' + health.sourceDeckName);
  if (health.sourceTranslation) sourceBits.push('Translation: ' + health.sourceTranslation);
  sourceBits.push('UID policy: ' + health.uidPolicy);
  var policyUsableLine = 'Policy usable: '
    + totals.learnQuestions + ' Learn · '
    + totals.practiceQuestions + ' Practice · '
    + totals.challengeQuestions + ' Challenge';
  return {
    id: id,
    title: health.title,
    status: health.status === 'ok' ? 'ok' : health.status === 'warning' ? 'warning' : 'error',
    recentlySaved: guidedAuthorSidecarJustSavedId && String(guidedAuthorSidecarJustSavedId) === String(id) && (Date.now() - guidedAuthorSidecarJustSavedAt) < 9000,
    deckMatchLine: (health.matchedDeck ? ('Matched deck: ' + health.matchedDeck.name + ' · ') : 'No matched deck · ')
      + totals.matchedCards + '/' + totals.sidecarCards + ' UID matches · '
      + (totals.missingCards ? totals.missingCards + ' missing UID/card' + (totals.missingCards === 1 ? '' : 's') : '0 missing'),
    questionLine: [
      (totals.questionBankQuestions || totals.questions || 0) + ' bank questions',
      totals.briefingScreens + ' Briefings',
      totals.eventStructures + ' Event boards',
      totals.scholarQuestions + ' Scholar'
    ].join(' · ') + ' · ' + policyUsableLine + ' · ' + totals.usableQuestions + ' usable · ' + totals.validationErrors + ' errors · ' + totals.validationWarnings + ' warnings',
    validationErrors: Number(totals.validationErrors || 0) || 0,
    validationWarnings: Number(totals.validationWarnings || 0) || 0,
    interactionLine: guidedSidecarInteractionMixText(health.interactionCounts || {}),
    genericLine: totals.genericLearnFallbacks
      ? totals.genericLearnFallbacks + ' generic Learn fallback pattern' + (totals.genericLearnFallbacks === 1 ? '' : 's') + ' still active'
      : 'No generic Learn fallback patterns recorded',
    hasGenericFallbacks: !!totals.genericLearnFallbacks,
    savedLine: ((guidedAuthorSidecarJustSavedId && String(guidedAuthorSidecarJustSavedId) === String(id) && (Date.now() - guidedAuthorSidecarJustSavedAt) < 9000)
      ? 'Saved just now'
      : (health.importedAt ? 'Saved ' + guidedFormatTimestamp(health.importedAt) : 'Saved date unavailable')) + ' · ' + sourceBits.join(' · '),
    missingEntries: health.missingEntries || [],
    isGeography: guidedAuthorIsGeographySidecar(sidecar)
  };
}

function guidedAuthorInlineJsArg(value) {
  return guidedEsc(JSON.stringify(String(value == null ? '' : value)));
}

function guidedAuthorSidecarIssueFilterForBriefing(issue) {
  var code = String(issue && issue.code || '');
  if (code.indexOf('evidence') !== -1) return 'evidence';
  if (code.indexOf('line') !== -1) return 'line';
  if (code.indexOf('reference') !== -1) return 'reference';
  if (code.indexOf('meta') !== -1) return 'meta';
  return 'warning';
}

function guidedAuthorOpenStoredSidecarIssues(sidecarId, severity) {
  var id = String(sidecarId || '');
  var targetSeverity = String(severity || 'warning') === 'error' ? 'error' : 'warning';
  var sidecar = guidedAuthorFindStoredSidecarById(id);
  if (!sidecar) {
    if (typeof showXpToast === 'function') showXpToast('That active sidecar is no longer available.', 3200);
    return;
  }
  guidedAuthorSidecarWorkspaceId = id;
  guidedAuthorDraftTargetSidecarId = id;
  var report = null;
  try {
    report = guidedAuthorValidateSidecarObject(sidecar, guidedAuthorStoredSidecarTitle(sidecar));
  } catch(e) {
    report = null;
  }
  var issues = report && Array.isArray(report.issues) ? report.issues : [];
  var issue = issues.find(function(item){
    return targetSeverity === 'error'
      ? item && item.severity === 'error'
      : item && item.severity !== 'error';
  });
  if (!issue) {
    guidedAuthorSetTab('sidecars');
    if (typeof showXpToast === 'function') {
      showXpToast('No ' + targetSeverity + 's found for this sidecar right now.', 2800);
    }
    return;
  }
  var issueCode = String(issue.code || '');
  if (issueCode.indexOf('briefing_') === 0 && typeof guidedAuthorBriefingBrowserSidecarRecords === 'function') {
    var briefingRecords = guidedAuthorBriefingBrowserSidecarRecords(sidecar, 0);
    var briefingTarget = briefingRecords.find(function(record){
      return String(record.cardUid || '') === String(issue.uid || '')
        && String(record.screenId || '') === String(issue.questionId || issue.detail || '');
    }) || briefingRecords.find(function(record){
      return String(record.cardUid || '') === String(issue.uid || '')
        && (record.issueTypes || []).indexOf(guidedAuthorSidecarIssueFilterForBriefing(issue)) !== -1;
    }) || briefingRecords.find(function(record){
      return String(record.cardUid || '') === String(issue.uid || '')
        && (record.warnings || []).length;
    });
    if (briefingTarget && typeof guidedAuthorBriefingBrowserEnsureState === 'function') {
      var briefingState = guidedAuthorBriefingBrowserEnsureState();
      briefingState.category = briefingTarget.categoryId || 'all';
      briefingState.stage = briefingTarget.stage || 'all';
      briefingState.card = briefingTarget.cardKey || 'all';
      briefingState.evidence = 'all';
      briefingState.issue = guidedAuthorSidecarIssueFilterForBriefing(issue);
      briefingState.search = '';
      briefingState.selectedKey = briefingTarget.key;
      briefingState.listLimit = GUIDED_AUTHOR_LIST_WINDOW_INITIAL;
      guidedAuthorSetTab('briefings');
      return;
    }
  }
  if (issue.questionId && typeof guidedAuthorQuestionBrowserSidecarQuestionRecords === 'function') {
    var questionRecords = guidedAuthorQuestionBrowserSidecarQuestionRecords(sidecar, 0);
    var questionTarget = questionRecords.find(function(record){
      return String(record.cardUid || '') === String(issue.uid || '')
        && String(record.questionId || (record.question && record.question.id) || '') === String(issue.questionId || '');
    });
    if (questionTarget && typeof guidedAuthorQuestionBrowserEnsureState === 'function') {
      var questionState = guidedAuthorQuestionBrowserEnsureState();
      questionState.view = 'authored';
      questionState.category = questionTarget.categoryId || 'all';
      questionState.stage = questionTarget.stage || 'all';
      questionState.card = questionTarget.cardKey || 'all';
      questionState.scope = 'all';
      questionState.interaction = questionTarget.interaction || 'all';
      questionState.search = '';
      questionState.selectedKey = questionTarget.key;
      questionState.listLimit = GUIDED_AUTHOR_LIST_WINDOW_INITIAL;
      guidedAuthorSetTab('questions');
      return;
    }
  }
  guidedAuthorSetTab('sidecars');
  if (typeof showXpToast === 'function') {
    showXpToast('Opened Sidecars. This issue does not have a direct editor jump yet.', 3600);
  }
}

function guidedAuthorRenderSidecarIssueJump(row, severity, label, className) {
  if (!row || !row.id) return guidedEsc(label || '');
  var count = severity === 'error' ? Number(row.validationErrors || 0) : Number(row.validationWarnings || 0);
  if (!count) return guidedEsc(label || '');
  return '<button type="button" class="' + guidedEsc(className || 'guided-sidecar-inline-issue-link') + '" onclick="guidedAuthorOpenStoredSidecarIssues(' + guidedAuthorInlineJsArg(row.id) + ', ' + guidedAuthorInlineJsArg(severity) + ')">' + guidedEsc(label || '') + '</button>';
}

function guidedAuthorRenderSidecarQuestionLine(row) {
  var parts = (row && row.questionLine || '').split(' · ');
  var errorText = (row && Number(row.validationErrors || 0) || 0) + ' errors';
  var warningText = (row && Number(row.validationWarnings || 0) || 0) + ' warnings';
  if (parts.length >= 2) {
    parts.splice(Math.max(0, parts.length - 2), 2);
  }
  return guidedEsc(parts.join(' · '))
    + (parts.length ? ' · ' : '')
    + guidedAuthorRenderSidecarIssueJump(row, 'error', errorText)
    + ' · '
    + guidedAuthorRenderSidecarIssueJump(row, 'warning', warningText);
}

function guidedAuthorRenderSidecarHealthSummaryPills(reports, aggregate) {
  if (!reports || !reports.length) return '';
  return '<div class="guided-progress-row">'
    + '<span class="guided-progress-pill">' + guidedEsc(reports.length + ' active sidecar' + (reports.length === 1 ? '' : 's')) + '</span>'
    + '<span class="guided-progress-pill">' + guidedEsc(aggregate.matchedCards + '/' + aggregate.sidecarCards + ' UID matches') + '</span>'
    + '<span class="guided-progress-pill">' + guidedEsc((aggregate.questionBankQuestions || aggregate.questions) + ' bank questions') + '</span>'
    + '<span class="guided-progress-pill">' + guidedEsc(aggregate.briefingScreens + ' Briefings') + '</span>'
    + '<span class="guided-progress-pill' + (aggregate.missingCards ? ' is-warning' : '') + '">' + guidedEsc(aggregate.missingCards + ' missing') + '</span>'
    + '<span class="guided-progress-pill' + (aggregate.errors ? ' is-warning' : '') + '">' + guidedEsc(aggregate.errors + ' errors') + '</span>'
	    + '<span class="guided-progress-pill' + (aggregate.warnings ? ' is-warning' : '') + '">' + guidedEsc(aggregate.warnings + ' warnings') + '</span>'
	    + '</div>';
}

function guidedAuthorRenderSidecarMissingPreview(row) {
  var entries = row.missingEntries || [];
  if (!entries.length) return '';
  return '<div class="guided-author-warning-more">Missing: '
    + guidedEsc(entries.slice(0, 4).map(function(item){ return item.uid || item.titleHint || item.reason; }).join(', '))
    + (entries.length > 4 ? ' +' + guidedEsc(entries.length - 4) + ' more' : '')
    + '</div>';
}

function guidedAuthorRenderSidecarHealthRow(row) {
  var actions = ''
    + '<button class="btn btn-gold" onclick="guidedAuthorSaveStoredSidecarJsonFile(\'' + guidedEsc(row.id) + '\')">Save active sidecar JSON</button>'
    + (row.isGeography ? '<button class="btn btn-soft" onclick="guidedAuthorMergeGeographyCopyFixesIntoActiveSidecar(\'' + guidedEsc(row.id) + '\')">Merge Geography text fixes</button>' : '')
    + '<button class="btn btn-soft" onclick="guidedAuthorDeleteSidecar(\'' + guidedEsc(row.id) + '\')">Delete browser copy</button>';
  return ''
    + '<div class="guided-author-sidecar-row is-' + guidedEsc(row.status) + (row.recentlySaved ? ' is-recently-saved' : '') + '">'
    +   '<strong>' + guidedEsc(row.title) + '</strong>'
    +   '<span><b class="guided-author-active-now">Active now</b> · Active browser sidecar · This is what Guided uses at runtime</span>'
    +   '<span>' + guidedEsc(row.deckMatchLine) + '</span>'
    +   '<span>' + guidedAuthorRenderSidecarQuestionLine(row) + '</span>'
    +   '<span>' + guidedEsc(row.interactionLine) + '</span>'
    +   '<span class="' + (row.hasGenericFallbacks ? 'is-warning' : '') + '">' + guidedEsc(row.genericLine) + '</span>'
    +   '<span>' + guidedEsc(row.savedLine) + '</span>'
    +   guidedAuthorRenderSidecarMissingPreview(row)
    +   '<div class="guided-author-actions">' + actions + '</div>'
    + '</div>';
}

function guidedAuthorRenderSidecarHealthRows(reports) {
  if (!reports || !reports.length) {
    return guidedAuthorEmptyState(
      'No active browser sidecar yet.',
      'A JSON file on disk is only a source file. Load a source sidecar below, validate it, then save it as active before Guided Learning can use it.',
      ''
    );
  }
  return reports.map(function(health){
    return guidedAuthorRenderSidecarHealthRow(guidedAuthorBuildSidecarHealthRowModel(health));
  }).join('');
}

function guidedAuthorRenderSidecarHealthPanel() {
  var sidecars = (guidedSidecarStore && guidedSidecarStore.sidecars || []).slice();
  var reports = guidedAuthorBuildSidecarHealthReports();
  var aggregate = guidedAuthorBuildSidecarHealthAggregate(reports);
	  return ''
	    + '<div id="guided-sidecar-health" class="guided-card guided-sidecar-card guided-sidecar-stage-card">'
	    +   '<div class="guided-section-kicker">1 · Active browser sidecars</div>'
    +   '<div class="guided-card-title">' + guidedAuthorHelpTitle('What Guided Learning uses right now', 'sidecars-active-sidecar', 'This list shows the sidecar copies saved inside the browser. These active copies are what Guided Learning actually uses when you study. A JSON file in the sidecars folder is only a source file; it has no effect until you load it, validate it, and save it as active. If you make edits in the browser, those edits live in the active browser copy first. Save or export the active sidecar JSON when you want the file on disk to catch up.') + '</div>'
	    +   '<div class="guided-card-sub">Active means runtime-ready. A JSON file on disk is only a source file until you load, validate, and save it as active.</div>'
    +   '<div class="guided-sidecar-guidance"><strong>Usual action:</strong> use <strong>Save active sidecar JSON</strong> on the exact sidecar row after browser edits are applied. Use <strong>Merge Geography text fixes</strong> only to pull latest Geography briefing copy into the active sidecar while preserving tuned maps, pins, labels, and crops.</div>'
    +   guidedAuthorRenderSidecarHealthSummaryPills(reports, aggregate)
    +   guidedAuthorRenderSidecarHealthRows(reports)
    +   '<details class="guided-author-details guided-sidecar-advanced"><summary><span><strong>Advanced browser-store backup</strong><em>Copies the whole internal sidecar store, including StudyDeck metadata. Use individual JSON export for normal source files.</em></span><b>Open</b></summary><div class="guided-author-details-body"><div class="guided-author-actions"><button class="btn btn-soft" onclick="guidedAuthorExportStoredSidecars()"' + (sidecars.length ? '' : ' disabled') + '>Copy browser sidecar backup</button></div></div></details>'
    + '</div>';
}

function guidedAuthorRenderSavedSidecarsPanel() {
  return guidedAuthorRenderSidecarHealthPanel();
}

function guidedAuthorRenderSidecarLibraryFilters(activeFilter) {
  var filters = [
    ['all', 'All'],
    ['drafts', 'Has drafts'],
    ['issues', 'Needs attention'],
    ['geography', 'Geography'],
    ['recent', 'Saved recently']
  ];
  return '<div class="guided-sidecar-library-filters">'
    + filters.map(function(item){
      var active = String(activeFilter || 'all') === item[0];
      return '<button type="button" class="guided-sidecar-library-filter' + (active ? ' is-active' : '') + '" onclick="guidedAuthorSetSidecarLibraryFilter(\'' + guidedEsc(item[0]) + '\')">' + guidedEsc(item[1]) + '</button>';
    }).join('')
    + '</div>';
}

function guidedAuthorSidecarLibraryRowMatches(row, preflight, search, filter) {
  var haystack = [
    row.title,
    row.status,
    row.deckMatchLine,
    row.questionLine,
    row.interactionLine,
    row.savedLine
  ].join(' ').toLowerCase();
  if (search && haystack.indexOf(search.toLowerCase()) === -1) return false;
  if (filter === 'drafts') return preflight.appliedCount > 0;
  if (filter === 'issues') return row.status !== 'ok' || row.hasGenericFallbacks;
  if (filter === 'geography') return !!row.isGeography;
  if (filter === 'recent') return !!row.recentlySaved;
  return true;
}

function guidedAuthorRenderSidecarLibraryRow(row, preflight, selected) {
  var statusText = row.status === 'ok' ? 'OK' : row.status === 'warning' ? 'Warnings' : 'Errors';
  var uidMatch = (row.deckMatchLine.match(/(\d+\/\d+) UID/) || [,'0/0'])[1];
  var questionBits = (row.questionLine || '').split(' · ');
  var compactCounts = [uidMatch, questionBits[0] || '', questionBits[1] || ''].filter(Boolean).join(' · ');
  var draftText = preflight.appliedCount
    ? preflight.appliedCount + ' draft' + (preflight.appliedCount === 1 ? '' : 's')
    : 'No drafts';
  var statusHtml = row.status === 'ok'
    ? '<b>OK</b>'
    : '<b class="guided-sidecar-library-status-link is-' + guidedEsc(row.status) + '" role="button" tabindex="0" onclick="event.stopPropagation(); guidedAuthorOpenStoredSidecarIssues(' + guidedAuthorInlineJsArg(row.id) + ', ' + guidedAuthorInlineJsArg(row.status === 'error' ? 'error' : 'warning') + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();event.stopPropagation();guidedAuthorOpenStoredSidecarIssues(' + guidedAuthorInlineJsArg(row.id) + ', ' + guidedAuthorInlineJsArg(row.status === 'error' ? 'error' : 'warning') + ')}">' + guidedEsc(statusText) + '</b>';
  return ''
    + '<div class="guided-sidecar-library-row is-' + guidedEsc(row.status) + (selected ? ' is-selected' : '') + '">'
    +   '<button type="button" class="guided-sidecar-library-main" onclick="guidedAuthorSelectSidecarWorkspace(\'' + guidedEsc(row.id) + '\')" aria-pressed="' + (selected ? 'true' : 'false') + '">'
    +     '<span><strong>' + guidedEsc(row.title) + '</strong><em>' + guidedEsc(compactCounts) + '</em></span>'
    +     statusHtml
    +   '</button>'
    +   '<div class="guided-sidecar-library-meta"><span class="' + (preflight.appliedCount ? 'is-review' : '') + '">' + guidedEsc(draftText) + '</span></div>'
    + '</div>';
}

function guidedAuthorBuildSidecarLibraryModels() {
  return guidedAuthorBuildSidecarHealthReports().map(function(health){
    var row = guidedAuthorBuildSidecarHealthRowModel(health);
    var preflight = guidedAuthorBuildReviewEditPreflightForTarget(health.sidecar || null);
    return { health: health, row: row, preflight: preflight };
  });
}

function guidedAuthorRenderSidecarLibrary() {
  var selectedId = guidedAuthorSidecarWorkspaceSelectedId();
  var search = String(guidedAuthorSidecarLibrarySearch || '');
  var filter = String(guidedAuthorSidecarLibraryFilter || 'all');
  var filterLabels = [
    { value: 'drafts', label: 'Has drafts' },
    { value: 'issues', label: 'Needs attention' },
    { value: 'geography', label: 'Geography' },
    { value: 'recent', label: 'Saved recently' }
  ];
  var activeSummary = [];
  if (search.trim()) activeSummary.push({ label: 'Search', value: search.trim(), type: 'search' });
  if (filter !== 'all') activeSummary.push({ label: 'View', value: filterOptionLabel(filterLabels, filter), type: 'status' });
  var models = guidedAuthorBuildSidecarLibraryModels();
  var visible = models.filter(function(model){
    return guidedAuthorSidecarLibraryRowMatches(model.row, model.preflight, search, filter);
  });
  var limit = Math.max(
    GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INITIAL,
    parseInt(guidedAuthorSidecarLibraryLimit, 10) || GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INITIAL
  );
  var shown = visible.slice(0, Math.min(limit, visible.length));
  if (selectedId && !shown.some(function(model){ return String(model.row.id) === String(selectedId); })) {
    var selectedModel = visible.find(function(model){ return String(model.row.id) === String(selectedId); });
    if (selectedModel) shown.push(selectedModel);
  }
  var visibleCount = Math.min(limit, visible.length);
  var footer = visible.length > visibleCount
    ? '<div class="guided-author-list-window-footer"><span>Showing ' + guidedEsc(visibleCount) + ' of ' + guidedEsc(visible.length) + ' sidecars</span><button type="button" class="btn btn-soft" onclick="guidedAuthorShowMoreSidecars()">Show ' + guidedEsc(Math.min(GUIDED_AUTHOR_SIDECAR_LIBRARY_WINDOW_INCREMENT, visible.length - visibleCount)) + ' more</button></div>'
    : '';
  return ''
    + '<div class="guided-card guided-sidecar-library-card">'
    +   '<div class="guided-section-kicker">Sidecars</div>'
    +   '<div class="guided-card-title">' + guidedAuthorHelpTitle('Choose a sidecar workspace', 'sidecars-library-workspace', 'Choose the sidecar you want to work on right now. The list can eventually contain many decks, so search and filter it first, then open one focused workspace below. The workspace actions apply only to the selected sidecar: review drafts, apply drafts, save JSON, inspect warnings, or load a replacement source file. Picking a sidecar here does not change the source file on disk by itself.') + '</div>'
    +   '<label class="guided-author-field guided-sidecar-library-search"><span>Search</span><input type="search" value="' + guidedEsc(search) + '" placeholder="Deck or sidecar name..." oninput="guidedAuthorSetSidecarLibrarySearch(this.value)"></label>'
    +   guidedAuthorRenderSidecarLibraryFilters(filter)
    +   renderFilterActiveSummary(activeSummary, 'guidedAuthorClearSidecarLibraryFilters()')
    +   '<div class="guided-sidecar-library-count">' + guidedEsc(visible.length + ' matching · ' + models.length + ' active') + '</div>'
    +   '<div class="guided-sidecar-library-list">'
    +     (shown.length ? shown.map(function(model){
            return guidedAuthorRenderSidecarLibraryRow(model.row, model.preflight, String(model.row.id) === String(selectedId));
          }).join('') : guidedAuthorEmptyState(
            'No sidecars match these filters.',
            'The library is being narrowed by the search box or filter chip above. Clear filters to show every active sidecar again.',
            activeSummary.length ? '<button type="button" class="btn btn-soft" onclick="guidedAuthorClearSidecarLibraryFilters()">Clear filters</button>' : ''
          ))
    +     footer
    +   '</div>'
    + '</div>';
}

function guidedAuthorRenderSidecarWorkspaceStats(row, preflight) {
  return '<div class="guided-sidecar-workspace-stats">'
    + '<div><span>Cards</span><strong>' + guidedEsc((row.deckMatchLine.match(/(\d+\/\d+) UID/) || [,'0/0'])[1]) + '</strong></div>'
    + '<div><span>Drafts</span><strong>' + guidedEsc(preflight.appliedCount) + '</strong></div>'
    + '<div><span>Status</span><strong>' + (row.status === 'ok' ? 'OK' : guidedAuthorRenderSidecarIssueJump(row, row.status === 'error' ? 'error' : 'warning', row.status === 'warning' ? 'Warnings' : 'Errors')) + '</strong></div>'
    + '</div>';
}

function guidedAuthorActionCluster(label, body, extraClass) {
  var className = 'guided-author-action-cluster' + (extraClass ? ' ' + extraClass : '');
  return '<div class="' + guidedEsc(className) + '">'
    + (label ? '<div class="guided-author-action-cluster-label">' + guidedEsc(label) + '</div>' : '')
    + '<div class="guided-author-action-cluster-row">' + (body || '') + '</div>'
    + '</div>';
}

function guidedAuthorRenderSaveFlowStatus() {
  if (!guidedAuthorSaveFlowStatus) return '';
  var kind = guidedAuthorSaveFlowStatus.kind || 'info';
  var safeKind = /^(success|info|warning|error)$/.test(kind) ? kind : 'info';
  return '<div class="guided-author-save-flow-status is-' + guidedEsc(safeKind) + '" role="status">'
    + '<strong>' + guidedEsc(guidedAuthorSaveFlowStatus.title || 'Action finished') + '</strong>'
    + (guidedAuthorSaveFlowStatus.body ? '<span>' + guidedEsc(guidedAuthorSaveFlowStatus.body) + '</span>' : '')
    + '</div>';
}

function guidedAuthorRenderSidecarWorkspacePrimary(row, preflight) {
  var id = row.id;
  var statusText = row.status === 'ok' ? 'OK' : row.status === 'warning' ? 'Warnings' : 'Errors';
  var validationText = preflight.errors == null ? 'Not checked' : (preflight.errors + ' errors · ' + preflight.warnings + ' warnings');
  return ''
    + '<section class="guided-sidecar-workspace-section guided-sidecar-workspace-primary">'
    +   '<div class="guided-sidecar-workspace-top">'
    +     '<div>'
    +       '<div class="guided-section-kicker">Selected sidecar</div>'
    +       '<h4>' + guidedEsc(row.title) + '</h4>'
    +     '</div>'
    +     (row.status === 'ok'
            ? '<b class="guided-sidecar-workspace-status is-ok">' + guidedEsc(statusText) + '</b>'
            : guidedAuthorRenderSidecarIssueJump(row, row.status === 'error' ? 'error' : 'warning', statusText, 'guided-sidecar-workspace-status guided-sidecar-status-link is-' + row.status))
    +   '</div>'
    +   guidedAuthorRenderSidecarWorkspaceStats(row, preflight)
    +   guidedAuthorRenderSidecarMissingPreview(row)
   +   '<div class="guided-sidecar-mini-status">'
   +     '<span>' + guidedEsc(preflight.appliedCount ? (preflight.appliedCount + ' draft' + (preflight.appliedCount === 1 ? '' : 's') + ' ready') : 'No drafts ready') + '</span>'
   +     '<span>' + guidedEsc(preflight.missedCount ? (preflight.missedCount + ' for other sidecars') : 'This sidecar only') + '</span>'
   +     '<span class="' + (preflight.errors ? 'is-warning' : '') + '">' + guidedEsc(validationText) + '</span>'
   +   '</div>'
   +   '<div class="guided-sidecar-workspace-action-groups">'
   +     guidedAuthorActionCluster('Main actions', ''
          + '<button class="btn btn-gold" onclick="guidedAuthorWorkspaceApplyDrafts(\'' + guidedEsc(id) + '\', false)"' + (preflight.appliedCount ? '' : ' disabled') + '>Apply local drafts</button>'
          + '<button class="btn btn-soft" onclick="guidedAuthorSaveStoredSidecarJsonFile(\'' + guidedEsc(id) + '\')">Save full JSON</button>', 'is-primary')
   +     guidedAuthorActionCluster('Review tools', ''
          + '<button class="btn btn-soft" onclick="guidedAuthorOpenWorkspaceReviewEdits(\'' + guidedEsc(id) + '\')">Review local drafts</button>'
          + '<button class="btn btn-soft" onclick="guidedAuthorExportContentHandoffBundle(\'' + guidedEsc(id) + '\')">Export content handoff</button>'
          + '<button class="btn btn-soft" onclick="guidedAuthorSetTab(\'coverage\')">Open Coverage</button>'
          + '<button class="btn btn-soft" onclick="guidedAuthorSetTab(\'contentQa\')">Open Content QA</button>', 'is-secondary')
   +   '</div>'
   +   '<details class="guided-author-details guided-sidecar-compact-details"><summary><span><strong>Details</strong><em>Counts, interaction mix, and save status.</em></span><b>Open</b></summary><div class="guided-author-details-body"><div class="guided-sidecar-workspace-lines">'
   +     '<span>' + guidedAuthorRenderSidecarQuestionLine(row) + '</span>'
   +     '<span>' + guidedEsc(row.interactionLine) + '</span>'
   +     '<span class="' + (row.hasGenericFallbacks ? 'is-warning' : '') + '">' + guidedEsc(row.genericLine) + '</span>'
    +     '<span>' + guidedEsc(row.savedLine) + '</span>'
    +   '</div></div></details>'
    + '</section>';
}

function guidedAuthorRenderSidecarSourceLoader() {
  var open = guidedAuthorSidecarSourceLoaderOpen || !!guidedAuthorSidecarValidationReport || !!guidedAuthorValidatedSidecarObject || !!guidedAuthorSidecarPasteText;
  return '<details class="guided-author-details guided-sidecar-source-loader guided-sidecar-utility"' + (open ? ' open' : '') + ' ontoggle="guidedAuthorSetSidecarSourceLoaderOpen(this.open)"><summary><span><strong>Import source JSON</strong><em>Load a file only when you need to replace or refresh the browser copy.</em></span><b>Open</b></summary><div class="guided-author-details-body">' + guidedAuthorRenderSidecarValidator() + '</div></details>';
}

function guidedAuthorRenderSidecarWorkspaceDanger(row) {
  var recovery = row.isGeography
    ? guidedAuthorActionCluster('Recovery', '<button class="btn btn-soft" onclick="guidedAuthorMergeGeographyCopyFixesIntoActiveSidecar(\'' + guidedEsc(row.id) + '\')">Merge Geography text fixes</button>', 'is-secondary')
    : '';
  return '<details class="guided-author-details guided-sidecar-advanced guided-sidecar-utility"><summary><span><strong>Advanced</strong><em>Delete this browser copy or export the internal store.</em></span><b>Open</b></summary><div class="guided-author-details-body"><div class="guided-sidecar-source-action-groups">'
    + recovery
    + guidedAuthorActionCluster('Backup', '<button class="btn btn-soft" onclick="guidedAuthorExportStoredSidecars()">Copy browser sidecar backup</button>', 'is-secondary')
    + guidedAuthorActionCluster('Remove', '<button class="btn btn-soft" onclick="guidedAuthorDeleteSidecar(\'' + guidedEsc(row.id) + '\')">Delete browser copy</button>', 'is-danger')
    + '</div></div></details>';
}

function guidedAuthorRenderSidecarWorkspace() {
  var selectedId = guidedAuthorSidecarWorkspaceSelectedId();
  var models = guidedAuthorBuildSidecarLibraryModels();
  var selected = models.find(function(model){ return String(model.row.id) === String(selectedId); });
  if (!selected) {
    return ''
      + '<div class="guided-sidecar-workspace-card">'
      +   guidedAuthorRenderSaveFlowStatus()
      +   '<div class="guided-card guided-sidecar-empty-workspace">'
      +     '<div class="guided-section-kicker">Workspace</div>'
      +     '<div class="guided-card-title">No active sidecar yet</div>'
      +     '<div class="guided-card-sub">Load a JSON source file to make a browser-active copy.</div>'
      +   '</div>'
      +   guidedAuthorRenderSidecarSourceLoader()
      + '</div>';
  }
  guidedAuthorDraftTargetSidecarId = selected.row.id;
  return ''
    + '<div class="guided-sidecar-workspace-card">'
    +   guidedAuthorRenderSaveFlowStatus()
    +   '<div class="guided-sidecar-workspace-stack">'
    +     guidedAuthorRenderSidecarWorkspacePrimary(selected.row, selected.preflight)
    +   '</div>'
    +   guidedAuthorRenderReturnedSidecarImporter(selected.row)
    +   guidedAuthorRenderSidecarSourceLoader()
    +   guidedAuthorRenderSidecarWorkspaceDanger(selected.row)
    + '</div>';
}

function guidedAuthorRenderSidecarLibraryWorkspace() {
  return '<div class="guided-sidecar-library-workspace">'
    + guidedAuthorRenderSidecarLibrary()
    + guidedAuthorRenderSidecarWorkspace()
    + '</div>';
}

function guidedAuthorRenderSidecarIssueList(report) {
  var issues = (report && report.issues || []).slice(0, 12);
  if (!issues.length) return '<div class="guided-author-good">No sidecar validation issues found.</div>';
  return '<div class="guided-author-warning-list">' + issues.map(function(issue){
    return ''
      + '<div class="guided-author-warning is-' + guidedEsc(issue.severity || 'warning') + '">'
      +   '<strong>' + guidedEsc((issue.code || 'issue') + (issue.uid ? (' · ' + issue.uid) : '') + (issue.questionId ? (' · ' + issue.questionId) : '')) + '</strong>'
      +   '<span>' + guidedEsc(issue.message || '') + (issue.detail ? ' ' + guidedEsc(issue.detail) : '') + '</span>'
      + '</div>';
  }).join('') + ((report.issues || []).length > issues.length ? '<div class="guided-author-warning-more">+' + guidedEsc((report.issues || []).length - issues.length) + ' more issue' + (((report.issues || []).length - issues.length) === 1 ? '' : 's') + '</div>' : '') + '</div>';
}

function guidedAuthorRenderSidecarCardRows(report) {
  var cards = (report && report.cardReports || []).slice(0, 12);
  if (!cards.length) return guidedAuthorEmptyState('No card entries to preview.', 'This sidecar preview did not include any card-level guided content.', '');
  return '<div class="guided-author-example-list">' + cards.map(function(card){
    var status = card.errors ? 'error' : (card.warnings ? 'warning' : 'ok');
    var questionCount = card.questionBankQuestions != null && card.questionBankQuestions
      ? (card.questionBankQuestions || 0) + (card.eventStructure ? 1 : 0)
      : (card.learnQuestions || 0) + (card.practiceQuestions || 0) + (card.challengeQuestions || 0) + (card.scholarQuestions || 0) + (card.eventStructure ? 1 : 0);
    var questionLine = questionCount + ' question' + (questionCount === 1 ? '' : 's') + ' · ' + (card.briefingScreens || 0) + ' briefing' + ((card.briefingScreens || 0) === 1 ? '' : 's') + ' · ' + card.detailKeys.length + ' detail key' + (card.detailKeys.length === 1 ? '' : 's');
    var matchLine = card.deckCardMatched
      ? ('UID matched ' + (card.deckCardAnswer || card.deckCardId))
      : card.diagnosticCardMatched
        ? ('diagnostic ' + (card.matchReason || 'fallback') + ' match; cardUid must be fixed')
        : 'missing UID match';
    return ''
      + '<div class="guided-author-sidecar-row is-' + guidedEsc(status) + '">'
      +   '<strong>' + guidedEsc(card.uid) + (card.titleHint ? ' · ' + guidedEsc(card.titleHint) : '') + '</strong>'
      +   '<span>' + guidedEsc(matchLine + ' · ' + questionLine + (card.hasPassageEvidence ? ' · evidence note found' : ' · missing ' + card.passageEvidenceLabel)) + '</span>'
      + '</div>';
  }).join('') + ((report.cardReports || []).length > cards.length ? '<div class="guided-author-warning-more">+' + guidedEsc((report.cardReports || []).length - cards.length) + ' more card' + (((report.cardReports || []).length - cards.length) === 1 ? '' : 's') + '</div>' : '') + '</div>';
}

function guidedAuthorRenderSidecarValidationReport(report) {
  if (!report) return guidedAuthorEmptyState('No source preview loaded.', 'Load or paste a sidecar JSON file when you want to inspect or replace the browser-active copy.', '');
  var totals = report.totals || {};
  var deckLine = report.matchedDeck
    ? ('Matched deck: ' + report.matchedDeck.name + ' (' + report.matchedDeck.reason + ')')
    : 'No matching deck found';
  var patternKeys = Object.keys(report.patternCounts || {});
  var patternLine = patternKeys.length
    ? '<div class="guided-summary-note"><strong>Question patterns</strong><br>' + guidedEsc(patternKeys.map(function(pattern){ return pattern + ': ' + report.patternCounts[pattern]; }).join(' | ')) + '</div>'
    : '';
  var previewBits = [
    (totals.matchedCards || 0) + '/' + (totals.sidecarCards || 0) + ' UID matches',
    (totals.questionBankQuestions || totals.questions || 0) + ' bank questions',
    (totals.learnQuestions || 0) + ' Learn-usable',
    (totals.practiceQuestions || 0) + ' Practice-usable',
    (totals.challengeQuestions || 0) + ' Challenge-usable',
    (totals.briefingScreens || 0) + ' Briefings',
    (totals.eventStructures || 0) + ' Event boards',
    (totals.errors || 0) + ' errors',
    (totals.warnings || 0) + ' warnings'
  ];
  if (totals.scholarQuestions) previewBits.push(totals.scholarQuestions + ' Scholar');
  return ''
    + '<div class="guided-summary-note guided-sidecar-preview-note"><strong>Loaded sidecar preview — not active yet</strong><br>' + guidedEsc('Save this preview as the active browser sidecar to make Guided Learning use it. ' + previewBits.join(' · ')) + '</div>'
    + '<div class="guided-summary-grid guided-sidecar-summary">'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Sidecar cards</div><div class="guided-stat-value">' + guidedEsc(totals.sidecarCards || 0) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Matched cards</div><div class="guided-stat-value">' + guidedEsc(totals.matchedCards || 0) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Detail keys</div><div class="guided-stat-value">' + guidedEsc(totals.detailKeys || 0) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Bank questions</div><div class="guided-stat-value">' + guidedEsc(totals.questionBankQuestions || totals.questions || 0) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Usable items</div><div class="guided-stat-value">' + guidedEsc((totals.usableQuestions || 0) + ' / ' + (totals.questions || 0)) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Briefings</div><div class="guided-stat-value">' + guidedEsc(totals.briefingScreens || 0) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Errors</div><div class="guided-stat-value">' + guidedEsc(totals.errors || 0) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Warnings</div><div class="guided-stat-value">' + guidedEsc(totals.warnings || 0) + '</div></div>'
    + '</div>'
    + '<div class="guided-summary-note"><strong>' + guidedEsc(report.sourceName || 'Sidecar JSON') + '</strong><br>' + guidedEsc(deckLine) + '</div>'
    + guidedAuthorDetails('Details', 'Question mix, validation issues, fingerprint, and card preview.', ''
      + patternLine
      + '<div class="guided-summary-note"><strong>Technical ID</strong><br>' + guidedEsc('Fingerprint: ' + guidedSidecarContentFingerprint(guidedAuthorValidatedSidecarObject || {}) + ' · UID matching only at runtime') + '</div>'
      + guidedAuthorRenderInteractionCounts(report.interactionCounts, guidedAuthorInteractionTargetTypes(report.deckCategory || 'atrocities'))
      + '<div class="guided-section-kicker" style="margin-top:14px">Validation issues</div>'
      + guidedAuthorRenderSidecarIssueList(report)
      + '<div class="guided-section-kicker" style="margin-top:14px">Card preview</div>'
      + guidedAuthorRenderSidecarCardRows(report), false);
}

function guidedAuthorRenderReturnedSidecarCompareSummary(summary) {
  if (!summary) return guidedAuthorEmptyState('No returned sidecar selected.', 'Pick an active sidecar first, then load the returned full sidecar JSON from the content chat.', '');
  var contentText = summary.contentChanged.length + ' content card' + (summary.contentChanged.length === 1 ? '' : 's') + ' changed';
  var mapText = summary.mapChanged.length + ' map card' + (summary.mapChanged.length === 1 ? '' : 's') + ' changed'
    + (summary.globalMapsChanged ? ' · shared map labels changed' : '');
  var uidText = summary.onlyReturned.length + ' added · ' + summary.onlyActive.length + ' missing';
  var changedPreview = [];
  if (summary.contentChanged.length) changedPreview.push('Content: ' + summary.contentChanged.slice(0, 12).join(', ') + (summary.contentChanged.length > 12 ? ' +' + (summary.contentChanged.length - 12) : ''));
  if (summary.mapChanged.length || summary.globalMapsChanged) changedPreview.push('Maps: ' + (summary.mapChanged.length ? summary.mapChanged.slice(0, 12).join(', ') : 'shared labels') + (summary.mapChanged.length > 12 ? ' +' + (summary.mapChanged.length - 12) : ''));
  if (summary.onlyReturned.length) changedPreview.push('Only in returned: ' + summary.onlyReturned.slice(0, 10).join(', ') + (summary.onlyReturned.length > 10 ? ' +' + (summary.onlyReturned.length - 10) : ''));
  if (summary.onlyActive.length) changedPreview.push('Only in active: ' + summary.onlyActive.slice(0, 10).join(', ') + (summary.onlyActive.length > 10 ? ' +' + (summary.onlyActive.length - 10) : ''));
  return '<div class="guided-returned-sidecar-compare">'
    + '<div class="guided-sidecar-mini-status">'
    +   '<span class="' + (summary.fingerprintsMatch ? '' : 'is-warning') + '">' + guidedEsc(summary.fingerprintsMatch ? 'Same fingerprint' : 'Different fingerprint') + '</span>'
    +   '<span>' + guidedEsc(contentText) + '</span>'
    +   '<span class="' + (summary.mapChanged.length || summary.globalMapsChanged ? 'is-warning' : '') + '">' + guidedEsc(mapText) + '</span>'
    +   '<span class="' + (summary.onlyReturned.length || summary.onlyActive.length ? 'is-warning' : '') + '">' + guidedEsc(uidText) + '</span>'
    + '</div>'
    + (changedPreview.length ? '<div class="guided-author-warning-more">' + changedPreview.map(function(line){ return '<span>' + guidedEsc(line) + '</span>'; }).join('') + '</div>' : '')
    + '</div>';
}

function guidedAuthorRenderReturnedSidecarReport(report, targetSidecar) {
  if (!report) return guidedAuthorEmptyState('No returned sidecar loaded.', 'Load the full sidecar JSON returned by the content chat. Handoff manifests and patch lists are intentionally rejected here.', '');
  var totals = report.totals || {};
  var rejected = !!report.returnedSidecarRejected;
  var compareSummary = (!rejected && targetSidecar && guidedAuthorReturnedSidecarObject)
    ? guidedAuthorBuildReturnedSidecarCompareSummary(targetSidecar, guidedAuthorReturnedSidecarObject)
    : null;
  var deckLine = report.matchedDeck
    ? ('Matched deck: ' + report.matchedDeck.name + ' (' + report.matchedDeck.reason + ')')
    : 'No matching deck found';
  return ''
    + '<div class="guided-summary-grid guided-sidecar-summary guided-returned-sidecar-summary">'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Cards</div><div class="guided-stat-value">' + guidedEsc(totals.sidecarCards || 0) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Matches</div><div class="guided-stat-value">' + guidedEsc((totals.matchedCards || 0) + '/' + (totals.sidecarCards || 0)) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Questions</div><div class="guided-stat-value">' + guidedEsc(totals.questionBankQuestions || totals.questions || 0) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Briefings</div><div class="guided-stat-value">' + guidedEsc(totals.briefingScreens || 0) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Errors</div><div class="guided-stat-value">' + guidedEsc(totals.errors || 0) + '</div></div>'
    +   '<div class="guided-summary-stat"><div class="guided-stat-label">Warnings</div><div class="guided-stat-value">' + guidedEsc(totals.warnings || 0) + '</div></div>'
    + '</div>'
    + '<div class="guided-summary-note"><strong>' + guidedEsc(report.sourceName || 'Returned sidecar') + '</strong><br>' + guidedEsc(deckLine) + '</div>'
    + guidedAuthorRenderReturnedSidecarCompareSummary(compareSummary)
    + (rejected || (report.issues || []).length
      ? guidedAuthorDetails('Validation issues', 'Shown before saving as active.', guidedAuthorRenderSidecarIssueList(report), false)
      : '');
}

function guidedAuthorRenderReturnedSidecarImporter(row) {
  var targetSidecar = row && row.id ? guidedAuthorFindStoredSidecarById(row.id) : guidedAuthorReturnedSidecarTarget();
  var open = guidedAuthorReturnedSidecarOpen || !!guidedAuthorReturnedSidecarReport || !!guidedAuthorReturnedSidecarObject || !!guidedAuthorReturnedSidecarPasteText;
  var canSave = !!guidedAuthorReturnedSidecarObject && !!guidedAuthorReturnedSidecarReport && !guidedAuthorReturnedSidecarReport.returnedSidecarRejected;
  return '<details class="guided-author-details guided-sidecar-returned-loader guided-sidecar-utility"' + (open ? ' open' : '') + ' ontoggle="guidedAuthorSetReturnedSidecarOpen(this.open)">'
    + '<summary><span><strong>Import returned sidecar</strong><em>Check content-GPT output before activating it.</em></span><b>Open</b></summary>'
    + '<div class="guided-author-details-body">'
    +   '<input id="guided-returned-sidecar-file-input" type="file" accept=".json,application/json" aria-label="Load returned sidecar JSON file" style="display:none" onchange="guidedAuthorLoadReturnedSidecarFile(event)">'
    +   '<textarea id="guided-returned-sidecar-paste" class="guided-sidecar-textarea" rows="5" aria-label="Returned sidecar JSON text" placeholder="Paste returned full sidecar JSON here">' + guidedEsc(guidedAuthorReturnedSidecarPasteText || '') + '</textarea>'
    +   '<div class="guided-sidecar-source-action-groups">'
    +     guidedAuthorActionCluster('Load / check', ''
            + '<button class="btn btn-gold" onclick="guidedAuthorTriggerReturnedSidecarFile()">Choose returned JSON file</button>'
            + '<button class="btn btn-soft" onclick="guidedAuthorValidateReturnedSidecarPaste()">Check pasted JSON</button>', 'is-primary')
    +     guidedAuthorActionCluster('Activate', '<button class="btn btn-gold" onclick="guidedAuthorSaveReturnedSidecarAsActive(false)"' + (canSave ? '' : ' disabled') + '>Save returned preview as active</button>', 'is-primary')
    +     guidedAuthorActionCluster('Clean up', '<button class="btn btn-soft" onclick="guidedAuthorClearReturnedSidecar()">Clear returned preview</button>', 'is-secondary')
    +   '</div>'
    +   guidedAuthorRenderReturnedSidecarReport(guidedAuthorReturnedSidecarReport, targetSidecar)
    + '</div>'
    + '</details>';
}

function guidedAuthorRenderSidecarValidator() {
  var previewMatchesActive = guidedAuthorPreviewMatchesActiveSidecar();
  var saveDisabled = !guidedAuthorValidatedSidecarObject || previewMatchesActive;
  var saveLabel = previewMatchesActive ? 'Already active sidecar' : 'Save preview as active';
  return ''
    + '<div class="guided-card guided-sidecar-card guided-sidecar-stage-card" id="guided-sidecar-source-preview-section">'
      +   '<div class="guided-section-kicker">Source file</div>'
    +   '<div class="guided-card-title">Load, check, then activate</div>'
    +   '<div class="guided-card-sub">Loaded files are previews until you save them active.</div>'
    +   '<input id="guided-sidecar-file-input" type="file" accept=".json,application/json" aria-label="Load source sidecar JSON file" style="display:none" onchange="guidedAuthorLoadSidecarFile(event)">'
    +   '<textarea id="guided-sidecar-paste" class="guided-sidecar-textarea" rows="5" aria-label="Source sidecar JSON text" placeholder="Paste sidecar JSON here">' + guidedEsc(guidedAuthorSidecarPasteText || '') + '</textarea>'
    +   '<div class="guided-sidecar-source-action-groups">'
    +     guidedAuthorActionCluster('Load / check', ''
            + '<button class="btn btn-gold" onclick="guidedAuthorTriggerSidecarFile()">Choose source JSON file</button>'
            + '<button class="btn btn-soft" onclick="guidedAuthorValidateSidecarPaste()">Check pasted JSON</button>', 'is-primary')
    +     guidedAuthorActionCluster('Activate', '<button class="btn btn-gold" onclick="guidedAuthorSaveValidatedSidecar(false)"' + (saveDisabled ? ' disabled' : '') + '>' + guidedEsc(saveLabel) + '</button>', 'is-primary')
    +     guidedAuthorActionCluster('Report / cleanup', ''
            + '<button class="btn btn-soft" onclick="guidedAuthorExportSidecarValidationReport()">Export check report</button>'
            + '<button class="btn btn-soft" onclick="guidedAuthorClearSidecarValidation()">Clear loaded preview</button>', 'is-secondary')
    +   '</div>'
    +   guidedAuthorRenderSidecarValidationReport(guidedAuthorSidecarValidationReport)
    + '</div>';
}

function guidedAuthorSidecarForMapDraft(edit) {
  var targetId = String(edit && edit.targetSidecarId || '').trim();
  if (targetId) {
    var target = guidedAuthorFindStoredSidecarById(targetId);
    if (target) return target;
  }
  return guidedAuthorStoredSidecarByDraftTarget() || guidedAuthorStoredSidecars()[0] || null;
}

function guidedAuthorMapDraftCardTitle(entryItem) {
  var entry = entryItem && entryItem.entry || {};
  var location = guidedAuthorSidecarObjectField(entry, 'mapLocation') || {};
  return entry.titleHint || entry.title || location.label || entry.deckAnswer || '';
}

function guidedAuthorMapDraftQuestionContext(edit) {
  var sidecar = guidedAuthorSidecarForMapDraft(edit);
  var match = sidecar ? guidedAuthorFindSidecarQuestionByDraft(sidecar, {
    cardUid: edit && edit.cardUid,
    questionId: edit && edit.questionId,
    bankQuestionId: edit && edit.questionId
  }) : null;
  return {
    sidecar: sidecar,
    question: match && match.question || null,
    entryItem: match && match.entryItem || (sidecar ? guidedAuthorFindSidecarEntryByUid(sidecar, edit && edit.cardUid) : null)
  };
}

function guidedAuthorMapDraftCoordLabel(x, y) {
  var xNum = Number(x);
  var yNum = Number(y);
  var xText = Number.isFinite(xNum) ? xNum.toFixed(1).replace(/\.0$/, '') : String(x == null ? '' : x);
  var yText = Number.isFinite(yNum) ? yNum.toFixed(1).replace(/\.0$/, '') : String(y == null ? '' : y);
  return xText && yText ? xText + ', ' + yText : 'no coordinates';
}

function guidedAuthorMapDraftEditLabel(edit) {
  var type = String(edit && edit.type || '').trim();
  if (type === 'mapQuestion') return 'Edit in Quiz Pins';
  if (type === 'cardStudyMap' || type === 'mapLocation' || type === 'briefingMapPanel') return 'Edit in Card Map Setup';
  if (type === 'mapLabel') return 'Edit in Advanced Labels';
  return 'Edit in Maps';
}

function guidedAuthorRenderMapDraftEditAction(key, edit) {
  return '<div class="guided-author-map-draft-actions">'
    + '<button type="button" class="btn btn-soft" data-map-draft-key="' + guidedEsc(key) + '" onclick="guidedAuthorOpenMapDraftEditorByKey(this.dataset.mapDraftKey)">'
    + guidedEsc(guidedAuthorMapDraftEditLabel(edit))
    + '</button>'
    + '</div>';
}

function guidedAuthorRenderMapQuestionDraftExample(key, edit) {
  var context = guidedAuthorMapDraftQuestionContext(edit || {});
  var question = context.question || {};
  var prompt = guidedAuthorSidecarPrompt(question) || 'Map Pin question';
  var cardTitle = guidedAuthorMapDraftCardTitle(context.entryItem);
  var uid = guidedSidecarNormalizeUid(edit && edit.cardUid || context.entryItem && guidedAuthorSidecarEntryUid(context.entryItem) || '');
  var mapId = guidedNormalizeMapId(edit && edit.mapId || question.mapId || '');
  var options = Array.isArray(edit && edit.mapOptions)
    ? edit.mapOptions.map(function(option, idx){ return guidedAuthorNormalizeMapOptionDraft(option, idx); }).slice(0, 4)
    : guidedNormalizeMapPinOptions(question, null).slice(0, 4);
  var correct = options.find(function(option){ return option.correct; }) || options[0] || null;
  var crop = edit && edit.crop || question.crop || {};
  var cropBits = [];
  if (crop.minSize != null && crop.minSize !== '') cropBits.push('Close size ' + guidedEsc(crop.minSize));
  if (crop.padding != null && crop.padding !== '') cropBits.push('Padding ' + guidedEsc(crop.padding));
  var pinRows = options.map(function(option, idx){
    var pin = option.pinLabel || guidedLettersForIndex(idx);
    var place = option.placeLabel || option.label || 'Unnamed place';
    var region = option.region ? ' · ' + option.region : '';
    return '<span' + (option.correct ? ' class="is-correct"' : '') + '><strong>Pin ' + guidedEsc(pin) + '</strong> ' + guidedEsc(place + region) + ' <em>' + guidedEsc(guidedAuthorMapDraftCoordLabel(option.x, option.y)) + '</em></span>';
  }).join('');
  var meta = [
    correct ? 'Correct: Pin ' + (correct.pinLabel || '') + (correct.placeLabel ? ' · ' + correct.placeLabel : '') : '',
    cropBits.length ? 'Feedback crop: ' + cropBits.join(' · ') : '',
    mapId ? 'Map: ' + mapId.replace(/_/g, ' ') : ''
  ].filter(Boolean);
  return '<div class="guided-author-example guided-author-map-draft-example">'
    + '<strong>' + guidedEsc((uid || 'Map question') + (cardTitle ? ' · ' + cardTitle : '')) + '</strong>'
    + '<span>Map question draft · ' + guidedEsc(edit && edit.questionId || key) + '</span>'
    + '<em>' + guidedEsc(guidedAuthorPreviewText(prompt, 150)) + '</em>'
    + (meta.length ? '<div class="guided-author-map-draft-meta">' + meta.map(function(bit){ return '<b>' + guidedEsc(bit) + '</b>'; }).join('') + '</div>' : '')
    + (pinRows ? '<div class="guided-author-map-draft-pins">' + pinRows + '</div>' : '')
    + guidedAuthorRenderMapDraftEditAction(key, edit)
    + '</div>';
}

function guidedAuthorRenderMapDraftExample(key, edit) {
  edit = edit || {};
  if (edit.type === 'mapQuestion') return guidedAuthorRenderMapQuestionDraftExample(key, edit);
  var title = edit.cardUid || edit.mapId || key;
  var typeLabel = edit.type === 'mapLocation' ? 'Card map setup draft'
    : edit.type === 'briefingMapPanel' ? 'Briefing map draft'
    : edit.type === 'mapLabel' ? 'Shared map label draft'
    : 'Map draft';
  var preview = edit.label || edit.questionId || edit.briefingId || edit.mapId || '';
  if (edit.type === 'cardStudyMap' && edit.value) {
    var pieces = [];
    if (edit.value.x != null || edit.value.y != null) pieces.push('Anchor ' + guidedAuthorMapDraftCoordLabel(edit.value.x, edit.value.y));
    if (edit.value.labelDx != null || edit.value.labelDy != null) pieces.push('Label offset ' + guidedAuthorMapDraftCoordLabel(edit.value.labelDx, edit.value.labelDy));
    if (edit.value.labelPriority != null && edit.value.labelPriority !== '') pieces.push('Crowding priority ' + edit.value.labelPriority + '/10');
    if (edit.value.crop) {
      pieces.push('Close size ' + (edit.value.crop.minSize || '') + ' · Padding ' + (edit.value.crop.padding || ''));
    }
    if (pieces.length) preview = pieces.join(' · ');
  }
  if (edit.type === 'mapLocation' && (edit.x != null || edit.y != null)) preview = 'Anchor ' + guidedAuthorMapDraftCoordLabel(edit.x, edit.y);
  if (edit.type === 'briefingMapPanel' && edit.mapPanel && edit.mapPanel.crop) {
    preview = 'Map page crop: Close size ' + (edit.mapPanel.crop.minSize || '') + ' · Padding ' + (edit.mapPanel.crop.padding || '');
  }
  return '<div class="guided-author-example guided-author-map-draft-example"><strong>' + guidedEsc(title) + '</strong><span>' + guidedEsc(typeLabel) + '</span><em>' + guidedEsc(guidedAuthorPreviewText(preview, 120)) + '</em>' + guidedAuthorRenderMapDraftEditAction(key, edit) + '</div>';
}

function guidedAuthorDraftTotalFromCounts(counts, policyCount, footprintCount) {
  counts = counts || guidedAuthorDraftReviewCounts();
  return Number(counts.card || 0)
    + Number(counts.question || 0)
    + Number(counts.briefing || 0)
    + Number(counts.event || 0)
    + Number(counts.map || 0)
    + Number(policyCount || 0)
    + Number(footprintCount || 0);
}

function guidedAuthorBuildReviewEditPreflight() {
  return guidedAuthorBuildReviewEditPreflightForTarget(guidedAuthorStoredSidecarByDraftTarget());
}

function guidedAuthorRenderReviewEditWorkflow(hasDrafts, hasActiveSidecar) {
  var steps = [
    {
      num: 1,
      title: 'Review local drafts',
      body: hasDrafts ? 'These changes exist only in this browser until you apply them.' : 'Create edits in Questions, Briefings, Maps, Nodes, or Rewards first.',
      state: hasDrafts ? 'current' : 'pending'
    },
    {
      num: 2,
      title: 'Apply drafts to the active browser sidecar',
      body: hasActiveSidecar ? 'This updates what Guided Learning uses in the browser. It still does not write the source JSON file on disk.' : 'Load, validate, and save a sidecar as active before applying drafts.',
      state: hasDrafts && hasActiveSidecar ? 'current' : (hasActiveSidecar ? 'pending' : 'warning')
    },
    {
      num: 3,
      title: 'Save or export the full sidecar JSON',
      body: 'After applying, export a complete sidecar JSON file so your source file can match the browser-local active sidecar.',
      state: hasActiveSidecar ? 'pending' : 'warning'
    }
  ];
  return '<div class="guided-author-apply-flow">'
    + steps.map(function(step){
      return '<div class="guided-author-workflow-step is-' + guidedEsc(step.state) + '"><strong>' + guidedEsc(step.num) + '</strong><span><b>' + guidedEsc(step.title) + '</b><em>' + guidedEsc(step.body) + '</em></span></div>';
    }).join('')
    + '</div>';
}

function guidedAuthorRenderReviewPreflight(preflight) {
  var validationText = preflight.errors == null
    ? 'Unavailable until an active sidecar is selected.'
    : (preflight.errors + ' errors · ' + preflight.warnings + ' warnings');
  var validationClass = preflight.errors ? ' is-warning' : '';
  var targetText = preflight.targetTitle || 'No active sidecar selected';
  return '<div class="guided-author-preflight">'
    + '<div class="guided-section-kicker">Apply preflight</div>'
    + '<div class="guided-card-sub">This previews what will happen if you press <strong>Apply drafts to active sidecar</strong>. Applying changes the browser-local active sidecar only; exporting is the step that gives you a source JSON file to keep on disk.</div>'
    + '<div class="guided-author-preflight-grid">'
    +   '<div class="guided-author-preflight-card"><span>Selected target</span><strong>' + guidedEsc(targetText) + '</strong><em>' + guidedEsc(preflight.sidecarCount ? 'Active browser sidecar' : 'No saved active sidecar yet') + '</em></div>'
    +   '<div class="guided-author-preflight-card"><span>Will apply</span><strong>' + guidedEsc(preflight.appliedCount + ' draft' + (preflight.appliedCount === 1 ? '' : 's')) + '</strong><em>' + guidedEsc(preflight.appliedCount ? 'These match the selected active sidecar.' : 'Nothing matches the selected target yet.') + '</em></div>'
    +   '<div class="guided-author-preflight-card"><span>Will stay local</span><strong>' + guidedEsc(preflight.missedCount + ' draft' + (preflight.missedCount === 1 ? '' : 's')) + '</strong><em>' + guidedEsc(preflight.missedCount ? 'These did not match the selected target and will remain in Review Edits.' : 'No unmatched drafts detected.') + '</em></div>'
    +   '<div class="guided-author-preflight-card' + validationClass + '"><span>Validation after merge</span><strong>' + guidedEsc(validationText) + '</strong><em>' + guidedEsc(preflight.errors ? 'Review before applying, or apply anyway if the issue is expected.' : 'Merged sidecar validation preview.') + '</em></div>'
    + '</div>'
    + '<div class="guided-author-edit-note ' + (preflight.appliedCount ? 'is-info' : 'is-warning') + '">' + guidedEsc(preflight.willClearText) + '</div>'
    + '</div>';
}

function guidedAuthorRenderReviewStatus(preflight) {
  preflight = preflight || {};
  var targetText = preflight.targetTitle || 'No active sidecar selected';
  var validationText = preflight.errors == null
    ? 'Not checked'
    : (preflight.errors + ' errors · ' + preflight.warnings + ' warnings');
  return '<div class="guided-author-review-status">'
    + '<div><span>Target</span><strong>' + guidedEsc(targetText) + '</strong></div>'
    + '<div><span>Ready</span><strong>' + guidedEsc(preflight.appliedCount || 0) + '</strong></div>'
    + '<div><span>Other</span><strong>' + guidedEsc(preflight.missedCount || 0) + '</strong></div>'
    + '<div class="' + (preflight.errors ? 'is-warning' : '') + '"><span>Check</span><strong>' + guidedEsc(validationText) + '</strong></div>'
    + '</div>'
    + (preflight.willClearText ? '<div class="guided-author-review-note">' + guidedEsc(preflight.willClearText) + '</div>' : '');
}

function guidedAuthorRenderReviewActions(hasDrafts, hasActiveSidecar, directDraftCount, hasNodeSettings) {
  return '<div class="guided-author-review-actions">'
    + guidedAuthorActionCluster('Use drafts', '<button class="btn btn-gold" onclick="guidedAuthorApplyDraftsToActiveSidecar(false)"' + (hasDrafts && hasActiveSidecar ? '' : ' disabled') + '>Apply drafts to active sidecar</button>', 'is-primary')
    + guidedAuthorActionCluster('Save active copy', '<button class="btn btn-soft" onclick="guidedAuthorSaveSelectedActiveSidecarJsonFile()"' + (hasActiveSidecar ? '' : ' disabled') + '>Save active sidecar JSON</button>', 'is-secondary')
    + '<details class="guided-author-review-more">'
    +   '<summary>More actions</summary>'
    +   '<div class="guided-author-actions">'
    +     '<button class="btn btn-soft" onclick="guidedAuthorSaveFullDraftedSidecarJsonFile()"' + (hasActiveSidecar ? '' : ' disabled') + '>Save merged JSON file</button>'
    +     '<button class="btn btn-soft" onclick="guidedAuthorExportFullDraftedSidecar()"' + (hasActiveSidecar ? '' : ' disabled') + '>Copy full JSON text</button>'
    +     '<button class="btn btn-soft" onclick="guidedAuthorExportDraftPatch()"' + (hasDrafts ? '' : ' disabled') + '>Export patch file</button>'
    +     '<button class="btn btn-soft" onclick="guidedAuthorClearDraftPatch()"' + (directDraftCount ? '' : ' disabled') + '>Clear local drafts</button>'
    +     (hasNodeSettings ? '<button class="btn btn-soft" onclick="guidedAuthorClearAllNodePolicy()">Clear local node settings</button>' : '')
    +   '</div>'
    + '</details>'
    + '</div>';
}

function guidedAuthorRenderDraftSection(title, count, summary, rows, open) {
  rows = rows || [];
  if (!count && !rows.length) return '';
  return '<details class="guided-author-draft-section"' + (open ? ' open' : '') + '>'
    + '<summary><span><strong>' + guidedEsc(title) + '</strong>' + (summary ? '<em>' + guidedEsc(summary) + '</em>' : '') + '</span><b>' + guidedEsc(count + ' draft' + (count === 1 ? '' : 's')) + '</b></summary>'
    + '<div class="guided-author-draft-section-body">'
    + (rows.length ? '<div class="guided-author-example-list">' + rows.join('') + '</div>' : guidedAuthorEmptyState('No drafts in this section.', 'This draft group has nothing pending for the selected active sidecar.', ''))
    + '</div>'
    + '</details>';
}

function guidedAuthorDraftObjectRows(group, render) {
  var data = guidedAuthorDraftPatch && guidedAuthorDraftPatch[group] || {};
  return Object.keys(data).sort().map(function(key){
    return render(key, data[key] || {});
  });
}

function guidedAuthorRenderDraftGroups(counts, policyCount, footprintCount) {
  var groups = [];
  groups.push(guidedAuthorRenderDraftSection('Cards', counts.card, 'Card fields', guidedAuthorDraftObjectRows('cardEdits', function(key, edit){
    var title = edit.uid || key;
    var preview = edit.q || edit.a || edit.helperCue || edit.rememberThis || '';
    return '<div class="guided-author-example"><strong>' + guidedEsc(title) + '</strong><span>Card draft · ' + guidedEsc(edit.deckName || edit.deckId || 'card metadata') + '</span><em>' + guidedEsc(guidedAuthorPreviewText(preview, 160)) + '</em></div>';
  }), counts.card > 0));
  groups.push(guidedAuthorRenderDraftSection('Questions', counts.question, 'Question text', guidedAuthorDraftObjectRows('questionEdits', function(key, edit){
    var title = edit.questionId || edit.kind || key;
    var preview = edit.prompt || edit.correctLabel || edit.explanation || '';
    return '<div class="guided-author-example"><strong>' + guidedEsc(title) + '</strong><span>Question draft · ' + guidedEsc(edit.outputPath || edit.kind || '') + '</span><em>' + guidedEsc(guidedAuthorPreviewText(preview, 160)) + '</em></div>';
  }), !counts.card && counts.question > 0));
  groups.push(guidedAuthorRenderDraftSection('Briefings', counts.briefing, 'Briefing text', guidedAuthorDraftObjectRows('briefingEdits', function(key, edit){
    var lines = Array.isArray(edit.lines) ? edit.lines.join(' ') : edit.lines || '';
    return '<div class="guided-author-example"><strong>' + guidedEsc(edit.briefingId || key) + '</strong><span>Briefing draft · ' + guidedEsc(edit.deckName || edit.deckId || '') + '</span><em>' + guidedEsc(guidedAuthorPreviewText(lines, 160)) + '</em></div>';
  }), !counts.card && !counts.question && counts.briefing > 0));
  groups.push(guidedAuthorRenderDraftSection('Event Boards', counts.event, 'Event board slots', guidedAuthorDraftObjectRows('eventStructureEdits', function(key, edit){
    var preview = edit.prompt || edit.moralProblem || edit.action || edit.explanation || '';
    return '<div class="guided-author-example"><strong>' + guidedEsc(edit.cardUid || key) + '</strong><span>Event board draft · ' + guidedEsc(edit.outputPath || 'guidedLearning.eventStructure') + '</span><em>' + guidedEsc(guidedAuthorPreviewText(preview, 160)) + '</em></div>';
  }), !counts.card && !counts.question && !counts.briefing && counts.event > 0));
  groups.push(guidedAuthorRenderDraftSection('Maps', counts.map, 'Map setup', guidedAuthorDraftObjectRows('mapEdits', guidedAuthorRenderMapDraftExample), !counts.card && !counts.question && !counts.briefing && !counts.event && counts.map > 0));
  var policyRows = guidedNodePolicyExampleRows().map(function(row){
    return '<div class="guided-author-example"><strong>' + guidedEsc(row.title) + '</strong><span>Node policy · guidedNodePolicy</span><em>' + guidedEsc(row.body) + '</em></div>';
  });
  groups.push(guidedAuthorRenderDraftSection('Node Policy', policyCount, 'Question type rules', policyRows, !guidedAuthorDraftTotalFromCounts(counts, 0, 0) && policyCount > 0));
  var footprintRows = guidedNodeFootprintExampleRows().map(function(row){
    return '<div class="guided-author-example"><strong>' + guidedEsc(row.title) + '</strong><span>Node footprint · guidedNodeFootprint</span><em>' + guidedEsc(row.body) + '</em></div>';
  });
  groups.push(guidedAuthorRenderDraftSection('Node Footprint', footprintCount, 'Node question counts', footprintRows, !guidedAuthorDraftTotalFromCounts(counts, policyCount, 0) && footprintCount > 0));
  return groups.filter(Boolean).join('') || guidedAuthorEmptyState('No local drafts yet.', 'Use an Edit button inside Guided Author Tools to create a draft. Drafts appear here before they are applied or exported.', '');
}

function guidedAuthorRenderDraftPatchPanel() {
  var counts = guidedAuthorDraftReviewCounts();
  var cardCount = counts.card;
  var questionCount = counts.question;
  var briefingCount = counts.briefing;
  var eventStructureCount = counts.event;
  var mapCount = counts.map;
  var policyCount = guidedNodePolicyLocalEditCount();
  var footprintCount = guidedNodeFootprintLocalEditCount();
  var totalDrafts = guidedAuthorDraftTotalFromCounts(counts, policyCount, footprintCount);
  var hasDrafts = totalDrafts > 0;
  var hasActiveSidecar = guidedAuthorStoredSidecars().length > 0;
  var preflight = guidedAuthorBuildReviewEditPreflight();
  var directDraftCount = cardCount + questionCount + briefingCount + eventStructureCount + mapCount;
  var hasNodeSettings = (policyCount + footprintCount) > 0;
	  return ''
	    + '<div class="guided-card guided-author-draft-card">'
	    +   '<div class="guided-node-head">'
	    +     '<div><div class="guided-section-kicker">Review edits</div><div class="guided-card-title">' + guidedAuthorHelpTitle(hasDrafts ? 'Review and apply local drafts' : 'No local drafts to apply', 'review-edits-flow', 'Drafts are temporary edits saved in this browser. They preview in Author Tools, but they are not part of the active sidecar until you apply them. The safe flow is: first review what changed, then choose the target active sidecar, then press Apply drafts to active sidecar. After that, Guided Learning uses the updated browser copy. The final step is saving or exporting the full sidecar JSON so the source file on disk can match the browser copy.') + '</div></div>'
	    +     '<div class="guided-author-status-pill ' + (hasDrafts ? 'is-review' : 'is-native_ready') + '">' + guidedEsc(totalDrafts) + ' drafts</div>'
	    +   '</div>'
    +   guidedAuthorStoredSidecarSelectorHtml()
    +   guidedAuthorRenderReviewStatus(preflight)
    +   guidedAuthorRenderSaveFlowStatus()
    +   '<div class="guided-author-draft-groups">' + guidedAuthorRenderDraftGroups(counts, policyCount, footprintCount) + '</div>'
    +   guidedAuthorRenderReviewActions(hasDrafts, hasActiveSidecar, directDraftCount, hasNodeSettings)
    + '</div>';
}

function guidedAuthorActiveOverlayCount() {
  return guidedAuthorStoredSidecars().length;
}

function guidedAuthorRenderSidecarWorkflowSteps() {
  var activeCount = guidedAuthorActiveOverlayCount();
  var hasPreview = !!guidedAuthorSidecarValidationReport;
  var previewActive = guidedAuthorPreviewMatchesActiveSidecar();
  var snapshot = guidedAuthorLoadSidecarSnapshot();
  var totals = guidedAuthorSidecarValidationReport && guidedAuthorSidecarValidationReport.totals || {};
  var steps = [
    {
      num: 1,
      title: 'Check active browser sidecars',
      body: activeCount ? activeCount + ' active browser sidecar' + (activeCount === 1 ? '' : 's') + ' available for Guided runtime.' : 'No active browser sidecar is saved yet.',
      state: activeCount ? 'done' : 'current'
    },
    {
      num: 2,
      title: 'Load source file as preview',
      body: hasPreview ? ((totals.matchedCards || 0) + '/' + (totals.sidecarCards || 0) + ' UID matches · ' + (totals.questionBankQuestions || totals.questions || 0) + ' bank questions · ' + (totals.errors || 0) + ' errors · ' + (totals.warnings || 0) + ' warnings') : 'Load or paste a JSON file only when you want to inspect or replace a browser-active sidecar.',
      state: hasPreview ? ((totals.errors || 0) ? 'warning' : 'done') : (activeCount ? 'pending' : 'current')
    },
    {
      num: 3,
      title: 'Protect, compare, or merge if needed',
      body: snapshot ? 'Snapshot available. Compare or restore before replacing browser-local work.' : 'Take a snapshot before replacing an active sidecar that has browser-only edits.',
      state: snapshot ? 'done' : (activeCount ? 'current' : 'pending')
    },
    {
      num: 4,
      title: 'Save/export the finished active JSON',
      body: previewActive ? 'Loaded preview already matches active. Export when you want the source file on disk to match.' : hasPreview ? 'Save the preview as active, then export the active sidecar JSON if the source file should change.' : 'Export from an active sidecar row after edits are applied.',
      state: previewActive || activeCount ? 'done' : 'pending'
    }
  ];
  return '';
}

function guidedAuthorRenderSidecarsTab() {
  return guidedAuthorRenderSidecarWorkflowSteps()
    + guidedAuthorRenderSidecarLibraryWorkspace();
}

function guidedAuthorActiveSidecarPracticeTotals() {
  return (guidedSidecarStore && guidedSidecarStore.sidecars || []).map(guidedBuildSidecarHealthReport).reduce(function(out, health){
    var t = health && health.totals || {};
    out.practiceQuestions += Number(t.practiceQuestions || 0) || 0;
    out.sidecarCards += Number(t.sidecarCards || 0) || 0;
    out.matchedCards += Number(t.matchedCards || 0) || 0;
    return out;
  }, { practiceQuestions: 0, sidecarCards: 0, matchedCards: 0 });
}
