// StudyDeck Guided Author Tools Coverage and Content QA helpers.
// Loaded before app.js by index.html; intentionally uses classic-script globals.
// Contains active sidecar QA status, Coverage tab reports, and Content QA report rendering.

var guidedAuthorCoverageState = {
  sidecar: 'all',
  stage: 'all',
  status: 'all',
  search: ''
};

function guidedAuthorActiveSidecarStatusBlockHtml() {
  var sidecars = guidedAuthorStoredSidecars();
  if (!sidecars.length) {
    return ''
      + '<div class="guided-author-active-status is-empty">'
      +   '<div><div class="guided-section-kicker">Active browser sidecar</div><strong>None saved</strong><span>Browser QA has no active sidecar to read.</span></div>'
      +   '<p>Load a source sidecar file, validate it, then save it as active before reviewing Coverage or Content QA.</p>'
      +   '<div class="guided-author-actions"><button type="button" class="btn btn-gold" onclick="guidedAuthorCoverageOpenSidecars()">Open Sidecars setup</button></div>'
      + '</div>';
  }
  var coverage = guidedAuthorBuildCoverageReport(sidecars);
  var titles = (coverage.sidecars || []).map(function(sidecar){ return sidecar.title; }).filter(Boolean).join(' · ');
  var totals = coverage.totals || {};
  return ''
    + '<div class="guided-author-active-status">'
    +   '<div class="guided-author-active-status-head">'
    +     '<div><div class="guided-section-kicker">Active browser sidecar</div><strong>' + guidedEsc(titles || (sidecars.length + ' active sidecar' + (sidecars.length === 1 ? '' : 's'))) + '</strong><span>Content QA reads this browser-local copy.</span></div>'
    +     '<button type="button" class="btn btn-soft" onclick="guidedAuthorCoverageOpenSidecars()">Open Sidecars setup</button>'
    +   '</div>'
    +   '<div class="guided-progress-row">'
    +     '<span class="guided-progress-pill">' + guidedEsc(totals.cards + ' cards') + '</span>'
    +     '<span class="guided-progress-pill">' + guidedEsc(totals.usableItems + ' usable') + '</span>'
    +     '<span class="guided-progress-pill' + (totals.validationErrors ? ' is-warning' : '') + '">' + guidedEsc(totals.validationErrors + ' errors') + '</span>'
    +     '<span class="guided-progress-pill' + (totals.validationWarnings ? ' is-warning' : '') + '">' + guidedEsc(totals.validationWarnings + ' warnings') + '</span>'
    +   '</div>'
    +   '<p>Source JSON changes on disk are not visible here until you load, validate, and save the updated sidecar as active.</p>'
    + '</div>';
}

function guidedAuthorCoverageEnsureState() {
  if (!guidedAuthorCoverageState || typeof guidedAuthorCoverageState !== 'object') guidedAuthorCoverageState = {};
  var defaults = { sidecar: 'all', stage: 'all', status: 'all', search: '' };
  Object.keys(defaults).forEach(function(key){
    if (guidedAuthorCoverageState[key] == null) guidedAuthorCoverageState[key] = defaults[key];
  });
  if (['all', 'issues'].indexOf(guidedAuthorCoverageState.status) === -1) guidedAuthorCoverageState.status = 'all';
  return guidedAuthorCoverageState;
}
function guidedAuthorCoverageExpectedPolicyCounts() {
  return {
    passage_reference: 1,
    content_choice: 2,
    cloze_drag: 2,
    sequence_order: 1,
    odd_one_out: 1
  };
}
function guidedAuthorCoverageSidecarId(sidecar, index) {
  var meta = sidecar && sidecar.__studydeckSidecar || {};
  return String(meta.id || sidecar && (sidecar.id || sidecar.title || sidecar.name) || ('sidecar_' + index));
}
function guidedAuthorCoverageSidecarTitle(sidecar, deck, index) {
  var meta = sidecar && sidecar.__studydeckSidecar || {};
  return String(sidecar && (sidecar.title || sidecar.name) || meta.sourceName || meta.matchedDeckName || deck && deck.name || ('Active sidecar ' + (index + 1)));
}
function guidedAuthorCoverageQuestionsForEntry(entry) {
  var bank = guidedAuthorSidecarArrayField(entry, 'questions');
  if (bank.length) return bank;
  return []
    .concat(guidedAuthorSidecarArrayField(entry, 'learnQuestions'))
    .concat(guidedAuthorSidecarArrayField(entry, 'practiceQuestions'))
    .concat(guidedAuthorSidecarArrayField(entry, 'challengeQuestions'))
    .concat(guidedAuthorSidecarArrayField(entry, 'scholarQuestions'));
}
function guidedAuthorCoverageBriefingId(screen, index) {
  return String(screen && (screen.id || screen.key || '') || ('briefing_' + (index + 1))).trim();
}
function guidedAuthorCoverageQuestionTextValues(question) {
  var values = [
    guidedTextFromFieldValue(question && (question.prompt || question.question || question.text)),
    guidedTextFromFieldValue(question && (question.answer || question.correctAnswer || question.correctLabel || question.oddOneOut)),
    guidedTextFromFieldValue(question && (question.explanation || question.feedback || question.rationale))
  ];
  [
    question && question.distractors,
    question && question.wrongAnswers,
    question && question.incorrectOptions,
    question && question.options,
    question && question.choices,
    question && question.wordBank,
    question && question.fittingItems,
    question && (question.correctOrder || question.correctSequence || question.sequence || question.steps)
  ].forEach(function(value){
    values = values.concat(guidedTextArrayFromChallengeField(value));
  });
  return values.filter(Boolean);
}
function guidedAuthorCoverageEventTextValues(eventStructure) {
  if (!eventStructure || typeof eventStructure !== 'object') return [];
  var values = [
    guidedTextFromFieldValue(eventStructure.prompt),
    guidedTextFromFieldValue(eventStructure.explanation)
  ];
  GUIDED_ATROCITY_EVENT_STRUCTURE_SLOTS.forEach(function(slot){
    var value = guidedReadAtrocityEventStructureValue(eventStructure, slot);
    if (value) values.push(value);
  });
  return values.filter(Boolean);
}
function guidedAuthorCoverageHasMetaLanguage(value) {
  return /\b(briefing|card|source|event file|note layer)\b/i.test(guidedScholarPlainText(value || ''));
}
function guidedAuthorCoverageIssue(row, type, message) {
  if (!row || !message) return;
  row.issues.push(message);
  if (row.statusTypes.indexOf(type) === -1) row.statusTypes.push(type);
}
function guidedAuthorCoverageStatusLabel(type) {
  var labels = {
    ok: 'OK',
    scholar: 'Needs Scholar',
    briefing: 'Briefing gap',
    balance: 'Question balance',
    event: 'Event board gap',
    map: 'Map gap',
    meta: 'Meta wording',
    scholarMeta: 'Scholar metadata'
  };
  return labels[type] || cleanQuizAnswerText(type || 'Issue');
}
function guidedAuthorCoverageContractForSidecar(sidecar, deck, category) {
  var text = [
    sidecar && sidecar.deckCategory,
    sidecar && sidecar.categoryId,
    sidecar && sidecar.deckName,
    sidecar && sidecar.sourceDeckName,
    sidecar && sidecar.title,
    deck && deck.name,
    category && category.id,
    category && category.label
  ].join(' ').toLowerCase();
  if (text.indexOf('character') !== -1 || text.indexOf('people') !== -1) {
    return {
      id: 'characters_pilot_v1',
      label: 'Characters Pilot v1',
      expectedPolicyCounts: {
        content_choice: 2,
        cloze_drag: 1,
        sequence_order: 1,
        odd_one_out: 1
      },
      briefingCount: 3,
      scholarCount: 0,
      eventBoardCount: 0,
      requiresMapLocation: false
    };
  }
  if (text.indexOf('geograph') !== -1) {
    return {
      id: 'geography_map_v1',
      label: 'Geography Map v1',
      expectedPolicyCounts: {
        map_pin_choice: 1,
        content_choice: 2,
        cloze_drag: 2
      },
      briefingCount: 3,
      briefingMin: 2,
      briefingMax: 4,
      scholarCount: 0,
      eventBoardCount: 0,
      requiresMapLocation: true
    };
  }
  return {
    id: 'atrocities_level_v1',
    label: 'Atrocities Level 1-2',
    expectedPolicyCounts: guidedAuthorCoverageExpectedPolicyCounts(),
    briefingCount: 4,
    scholarCount: 1,
    eventBoardCount: 1,
    requiresMapLocation: false
  };
}
function guidedAuthorCoverageValidateMapQuestion(row, question) {
  if (!row || guidedQuestionPolicyType(question) !== 'map_pin_choice') return;
  var options = guidedNormalizeMapPinOptions(question || {}, null);
  var rawOptions = Array.isArray(question && question.mapOptions) ? question.mapOptions : (Array.isArray(question && question.options) ? question.options : []);
  var correctCount = options.filter(function(option){ return option.correct; }).length;
  if (guidedNormalizeChallengeInteractionType(question && question.interactionType) !== 'map_pin_choice') {
    guidedAuthorCoverageIssue(row, 'map', (question.id || 'Map question') + ' should use interactionType map_pin_choice.');
  }
  var mapId = guidedNormalizeMapId(question && question.mapId || options[0] && options[0].mapId);
  if (!mapId) {
    guidedAuthorCoverageIssue(row, 'map', (question.id || 'Map question') + ' is missing a mapId.');
  } else if (!guidedMapAssetForId(mapId)) {
    guidedAuthorCoverageIssue(row, 'map', (question.id || 'Map question') + ' uses unknown map asset "' + mapId + '".');
  }
  if (options.length !== 4) {
    guidedAuthorCoverageIssue(row, 'map', (question.id || 'Map question') + ' should have 4 map pin options; found ' + options.length + '.');
  }
  if (correctCount !== 1) {
    guidedAuthorCoverageIssue(row, 'map', (question.id || 'Map question') + ' should have exactly 1 correct pin; found ' + correctCount + '.');
  }
  rawOptions.forEach(function(option, index){
    var x = Number(option && option.x);
    var y = Number(option && option.y);
    if (!guidedTextFromFieldValue(option && (option.placeLabel || option.name || option.place || option.value || option.label))) {
      guidedAuthorCoverageIssue(row, 'map', (question.id || 'Map question') + ' option ' + (index + 1) + ' is missing a placeLabel for feedback and flashcards.');
    }
    if (option && option.label && !/^pin\s+[a-z0-9]+$/i.test(guidedTextFromFieldValue(option.label))) {
      guidedAuthorCoverageIssue(row, 'map', (question.id || 'Map question') + ' option ' + (index + 1) + ' uses label for a place name; use placeLabel so quizzes only show Pin A-D.');
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
      guidedAuthorCoverageIssue(row, 'map', (question.id || 'Map question') + ' option ' + (index + 1) + ' has out-of-range map coordinates.');
    }
  });
}
function guidedAuthorBuildCoverageReport(sidecars) {
  sidecars = Array.isArray(sidecars) ? sidecars : guidedAuthorStoredSidecars();
  var report = {
    sidecars: [],
    cards: [],
    totals: {
      cards: 0,
      levels: 0,
      bankQuestions: 0,
      normalQuestions: 0,
      briefingScreens: 0,
      eventBoards: 0,
      scholarQuestions: 0,
      mapLocations: 0,
      usableItems: 0,
      validationErrors: 0,
      validationWarnings: 0
    },
    levels: [],
    issueCount: 0,
    expectedPolicyCounts: {}
  };
  var levelLookup = {};
  (sidecars || []).forEach(function(sidecar, sidecarIndex){
    var entries = guidedAuthorSidecarCardEntries(sidecar);
    var deckMatch = guidedAuthorFindDeckBySidecar(sidecar || {}, entries);
    var deck = deckMatch && deckMatch.deck || null;
    var meta = sidecar && sidecar.__studydeckSidecar || {};
    var health = guidedBuildSidecarHealthReport(sidecar || {});
    var sidecarId = guidedAuthorCoverageSidecarId(sidecar, sidecarIndex);
    var sidecarTitle = guidedAuthorCoverageSidecarTitle(sidecar, deck, sidecarIndex);
    var categoryId = String(sidecar && (sidecar.deckCategory || sidecar.categoryId || meta.deckCategory || '') || '');
    var category = categoryId ? guidedResolveCategoryById(categoryId) : null;
    if (!category && deck) {
      category = guidedResolveCategories().find(function(cat){ return String(cat.deckId) === String(deck.id); }) || null;
    }
    var contract = guidedAuthorCoverageContractForSidecar(sidecar, deck, category);
    report.sidecars.push({
      id: sidecarId,
      title: sidecarTitle,
      cardCount: entries.length,
      contractLabel: contract.label,
      validationErrors: Number(health && health.totals && health.totals.validationErrors || 0) || 0,
      validationWarnings: Number(health && health.totals && health.totals.validationWarnings || 0) || 0
    });
    report.totals.validationErrors += Number(health && health.totals && health.totals.validationErrors || 0) || 0;
    report.totals.validationWarnings += Number(health && health.totals && health.totals.validationWarnings || 0) || 0;
    entries.forEach(function(item){
      var rawEntry = item && item.entry || {};
      var uid = guidedAuthorSidecarEntryUid(item);
      var match = deck ? guidedAuthorSidecarFindDeckCardMatch(deck, uid, rawEntry) : null;
      var baseCard = match && match.card || {};
      var card = match && match.card ? guidedApplySidecarEntryToCard(match.card, rawEntry) : Object.assign({}, rawEntry, {
        uid: uid,
        q: rawEntry.titleHint || rawEntry.title || uid || 'Untitled card',
        a: rawEntry.deckAnswer || rawEntry.sourceReference || rawEntry.reference || ''
      });
      var stage = String(rawEntry.stage || rawEntry.level || card.level || '').trim();
      var cardTitle = rawEntry.titleHint || guidedLearnFallbackTitle(card) || uid || 'Untitled card';
      var questions = guidedAuthorCoverageQuestionsForEntry(rawEntry);
      var briefings = guidedAuthorSidecarArrayField(rawEntry, 'briefingScreens');
      var eventStructure = guidedAuthorSidecarObjectField(rawEntry, 'eventStructure');
      var expected = contract.expectedPolicyCounts || {};
      var briefingIds = {};
      briefings.forEach(function(screen, index){
        var screenId = guidedAuthorCoverageBriefingId(screen, index);
        if (screenId) briefingIds[screenId] = true;
      });
      var policyCounts = {};
      Object.keys(expected).forEach(function(key){ policyCounts[key] = 0; });
      var scholarCount = 0;
      var rawMapLocation = rawEntry && rawEntry.guidedLearning && rawEntry.guidedLearning.mapLocation;
      var mapLocation = guidedNormalizeMapLocation(rawMapLocation, cardTitle);
      var row = {
        sidecarId: sidecarId,
        sidecarTitle: sidecarTitle,
        categoryId: category && category.id || categoryId,
        categoryLabel: category && category.label || deck && deck.name || '',
        deckId: deck && deck.id || '',
        cardId: baseCard && baseCard.id,
        cardKey: String((deck && deck.id || '') + '::' + (baseCard && baseCard.id || uid)),
        cardUid: uid,
        cardTitle: cardTitle,
        stage: stage,
        questionCount: questions.length,
        normalQuestionCount: 0,
        briefingCount: briefings.length,
        eventBoardCount: eventStructure ? 1 : 0,
        scholarCount: 0,
        policyCounts: policyCounts,
        expectedPolicyCounts: Object.assign({}, expected),
        expectedBriefingCount: Number(contract.briefingCount || 0) || 0,
        expectedBriefingMin: Number(contract.briefingMin || contract.briefingCount || 0) || 0,
        expectedBriefingMax: Number(contract.briefingMax || contract.briefingCount || 0) || 0,
        expectedScholarCount: Number(contract.scholarCount || 0) || 0,
        expectedEventBoardCount: Number(contract.eventBoardCount || 0) || 0,
        expectedNormalQuestionCount: Object.keys(expected).reduce(function(total, key){ return total + (Number(expected[key] || 0) || 0); }, 0),
        expectedMapLocation: !!contract.requiresMapLocation,
        mapLocationCount: mapLocation ? 1 : 0,
        coverageContract: contract.id,
        coverageContractLabel: contract.label,
        promptSnippets: [],
        issues: [],
        statusTypes: [],
        searchText: ''
      };
      questions.forEach(function(question, questionIndex){
        var interaction = guidedNormalizeChallengeInteractionType(question && (question.interactionType || question.type || question.kind || question.questionType || 'content_choice'));
        var policyType = guidedQuestionPolicyType(question);
        var isScholarByPolicy = policyType === 'scholar_note_choice';
        var isScholarByInteraction = interaction === 'scholar_note_choice';
        if (isScholarByPolicy || isScholarByInteraction) {
          if (isScholarByPolicy && isScholarByInteraction) scholarCount += 1;
          else guidedAuthorCoverageIssue(row, 'scholarMeta', (question.id || ('Question ' + (questionIndex + 1))) + ' has mismatched Scholar metadata.');
        } else if (Object.prototype.hasOwnProperty.call(expected, policyType)) {
          policyCounts[policyType] += 1;
        } else {
          guidedAuthorCoverageIssue(row, 'balance', (question.id || ('Question ' + (questionIndex + 1))) + ' uses unexpected policy type: ' + policyType + '.');
        }
        guidedAuthorCoverageValidateMapQuestion(row, question);
        guidedAuthorQuestionBriefingIds(question).forEach(function(briefingId){
          if (!briefingIds[String(briefingId || '')]) {
            guidedAuthorCoverageIssue(row, 'briefing', (question.id || ('Question ' + (questionIndex + 1))) + ' references missing briefing ' + briefingId + '.');
          }
        });
        guidedAuthorCoverageQuestionTextValues(question).forEach(function(value){
          if (guidedAuthorCoverageHasMetaLanguage(value)) {
            guidedAuthorCoverageIssue(row, 'meta', (question.id || ('Question ' + (questionIndex + 1))) + ' uses learner-facing authoring language.');
          }
        });
        var promptText = guidedAuthorSidecarPrompt(question);
        if (promptText) row.promptSnippets.push(promptText);
      });
      row.scholarCount = scholarCount;
      row.normalQuestionCount = Object.keys(expected).reduce(function(total, key){ return total + (policyCounts[key] || 0); }, 0);
      if (row.expectedBriefingMin || row.expectedBriefingMax) {
        var briefingMin = row.expectedBriefingMin || row.expectedBriefingCount;
        var briefingMax = row.expectedBriefingMax || row.expectedBriefingCount;
        if (row.briefingCount < briefingMin || row.briefingCount > briefingMax) {
          guidedAuthorCoverageIssue(row, 'briefing', 'Expected ' + (briefingMin === briefingMax ? briefingMin : (briefingMin + '-' + briefingMax)) + ' briefing screens; found ' + row.briefingCount + '.');
        }
      }
      Object.keys(expected).forEach(function(key){
        if ((policyCounts[key] || 0) !== expected[key]) {
          guidedAuthorCoverageIssue(row, 'balance', guidedNodePolicyTypeLabel(key) + ' expected ' + expected[key] + '; found ' + (policyCounts[key] || 0) + '.');
        }
      });
      if (row.scholarCount !== row.expectedScholarCount) guidedAuthorCoverageIssue(row, 'scholar', 'Expected ' + row.expectedScholarCount + ' Scholar Bonus; found ' + row.scholarCount + '.');
      if (row.eventBoardCount !== row.expectedEventBoardCount) guidedAuthorCoverageIssue(row, 'event', 'Expected ' + row.expectedEventBoardCount + ' event board; found ' + row.eventBoardCount + '.');
      if (row.expectedMapLocation && !mapLocation) guidedAuthorCoverageIssue(row, 'map', 'Expected a valid mapLocation with mapId, x, y, label, and region.');
      if (mapLocation && !guidedMapAssetForId(mapLocation.mapId)) guidedAuthorCoverageIssue(row, 'map', 'Map location uses unknown map asset "' + mapLocation.mapId + '".');
      if (row.expectedMapLocation && mapLocation && !String(rawMapLocation && rawMapLocation.region || '').trim()) guidedAuthorCoverageIssue(row, 'map', 'Map location is missing a region label.');
      guidedAuthorCoverageEventTextValues(eventStructure).forEach(function(value){
        if (guidedAuthorCoverageHasMetaLanguage(value)) {
          guidedAuthorCoverageIssue(row, 'meta', 'Event board uses learner-facing authoring language.');
        }
      });
      if (!row.statusTypes.length) row.statusTypes.push('ok');
      row.searchText = [
        row.cardTitle,
        row.cardUid,
        row.stage,
        row.categoryLabel,
        row.sidecarTitle,
        row.promptSnippets.join(' ')
      ].join(' ').toLowerCase();
      report.cards.push(row);
      report.totals.cards += 1;
      report.totals.bankQuestions += row.questionCount;
      report.totals.normalQuestions += row.normalQuestionCount;
      report.totals.briefingScreens += row.briefingCount;
      report.totals.eventBoards += row.eventBoardCount;
      report.totals.scholarQuestions += row.scholarCount;
      report.totals.mapLocations += row.mapLocationCount;
      report.totals.usableItems += row.questionCount + row.eventBoardCount;
      report.issueCount += row.issues.length;
      var levelKey = stage || 'Unstaged';
      if (!levelLookup[levelKey]) {
        levelLookup[levelKey] = { stage: stage, label: stage ? ('Level ' + stage) : 'Unstaged', cards: 0, questions: 0, normalQuestions: 0, briefings: 0, scholar: 0, events: 0, mapLocations: 0, issues: 0 };
      }
      levelLookup[levelKey].cards += 1;
      levelLookup[levelKey].questions += row.questionCount;
      levelLookup[levelKey].normalQuestions += row.normalQuestionCount;
      levelLookup[levelKey].briefings += row.briefingCount;
      levelLookup[levelKey].scholar += row.scholarCount;
      levelLookup[levelKey].events += row.eventBoardCount;
      levelLookup[levelKey].mapLocations += row.mapLocationCount;
      levelLookup[levelKey].issues += row.issues.length;
    });
  });
  report.levels = Object.keys(levelLookup).map(function(key){ return levelLookup[key]; }).sort(function(a, b){
    var an = Number(a.stage);
    var bn = Number(b.stage);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    return String(a.label).localeCompare(String(b.label));
  });
  report.totals.levels = report.levels.length;
  return report;
}
function guidedAuthorCoverageSetFilter(field, value) {
  var state = guidedAuthorCoverageEnsureState();
  if (!Object.prototype.hasOwnProperty.call(state, field)) return;
  state[field] = String(value == null ? '' : value);
  renderGuidedView();
}
function guidedAuthorCoverageClearFilters() {
  var state = guidedAuthorCoverageEnsureState();
  state.sidecar = 'all';
  state.stage = 'all';
  state.status = 'all';
  state.search = '';
  renderGuidedView();
}
function guidedAuthorCoverageHasActiveFilters() {
  var state = guidedAuthorCoverageEnsureState();
  return String(state.sidecar || 'all') !== 'all'
    || String(state.stage || 'all') !== 'all'
    || String(state.status || 'all') !== 'all'
    || !!String(state.search || '').trim();
}
function guidedAuthorCoverageFilteredCards(report) {
  var state = guidedAuthorCoverageEnsureState();
  var sidecarIds = (report.sidecars || []).map(function(sidecar){ return sidecar.id; });
  if (state.sidecar !== 'all' && sidecarIds.indexOf(state.sidecar) === -1) state.sidecar = 'all';
  var query = String(state.search || '').trim().toLowerCase();
  return (report.cards || []).filter(function(row){
    if (state.sidecar !== 'all' && row.sidecarId !== state.sidecar) return false;
    if (state.stage !== 'all' && String(row.stage || '') !== state.stage) return false;
    if (state.status === 'issues' && !row.issues.length) return false;
    if (query && row.searchText.indexOf(query) === -1) return false;
    return true;
  });
}
function guidedAuthorCoverageSelectControl(label, field, options) {
  var state = guidedAuthorCoverageEnsureState();
  var current = String(state[field] || 'all');
  return ''
    + '<label class="guided-author-question-filter"><span>' + guidedEsc(label) + '</span><select onchange="guidedAuthorCoverageSetFilter(\'' + guidedEsc(field) + '\', this.value)">'
    + '<option value="all"' + (current === 'all' ? ' selected' : '') + '>All</option>'
    + (options || []).map(function(option){
      return '<option value="' + guidedEsc(option.value) + '"' + (current === String(option.value) ? ' selected' : '') + '>' + guidedEsc(option.label) + '</option>';
    }).join('')
    + '</select></label>';
}
function guidedAuthorCoverageRenderFilters(report) {
  var sidecarOptions = (report.sidecars || []).map(function(sidecar){
    return { value: sidecar.id, label: sidecar.title };
  });
  var stageOptions = (report.levels || []).map(function(level){
    return { value: level.stage || '', label: level.label };
  });
  var statusOptions = [{ value: 'issues', label: 'Issues only' }];
  var state = guidedAuthorCoverageEnsureState();
  var hasActiveFilters = guidedAuthorCoverageHasActiveFilters();
  var activeSummary = [];
  if (state.sidecar !== 'all') activeSummary.push({ label: 'Sidecar', value: filterOptionLabel(sidecarOptions, state.sidecar), type: 'sidecar' });
  if (state.stage !== 'all') activeSummary.push({ label: 'Level', value: filterOptionLabel(stageOptions, state.stage), type: 'stage' });
  if (state.status !== 'all') activeSummary.push({ label: 'Status', value: filterOptionLabel(statusOptions, state.status), type: 'status' });
  if (String(state.search || '').trim()) activeSummary.push({ label: 'Search', value: String(state.search || '').trim(), type: 'search' });
  return ''
    + '<div class="guided-author-question-filters guided-author-coverage-filters">'
    + ((report.sidecars || []).length > 1 ? guidedAuthorCoverageSelectControl('Sidecar', 'sidecar', sidecarOptions) : '')
    + guidedAuthorCoverageSelectControl('Level', 'stage', stageOptions)
    + guidedAuthorCoverageSelectControl('Status', 'status', statusOptions)
    + '<label class="guided-author-question-filter guided-author-question-search"><span>Search</span><input type="search" value="' + guidedEsc(state.search || '') + '" placeholder="Title, UID, prompt…" oninput="guidedAuthorCoverageSetFilter(\'search\', this.value)"></label>'
    + '<div class="guided-author-question-filter-actions"><button type="button" class="btn btn-soft" onclick="guidedAuthorCoverageClearFilters()" ' + (hasActiveFilters ? '' : 'disabled') + '>Clear filters</button></div>'
    + renderFilterActiveSummary(activeSummary, 'guidedAuthorCoverageClearFilters()')
    + '</div>';
}
function guidedAuthorCoverageRenderNoResults() {
  var hasActiveFilters = guidedAuthorCoverageHasActiveFilters();
  return guidedAuthorEmptyState(
    hasActiveFilters ? 'No cards match these coverage filters.' : 'No coverage rows are available yet.',
    hasActiveFilters
      ? 'Coverage is being narrowed by the active filters above. Clear filters, or loosen the sidecar, level, status, or search text.'
      : 'Load and save an active sidecar before checking card coverage.',
    hasActiveFilters ? '<button type="button" class="btn btn-soft" onclick="guidedAuthorCoverageClearFilters()">Clear filters</button>' : ''
  );
}
function guidedAuthorCoverageOpenQuestions(cardUid, scholarOnly) {
  var state = guidedAuthorQuestionBrowserEnsureState();
  state.view = 'authored';
  state.category = 'all';
  state.stage = 'all';
  state.card = 'all';
  state.interaction = scholarOnly ? 'scholar_note_choice' : 'all';
  state.search = String(cardUid || '');
  state.selectedKey = '';
  state.listLimit = GUIDED_AUTHOR_LIST_WINDOW_INITIAL;
  var records = guidedAuthorQuestionBrowserRecords();
  var filtered = guidedAuthorQuestionBrowserFilterRecords(records);
  if (filtered.length) state.selectedKey = filtered[0].key;
  guidedAuthorSetTab('questions');
}
function guidedAuthorCoverageOpenBriefings(cardUid) {
  var state = guidedAuthorBriefingBrowserEnsureState();
  state.category = 'all';
  state.stage = 'all';
  state.card = 'all';
  state.evidence = 'all';
  state.issue = 'all';
  state.search = String(cardUid || '');
  state.selectedKey = '';
  state.listLimit = GUIDED_AUTHOR_LIST_WINDOW_INITIAL;
  var records = guidedAuthorBriefingBrowserRecords();
  var filtered = guidedAuthorBriefingBrowserFilterRecords(records);
  if (filtered.length) state.selectedKey = filtered[0].key;
  guidedAuthorSetTab('briefings');
}
function guidedAuthorCoverageOpenSidecars() {
  guidedAuthorSetTab('sidecars');
}
function guidedAuthorCoverageRenderLevelCards(report) {
  if (!report.levels.length) return guidedAuthorEmptyState('No level coverage yet.', 'Load and save an active sidecar before checking level-by-level coverage.', '');
  return '<div class="guided-author-coverage-level-grid">' + report.levels.map(function(level){
    var summaryBits = [
      level.briefings + ' briefings',
      level.questions + ' questions'
    ];
    if (level.mapLocations) summaryBits.push(level.mapLocations + ' maps');
    if (level.scholar) summaryBits.push(level.scholar + ' Scholar');
    if (level.events) summaryBits.push(level.events + ' events');
    return ''
      + '<div class="guided-author-coverage-level-card' + (level.issues ? ' has-issues' : ' is-ok') + '">'
      +   '<div class="guided-section-kicker">' + guidedEsc(level.label) + '</div>'
      +   '<strong>' + guidedEsc(level.cards + ' cards') + '</strong>'
      +   '<span>' + guidedEsc(summaryBits.join(' · ')) + '</span>'
      +   '<b>' + guidedEsc(level.issues ? (level.issues + ' issue' + (level.issues === 1 ? '' : 's')) : 'OK') + '</b>'
      + '</div>';
  }).join('') + '</div>';
}
function guidedAuthorCoverageMetric(label, current, expected, min, max) {
  var hasRange = Number.isFinite(Number(min)) && Number.isFinite(Number(max)) && Number(min) !== Number(max);
  var ok = hasRange
    ? Number(current || 0) >= Number(min) && Number(current || 0) <= Number(max)
    : Number(current || 0) === Number(expected || 0);
  var expectedText = hasRange ? (min + '-' + max) : expected;
  return '<span class="guided-author-coverage-metric' + (ok ? ' is-ok' : ' has-issues') + '"><b>' + guidedEsc(label) + '</b> ' + guidedEsc(current + '/' + expectedText) + '</span>';
}
function guidedAuthorCoverageStatusChips(row) {
  return '<div class="guided-author-coverage-status-row">' + (row.statusTypes || []).map(function(type){
    return '<span class="guided-author-coverage-chip ' + (type === 'ok' ? 'is-ok' : 'is-warning') + '">' + guidedEsc(guidedAuthorCoverageStatusLabel(type)) + '</span>';
  }).join('') + '</div>';
}
function guidedAuthorCoverageRenderRow(row) {
  var issuePreview = row.issues.length
    ? '<div class="guided-author-coverage-issues">' + row.issues.slice(0, 3).map(function(issue){
        return '<span>' + guidedEsc(issue) + '</span>';
      }).join('') + (row.issues.length > 3 ? '<span>' + guidedEsc('+' + (row.issues.length - 3) + ' more') + '</span>' : '') + '</div>'
    : '';
  var metrics = [];
  if (row.expectedBriefingCount || row.briefingCount) metrics.push(guidedAuthorCoverageMetric('Briefings', row.briefingCount, row.expectedBriefingCount, row.expectedBriefingMin, row.expectedBriefingMax));
  metrics.push(guidedAuthorCoverageMetric('Normal', row.normalQuestionCount, row.expectedNormalQuestionCount));
  if ((row.expectedPolicyCounts && row.expectedPolicyCounts.map_pin_choice) || (row.policyCounts && row.policyCounts.map_pin_choice)) {
    metrics.push(guidedAuthorCoverageMetric('Map Pin', row.policyCounts && row.policyCounts.map_pin_choice || 0, row.expectedPolicyCounts && row.expectedPolicyCounts.map_pin_choice || 0));
  }
  if (row.expectedMapLocation || row.mapLocationCount) metrics.push(guidedAuthorCoverageMetric('Map Location', row.mapLocationCount, row.expectedMapLocation ? 1 : 0));
  if (row.expectedScholarCount || row.scholarCount) metrics.push(guidedAuthorCoverageMetric('Scholar', row.scholarCount, row.expectedScholarCount));
  if (row.expectedEventBoardCount || row.eventBoardCount) metrics.push(guidedAuthorCoverageMetric('Events', row.eventBoardCount, row.expectedEventBoardCount));
  var actions = [
    '<button type="button" class="btn btn-soft" onclick="guidedAuthorCoverageOpenQuestions(' + guidedAuthorQuestionBrowserArg(row.cardUid) + ', false)">Open questions</button>'
  ];
  if (row.expectedBriefingCount || row.briefingCount) actions.push('<button type="button" class="btn btn-soft" onclick="guidedAuthorCoverageOpenBriefings(' + guidedAuthorQuestionBrowserArg(row.cardUid) + ')">Open briefings</button>');
  if (row.expectedScholarCount || row.scholarCount) actions.push('<button type="button" class="btn btn-soft" onclick="guidedAuthorCoverageOpenQuestions(' + guidedAuthorQuestionBrowserArg(row.cardUid) + ', true)">Review Scholar</button>');
  actions.push('<button type="button" class="btn btn-soft" onclick="guidedAuthorCoverageOpenSidecars()">Open sidecar validation</button>');
  return ''
    + '<div class="guided-author-coverage-row' + (row.issues.length ? ' has-issues' : ' is-ok') + '">'
    +   '<div class="guided-author-coverage-row-head">'
    +     '<div><strong>' + guidedEsc(row.cardTitle) + '</strong><span>' + guidedEsc([row.cardUid, row.stage ? 'Level ' + row.stage : '', row.sidecarTitle].filter(Boolean).join(' · ')) + '</span></div>'
    +     '<b class="guided-author-coverage-row-total">' + guidedEsc(row.issues.length ? (row.issues.length + ' issue' + (row.issues.length === 1 ? '' : 's')) : 'OK') + '</b>'
    +   '</div>'
    +   '<div class="guided-author-coverage-metrics">'
    +     metrics.join('')
    +   '</div>'
    +   guidedAuthorCoverageStatusChips(row)
    +   issuePreview
    +   '<div class="guided-author-coverage-actions">'
    +     actions.join('')
    +   '</div>'
    + '</div>';
}
function guidedAuthorRenderCoverageTab() {
  var report = guidedAuthorBuildCoverageReport();
  var filteredCards = guidedAuthorCoverageFilteredCards(report);
  if (!report.sidecars.length) {
    return ''
      + '<div class="guided-card guided-author-start-card">'
      +   '<div class="guided-kicker">Coverage</div>'
      +   '<div class="guided-card-title">No active sidecar coverage yet.</div>'
      +   '<div class="guided-card-sub">Load, validate, and save a sidecar before reviewing Scholar, briefing, and level coverage.</div>'
      +   '<button class="btn btn-gold" onclick="guidedAuthorCoverageOpenSidecars()">Open Sidecars setup</button>'
      + '</div>';
  }
  return ''
	    + '<div class="guided-card guided-author-start-card">'
	    +   '<div class="guided-kicker">Coverage</div>'
	    +   '<div class="guided-card-title">' + guidedAuthorHelpTitle('Check sidecar structure', 'coverage-structural', 'Coverage is a structure check. It answers questions like: does each card have the expected number of briefing screens, question types, event boards, map data, and Scholar items? It does not judge whether the writing is good, whether an answer choice sounds awkward, or whether a briefing explains the topic well. Use this screen when something appears missing or uneven. Use Content QA when you want checks for wording problems, broken references, banned learner-facing terms, or known content regressions.') + '</div>'
	    +   '<div class="guided-card-sub">Counts cards, questions, briefings, maps, Scholar items, and event boards in active browser sidecars.</div>'
    +   '<div class="guided-author-question-summary">'
    +     '<span>' + guidedEsc(report.totals.cards + ' cards') + '</span>'
    +     '<span>' + guidedEsc(report.totals.levels + ' levels') + '</span>'
    +     '<span>' + guidedEsc(report.totals.bankQuestions + ' bank questions') + '</span>'
    +     '<span>' + guidedEsc(report.totals.briefingScreens + ' briefings') + '</span>'
    +     (report.totals.mapLocations ? '<span>' + guidedEsc(report.totals.mapLocations + ' map locations') + '</span>' : '')
    +     '<span>' + guidedEsc(report.totals.scholarQuestions + ' Scholar') + '</span>'
    +     '<span>' + guidedEsc(report.totals.eventBoards + ' event boards') + '</span>'
    +     '<span>' + guidedEsc(report.totals.usableItems + ' usable') + '</span>'
    +     '<span>' + guidedEsc(report.totals.validationErrors + ' errors') + '</span>'
    +     '<span>' + guidedEsc(report.totals.validationWarnings + ' warnings') + '</span>'
    +   '</div>'
    + '</div>'
    + '<div class="guided-card guided-author-coverage-card">'
    +   guidedAuthorCoverageRenderLevelCards(report)
    + '</div>'
    + '<div class="guided-card guided-author-coverage-card">'
    +   '<div class="guided-section-kicker">Coverage matrix</div>'
    +   guidedAuthorCoverageRenderFilters(report)
    +   '<div class="guided-author-question-summary"><span>' + guidedEsc(filteredCards.length + ' shown') + '</span><span>' + guidedEsc(report.cards.length + ' cards') + '</span><span>' + guidedEsc(report.totals.validationErrors + ' errors') + '</span><span>' + guidedEsc(report.totals.validationWarnings + ' warnings') + '</span></div>'
    +   '<div class="guided-author-coverage-matrix">'
    +     (filteredCards.length ? filteredCards.map(guidedAuthorCoverageRenderRow).join('') : guidedAuthorCoverageRenderNoResults())
    +   '</div>'
    + '</div>';
}
function guidedAuthorContentQaCompact(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}
function guidedAuthorContentQaList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
function guidedAuthorContentQaSameList(actual, expected) {
  actual = guidedAuthorContentQaList(actual).map(guidedAuthorContentQaCompact);
  expected = guidedAuthorContentQaList(expected).map(guidedAuthorContentQaCompact);
  if (actual.length !== expected.length) return false;
  return actual.every(function(value, index){ return value === expected[index]; });
}
function guidedAuthorContentQaAddIssue(target, severity, uid, questionId, message, scholarOnly, details, kind) {
  target.push({
    severity: severity || 'failure',
    uid: String(uid || ''),
    questionId: String(questionId || ''),
    message: String(message || ''),
    scholarOnly: !!scholarOnly,
    details: Array.isArray(details) ? details.slice() : [],
    kind: String(kind || '')
  });
}
function guidedAuthorContentQaCollectExactStringPaths(value, target, path, out) {
  if (value == null) return;
  path = path || '$';
  if (typeof value === 'string') {
    if (value === target) out.push(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(function(item, index){
      guidedAuthorContentQaCollectExactStringPaths(item, target, path + '[' + index + ']', out);
    });
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach(function(key){
      guidedAuthorContentQaCollectExactStringPaths(value[key], target, path + '.' + key, out);
    });
  }
}
function guidedAuthorContentQaPathUid(path) {
  var text = String(path || '');
  var match = text.match(/\.cards\.([^.[]+)/);
  return match ? match[1] : '';
}
function guidedAuthorContentQaPathFamily(path) {
  path = String(path || '');
  if (path.indexOf('.briefingScreens') !== -1) return { key: 'briefings', label: 'briefings' };
  if (path.indexOf('.questions') !== -1) return { key: 'questions', label: 'questions' };
  if (path.indexOf('.eventStructure') !== -1) return { key: 'eventStructure', label: 'event board' };
  if (path.indexOf('.evidenceNotes') !== -1) return { key: 'evidenceNotes', label: 'evidence notes' };
  return { key: 'sidecar', label: 'sidecar metadata' };
}
function guidedAuthorContentQaAddEvidenceLabelDriftIssues(sidecars, failures) {
  var grouped = {};
  (sidecars || []).forEach(function(sidecar, index){
    var paths = [];
    guidedAuthorContentQaCollectExactStringPaths(sidecar, 'Critical note', 'sidecar[' + index + ']', paths);
    paths.forEach(function(path){
      var uid = guidedAuthorContentQaPathUid(path);
      var family = guidedAuthorContentQaPathFamily(path);
      var key = [index, uid || 'sidecar', family.key].join('|');
      if (!grouped[key]) {
        grouped[key] = {
          uid: uid,
          family: family.label,
          paths: []
        };
      }
      grouped[key].paths.push(path);
    });
  });
  Object.keys(grouped).forEach(function(key){
    var item = grouped[key];
    var where = item.uid ? item.uid : 'Active sidecar';
    var count = item.paths.length;
    guidedAuthorContentQaAddIssue(
      failures,
      'failure',
      item.uid,
      '',
      where + ' has old "Critical note" evidence labels in ' + item.family + ' (' + count + ' place' + (count === 1 ? '' : 's') + '); use "Critical notes".',
      false,
      item.paths,
      'evidenceLabelDrift'
    );
  });
}
function guidedAuthorContentQaPolicyTotals(coverageReport) {
  var totals = {
    passage_reference: 0,
    map_pin_choice: 0,
    content_choice: 0,
    cloze_drag: 0,
    sequence_order: 0,
    odd_one_out: 0,
    scholar_note_choice: 0
  };
  (coverageReport.cards || []).forEach(function(row){
    Object.keys(totals).forEach(function(key){
      if (key === 'scholar_note_choice') return;
      totals[key] += Number(row.policyCounts && row.policyCounts[key] || 0) || 0;
    });
    totals.scholar_note_choice += Number(row.scholarCount || 0) || 0;
  });
  return totals;
}
function guidedAuthorContentQaMetricRows(coverageReport, policyTotals) {
  var expectedPolicyCounts = {};
  var expectedBankQuestions = 0;
  var expectedBriefings = 0;
  var expectedBriefingMin = 0;
  var expectedBriefingMax = 0;
  var expectedEventBoards = 0;
  var expectedMapLocations = 0;
  (coverageReport.cards || []).forEach(function(row){
    Object.keys(row.expectedPolicyCounts || {}).forEach(function(key){
      expectedPolicyCounts[key] = (expectedPolicyCounts[key] || 0) + (Number(row.expectedPolicyCounts[key] || 0) || 0);
    });
    expectedPolicyCounts.scholar_note_choice = (expectedPolicyCounts.scholar_note_choice || 0) + (Number(row.expectedScholarCount || 0) || 0);
    expectedBankQuestions += (Number(row.expectedNormalQuestionCount || 0) || 0) + (Number(row.expectedScholarCount || 0) || 0);
    expectedBriefings += Number(row.expectedBriefingCount || 0) || 0;
    expectedBriefingMin += Number(row.expectedBriefingMin || row.expectedBriefingCount || 0) || 0;
    expectedBriefingMax += Number(row.expectedBriefingMax || row.expectedBriefingCount || 0) || 0;
    expectedEventBoards += Number(row.expectedEventBoardCount || 0) || 0;
    expectedMapLocations += row.expectedMapLocation ? 1 : 0;
  });
  var rows = [
    { label: 'Cards', actual: coverageReport.totals.cards, expected: coverageReport.cards.length },
    { label: 'Bank questions', actual: coverageReport.totals.bankQuestions, expected: expectedBankQuestions }
  ];
  [
    ['Passage Reference', 'passage_reference'],
    ['Map Pin', 'map_pin_choice'],
    ['Content Choice', 'content_choice'],
    ['Cloze', 'cloze_drag'],
    ['Sequence', 'sequence_order'],
    ['Odd One Out', 'odd_one_out'],
    ['Scholar', 'scholar_note_choice']
  ].forEach(function(pair){
    var label = pair[0];
    var key = pair[1];
    var actual = policyTotals[key] || 0;
    var expected = expectedPolicyCounts[key] || 0;
    if (actual || expected) rows.push({ label: label, actual: actual, expected: expected });
  });
  if (coverageReport.totals.briefingScreens || expectedBriefings) rows.push({ label: 'Briefings', actual: coverageReport.totals.briefingScreens, expected: expectedBriefings, min: expectedBriefingMin, max: expectedBriefingMax });
  if (coverageReport.totals.mapLocations || expectedMapLocations) rows.push({ label: 'Map locations', actual: coverageReport.totals.mapLocations || 0, expected: expectedMapLocations });
  if (coverageReport.totals.eventBoards || expectedEventBoards) rows.push({ label: 'Event boards', actual: coverageReport.totals.eventBoards, expected: expectedEventBoards });
  rows.push({ label: 'Usable', actual: coverageReport.totals.usableItems, expected: expectedBankQuestions + expectedEventBoards });
  return rows;
}
function guidedAuthorContentQaFindQuestionById(sidecars, questionId) {
  var found = null;
  (sidecars || []).forEach(function(sidecar){
    if (found) return;
    guidedAuthorSidecarCardEntries(sidecar).forEach(function(item){
      if (found) return;
      var rawEntry = item && item.entry || {};
      var uid = guidedAuthorSidecarEntryUid(item);
      guidedAuthorCoverageQuestionsForEntry(rawEntry).forEach(function(question){
        if (found) return;
        if (String(question && question.id || '') === String(questionId)) {
          found = { uid: uid, question: question };
        }
      });
    });
  });
  return found;
}
function guidedAuthorContentQaScanKnownRegressions(sidecars, failures) {
  var atrocityUids = {
    BA1K: true, SG2M: true, FP3Z: true, JC7T: true, HS6S: true, DS0W: true, KB9V: true, '8DA1': true,
    LT3P: true, DT4Q: true, GC1H: true, NA3T: true, JP8U: true, LC5L: true, UZ2I: true, TAMN: true
  };
  var hasAtrocitiesSidecar = false;
  (sidecars || []).forEach(function(sidecar){
    guidedAuthorSidecarCardEntries(sidecar).forEach(function(item){
      var uid = String(guidedAuthorSidecarEntryUid(item) || '').toUpperCase();
      if (atrocityUids[uid]) hasAtrocitiesSidecar = true;
    });
  });
  if (!hasAtrocitiesSidecar) return;
  Object.keys(GUIDED_AUTHOR_CONTENT_QA_REGRESSIONS).forEach(function(questionId){
    var regression = GUIDED_AUTHOR_CONTENT_QA_REGRESSIONS[questionId];
    var found = guidedAuthorContentQaFindQuestionById(sidecars, questionId);
    if (!found) {
      guidedAuthorContentQaAddIssue(failures, 'failure', '', questionId, 'Expected deterministic QA question is missing.');
      return;
    }
    var question = found.question || {};
    if (regression.expectedPrompt && guidedAuthorContentQaCompact(question.prompt) !== regression.expectedPrompt) {
      guidedAuthorContentQaAddIssue(failures, 'failure', found.uid, questionId, 'Prompt has drifted from the approved deterministic wording.');
    }
    if (regression.expectedAnswer && guidedAuthorContentQaCompact(question.answer) !== regression.expectedAnswer) {
      guidedAuthorContentQaAddIssue(failures, 'failure', found.uid, questionId, 'Answer has drifted from the approved deterministic wording.');
    }
    if (regression.expected && !guidedAuthorContentQaSameList(question[regression.field], regression.expected)) {
      guidedAuthorContentQaAddIssue(failures, 'failure', found.uid, questionId, guidedNodePolicyTypeLabel(guidedQuestionPolicyType(question)) + ' choices do not match the approved deterministic set.');
    }
    guidedAuthorContentQaList(regression.forbidden).forEach(function(forbidden){
      var actual = guidedAuthorContentQaList(question[regression.field]).map(guidedAuthorContentQaCompact);
      if (actual.indexOf(guidedAuthorContentQaCompact(forbidden)) !== -1) {
        guidedAuthorContentQaAddIssue(failures, 'failure', found.uid, questionId, 'Known bad value returned: "' + forbidden + '".');
      }
    });
  });
}
function guidedAuthorContentQaSidecarLooksGeography(sidecar) {
  var text = [
    sidecar && sidecar.deckCategory,
    sidecar && sidecar.categoryId,
    sidecar && sidecar.deckName,
    sidecar && sidecar.sourceDeckName,
    sidecar && sidecar.title
  ].join(' ').toLowerCase();
  return text.indexOf('geograph') !== -1;
}
function guidedAuthorContentQaScanGeographyMapBriefings(sidecars, failures) {
  (sidecars || []).forEach(function(sidecar){
    if (!guidedAuthorContentQaSidecarLooksGeography(sidecar)) return;
    guidedAuthorSidecarCardEntries(sidecar).forEach(function(item){
      var rawEntry = item && item.entry || {};
      var uid = String(guidedAuthorSidecarEntryUid(item) || '').toUpperCase();
      var gl = rawEntry && rawEntry.guidedLearning || {};
      var screens = guidedAuthorSidecarArrayField(rawEntry, 'briefingScreens');
      var mapLocation = guidedNormalizeMapLocation(gl.mapLocation, rawEntry.titleHint || uid);
      if (screens.length < 2 || screens.length > 4) {
        guidedAuthorContentQaAddIssue(failures, 'failure', uid, uid + '_briefings', 'Geography cards should use 2-4 briefing screens; found ' + screens.length + '.');
      }
      if (!screens.some(function(screen){ return guidedAuthorSidecarBriefingScreenLines(screen).length; })) {
        guidedAuthorContentQaAddIssue(failures, 'failure', uid, uid + '_briefings', 'Geography card needs at least one text briefing screen.');
      }
      if (!mapLocation) {
        guidedAuthorContentQaAddIssue(failures, 'failure', uid, uid + '_mapLocation', 'Geography card needs a valid mapLocation for study maps and Map Pin support.');
      } else if (!guidedMapAssetForId(mapLocation.mapId)) {
        guidedAuthorContentQaAddIssue(failures, 'failure', uid, uid + '_mapLocation', 'Geography mapLocation uses an unknown map asset.');
      }
      if (mapLocation) {
        var placeLabels = Array.isArray(gl.mapLocation && gl.mapLocation.placeLabels) ? gl.mapLocation.placeLabels : [];
        var landmarkLabels = Array.isArray(gl.mapLocation && gl.mapLocation.landmarkLabels) ? gl.mapLocation.landmarkLabels : [];
        if (!placeLabels.length && !landmarkLabels.length) {
          guidedAuthorContentQaAddIssue(failures, 'failure', uid, uid + '_mapLocation', 'Geography mapLocation should include study placeLabels or landmarkLabels for readable briefing maps.');
        }
      }
      screens.forEach(function(screen, index){
        var mapPanel = screen && (screen.mapPanel || screen.mapContext || screen.map);
        if (!mapPanel) return;
        var screenId = String(screen && (screen.id || screen.key) || (uid + '_brief_' + String(index + 1).padStart(2, '0')));
        var normalizedPanel = guidedNormalizeBriefingMapPanel(mapPanel, {
          uid: uid,
          q: rawEntry.titleHint || rawEntry.title || uid,
          guidedLearning: gl
        });
        if (!normalizedPanel) guidedAuthorContentQaAddIssue(failures, 'failure', uid, screenId, 'Geography optional map-only briefing screen has unreadable mapPanel metadata.');
      });
    });
  });
}
function guidedAuthorContentQaBuildWatchlist(coverageReport) {
  var knownUids = {};
  (coverageReport.cards || []).forEach(function(row){ knownUids[String(row.cardUid || '').toUpperCase()] = true; });
  return GUIDED_AUTHOR_CONTENT_QA_SCHOLAR_WATCHLIST.filter(function(item){
    return knownUids[String(item.uid || '').toUpperCase()];
  }).map(function(item){
    return {
      severity: 'watchlist',
      uid: item.uid,
      questionId: '',
      message: item.message,
      scholarOnly: true
    };
  });
}
function guidedAuthorBuildContentQaReport() {
  var sidecars = guidedAuthorStoredSidecars();
  var coverageReport = guidedAuthorBuildCoverageReport(sidecars);
  var policyTotals = guidedAuthorContentQaPolicyTotals(coverageReport);
  var metrics = guidedAuthorContentQaMetricRows(coverageReport, policyTotals);
  var failures = [];
  var warnings = [];
  metrics.forEach(function(metric){
    if (!guidedAuthorContentQaMetricOk(metric)) {
      guidedAuthorContentQaAddIssue(failures, 'failure', '', '', metric.label + ' expected ' + guidedAuthorContentQaMetricExpectedText(metric) + '; found ' + metric.actual + '.');
    }
  });
  if (coverageReport.totals.validationErrors) {
    guidedAuthorContentQaAddIssue(failures, 'failure', '', '', coverageReport.totals.validationErrors + ' sidecar validation error' + (coverageReport.totals.validationErrors === 1 ? '' : 's') + ' detected.');
  }
  if (coverageReport.totals.validationWarnings) {
    guidedAuthorContentQaAddIssue(warnings, 'warning', '', '', coverageReport.totals.validationWarnings + ' sidecar validation warning' + (coverageReport.totals.validationWarnings === 1 ? '' : 's') + ' detected.');
  }
  (coverageReport.cards || []).forEach(function(row){
    (row.issues || []).forEach(function(issue){
      guidedAuthorContentQaAddIssue(failures, 'failure', row.cardUid, '', issue, /scholar/i.test(issue));
    });
  });
	  guidedAuthorContentQaAddEvidenceLabelDriftIssues(sidecars, failures);
  guidedAuthorContentQaScanKnownRegressions(sidecars, failures);
  guidedAuthorContentQaScanGeographyMapBriefings(sidecars, failures);
  return {
    hasSidecars: !!sidecars.length,
    sidecars: sidecars,
    coverage: coverageReport,
    totals: coverageReport.totals,
    policyTotals: policyTotals,
    metrics: metrics,
    objectiveFailures: failures,
    objectiveWarnings: warnings,
    watchlist: guidedAuthorContentQaBuildWatchlist(coverageReport),
    checks: [
      'Active sidecar coverage contract totals compared.',
      'Per-card briefing, map, normal question, Scholar, and event-board balance checked when required by the sidecar contract.',
      'Question references to briefing screen IDs checked.',
      'Geography variable briefing counts, map metadata, and optional map-only pages checked when a Geography sidecar is active.',
      'Banned learner-facing meta terms checked in prompts, options, explanations, briefings, and event boards.',
      'Scholar metadata checked for policyType/interactionType consistency.',
      'Known Atrocities deterministic regression values checked when an Atrocities sidecar is active.',
      'Exact "Critical note" evidence-label drift checked.'
    ]
  };
}
function guidedAuthorContentQaMetricOk(metric) {
  var actual = Number(metric && metric.actual || 0) || 0;
  var min = Number(metric && metric.min || 0) || 0;
  var max = Number(metric && metric.max || 0) || 0;
  if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0 && min !== max) {
    return actual >= min && actual <= max;
  }
  return actual === (Number(metric && metric.expected || 0) || 0);
}
function guidedAuthorContentQaMetricExpectedText(metric) {
  var min = Number(metric && metric.min || 0) || 0;
  var max = Number(metric && metric.max || 0) || 0;
  if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0 && min !== max) {
    return min + '-' + max;
  }
  return String(Number(metric && metric.expected || 0) || 0);
}
function guidedAuthorContentQaMetricHtml(metric) {
  var ok = guidedAuthorContentQaMetricOk(metric);
  return '<span class="guided-author-coverage-metric' + (ok ? ' is-ok' : ' has-issues') + '"><b>' + guidedEsc(metric.label) + '</b> ' + guidedEsc(metric.actual + '/' + guidedAuthorContentQaMetricExpectedText(metric)) + '</span>';
}
function guidedAuthorContentQaOpenQuestion(cardUid, scholarOnly) {
  var state = guidedAuthorQuestionBrowserEnsureState();
  state.view = 'authored';
  state.category = 'all';
  state.stage = 'all';
  state.card = 'all';
  state.interaction = scholarOnly ? 'scholar_note_choice' : 'all';
  state.search = String(cardUid || '');
  state.selectedKey = '';
  guidedAuthorSetTab('questions');
}
function guidedAuthorContentQaOpenCoverage(cardUid) {
  var state = guidedAuthorCoverageEnsureState();
  state.sidecar = 'all';
  state.stage = 'all';
  state.status = String(cardUid || '') ? 'all' : state.status;
  state.search = String(cardUid || '');
  guidedAuthorSetTab('coverage');
}
function guidedAuthorContentQaIssueActionsHtml(issue) {
  var uid = String(issue && issue.uid || '');
  if (issue && issue.kind === 'evidenceLabelDrift') {
    return '<button type="button" class="btn btn-gold" onclick="guidedAuthorSetTab(\'sidecars\'); setTimeout(guidedAuthorTriggerSidecarFile, 0)">Choose source JSON file</button><button type="button" class="btn btn-soft" onclick="guidedAuthorCoverageOpenSidecars()">Open Sidecars setup</button>';
  }
  if (!uid) {
    return '<button type="button" class="btn btn-soft" onclick="guidedAuthorCoverageOpenSidecars()">Open Sidecars setup</button>';
  }
  return ''
    + '<button type="button" class="btn btn-soft" onclick="guidedAuthorContentQaOpenQuestion(' + guidedAuthorQuestionBrowserArg(uid) + ', ' + (issue.scholarOnly ? 'true' : 'false') + ')">Open question</button>'
	    + (issue.scholarOnly ? '<button type="button" class="btn btn-soft" onclick="guidedAuthorContentQaOpenQuestion(' + guidedAuthorQuestionBrowserArg(uid) + ', true)">Review Scholar</button>' : '')
	    + '<button type="button" class="btn btn-soft" onclick="guidedAuthorContentQaOpenCoverage(' + guidedAuthorQuestionBrowserArg(uid) + ')">Open Coverage</button>';
}
function guidedAuthorContentQaIssueDetailsHtml(issue) {
  var details = issue && Array.isArray(issue.details) ? issue.details : [];
  if (!details.length) return '';
  return '<details class="guided-author-content-qa-details"><summary>Raw paths</summary><div>' + details.map(function(path){
    return '<code>' + guidedEsc(path) + '</code>';
  }).join('') + '</div></details>';
}
function guidedAuthorContentQaIssueListHtml(items, type) {
  items = items || [];
  if (!items.length) {
    if (type === 'failure') return '<div class="guided-author-content-qa-empty guided-author-coverage-chip is-ok">0 objective failures</div>';
    if (type === 'warning') return '';
    return guidedAuthorEmptyState('No watchlist items found.', 'This active sidecar has no subjective editorial notes from the current QA pass.', '');
  }
  return '<div class="guided-author-content-qa-list">' + items.map(function(issue){
    var rowClass = type === 'watchlist' ? ' is-watchlist' : (type === 'warning' ? ' is-warning' : ' is-failure');
    var meta = [issue.uid, issue.questionId].filter(Boolean).join(' · ');
    return ''
      + '<div class="guided-author-content-qa-row' + rowClass + '">'
	      +   '<div class="guided-author-content-qa-row-main">'
	      +     '<strong>' + guidedEsc(meta || (type === 'watchlist' ? 'Editorial watchlist' : 'Sidecar')) + '</strong>'
	      +     '<span>' + guidedEsc(issue.message) + '</span>'
	      +     guidedAuthorContentQaIssueDetailsHtml(issue)
	      +   '</div>'
	      +   '<div class="guided-author-coverage-actions">' + guidedAuthorContentQaIssueActionsHtml(issue) + '</div>'
	      + '</div>';
  }).join('') + '</div>';
}
function guidedAuthorContentQaChecksHtml(checks) {
  return '<div class="guided-author-content-qa-checks">' + (checks || []).map(function(check){
    return '<span class="guided-author-coverage-chip is-ok">' + guidedEsc(check) + '</span>';
  }).join('') + '</div>';
}
function guidedAuthorRenderContentQaTab(run, report, qualityReport, typeCoverageReport, learnCoverageReport) {
  var contentReport = guidedAuthorBuildContentQaReport();
	  if (!contentReport.hasSidecars) {
	    return ''
	      + '<div class="guided-card guided-author-start-card">'
	      +   '<div class="guided-kicker">Content QA</div>'
	      +   '<div class="guided-card-title">' + guidedAuthorHelpTitle('No active sidecar to review.', 'content-qa-active-sidecar', 'Content QA reads the active sidecar saved inside this browser. A JSON file sitting in the sidecars folder does not count until it has been loaded, validated, and saved as active. This matters because browser edits and source files can drift apart. If this screen is empty, go to Sidecars first and make sure the sidecar you want to inspect is saved active.') + '</div>'
	      +   '<div class="guided-card-sub">Load, validate, and save a sidecar before using browser-side content QA. This report reads active browser-local sidecars, not filesystem reports.</div>'
		      +   '<button class="btn btn-gold" onclick="guidedAuthorCoverageOpenSidecars()">Open Sidecars setup</button>'
	      + '</div>';
	  }
  return ''
	    + '<div class="guided-card guided-author-start-card">'
	    +   '<div class="guided-kicker">Content QA</div>'
	    +   '<div class="guided-card-title">' + guidedAuthorHelpTitle('Check content issues', 'content-qa-deterministic', 'Content QA is a read-only quality report for the active browser sidecar. Objective failures are things the app can clearly prove are wrong, such as a question pointing to a missing briefing, learner-facing meta language, invalid Scholar metadata, or a known regression. Warnings and watchlist items are prompts for human review; they do not automatically mean the content is unusable. This screen does not edit anything by itself. Use the action buttons in each row to jump to the right authoring area, make a draft, then apply/export from Review Edits.') + '</div>'
	    +   '<div class="guided-card-sub">Finds broken references, known wording problems, and review warnings in active browser sidecars.</div>'
	    +   '<div class="guided-author-question-summary">'
    +     '<span class="' + (contentReport.objectiveFailures.length ? 'guided-author-coverage-chip is-warning' : 'guided-author-coverage-chip is-ok') + '">' + guidedEsc(contentReport.objectiveFailures.length ? 'FAIL' : 'PASS') + '</span>'
    +     '<span>' + guidedEsc(contentReport.totals.usableItems + ' usable') + '</span>'
    +     '<span>' + guidedEsc(contentReport.objectiveFailures.length + ' objective failures') + '</span>'
    +     '<span>' + guidedEsc(contentReport.objectiveWarnings.length + ' warnings') + '</span>'
	    +     '<span>' + guidedEsc(contentReport.watchlist.length + ' watchlist') + '</span>'
	    +   '</div>'
	    + '</div>'
	    + '<div class="guided-card guided-author-content-qa-card">' + guidedAuthorActiveSidecarStatusBlockHtml() + '</div>'
	    + '<div class="guided-card guided-author-content-qa-card">'
    +   '<div class="guided-section-kicker">Contract totals</div>'
    +   '<div class="guided-author-coverage-metrics guided-author-content-qa-metrics">'
    +     contentReport.metrics.map(guidedAuthorContentQaMetricHtml).join('')
    +   '</div>'
    + '</div>'
    + '<div class="guided-card guided-author-content-qa-card">'
    +   '<div class="guided-section-kicker">Objective failures</div>'
    +   '<div class="guided-card-title">' + guidedEsc(contentReport.objectiveFailures.length ? 'Fix before source-sidecar save.' : 'None found.') + '</div>'
    +   '<div class="guided-card-sub">Covers count mismatches, broken briefing references, banned learner-facing meta terms, bad Scholar metadata, missing event boards, exact evidence-label drift, and known deterministic regressions.</div>'
    +   guidedAuthorContentQaIssueListHtml(contentReport.objectiveFailures, 'failure')
    +   guidedAuthorContentQaIssueListHtml(contentReport.objectiveWarnings, 'warning')
    + '</div>'
    + '<div class="guided-card guided-author-content-qa-card">'
    +   '<div class="guided-section-kicker">Editorial watchlist</div>'
    +   '<div class="guided-card-title">Subjective review only.</div>'
    +   '<div class="guided-card-sub">These items are intentionally not rewritten by deterministic QA. Use them for a later editorial pass.</div>'
    +   guidedAuthorContentQaIssueListHtml(contentReport.watchlist, 'watchlist')
    + '</div>'
    + '<div class="guided-card guided-author-content-qa-card">'
    +   '<div class="guided-section-kicker">Deterministic checks passed</div>'
    +   guidedAuthorContentQaChecksHtml(contentReport.checks)
    +   '<div class="guided-author-coverage-actions">'
    +     '<button type="button" class="btn btn-soft" onclick="guidedAuthorContentQaOpenCoverage(\'\')">Open Coverage</button>'
    +     '<button type="button" class="btn btn-soft" onclick="guidedAuthorCoverageOpenSidecars()">Open Sidecars setup</button>'
    +   '</div>'
    + '</div>';
}
function guidedAuthorRenderReviewEditsTab() {
  return guidedAuthorRenderDraftPatchPanel();
}
function guidedAuthorRenderDraftsTab() {
  return guidedAuthorRenderReviewEditsTab();
}
