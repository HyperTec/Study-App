// StudyDeck timeline viewer.
(function(){
  var timelineState = {
    sidecar: null,
    timeline: null,
    lanes: [],
    events: [],
    eventLookup: {},
    selectedEventId: '',
    zoom: 1,
    dateCursorYear: null,
    boardScrollLeft: 0,
    indexScrollTop: 0,
    activeCategoryFilters: [],
    collapsedLaneIds: [],
    hideFilteredItems: false,
    searchQuery: '',
    typeFilter: 'all',
    dateWindow: {
      fromYear: '',
      fromEra: 'CE',
      toYear: '',
      toEra: 'CE'
    },
    filterPanelOpen: false,
    indexPanelOpen: false,
    coverageNextOpen: false,
    savedAt: 0
  };
  var TIMELINE_UI_STATE_KEY = 'studydeck_timeline_ui_state_v1';
  var timelineDateCursorDrag = null;
  var timelineDateCursorSuppressClickUntil = 0;

  function html(value) {
    if (typeof escHtml === 'function') return escHtml(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function applyStoredTimelineUiState() {
    try {
      var raw = sessionStorage.getItem(TIMELINE_UI_STATE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      var savedAt = Number(saved.savedAt || 0) || 0;
      if (timelineState.savedAt && savedAt && savedAt < timelineState.savedAt) return;
      if (typeof saved.selectedEventId === 'string') timelineState.selectedEventId = saved.selectedEventId;
      if (Number.isFinite(Number(saved.zoom))) timelineState.zoom = Math.max(1, Math.min(4, Number(saved.zoom)));
      if (Object.prototype.hasOwnProperty.call(saved, 'dateCursorYear')) timelineState.dateCursorYear = normalizeTimelineCursorYear(saved.dateCursorYear, null, null);
      if (Number.isFinite(Number(saved.boardScrollLeft))) timelineState.boardScrollLeft = Math.max(0, Number(saved.boardScrollLeft));
      if (Number.isFinite(Number(saved.indexScrollTop))) timelineState.indexScrollTop = Math.max(0, Number(saved.indexScrollTop));
      if (Array.isArray(saved.activeCategoryFilters)) {
        timelineState.activeCategoryFilters = saved.activeCategoryFilters.map(clean).filter(Boolean);
      }
      if (Array.isArray(saved.collapsedLaneIds)) {
        timelineState.collapsedLaneIds = saved.collapsedLaneIds.map(clean).filter(Boolean);
      }
      if (typeof saved.hideFilteredItems === 'boolean') timelineState.hideFilteredItems = saved.hideFilteredItems;
      if (typeof saved.searchQuery === 'string') timelineState.searchQuery = saved.searchQuery;
      if (typeof saved.typeFilter === 'string') timelineState.typeFilter = saved.typeFilter;
      if (saved.dateWindow && typeof saved.dateWindow === 'object') timelineState.dateWindow = saved.dateWindow;
      if (typeof saved.indexPanelOpen === 'boolean') timelineState.indexPanelOpen = saved.indexPanelOpen;
      if (typeof saved.coverageNextOpen === 'boolean') timelineState.coverageNextOpen = saved.coverageNextOpen;
      timelineState.savedAt = savedAt || timelineState.savedAt;
    } catch(e) {}
  }

  function saveTimelineUiState() {
    timelineState.savedAt = Date.now();
    try {
      sessionStorage.setItem(TIMELINE_UI_STATE_KEY, JSON.stringify({
        selectedEventId: timelineState.selectedEventId || '',
        zoom: Number(timelineState.zoom || 1) || 1,
        dateCursorYear: activeTimelineCursorYear(),
        boardScrollLeft: Number(timelineState.boardScrollLeft || 0) || 0,
        indexScrollTop: Number(timelineState.indexScrollTop || 0) || 0,
        activeCategoryFilters: activeTimelineCategoryFilters(),
        collapsedLaneIds: activeTimelineCollapsedLaneIds(),
        hideFilteredItems: !!timelineState.hideFilteredItems,
        searchQuery: clean(timelineState.searchQuery),
        typeFilter: activeTimelineTypeFilter(),
        dateWindow: timelineDateWindow(),
        indexPanelOpen: !!timelineState.indexPanelOpen,
        coverageNextOpen: !!timelineState.coverageNextOpen,
        savedAt: timelineState.savedAt
      }));
    } catch(e) {}
  }

  function jsString(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');
  }

  function normalize(value) {
    return clean(value).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function compactTimelineLabel(label) {
    var original = clean(label);
    var shortLabels = {
      'jesus of nazareth': 'Jesus ministry',
      'john the baptist': 'John Baptist',
      'pontius pilate': 'Pilate',
      'temple destroyed': 'Temple fall',
      'undisputed pauline letters': "Paul's main letters",
      'johannine writings': 'John-related writings',
      'pastoral epistles': 'Pastoral letters'
    };
    return shortLabels[normalize(original)] || original;
  }

  function compactTimelineDate(label) {
    var original = clean(label);
    var dateLabels = {
      'early 1st century ce': 'early 1st c.',
      'public activity c 27 30 ce': 'c. 27-30 CE',
      '50s early 60s ce': '50s-early 60s',
      '50s or early 60s ce': '50s/early 60s',
      'mid to late 50s ce': 'mid-late 50s',
      '60s ce if pauline later if pseudonymous': '60s+ CE',
      'about 60 90 ce': 'c. 60-90 CE',
      'c 70 ce or shortly after': 'c. 70 CE',
      'late 1st century ce if pseudonymous': 'late 1st c.',
      'late 1st century ce and nearby': 'late 1st c.',
      'late 1st or early 2nd century ce': 'late 1st/early 2nd'
    };
    return dateLabels[normalize(original)] || original;
  }

  function applyTimelineDisplayLabels(event) {
    event.displayLabel = compactTimelineLabel(event.label);
    event.displayDateShort = compactTimelineDate(event.displayDate);
    return event;
  }

  function timelineVisibleLabel(event) {
    return clean(event && event.displayLabel) || clean(event && event.label) || 'Timeline event';
  }

  function timelineVisibleDate(event) {
    return clean(event && event.displayDateShort) || clean(event && event.displayDate) || '';
  }

  function timelineDisplayDiffers(event) {
    if (!event) return false;
    return timelineVisibleLabel(event) !== clean(event.label) || timelineVisibleDate(event) !== clean(event.displayDate);
  }

  function timelinePillSummary(event) {
    return [timelineVisibleLabel(event), timelineVisibleDate(event)].filter(Boolean).join(' · ');
  }

  function timelineFullSummary(event) {
    return [clean(event && event.label), clean(event && event.displayDate)].filter(Boolean).join(' · ');
  }

  function timelineContextLabel() {
    return 'Historical setting';
  }

  function timelinePublicTitle(timeline, sidecar) {
    var title = clean(timeline && timeline.title) || clean(sidecar && sidecar.title) || 'Timeline';
    return title
      .replace(/\s+Timeline Sidecar\s+v?\d*\s+Pilot$/i, '')
      .replace(/\s+Pilot$/i, '')
      .trim() || 'Timeline';
  }

  function compactTimelineLaneLabel(label) {
    var normalized = normalize(label);
    var labels = {
      'history and events': 'History',
      'rulers and public figures': 'Rulers',
      'people and communities': 'People',
      'texts and attribution': 'Texts',
      'transmission and reception': 'Reception'
    };
    return labels[normalized] || clean(label);
  }

  function timelinePlainConfidence(event) {
    var text = normalize(event && event.confidence);
    if (!text) return '';
    var labels = {
      'strong historical anchor': 'firm historical anchor',
      'common historical range': 'common historical range',
      'common critical range': 'common scholarly range',
      'authorship dependent': 'date depends on authorship',
      'broad critical placement': 'broad scholarly range',
      'common critical range with authorship debate': 'common range; authorship debated',
      'common critical range if pseudonymous': 'common range if not by Paul'
    };
    return labels[text] || clean(event && event.confidence).replace(/critical/g, 'scholarly');
  }

  function timelinePlainDateKind(event) {
    var type = normalize(event && event.dateType);
    if (/single year/.test(type)) return 'single-year date';
    if (/regnal|office/.test(type)) return 'reign or office dates';
    if (/historical range/.test(type)) return 'historical event range';
    if (/collection/.test(type)) return 'grouped writing dates';
    if (/translation|manuscript|textual|reception|canon/.test(type)) return 'transmission or reception date range';
    if (/debated/.test(type)) return 'debated date range';
    if (/approximate|activity/.test(type)) return 'approximate date range';
    if (/context/.test(type)) return 'context date';
    return clean(event && event.dateType).replace(/_/g, ' ') || 'timeline date';
  }

  function timelineWhatThisIs(event, lane) {
    var category = normalize(event && event.category);
    if (event && event.isContext) return clean(event && event.shortNote) || 'A historical event from the surrounding period.';
    if (/history and events/.test(category)) return 'A historical period, event, institution, or setting used to place other cards in time.';
    if (/rulers and public figures/.test(category)) return 'A ruler, official, or public figure whose dates help anchor nearby cards.';
    if (/people and communities/.test(category)) return 'A person, group, or community connected to the historical setting of the deck.';
    if (/texts and attribution/.test(category)) return 'A text, writing collection, authorship claim, or composition topic.';
    if (/transmission and reception/.test(category)) return 'A manuscript, version, canon, interpretation, or later reception-history item.';
    if (/collection/.test(category)) return 'A grouped item. Its bar covers several related writings instead of one single card event.';
    if (/writing/.test(category)) return 'A flashcard-linked writing. Its bar shows the date range used for that card.';
    if (/historical anchor/.test(category)) return 'A historical anchor. It helps you line up the writings with rulers, officials, and public events.';
    return 'A timeline item in ' + clean(lane && lane.label || event && event.category || 'this lane') + '.';
  }

  function timelineDateExplanation(event) {
    var type = normalize(event && event.dateType);
    var confidence = normalize(event && event.confidence);
    if (/collection/.test(type)) return 'This is a range for a group, so the bar is wider than a single writing would be.';
    if (/translation|manuscript|textual|reception|canon/.test(type)) return 'This range marks when this tradition, witness, or reception item is usually placed.';
    if (/debated/.test(type) || /authorship/.test(confidence)) return 'The date is debated, often because authorship or exact timing is uncertain.';
    if (/approximate|activity/.test(type) || /broad/.test(confidence)) return 'This is an approximate scholarly range, not an exact calendar date.';
    if (/regnal|office/.test(type)) return 'This range marks years when the person ruled or held office.';
    if (/single year/.test(type)) return event && event.isContext ? timelineWhatThisIs(event) : 'This is a single-year date, so it appears as a dot when the timeline is zoomed out.';
    if (/historical range/.test(type)) return event && event.isContext ? timelineWhatThisIs(event) : 'This historical date range helps place nearby cards in time.';
    return 'The date label is the learner-facing wording from the timeline sidecar.';
  }

  function renderTimelineInfoTile(title, body) {
    body = clean(body);
    if (!body) return '';
    return '<div class="timeline-detail-info-tile"><strong>' + html(title) + '</strong><span>' + html(body) + '</span></div>';
  }

  function timelineMarkerNote(event, lane) {
    var note = clean(event && event.shortNote);
    if (note) return note;
    var type = normalize(event && event.dateType);
    if (event && event.isContext) {
      return [clean(event.label), clean(event.displayDate)].filter(Boolean).join(', ') || 'Historical context item.';
    }
    return [timelineWhatThisIs(event, lane), timelineDateExplanation(event)].filter(Boolean).join(' ');
  }

  function timelineMarkerMeta(event) {
    if (event && event.isContext) return timelineContextLabel();
    return [timelinePlainConfidence(event), timelinePlainDateKind(event)].filter(Boolean).join('|');
  }

  function sidecarCards(sidecar) {
    return sidecar && sidecar.cards && typeof sidecar.cards === 'object' ? sidecar.cards : {};
  }

  function sidecarHasTimeline(sidecar) {
    if (!sidecar || typeof sidecar !== 'object') return false;
    if (sidecar.sidecarType === 'studydeck-timeline') return true;
    var cards = sidecarCards(sidecar);
    return Object.keys(cards).some(function(uid){
      return !!(cards[uid] && cards[uid].timeline);
    });
  }

  function timelineSidecars() {
    var out = [];
    if (Array.isArray(window.STUDYDECK_TIMELINE_SIDECARS)) {
      out = out.concat(window.STUDYDECK_TIMELINE_SIDECARS.filter(sidecarHasTimeline));
    }
    if (typeof guidedSidecarStore !== 'undefined' && guidedSidecarStore && Array.isArray(guidedSidecarStore.sidecars)) {
      out = out.concat(guidedSidecarStore.sidecars.filter(sidecarHasTimeline));
    }
    var seen = {};
    return out.filter(function(sidecar){
      var key = [
        sidecar.title || sidecar.name || '',
        sidecar.source && sidecar.source.deckFileSha256 || '',
        Object.keys(sidecarCards(sidecar)).length
      ].join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function firstTimeline(sidecar) {
    var timelines = sidecar && sidecar.timelineLearning && sidecar.timelineLearning.timelines;
    if (!timelines || typeof timelines !== 'object') return null;
    var ids = Object.keys(timelines);
    if (!ids.length) return null;
    var timeline = timelines[ids[0]] || {};
    timeline.id = timeline.id || ids[0];
    return timeline;
  }

  function findDeckForSidecar(sidecar) {
    var availableDecks = (typeof decks !== 'undefined' && Array.isArray(decks)) ? decks : [];
    if (!availableDecks.length) return null;
    var wanted = [
      sidecar && sidecar.deckName,
      sidecar && sidecar.sourceDeckName,
      sidecar && sidecar.deck,
      sidecar && sidecar.targetDeck
    ].map(normalize).filter(Boolean);
    var byName = availableDecks.find(function(deck){
      var deckName = normalize(deck && deck.name);
      return wanted.some(function(name){
        return deckName === name || deckName.indexOf(name) !== -1 || name.indexOf(deckName) !== -1;
      });
    });
    if (byName) return byName;
    return availableDecks.find(function(deck){
      var name = normalize(deck && deck.name);
      return name.indexOf('timeline') !== -1 && name.indexOf('attribution') !== -1;
    }) || null;
  }

  function findCardByUid(uid, preferredDeck) {
    uid = clean(uid);
    if (!uid) return null;
    var availableDecks = (typeof decks !== 'undefined' && Array.isArray(decks)) ? decks : [];
    var orderedDecks = preferredDeck ? [preferredDeck].concat(availableDecks.filter(function(deck){ return deck !== preferredDeck; })) : availableDecks;
    for (var i = 0; i < orderedDecks.length; i += 1) {
      var deck = orderedDecks[i];
      var cards = deck && Array.isArray(deck.cards) ? deck.cards : [];
      for (var j = 0; j < cards.length; j += 1) {
        if (clean(cards[j] && cards[j].uid) === uid) return { deck: deck, card: cards[j] };
      }
    }
    return null;
  }

  function timelineCardLockInfo(deck, card) {
    if (!deck || !card) return { locked: false, cardLevel: 1, unlockedLevel: 40, deckName: '' };
    if (typeof getCardLinkLockInfo === 'function') return getCardLinkLockInfo(deck, card) || { locked: false };
    var cardLevel = Number(card.level || 1) || 1;
    var unlockedLevel = 40;
    if (!(typeof authorMode !== 'undefined' && authorMode)) {
      unlockedLevel = typeof getDeckUnlockedLevel === 'function'
        ? (Number(getDeckUnlockedLevel(deck.id) || 1) || 1)
        : 1;
    }
    return {
      locked: cardLevel > unlockedLevel,
      cardLevel: cardLevel,
      unlockedLevel: unlockedLevel,
      deckName: deck.name || 'this deck'
    };
  }

  function timelineEventLockInfo(event) {
    return timelineCardLockInfo(event && event.deck, event && event.card);
  }

  function timelineLockMessage(lockInfo) {
    return 'Reach ' + (lockInfo.deckName || 'this deck') + ' Level ' + (lockInfo.cardLevel || 1) + ' to study this card.';
  }

  function renderTimelineStudyCardButton(event, extraClass, label) {
    if (!event || !event.card) return '';
    var lockInfo = timelineEventLockInfo(event);
    var className = 'timeline-study-action' + (extraClass ? ' ' + extraClass : '');
    if (lockInfo && lockInfo.locked) {
      return '<button type="button" class="btn btn-soft ' + html(className) + ' is-locked" disabled aria-disabled="true" title="' + html(timelineLockMessage(lockInfo)) + '">Locked until Lvl. ' + html(lockInfo.cardLevel || 1) + '</button>';
    }
    return '<button type="button" class="btn btn-gold ' + html(className) + '" onclick="studyDeckTimelineOpenCard(\'' + jsString(event.cardUid) + '\')">' + html(label || 'Study card') + '</button>';
  }

  function renderTimelineStudyLockNote(event) {
    var lockInfo = timelineEventLockInfo(event);
    return lockInfo && lockInfo.locked
      ? '<div class="timeline-study-lock-note">' + html(timelineLockMessage(lockInfo)) + '</div>'
      : '';
  }

  function laneColor(lane) {
    return clean(lane && lane.color) || '#7dd3fc';
  }

  function laneById(lanes, laneId) {
    laneId = clean(laneId);
    return lanes.find(function(lane){ return clean(lane.id) === laneId; }) || lanes[0] || { id: 'timeline', label: 'Timeline', color: '#7dd3fc' };
  }

  function activeTimelineCategoryFilters() {
    var seen = {};
    var laneIds = {};
    (timelineState.lanes || []).forEach(function(lane){
      laneIds[clean(lane && lane.id)] = true;
    });
    return (timelineState.activeCategoryFilters || []).map(clean).filter(function(id){
      if (!id || seen[id]) return false;
      if (Object.keys(laneIds).length && !laneIds[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  function activeTimelineCollapsedLaneIds() {
    var seen = {};
    var laneIds = {};
    (timelineState.lanes || []).forEach(function(lane){
      laneIds[clean(lane && lane.id)] = true;
    });
    return (timelineState.collapsedLaneIds || []).map(clean).filter(function(id){
      if (!id || seen[id]) return false;
      if (Object.keys(laneIds).length && !laneIds[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  function timelineLaneIsCollapsed(laneId) {
    return activeTimelineCollapsedLaneIds().indexOf(clean(laneId)) !== -1;
  }

  function timelineHasCategoryFilter() {
    return activeTimelineCategoryFilters().length > 0;
  }

  function timelineSearchQuery() {
    return clean(timelineState.searchQuery);
  }

  function timelineHasSearchFilter() {
    return !!timelineSearchQuery();
  }

  function activeTimelineTypeFilter() {
    var type = clean(timelineState.typeFilter).toLowerCase();
    return ['all', 'cards', 'context'].indexOf(type) === -1 ? 'all' : type;
  }

  function timelineHasTypeFilter() {
    return activeTimelineTypeFilter() !== 'all';
  }

  function timelineEra(value) {
    return clean(value).toUpperCase() === 'BCE' ? 'BCE' : 'CE';
  }

  function timelineIntegerYear(value) {
    var raw = clean(value).replace(/[^\d]/g, '');
    if (!raw) return '';
    var year = Math.max(1, Math.floor(Number(raw) || 0));
    return year ? String(year) : '';
  }

  function timelineDateWindow() {
    var dateWindow = timelineState.dateWindow && typeof timelineState.dateWindow === 'object'
      ? timelineState.dateWindow
      : {};
    return {
      fromYear: timelineIntegerYear(dateWindow.fromYear),
      fromEra: timelineEra(dateWindow.fromEra),
      toYear: timelineIntegerYear(dateWindow.toYear),
      toEra: timelineEra(dateWindow.toEra)
    };
  }

  function timelineHasDateWindowFilter() {
    var dateWindow = timelineDateWindow();
    return !!(dateWindow.fromYear || dateWindow.toYear);
  }

  function timelineDateCoordinate(year, era) {
    var number = Math.max(1, Math.floor(Number(year) || 0));
    if (!number) return null;
    return timelineEra(era) === 'BCE' ? -number : number;
  }

  function activeTimelineDateWindow() {
    var dateWindow = timelineDateWindow();
    var from = dateWindow.fromYear ? timelineDateCoordinate(dateWindow.fromYear, dateWindow.fromEra) : null;
    var to = dateWindow.toYear ? timelineDateCoordinate(dateWindow.toYear, dateWindow.toEra) : null;
    if (from == null && to == null) return null;
    var min = from == null ? -Infinity : from;
    var max = to == null ? Infinity : to;
    if (min > max) {
      var swap = min;
      min = max;
      max = swap;
    }
    return Object.assign({}, dateWindow, { min: min, max: max });
  }

  function timelineDateWindowLabel() {
    var dateWindow = activeTimelineDateWindow();
    if (!dateWindow) return '';
    if (dateWindow.fromYear && dateWindow.toYear) {
      return formatYear(dateWindow.min) + ' to ' + formatYear(dateWindow.max);
    }
    if (dateWindow.fromYear) return 'From ' + formatYear(dateWindow.min);
    return 'To ' + formatYear(dateWindow.max);
  }

  function timelineHasAnyFilter() {
    return timelineHasCategoryFilter() || timelineHasSearchFilter() || timelineHasTypeFilter() || timelineHasDateWindowFilter();
  }

  function timelineHideFilteredItems() {
    return timelineHasAnyFilter() && !!timelineState.hideFilteredItems;
  }

  function timelineCategoryIsFiltered(laneId) {
    var filters = activeTimelineCategoryFilters();
    if (!filters.length) return false;
    return filters.indexOf(clean(laneId)) === -1;
  }

  function timelineEventMatchesCategoryFilter(event) {
    return !timelineCategoryIsFiltered(event && event.laneId);
  }

  function timelineEventMatchesSearchFilter(event) {
    var query = normalize(timelineSearchQuery());
    if (!query) return true;
    var terms = query.split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    var haystack = normalize([
      event && event.label,
      event && event.displayLabel,
      event && event.displayDate,
      event && event.displayDateShort,
      event && event.category,
      event && event.confidence,
      event && event.shortNote,
      event && event.titleHint,
      event && event.cardUid,
      event && event.dateType
    ].join(' '));
    return terms.every(function(term){ return haystack.indexOf(term) !== -1; });
  }

  function timelineEventMatchesTypeFilter(event) {
    var type = activeTimelineTypeFilter();
    if (type === 'cards') return !!(event && !event.isContext);
    if (type === 'context') return !!(event && event.isContext);
    return true;
  }

  function timelineEventMatchesDateWindowFilter(event) {
    var dateWindow = activeTimelineDateWindow();
    if (!dateWindow) return true;
    var start = timelineYear(event && event.startYear, 0);
    var end = timelineYear(event && event.endYear, start);
    if (start > end) {
      var swap = start;
      start = end;
      end = swap;
    }
    return end >= dateWindow.min && start <= dateWindow.max;
  }

  function timelineEventMatchesFilters(event) {
    return timelineEventMatchesCategoryFilter(event)
      && timelineEventMatchesSearchFilter(event)
      && timelineEventMatchesTypeFilter(event)
      && timelineEventMatchesDateWindowFilter(event);
  }

  function timelineFilterClassForEvent(event) {
    if (timelineEventMatchesFilters(event)) return '';
    return ' is-filtered-out' + (timelineHideFilteredItems() ? ' is-filter-hidden' : '');
  }

  function reconcileTimelineSelectionWithFilters(events) {
    if (!timelineHasAnyFilter()) return false;
    var selected = timelineState.eventLookup[timelineState.selectedEventId];
    if (selected && timelineEventMatchesFilters(selected)) return false;
    var next = (events || []).filter(timelineEventMatchesFilters).sort(function(a, b){
      return a.sortYear - b.sortYear || a.startYear - b.startYear || a.endYear - b.endYear || a.label.localeCompare(b.label);
    })[0];
    if (!next) return false;
    timelineState.selectedEventId = next.id;
    return true;
  }

  function timelineYear(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function eventPercent(year, minYear, maxYear) {
    if (maxYear <= minYear) return 0;
    return Math.max(0, Math.min(100, ((year - minYear) / (maxYear - minYear)) * 100));
  }

  function formatYear(year) {
    year = Number(year);
    if (!Number.isFinite(year)) return '';
    if (year < 0) return Math.abs(year) + ' BCE';
    if (year === 0) return '1 BCE / 1 CE';
    return year + ' CE';
  }

  function normalizeTimelineCursorYear(value, minYear, maxYear) {
    if (value == null || value === '') return null;
    var raw = Number(value);
    if (!Number.isFinite(raw)) return null;
    var year = Math.round(raw);
    if (year === 0) year = raw < 0 ? -1 : 1;
    if (minYear != null && minYear !== '' && Number.isFinite(Number(minYear))) year = Math.max(Math.round(Number(minYear)), year);
    if (maxYear != null && maxYear !== '' && Number.isFinite(Number(maxYear))) year = Math.min(Math.round(Number(maxYear)), year);
    if (year === 0) year = raw < 0 ? -1 : 1;
    return year;
  }

  function activeTimelineCursorYear() {
    var timeline = timelineState.timeline || {};
    return normalizeTimelineCursorYear(timelineState.dateCursorYear, timeline.minYear, timeline.maxYear);
  }

  function timelineYearFromPercent(percent, minYear, maxYear) {
    percent = Math.max(0, Math.min(100, Number(percent) || 0));
    minYear = timelineYear(minYear, -40);
    maxYear = timelineYear(maxYear, 130);
    return minYear + ((maxYear - minYear) * (percent / 100));
  }

  function renderTimelineDateCursor(minYear, maxYear, context) {
    var year = activeTimelineCursorYear();
    if (year == null) return '';
    var percent = eventPercent(year, minYear, maxYear);
    var label = formatYear(year);
    var className = context === 'axis' ? 'timeline-date-cursor is-axis' : 'timeline-date-cursor is-board';
    if (percent <= 10) className += ' is-near-start';
    else if (percent >= 90) className += ' is-near-end';
    return '<button type="button" class="' + className + '"'
      + ' style="left:' + percent.toFixed(4) + '%"'
      + ' aria-label="' + html('Date cursor at ' + label + '. Drag to move it.') + '"'
      + ' onpointerdown="studyDeckTimelineStartDateCursorDrag(event,\'' + html(context) + '\')"'
      + ' onclick="event.stopPropagation()">'
      + '<span class="timeline-date-cursor-label">' + html(label) + '</span>'
      + '</button>';
  }

  function timelineZoomValue() {
    var zoom = Number(timelineState.zoom || 1);
    if (!Number.isFinite(zoom)) zoom = 1;
    return Math.max(1, Math.min(4, zoom));
  }

  function timelineBaseBoardWidth() {
    return (typeof window !== 'undefined' && window.innerWidth <= 560) ? 860 : 980;
  }

  function timelineBoardWidth() {
    return Math.round(timelineBaseBoardWidth() * timelineZoomValue());
  }

  function timelineAxisLabelWidth() {
    return (typeof window !== 'undefined' && window.innerWidth <= 560) ? 132 : 160;
  }

  function timelineGridStep() {
    var zoom = timelineZoomValue();
    if (zoom >= 3.5) return 5;
    if (zoom >= 1.75) return 10;
    return 20;
  }

  function timelineTickLabelStep() {
    var zoom = timelineZoomValue();
    if (zoom >= 3.5) return 10;
    if (zoom >= 1.75) return 20;
    return 40;
  }

  function timelineLabelMinWidthPercent(event, boardWidth, zoomValue) {
    boardWidth = Math.max(1, Number(boardWidth) || timelineBoardWidth());
    zoomValue = Number(zoomValue == null ? timelineZoomValue() : zoomValue);
    if (!Number.isFinite(zoomValue)) zoomValue = 1;
    if (event && event.startYear === event.endYear) {
      return zoomValue >= 1.75 ? Math.min(18, (136 / boardWidth) * 100) : Math.min(16, (106 / boardWidth) * 100);
    }
    return Math.min(20, (140 / boardWidth) * 100);
  }

  function timelineTrueRangeWidthPercent(event, minYear, maxYear) {
    var left = eventPercent(event.startYear, minYear, maxYear);
    var right = eventPercent(event.endYear, minYear, maxYear);
    return Math.max(0, right - left);
  }

  function timelineLabelWidthPercent(event, minYear, maxYear, boardWidth, zoomValue) {
    var actualWidth = timelineTrueRangeWidthPercent(event, minYear, maxYear);
    return Math.max(timelineLabelMinWidthPercent(event, boardWidth, zoomValue), actualWidth);
  }

  function timelineLabelLeftPercent(event, minYear, maxYear, labelWidth) {
    var left = eventPercent(event.startYear, minYear, maxYear);
    var right = eventPercent(event.endYear, minYear, maxYear);
    var center = event.startYear === event.endYear ? left : (left + right) / 2;
    return Math.max(0, Math.min(100 - labelWidth, center - (labelWidth / 2)));
  }

  function timelineEventLayout(events, minYear, maxYear, boardWidth) {
    var rows = [];
    var stableBoardWidth = timelineBaseBoardWidth();
    var stableZoom = 1;
    var stableGap = 1.2;
    var items = (events || []).slice().sort(function(a, b){
      return a.sortYear - b.sortYear || a.endYear - b.endYear || a.label.localeCompare(b.label);
    }).map(function(event){
      var actualLeft = eventPercent(event.startYear, minYear, maxYear);
      var actualRight = eventPercent(event.endYear, minYear, maxYear);
      var width = timelineLabelWidthPercent(event, minYear, maxYear, boardWidth);
      var left = timelineLabelLeftPercent(event, minYear, maxYear, width);
      var stableWidth = timelineLabelWidthPercent(event, minYear, maxYear, stableBoardWidth, stableZoom);
      var stableLeft = timelineLabelLeftPercent(event, minYear, maxYear, stableWidth);
      var stableRight = stableLeft + stableWidth;
      var row = -1;
      for (var i = 0; i < rows.length; i += 1) {
        if (rows[i] + stableGap <= stableLeft) {
          row = i;
          break;
        }
      }
      if (row === -1) row = rows.length;
      rows[row] = stableRight;
      return { event: event, row: row, left: left, width: width, actualLeft: actualLeft, actualRight: actualRight };
    });
    return { items: items, rowCount: Math.max(1, rows.length) };
  }

  function buildTicks(minYear, maxYear) {
    minYear = timelineYear(minYear, -40);
    maxYear = timelineYear(maxYear, 130);
    if (maxYear < minYear) {
      var swap = maxYear;
      maxYear = minYear;
      minYear = swap;
    }
    var step = timelineGridStep();
    var labelStep = timelineTickLabelStep();
    var firstYear = Math.ceil(minYear / step) * step;
    var ticks = [];
    var hasAnchor = false;
    for (var year = firstYear; year <= maxYear + .0001; year += step) {
      var tickYear = Math.round(year);
      if (tickYear === 0) continue;
      var isAnchor = tickYear === 1;
      var isMajor = isAnchor || Math.abs(tickYear) % labelStep === 0;
      if (isAnchor) hasAnchor = true;
      ticks.push({
        percent: eventPercent(tickYear, minYear, maxYear),
        year: tickYear,
        isAnchor: isAnchor,
        isMajor: isMajor
      });
    }
    if (!hasAnchor && minYear <= 1 && maxYear >= 1) {
      ticks.push({
        percent: eventPercent(1, minYear, maxYear),
        year: 1,
        isAnchor: true,
        isMajor: true
      });
      ticks.sort(function(a, b){ return a.year - b.year; });
    }
    if (!ticks.length) {
      var fallbackYear = minYear <= 1 && maxYear >= 1 ? 1 : Math.round(minYear);
      if (fallbackYear === 0) fallbackYear = 1;
      ticks.push({
        percent: eventPercent(fallbackYear, minYear, maxYear),
        year: fallbackYear,
        isAnchor: fallbackYear === 1,
        isMajor: true
      });
    }
    return ticks;
  }

  function collectTimelineModel() {
    var sidecars = timelineSidecars();
    var sidecar = sidecars[0] || null;
    var timeline = firstTimeline(sidecar) || {};
    var lanes = Array.isArray(timeline.lanes) && timeline.lanes.length
      ? timeline.lanes.slice()
      : [{ id: 'timeline', label: 'Timeline', color: '#7dd3fc' }];
    var preferredDeck = findDeckForSidecar(sidecar || {});
    var minYear = timelineYear(timeline.minYear, -40);
    var maxYear = timelineYear(timeline.maxYear, 130);
    var events = [];

    (Array.isArray(timeline.contextEvents) ? timeline.contextEvents : []).forEach(function(item){
      var start = timelineYear(item.startYear, minYear);
      var end = timelineYear(item.endYear, start);
      events.push(applyTimelineDisplayLabels({
        id: clean(item.id) || ('context_' + events.length),
        label: clean(item.label) || 'Historical setting',
        startYear: start,
        endYear: end,
        sortYear: timelineYear(item.sortYear, start),
        displayDate: clean(item.displayDate) || formatYear(start),
        dateType: clean(item.dateType) || 'context',
        laneId: clean(item.lane) || clean(lanes[0] && lanes[0].id),
        category: clean(item.category) || timelineContextLabel(),
        confidence: clean(item.confidence) || '',
        shortNote: clean(item.shortNote) || '',
        isContext: true
      }));
    });

    var cards = sidecarCards(sidecar);
    Object.keys(cards).forEach(function(uid){
      var entry = cards[uid] || {};
      var tl = entry.timeline || {};
      if (!tl || tl.startYear == null) return;
      var start = timelineYear(tl.startYear, minYear);
      var end = timelineYear(tl.endYear, start);
      var found = findCardByUid(entry.cardUid || uid, preferredDeck);
      events.push(applyTimelineDisplayLabels({
        id: clean(tl.eventId) || (uid + '_timeline'),
        cardUid: clean(entry.cardUid || uid),
        label: clean(tl.label) || clean(entry.titleHint) || clean(found && found.card && found.card.a) || uid,
        titleHint: clean(entry.titleHint),
        startYear: start,
        endYear: end,
        sortYear: timelineYear(tl.sortYear, start),
        displayDate: clean(tl.displayDate) || formatYear(start),
        dateType: clean(tl.dateType) || 'range',
        laneId: clean(tl.lane) || clean(lanes[0] && lanes[0].id),
        category: clean(tl.category),
        confidence: clean(tl.confidence),
        shortNote: clean(tl.shortNote),
        sourceCardNoteLabel: clean(tl.sourceCardNoteLabel),
        deck: found && found.deck,
        card: found && found.card,
        isContext: false
      }));
    });

    events.sort(function(a, b){
      return a.sortYear - b.sortYear || a.endYear - b.endYear || a.label.localeCompare(b.label);
    });

    var lookup = {};
    events.forEach(function(event){ lookup[event.id] = event; });
    timelineState.sidecar = sidecar;
    timelineState.timeline = Object.assign({}, timeline, { minYear: minYear, maxYear: maxYear });
    timelineState.lanes = lanes;
    timelineState.events = events;
    timelineState.eventLookup = lookup;
    if (!lookup[timelineState.selectedEventId]) {
      var firstCard = events.find(function(event){ return !event.isContext; }) || events[0];
      timelineState.selectedEventId = firstCard ? firstCard.id : '';
    }
    return timelineState;
  }

  function renderHomeEntry() {
    var entry = document.getElementById('timeline-entry');
    if (!entry) return;
    var sidecars = timelineSidecars();
    var sidecar = sidecars[0] || null;
    var count = sidecar ? Object.keys(sidecarCards(sidecar)).length : 0;
    var subEl = document.getElementById('timeline-entry-sub');
    if (subEl) subEl.textContent = count
      ? 'Compare key dates.'
      : 'Timeline unavailable.';
    entry.disabled = !count;
    entry.classList.toggle('is-empty', !count);
  }

  function timelineActiveLanes(lanes, events, includeContext) {
    var active = {};
    (events || []).forEach(function(event){
      if (!includeContext && event.isContext) return;
      if (event.laneId) active[event.laneId] = true;
    });
    return (lanes || []).filter(function(lane){ return active[lane.id]; });
  }

  function renderLegend(lanes, events) {
    lanes = timelineActiveLanes(lanes, events, true);
    return '<div class="timeline-legend" aria-label="Timeline lanes">'
      + lanes.map(function(lane){
        return '<span class="timeline-legend-item"><i style="--lane-color:' + html(laneColor(lane)) + '"></i>' + html(lane.label || lane.id) + '</span>';
      }).join('')
      + '</div>';
  }

  function renderTicks(minYear, maxYear) {
    var ticks = buildTicks(minYear, maxYear);
    return ticks.map(function(tick){
      var edgeClass = tick.percent <= .001 ? ' is-start' : (tick.percent >= 99.999 ? ' is-end' : '');
      if (tick.isAnchor) edgeClass += ' is-anchor';
      if (!tick.isMajor) edgeClass += ' is-minor';
      return '<span class="timeline-tick' + edgeClass + '" style="left:' + tick.percent.toFixed(4) + '%"><i></i><b>' + html(formatYear(tick.year)) + '</b></span>';
    }).join('');
  }

  function renderBoardGrid(minYear, maxYear) {
    return '<div class="timeline-board-grid" aria-hidden="true">'
      + buildTicks(minYear, maxYear).map(function(tick){
        return '<i class="timeline-grid-line' + (tick.isAnchor ? ' is-anchor' : '') + (!tick.isMajor ? ' is-minor' : '') + '" style="left:' + tick.percent.toFixed(4) + '%"></i>';
      }).join('')
      + '</div>';
  }

  function renderTimelineBoardCursorLayer(minYear, maxYear) {
    if (activeTimelineCursorYear() == null) return '';
    return '<div class="timeline-date-cursor-layer" aria-hidden="false">' + renderTimelineDateCursor(minYear, maxYear, 'board') + '</div>';
  }

  function timelineLaneRowStep() {
    return 38;
  }

  function timelineLaneItemTop() {
    return 10;
  }

  function timelineLaneTrackHeight(rowCount, minimumHeight) {
    rowCount = Math.max(1, Number(rowCount) || 1);
    return Math.max(minimumHeight || 66, 20 + rowCount * timelineLaneRowStep());
  }

  function eventClass(event, labeledSingleYear, isTight) {
    var classes = ['timeline-event'];
    if (event.isContext) classes.push('is-context');
    if (event.startYear === event.endYear && !labeledSingleYear) classes.push('is-dot');
    if (event.startYear === event.endYear && labeledSingleYear) classes.push('is-single-year');
    if (event.startYear !== event.endYear) classes.push('is-range');
    if (isTight) classes.push('is-tight');
    if (/debated|uncertain|approximate|authorship/i.test(event.dateType + ' ' + event.confidence)) classes.push('is-soft');
    return classes.join(' ');
  }

  function renderEventButton(layout, lane, minYear, maxYear, boardWidth) {
    var event = layout.event;
    var label = timelineVisibleLabel(event);
    var date = timelineVisibleDate(event);
    var actualLeft = layout.actualLeft == null ? eventPercent(event.startYear, minYear, maxYear) : layout.actualLeft;
    var actualRight = layout.actualRight == null ? eventPercent(event.endYear, minYear, maxYear) : layout.actualRight;
    var left = layout.left == null ? actualLeft : layout.left;
    var width = layout.width || timelineLabelWidthPercent(event, minYear, maxYear, boardWidth);
    var trueLeft = width > 0 ? ((actualLeft - left) / width) * 100 : 50;
    var trueWidth = width > 0 ? ((Math.max(0, actualRight - actualLeft)) / width) * 100 : 0;
    var trueCenter = width > 0 ? ((((actualLeft + actualRight) / 2) - left) / width) * 100 : 50;
    var labeledSingleYear = event.startYear === event.endYear && timelineZoomValue() >= 1;
    var isTight = ((width / 100) * boardWidth) < 124;
    var isSelected = event.id === timelineState.selectedEventId;
    var selected = isSelected ? ' is-selected' : '';
    return '<button type="button" class="' + eventClass(event, labeledSingleYear, isTight) + selected + timelineFilterClassForEvent(event) + '"'
      + ' style="left:' + left.toFixed(4) + '%;width:' + width.toFixed(4) + '%;top:' + (timelineLaneItemTop() + layout.row * timelineLaneRowStep()) + 'px;--lane-color:' + html(laneColor(lane)) + ';--true-left:' + trueLeft.toFixed(4) + '%;--true-width:' + trueWidth.toFixed(4) + '%;--true-center:' + trueCenter.toFixed(4) + '%"'
      + ' data-event-id="' + html(event.id) + '"'
      + ' title="' + html(event.label + ' · ' + event.displayDate) + '"'
      + ' onclick="event.stopPropagation();studyDeckTimelineSelectEvent(\'' + jsString(event.id) + '\',\'board\')"'
      + ' aria-pressed="' + (isSelected ? 'true' : 'false') + '"'
      + ' aria-label="' + html(event.label + ', ' + event.displayDate) + '">'
      + '<b class="timeline-event-true-range" aria-hidden="true"></b>'
      + '<span>' + html(label) + '</span><em>' + html(date) + '</em>'
      + '</button>';
  }

  function timelineOverlapLabel(rowCount) {
    rowCount = Math.max(1, Number(rowCount) || 1);
    return rowCount + ' row' + (rowCount === 1 ? '' : 's');
  }

  function renderTimelineLaneLabel(lane, rowCount, isCollapsed) {
    var laneId = clean(lane && lane.id);
    var label = clean(lane && lane.label) || laneId || 'Timeline';
    var visibleLabel = compactTimelineLaneLabel(label);
    var buttonLabel = isCollapsed ? 'Show' : 'Hide';
    var rowLabel = timelineOverlapLabel(rowCount);
    return '<div class="timeline-lane-label" title="' + html(label) + '">'
      + '<i aria-hidden="true"></i><span>' + html(visibleLabel) + '</span>'
      + (isCollapsed ? '' : '<small>' + html(rowLabel) + '</small>')
      + '<button type="button" class="timeline-lane-collapse-btn" aria-expanded="' + (isCollapsed ? 'false' : 'true') + '" aria-label="' + html(buttonLabel + ' ' + label) + '" onclick="event.stopPropagation();studyDeckTimelineToggleLaneCollapse(\'' + jsString(laneId) + '\')">' + html(buttonLabel) + '</button>'
      + '</div>';
  }

  function renderContextRow(events, lanes, minYear, maxYear, boardWidth) {
    var contextEvents = events.filter(function(event){ return event.isContext; });
    if (!contextEvents.length) return '';
    var contextLane = laneById(lanes || [], contextEvents[0] && contextEvents[0].laneId);
    var layout = timelineEventLayout(contextEvents, minYear, maxYear, boardWidth);
    var rowCount = layout.rowCount;
    var isCollapsed = timelineLaneIsCollapsed(contextLane && contextLane.id);
    return '<div class="timeline-lane-row timeline-context-row' + (rowCount > 1 && !isCollapsed ? ' has-overlap-rows' : '') + (timelineCategoryIsFiltered(contextLane && contextLane.id) ? ' is-filtered-out' : '') + (isCollapsed ? ' is-collapsed' : '') + '" data-lane-id="' + html(clean(contextLane && contextLane.id)) + '" style="--lane-color:' + html(laneColor(contextLane)) + '">'
      + renderTimelineLaneLabel(contextLane, rowCount, isCollapsed)
      + '<div class="timeline-lane-track" style="min-height:' + (isCollapsed ? 36 : timelineLaneTrackHeight(rowCount, 60)) + 'px;--timeline-row-count:' + html(rowCount) + '">'
      + (isCollapsed ? '' : layout.items.map(function(item){
        return renderEventButton(item, laneById(lanes, item.event.laneId), minYear, maxYear, boardWidth);
      }).join(''))
      + '</div>'
      + '</div>';
  }

  function renderLaneRows(events, lanes, minYear, maxYear, boardWidth) {
    return timelineActiveLanes(lanes, events, false).map(function(lane){
      var laneEvents = events.filter(function(event){ return !event.isContext && event.laneId === lane.id; });
      var layout = timelineEventLayout(laneEvents, minYear, maxYear, boardWidth);
      var rowCount = layout.rowCount;
      var height = timelineLaneTrackHeight(layout.rowCount, 66);
      var isCollapsed = timelineLaneIsCollapsed(lane.id);
      return '<div class="timeline-lane-row' + (rowCount > 1 && !isCollapsed ? ' has-overlap-rows' : '') + (timelineCategoryIsFiltered(lane.id) ? ' is-filtered-out' : '') + (isCollapsed ? ' is-collapsed' : '') + '" data-lane-id="' + html(clean(lane.id)) + '" style="--lane-color:' + html(laneColor(lane)) + '">'
        + renderTimelineLaneLabel(lane, rowCount, isCollapsed)
        + '<div class="timeline-lane-track" style="min-height:' + (isCollapsed ? 36 : height) + 'px;--timeline-row-count:' + html(rowCount) + '">'
        + (isCollapsed ? '' : layout.items.map(function(item){
          return renderEventButton(item, lane, minYear, maxYear, boardWidth);
        }).join(''))
        + '</div>'
        + '</div>';
    }).join('');
  }

  function renderDetail() {
    var event = timelineState.eventLookup[timelineState.selectedEventId] || timelineState.events[0];
    if (!event) return '<div class="timeline-detail-card"><strong>No timeline event selected.</strong></div>';
    var lane = laneById(timelineState.lanes || [], event.laneId);
    var pillSummary = timelinePillSummary(event);
    var fullSummary = timelineFullSummary(event);
    var aliasHtml = timelineDisplayDiffers(event)
      ? renderTimelineInfoTile('Short label', 'Shown as: ' + pillSummary + '. Full wording: ' + fullSummary + '.')
      : renderTimelineInfoTile('Short label', pillSummary);
    var infoTiles = event.isContext
      ? aliasHtml
      : renderTimelineInfoTile('What it is', timelineWhatThisIs(event, lane))
        + renderTimelineInfoTile('Date range', timelineDateExplanation(event))
        + aliasHtml;
    var explainerHtml = infoTiles ? '<div class="timeline-detail-info-grid">' + infoTiles + '</div>' : '';
    var cardHtml = event.card
      ? '<div class="timeline-detail-card-text"><strong>Card answer</strong><span>' + html(event.card.a || event.label) + '</span></div>'
        + '<div class="timeline-detail-card-text"><strong>Card question</strong><span>' + html(event.card.q || '') + '</span></div>'
        + renderTimelineStudyCardButton(event, 'timeline-detail-action', 'Study this card')
        + renderTimelineStudyLockNote(event)
      : (event.cardUid ? '<div class="timeline-detail-note">The matching flashcard is not loaded right now, so this detail is coming from the timeline sidecar only.</div>' : '');
    return '<div class="timeline-detail-card">'
      + '<div class="timeline-detail-kicker">' + html(event.isContext ? timelineContextLabel() : (event.category || 'Timeline event')) + '</div>'
      + '<div class="timeline-detail-title">' + html(event.label) + '</div>'
      + '<div class="timeline-detail-date">' + html(event.displayDate) + '</div>'
      + (event.shortNote ? '<p>' + html(event.shortNote) + '</p>' : '')
      + explainerHtml
      + '<div class="timeline-detail-meta">'
      + (event.confidence ? '<span>Confidence: ' + html(timelinePlainConfidence(event)) + '</span>' : '')
      + (event.dateType && !event.isContext ? '<span>Date range: ' + html(timelinePlainDateKind(event)) + '</span>' : '')
      + (event.cardUid ? '<span>Card ID: ' + html(event.cardUid) + '</span>' : '')
      + '</div>'
      + cardHtml
      + '</div>';
  }

  function findTimelineEventForCard(card) {
    var uid = clean(card && card.uid);
    if (!uid) return null;
    var model = collectTimelineModel();
    return (model.events || []).find(function(event){
      return !event.isContext && clean(event.cardUid) === uid;
    }) || null;
  }

  function flashcardTimelineWindowBounds(event, minYear, maxYear, targetSpan) {
    var start = timelineYear(event && event.startYear, minYear);
    var end = timelineYear(event && event.endYear, start);
    if (end < start) {
      var swap = start;
      start = end;
      end = swap;
    }
    var eventSpan = Math.max(0, end - start);
    var span = Math.max(Number(targetSpan) || 40, eventSpan + 8);
    var center = (start + end) / 2;
    var low = center - (span / 2);
    var high = center + (span / 2);
    if (low < minYear) {
      high += minYear - low;
      low = minYear;
    }
    if (high > maxYear) {
      low -= high - maxYear;
      high = maxYear;
    }
    low = Math.max(minYear, low);
    high = Math.min(maxYear, high);
    if (high <= low) high = Math.min(maxYear, low + 1);
    return { min: Math.floor(low), max: Math.ceil(high) };
  }

  function flashcardTimelineWindowEvents(event, events, bounds) {
    if (!event || !bounds) return [];
    var currentId = clean(event.id);
    return (events || []).filter(function(item){
      if (!item || clean(item.id) === currentId) return false;
      var start = timelineYear(item.startYear, null);
      var end = timelineYear(item.endYear, start);
      if (start == null || end == null) return false;
      return start <= bounds.max && end >= bounds.min;
    }).sort(function(a, b){
      return a.sortYear - b.sortYear || a.startYear - b.startYear || a.endYear - b.endYear || timelineVisibleLabel(a).localeCompare(timelineVisibleLabel(b));
    });
  }

  function clampPercent(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function flashcardZoomBounds(event, contexts, minYear, maxYear) {
    var years = [];
    [event].concat(contexts || []).forEach(function(item){
      if (!item) return;
      years.push(timelineYear(item.startYear, minYear));
      years.push(timelineYear(item.endYear, timelineYear(item.startYear, minYear)));
    });
    if (!years.length) return { min: minYear, max: maxYear };
    var low = Math.min.apply(Math, years);
    var high = Math.max.apply(Math, years);
    var span = Math.max(1, high - low);
    var padding = Math.max(6, Math.round(span * .28));
    var zoomMin = Math.max(minYear, low - padding);
    var zoomMax = Math.min(maxYear, high + padding);
    if (zoomMax - zoomMin < 24) {
      var center = (low + high) / 2;
      zoomMin = center - 12;
      zoomMax = center + 12;
      if (zoomMin < minYear) {
        zoomMax = Math.min(maxYear, zoomMax + (minYear - zoomMin));
        zoomMin = minYear;
      }
      if (zoomMax > maxYear) {
        zoomMin = Math.max(minYear, zoomMin - (zoomMax - maxYear));
        zoomMax = maxYear;
      }
    }
    return { min: Math.floor(zoomMin), max: Math.ceil(zoomMax) };
  }

  function flashcardMarkerLayout(item, minYear, maxYear, minHitWidth) {
    var actualLeft = eventPercent(item.startYear, minYear, maxYear);
    var actualRight = eventPercent(item.endYear, minYear, maxYear);
    var actualWidth = Math.max(0, actualRight - actualLeft);
    var center = item.startYear === item.endYear ? actualLeft : (actualLeft + actualRight) / 2;
    var hitWidth = Math.max(minHitWidth || 8, actualWidth);
    var hitLeft = Math.max(0, Math.min(100 - hitWidth, center - (hitWidth / 2)));
    return {
      hitLeft: hitLeft,
      hitWidth: hitWidth,
      trueLeft: clampPercent(((actualLeft - hitLeft) / hitWidth) * 100),
      trueWidth: Math.max(0, (actualWidth / hitWidth) * 100),
      trueCenter: clampPercent(((center - hitLeft) / hitWidth) * 100)
    };
  }

  function flashcardMarkerStyleFromLayouts(fit, zoom) {
    return [
      '--fit-left:' + fit.hitLeft.toFixed(4) + '%',
      '--fit-width:' + fit.hitWidth.toFixed(4) + '%',
      '--fit-true-left:' + fit.trueLeft.toFixed(4) + '%',
      '--fit-true-width:' + fit.trueWidth.toFixed(4) + '%',
      '--fit-true-center:' + fit.trueCenter.toFixed(4) + '%',
      '--zoom-left:' + zoom.hitLeft.toFixed(4) + '%',
      '--zoom-width:' + zoom.hitWidth.toFixed(4) + '%',
      '--zoom-true-left:' + zoom.trueLeft.toFixed(4) + '%',
      '--zoom-true-width:' + zoom.trueWidth.toFixed(4) + '%',
      '--zoom-true-center:' + zoom.trueCenter.toFixed(4) + '%'
    ].join(';');
  }

  function flashcardMarkerStyle(item, fitMin, fitMax, zoomMin, zoomMax, fitMinHit, zoomMinHit) {
    return flashcardMarkerStyleFromLayouts(
      flashcardMarkerLayout(item, fitMin, fitMax, fitMinHit),
      flashcardMarkerLayout(item, zoomMin, zoomMax, zoomMinHit)
    );
  }

  function flashcardMarkerProfile(item, itemLane, fitBounds, zoomBounds, fitMinHit, zoomMinHit) {
    var fit = flashcardMarkerLayout(item, fitBounds.min, fitBounds.max, fitMinHit);
    var zoom = flashcardMarkerLayout(item, zoomBounds.min, zoomBounds.max, zoomMinHit);
    var visibleInZoom = item.startYear <= zoomBounds.max && item.endYear >= zoomBounds.min;
    return {
      item: item,
      itemLane: itemLane,
      style: flashcardMarkerStyleFromLayouts(fit, zoom) + ';--marker-color:' + html(laneColor(itemLane)),
      fitStart: fit.hitLeft,
      fitEnd: fit.hitLeft + fit.hitWidth,
      zoomStart: zoom.hitLeft,
      zoomEnd: zoom.hitLeft + zoom.hitWidth,
      visibleInZoom: visibleInZoom
    };
  }

  function flashcardProfilesCollide(a, b) {
    var gap = 2.4;
    var fitOverlap = a.fitStart < b.fitEnd + gap && b.fitStart < a.fitEnd + gap;
    if (fitOverlap) return true;
    if (!a.visibleInZoom || !b.visibleInZoom) return false;
    return a.zoomStart < b.zoomEnd + gap && b.zoomStart < a.zoomEnd + gap;
  }

  function packFlashcardTimelineRows(profiles) {
    var rows = [];
    (profiles || []).forEach(function(profile){
      var placed = false;
      for (var i = 0; i < rows.length; i += 1) {
        if (rows[i].items.every(function(item){ return !flashcardProfilesCollide(item, profile); })) {
          rows[i].items.push(profile);
          rows[i].hasZoomItem = rows[i].hasZoomItem || profile.visibleInZoom;
          placed = true;
          break;
        }
      }
      if (!placed) rows.push({ items: [profile], hasZoomItem: !!profile.visibleInZoom });
    });
    return rows;
  }

  function flashcardMarkerDateClass(item) {
    return item && item.startYear === item.endYear ? ' is-single-year' : ' is-range';
  }

  function flashcardAxisStep(min, max) {
    var span = Math.max(1, Math.abs(timelineYear(max, 1) - timelineYear(min, 0)));
    if (span <= 40) return 5;
    if (span <= 90) return 10;
    if (span <= 150) return 20;
    return 40;
  }

  function buildFlashcardAxisTicks(min, max) {
    min = timelineYear(min, -40);
    max = timelineYear(max, 130);
    if (max < min) {
      var swap = max;
      max = min;
      min = swap;
    }
    var step = flashcardAxisStep(min, max);
    var firstYear = 1 + Math.ceil((min - 1) / step) * step;
    var ticks = [];
    for (var year = firstYear; year <= max + .0001; year += step) {
      var tickYear = Math.round(year);
      if (tickYear === 0) continue;
      ticks.push({
        percent: eventPercent(tickYear, min, max),
        year: tickYear,
        isAnchor: tickYear === 1
      });
    }
    if (!ticks.length) {
      var fallbackYear = min <= 1 && max >= 1 ? 1 : Math.round(min);
      if (fallbackYear === 0) fallbackYear = 1;
      ticks.push({
        percent: eventPercent(fallbackYear, min, max),
        year: fallbackYear,
        isAnchor: fallbackYear === 1
      });
    }
    return ticks;
  }

  function renderFlashcardAxisLabels(fitMin, fitMax, zoomMin, zoomMax) {
    function row(className, min, max) {
      var ticks = buildFlashcardAxisTicks(min, max);
      return '<div class="fc-timeline-axis-grid ' + className + '" aria-hidden="true">'
        + ticks.map(function(tick){
          return '<i class="' + (tick.isAnchor ? 'is-anchor' : '') + '" style="left:' + tick.percent.toFixed(4) + '%"></i>';
        }).join('')
        + '</div><div class="fc-timeline-axis-labels ' + className + '" aria-hidden="true">'
        + ticks.map(function(tick){
          var edge = tick.percent <= 8 ? ' is-start' : (tick.percent >= 92 ? ' is-end' : '');
          if (tick.isAnchor) edge += ' is-anchor';
          return '<span class="' + edge + '" style="left:' + tick.percent.toFixed(4) + '%">' + html(formatYear(tick.year)) + '</span>';
        }).join('')
        + '</div>';
    }
    return row('is-fit', fitMin, fitMax) + row('is-zoom', zoomMin, zoomMax);
  }

  function allTimelineConfigs(sidecar) {
    var raw = sidecar && sidecar.timelineLearning && sidecar.timelineLearning.timelines;
    if (!raw || typeof raw !== 'object') return [];
    return Object.keys(raw).map(function(id){
      var item = raw[id] || {};
      return Object.assign({}, item, { id: clean(item.id) || id });
    });
  }

  function timelineHealthIssue(severity, code, message, detail, uid, label) {
    return {
      severity: severity || 'warning',
      code: code || 'timeline_issue',
      message: message || '',
      detail: detail || '',
      uid: uid || '',
      label: label || ''
    };
  }

  function timelineHealthSourceKind(sidecar) {
    var bundled = Array.isArray(window.STUDYDECK_TIMELINE_SIDECARS) && window.STUDYDECK_TIMELINE_SIDECARS.indexOf(sidecar) !== -1;
    var active = typeof guidedSidecarStore !== 'undefined'
      && guidedSidecarStore
      && Array.isArray(guidedSidecarStore.sidecars)
      && guidedSidecarStore.sidecars.indexOf(sidecar) !== -1;
    if (bundled && active) return 'Bundled pilot and active browser copy';
    if (active) return 'Active browser sidecar';
    if (bundled) return 'Bundled pilot sidecar';
    return 'Timeline sidecar';
  }

  function timelineNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function timelineDateNeedsReview(timeline) {
    var text = [
      timeline && timeline.dateType,
      timeline && timeline.confidence,
      timeline && timeline.displayDate,
      timeline && timeline.shortNote
    ].map(clean).join(' ');
    return /debated|uncertain|approximate|authorship|traditional|tentative|possible|probably|likely/i.test(text);
  }

  function timelineCardUidForEntry(key, entry) {
    return clean(entry && (entry.cardUid || entry.uid || entry.id) || key);
  }

  function timelineLaneLabel(laneMap, laneId) {
    var lane = laneMap[clean(laneId)];
    return clean(lane && (lane.label || lane.id)) || clean(laneId) || 'No lane';
  }

  function validateTimelineDateRecord(record, context, issues, timelineIds, laneMap) {
    record = record || {};
    context = context || {};
    var label = clean(record.label) || context.label || context.uid || 'Timeline event';
    var start = timelineNumber(record.startYear);
    var end = timelineNumber(record.endYear);
    var sort = record.sortYear == null || record.sortYear === '' ? null : timelineNumber(record.sortYear);
    var lane = clean(record.lane);
    if (start == null) {
      issues.push(timelineHealthIssue('error', 'missing_start_year', 'Missing start year.', 'This item cannot be placed on the timeline until it has a starting year.', context.uid, label));
    }
    if (record.endYear == null || record.endYear === '') {
      issues.push(timelineHealthIssue('warning', 'missing_end_year', 'Missing end year.', 'Single-year items should repeat the same year so the app knows it is a dot instead of a range.', context.uid, label));
    }
    if (record.endYear != null && record.endYear !== '' && end == null) {
      issues.push(timelineHealthIssue('error', 'bad_end_year', 'End year is not a usable number.', 'The app needs a number here, such as 70 or -4.', context.uid, label));
    }
    if (start != null && end != null && start > end) {
      issues.push(timelineHealthIssue('error', 'backwards_date_range', 'Date range is backwards.', 'The start year is later than the end year.', context.uid, label));
    }
    if (record.sortYear != null && record.sortYear !== '' && sort == null) {
      issues.push(timelineHealthIssue('warning', 'bad_sort_year', 'Sort year is not a usable number.', 'The item can still display, but ordering may feel strange.', context.uid, label));
    }
    if (!clean(record.displayDate)) {
      issues.push(timelineHealthIssue('warning', 'missing_display_date', 'Missing display date label.', 'The timeline should show a readable label like 66-73 CE.', context.uid, label));
    }
    if (!clean(record.label)) {
      issues.push(timelineHealthIssue('warning', 'missing_event_label', 'Missing timeline label.', 'The app can fall back to the card title, but the sidecar should name the event clearly.', context.uid, label));
    }
    if (context.requireEventId && !clean(record.eventId)) {
      issues.push(timelineHealthIssue('warning', 'missing_event_id', 'Missing event ID.', 'The app can make a backup ID, but a stable ID makes review safer.', context.uid, label));
    }
    if (context.requireTimelineId) {
      var timelineId = clean(record.timelineId);
      if (!timelineId) {
        issues.push(timelineHealthIssue('warning', 'missing_timeline_id', 'Missing timeline ID.', 'This item should say which timeline it belongs to.', context.uid, label));
      } else if (Object.keys(timelineIds).length && !timelineIds[timelineId]) {
        issues.push(timelineHealthIssue('error', 'unknown_timeline_id', 'Timeline ID does not exist.', 'The item points to "' + timelineId + '", but that timeline is not defined.', context.uid, label));
      }
    }
    if (!lane) {
      issues.push(timelineHealthIssue('error', 'missing_lane', 'Missing timeline lane.', 'Without a lane, the item may not appear in the graphic timeline.', context.uid, label));
    } else if (Object.keys(laneMap).length && !laneMap[lane]) {
      issues.push(timelineHealthIssue('error', 'unknown_lane', 'Timeline lane does not exist.', 'The item points to "' + lane + '", but that lane is not defined.', context.uid, label));
    }
  }

  function buildTimelineSidecarHealth(sidecar, index) {
    var configs = allTimelineConfigs(sidecar);
    var timelineIds = {};
    var laneMap = {};
    var contextEvents = [];
    configs.forEach(function(config){
      if (config.id) timelineIds[config.id] = true;
      (Array.isArray(config.lanes) ? config.lanes : []).forEach(function(lane){
        var id = clean(lane && lane.id);
        if (id) laneMap[id] = lane;
      });
      (Array.isArray(config.contextEvents) ? config.contextEvents : []).forEach(function(event){
        contextEvents.push(event || {});
      });
    });
    var cards = sidecarCards(sidecar);
    var entries = Object.keys(cards).map(function(key){
      return { key: key, entry: cards[key] || {} };
    });
    var deck = findDeckForSidecar(sidecar || {});
    var deckCards = deck && Array.isArray(deck.cards) ? deck.cards : [];
    var deckUidLookup = {};
    deckCards.forEach(function(card){
      var uid = clean(card && card.uid);
      if (uid) deckUidLookup[uid] = card;
    });

    var issues = [];
    var reviewItems = [];
    var missingDeckMatches = [];
    var missingUidEntries = [];
    var timelineUidLookup = {};
    var duplicateEventIds = {};
    var seenEventIds = {};
    var laneCounts = {};
    var timelineEvents = 0;

    entries.forEach(function(item){
      var entry = item.entry || {};
      var uid = timelineCardUidForEntry(item.key, entry);
      var timeline = entry.timeline;
      if (!timeline || typeof timeline !== 'object') {
        return;
      }
      timelineEvents += 1;
      if (!uid || /^[0-9]+$/.test(uid)) {
        missingUidEntries.push({ uid: uid, label: clean(entry.titleHint || timeline.label || item.key) });
        issues.push(timelineHealthIssue('error', 'missing_card_uid', 'Missing card ID.', 'This timeline item cannot reliably connect to a flashcard.', uid, clean(entry.titleHint || timeline.label || item.key)));
      } else {
        timelineUidLookup[uid] = true;
      }
      var eventId = clean(timeline.eventId);
      if (eventId) {
        if (seenEventIds[eventId]) duplicateEventIds[eventId] = true;
        seenEventIds[eventId] = true;
      }
      var lane = clean(timeline.lane);
      laneCounts[lane || ''] = (laneCounts[lane || ''] || 0) + 1;
      validateTimelineDateRecord(timeline, {
        uid: uid,
        label: clean(entry.titleHint || timeline.label || uid),
        requireEventId: true,
        requireTimelineId: true
      }, issues, timelineIds, laneMap);
      if (timelineDateNeedsReview(timeline)) {
        reviewItems.push({
          uid: uid,
          label: clean(timeline.label || entry.titleHint || uid),
          detail: [clean(timeline.displayDate), clean(timeline.confidence), clean(timeline.dateType).replace(/_/g, ' ')].filter(Boolean).join(' · ')
        });
      }
      if (deck && uid && !deckUidLookup[uid]) {
        missingDeckMatches.push({ uid: uid, label: clean(timeline.label || entry.titleHint || uid) });
      }
    });

    Object.keys(duplicateEventIds).forEach(function(eventId){
      issues.push(timelineHealthIssue('warning', 'duplicate_event_id', 'Duplicate event ID.', 'More than one timeline item uses "' + eventId + '".', '', eventId));
    });

    contextEvents.forEach(function(event){
      validateTimelineDateRecord(event, {
        uid: '',
        label: clean(event && event.label) || clean(event && event.id) || timelineContextLabel(),
        requireEventId: false,
        requireTimelineId: false
      }, issues, timelineIds, laneMap);
      if (timelineDateNeedsReview(event)) {
        reviewItems.push({
          uid: '',
          label: clean(event.label || event.id || timelineContextLabel()),
          detail: [clean(event.displayDate), clean(event.confidence), clean(event.dateType).replace(/_/g, ' ')].filter(Boolean).join(' · ')
        });
      }
    });

    var deckCardsMissingTimeline = [];
    if (deck) {
      deckCards.forEach(function(card){
        var uid = clean(card && card.uid);
        if (uid && !timelineUidLookup[uid]) {
          deckCardsMissingTimeline.push({ uid: uid, label: clean(card && (card.a || card.q || card.id)) });
        }
      });
    }

    var errorCount = issues.filter(function(issue){ return issue.severity === 'error'; }).length;
    var warningCount = issues.filter(function(issue){ return issue.severity !== 'error'; }).length;
    var status = 'ok';
    if (errorCount || missingDeckMatches.length) status = 'error';
    else if (!deck || warningCount || reviewItems.length || deckCardsMissingTimeline.length || (sidecar && sidecar.sidecarType === 'studydeck-timeline' && entries.length > timelineEvents)) status = 'warning';
    var timeline = configs[0] || {};
    return {
      index: index,
      sidecar: sidecar,
      sourceKind: timelineHealthSourceKind(sidecar),
      title: clean(sidecar && (sidecar.title || sidecar.name || sidecar.deckName)) || ('Timeline sidecar ' + (index + 1)),
      description: clean(sidecar && sidecar.description) || clean(timeline.description),
      timelineTitle: clean(timeline.title || sidecar && sidecar.title),
      matchedDeck: deck,
      status: status,
      issues: issues,
      reviewItems: reviewItems,
      missingDeckMatches: missingDeckMatches,
      missingUidEntries: missingUidEntries,
      deckCardsMissingTimeline: deckCardsMissingTimeline,
      laneCounts: laneCounts,
      laneMap: laneMap,
      totals: {
        sidecarCards: entries.length,
        timelineEvents: timelineEvents,
        sidecarCardsWithoutTimeline: Math.max(0, entries.length - timelineEvents),
        matchedTimelineCards: deck ? Math.max(0, timelineEvents - missingDeckMatches.length - missingUidEntries.length) : 0,
        missingDeckMatches: missingDeckMatches.length,
        deckCards: deckCards.length,
        deckCardsMissingTimeline: deckCardsMissingTimeline.length,
        contextEvents: contextEvents.length,
        timelines: configs.length,
        lanes: Object.keys(laneMap).length,
        errors: errorCount,
        warnings: warningCount,
        reviewItems: reviewItems.length
      }
    };
  }

  function buildTimelineHealthReport() {
    var reports = timelineSidecars().map(buildTimelineSidecarHealth);
    var totals = reports.reduce(function(out, item){
      var t = item.totals || {};
      out.sidecars += 1;
      out.timelineEvents += t.timelineEvents || 0;
      out.matchedTimelineCards += t.matchedTimelineCards || 0;
      out.missingDeckMatches += t.missingDeckMatches || 0;
      out.deckCardsMissingTimeline += t.deckCardsMissingTimeline || 0;
      out.deckComparisons += item.matchedDeck ? 1 : 0;
      out.contextEvents += t.contextEvents || 0;
      out.errors += t.errors || 0;
      out.warnings += t.warnings || 0;
      out.reviewItems += t.reviewItems || 0;
      return out;
    }, { sidecars: 0, timelineEvents: 0, matchedTimelineCards: 0, missingDeckMatches: 0, deckCardsMissingTimeline: 0, deckComparisons: 0, contextEvents: 0, errors: 0, warnings: 0, reviewItems: 0 });
    var status = 'ok';
    if (!reports.length || totals.errors || totals.missingDeckMatches) status = 'error';
    else if (reports.some(function(item){ return item.status === 'warning'; }) || totals.reviewItems || totals.deckCardsMissingTimeline) status = 'warning';
    return { status: status, sidecars: reports, totals: totals };
  }

  function timelineHealthStatusLabel(status) {
    if (status === 'ok') return 'Looks healthy';
    if (status === 'warning') return 'Needs review';
    return 'Needs fixes';
  }

  function renderTimelineHealthMetric(label, value, detail, className) {
    return '<div class="guided-summary-stat timeline-health-stat' + (className ? ' ' + html(className) : '') + '">'
      + '<div class="guided-stat-label">' + html(label) + '</div>'
      + '<div class="guided-stat-value">' + html(value) + '</div>'
      + (detail ? '<div class="timeline-health-stat-detail">' + html(detail) + '</div>' : '')
      + '</div>';
  }

  function renderTimelineHealthList(items, emptyText, limit) {
    items = Array.isArray(items) ? items : [];
    if (!items.length) return '<div class="guided-author-good">' + html(emptyText || 'No issues found.') + '</div>';
    limit = limit || 8;
    return '<div class="guided-author-warning-list">'
      + items.slice(0, limit).map(function(item){
        var severity = item.severity || 'warning';
        var title = [item.code, item.uid, item.label].filter(Boolean).join(' · ');
        var detail = item.message || item.detail || '';
        if (item.message && item.detail) detail = item.message + ' ' + item.detail;
        return '<div class="guided-author-warning is-' + html(severity) + '">'
          + '<strong>' + html(title || 'Timeline item') + '</strong>'
          + '<span>' + html(detail) + '</span>'
          + '</div>';
      }).join('')
      + (items.length > limit ? '<div class="guided-author-warning-more">+' + html(items.length - limit) + ' more</div>' : '')
      + '</div>';
  }

  function renderTimelineCoverageList(items, emptyText, limit) {
    items = Array.isArray(items) ? items : [];
    if (!items.length) return '<div class="guided-author-good">' + html(emptyText || 'No coverage gaps found.') + '</div>';
    limit = limit || 10;
    return '<div class="timeline-health-coverage-list">'
      + items.slice(0, limit).map(function(item){
        return '<span><strong>' + html(item.uid || 'No ID') + '</strong>' + (item.label ? ' · ' + html(item.label) : '') + '</span>';
      }).join('')
      + (items.length > limit ? '<em>+' + html(items.length - limit) + ' more</em>' : '')
      + '</div>';
  }

  function renderTimelineLaneMix(report) {
    var counts = report.laneCounts || {};
    var laneMap = report.laneMap || {};
    var keys = Object.keys(counts).sort(function(a, b){ return (counts[b] || 0) - (counts[a] || 0); });
    if (!keys.length) return '<div class="guided-author-good">No lane problems found.</div>';
    return '<div class="timeline-health-lane-list">'
      + keys.map(function(key){
        return '<span><i style="--lane-color:' + html(laneColor(laneMap[key])) + '"></i><b>' + html(timelineLaneLabel(laneMap, key)) + '</b><em>' + html(counts[key]) + '</em></span>';
      }).join('')
      + '</div>';
  }

  function renderTimelineHealthDetails(title, body) {
    if (typeof guidedAuthorDetails === 'function') return guidedAuthorDetails(title, '', body, false);
    return '<details class="guided-author-details"><summary><span><strong>' + html(title) + '</strong></span><b>Open</b></summary><div class="guided-author-details-body">' + body + '</div></details>';
  }

  function renderTimelineSidecarHealthCard(report) {
    var totals = report.totals || {};
    var deckLine = report.matchedDeck
      ? 'Matched deck: ' + report.matchedDeck.name + '. Cards outside the pilot sidecar will not show a timeline panel yet.'
      : 'Deck not loaded or not matched. Date fields can be checked, but card coverage cannot be confirmed yet.';
    var reviewRows = report.reviewItems.map(function(item){
      return timelineHealthIssue('warning', 'date_review', 'Approximate or debated date.', item.detail, item.uid, item.label);
    });
    var missingRows = report.missingDeckMatches.map(function(item){
      return timelineHealthIssue('error', 'card_not_found', 'Timeline item cannot find its flashcard.', 'This card ID is in the sidecar, but not in the loaded deck.', item.uid, item.label);
    });
    return '<section class="guided-card timeline-health-card is-' + html(report.status) + '">'
      + '<div class="timeline-health-card-head">'
      +   '<div><div class="guided-section-kicker">' + html(report.sourceKind) + '</div><div class="guided-card-title">' + html(report.title) + '</div><div class="guided-card-sub">' + html(deckLine) + '</div></div>'
      +   '<b class="timeline-health-status is-' + html(report.status) + '">' + html(timelineHealthStatusLabel(report.status)) + '</b>'
      + '</div>'
      + '<div class="guided-progress-row">'
      +   '<span class="guided-progress-pill">' + html(totals.timelineEvents + ' timeline cards') + '</span>'
      +   '<span class="guided-progress-pill">' + html(totals.contextEvents + ' context items') + '</span>'
      +   '<span class="guided-progress-pill">' + html(totals.lanes + ' lanes') + '</span>'
      +   '<span class="guided-progress-pill' + (totals.errors ? ' is-warning' : '') + '">' + html(totals.errors + ' date/data errors') + '</span>'
      +   '<span class="guided-progress-pill' + (totals.reviewItems ? ' is-warning' : '') + '">' + html(totals.reviewItems + ' review notes') + '</span>'
      + '</div>'
      + '<div class="guided-summary-grid timeline-health-summary">'
      +   renderTimelineHealthMetric('Timeline cards', totals.timelineEvents, totals.sidecarCardsWithoutTimeline ? totals.sidecarCardsWithoutTimeline + ' sidecar cards have no timeline item' : 'Every sidecar card has a timeline item')
      +   renderTimelineHealthMetric('Matched cards', report.matchedDeck ? (totals.matchedTimelineCards + '/' + totals.timelineEvents) : 'Not checked', report.matchedDeck ? 'Timeline card IDs found in the deck' : 'Load the matching deck to compare IDs', totals.missingDeckMatches ? 'is-warning' : '')
      +   renderTimelineHealthMetric('Deck still missing', report.matchedDeck ? totals.deckCardsMissingTimeline : 'Not checked', report.matchedDeck ? 'Deck cards without timeline panels yet' : 'No deck comparison available', totals.deckCardsMissingTimeline ? 'is-warning' : '')
      +   renderTimelineHealthMetric('Date problems', totals.errors + totals.warnings, totals.errors + ' errors · ' + totals.warnings + ' warnings', totals.errors ? 'is-warning' : '')
      + '</div>'
      + renderTimelineHealthDetails('Date and ID problems', renderTimelineHealthList(report.issues.concat(missingRows), 'No broken dates or missing card IDs found.', 10))
      + renderTimelineHealthDetails('Approximate dates to review', renderTimelineHealthList(reviewRows, 'No approximate or debated dates are flagged for review.', 10))
      + renderTimelineHealthDetails('Cards without timeline panels yet', renderTimelineCoverageList(report.deckCardsMissingTimeline, 'Every loaded deck card has timeline data.', 12))
      + renderTimelineHealthDetails('Lane mix', renderTimelineLaneMix(report))
      + '</section>';
  }

  function timelineCoveragePercent(covered, total) {
    covered = Number(covered) || 0;
    total = Number(total) || 0;
    if (!total) return 'Not checked';
    return Math.round((covered / total) * 100) + '% covered';
  }

  function timelineCardLabelForUid(uid, report) {
    uid = clean(uid);
    if (!uid) return '';
    var deck = report && report.matchedDeck;
    var cards = deck && Array.isArray(deck.cards) ? deck.cards : [];
    for (var i = 0; i < cards.length; i += 1) {
      if (clean(cards[i] && cards[i].uid) === uid) return clean(cards[i].a || cards[i].q || uid);
    }
    return uid;
  }

  function timelineCoverageNextItems(report) {
    report = report || {};
    var sidecar = report.sidecar || {};
    var sidecarCardLookup = sidecarCards(sidecar);
    var recommended = sidecar.authoringReview && Array.isArray(sidecar.authoringReview.recommendedNextCards)
      ? sidecar.authoringReview.recommendedNextCards
      : [];
    var next = recommended.filter(function(uid){
      return clean(uid) && !sidecarCardLookup[clean(uid)];
    }).slice(0, 6).map(function(uid){
      return { uid: clean(uid), label: timelineCardLabelForUid(uid, report) };
    });
    if (next.length) return next;
    return (report.deckCardsMissingTimeline || []).slice(0, 6);
  }

  function renderTimelineCoverageHealthCheck() {
    if (typeof authorMode === 'undefined' || !authorMode) return '';
    var health = buildTimelineHealthReport();
    var report = health.sidecars && health.sidecars[0];
    if (!report) return '';
    var totals = report.totals || {};
    var covered = totals.matchedTimelineCards || totals.timelineEvents || 0;
    var deckTotal = report.matchedDeck ? totals.deckCards : 0;
    var missing = report.matchedDeck ? totals.deckCardsMissingTimeline : 0;
    var nextItems = timelineCoverageNextItems(report);
    var statusText = totals.errors || totals.missingDeckMatches
      ? 'Needs fixes'
      : (missing ? 'Pilot coverage' : 'Looks complete');
    var summaryLine = report.matchedDeck
      ? covered + ' of ' + deckTotal + ' cards have timeline panels.'
      : 'Load the matching deck to check exactly which cards have timeline panels.';
    return '<section class="timeline-coverage-card is-' + html(health.status) + '" aria-label="Timeline coverage health check">'
      + '<div class="timeline-coverage-head">'
      +   '<div><div class="timeline-kicker">Coverage health check</div><h3>' + html(statusText) + '</h3><p>' + html(summaryLine) + '</p></div>'
      +   '<b class="timeline-health-status is-' + html(health.status) + '">' + html(timelineCoveragePercent(covered, deckTotal)) + '</b>'
      + '</div>'
      + '<div class="timeline-coverage-metrics">'
      +   '<span><strong>' + html(totals.timelineEvents || 0) + '</strong> timeline cards</span>'
      +   '<span class="' + (missing ? 'is-warning' : '') + '"><strong>' + html(report.matchedDeck ? missing : 'Not checked') + '</strong> still missing</span>'
      +   '<span class="' + (totals.missingDeckMatches ? 'is-warning' : '') + '"><strong>' + html(totals.missingDeckMatches || 0) + '</strong> broken card links</span>'
      +   '<span class="' + (totals.errors ? 'is-warning' : '') + '"><strong>' + html(totals.errors || 0) + '</strong> date problems</span>'
      + '</div>'
      + (nextItems.length
        ? '<details class="timeline-coverage-next"' + (timelineState.coverageNextOpen ? ' open' : '') + ' ontoggle="studyDeckTimelineSetCoverageNextOpen(this.open)"><summary><span><strong>Next suggested cards</strong><em>' + html(nextItems.length + ' shown') + '</em></span><b><i>Open</i><i>Close</i></b></summary><div>'
          + nextItems.map(function(item){
            return '<span><strong>' + html(item.uid || 'No ID') + '</strong>' + (item.label ? ' · ' + html(item.label) : '') + '</span>';
          }).join('')
          + '</div></details>'
        : '<div class="timeline-coverage-good">No next-card suggestions found in this sidecar.</div>')
      + '</section>';
  }

  function renderAuthorHealth() {
    var report = buildTimelineHealthReport();
    var totals = report.totals || {};
    var deckCoverageLabel = totals.deckComparisons
      ? totals.deckCardsMissingTimeline + ' cards not covered yet'
      : 'deck not checked';
    if (!report.sidecars.length) {
      return '<div class="timeline-health-author">'
        + '<div class="guided-card guided-hero-card timeline-health-hero">'
        + '<div class="guided-section-kicker">Timeline health</div>'
        + '<div class="guided-card-title">No timeline sidecar found.</div>'
        + '<div class="guided-card-sub">A timeline sidecar is the extra data file that gives flashcards their date bars and lets the full Timeline screen draw events.</div>'
        + '<div class="timeline-health-actions"><button type="button" class="btn btn-soft" onclick="guidedAuthorSetTab(\'sidecars\')">Open Sidecars setup</button></div>'
        + '</div>'
        + '</div>';
    }
    return '<div class="timeline-health-author">'
      + '<div class="guided-card guided-hero-card timeline-health-hero">'
      +   '<div class="timeline-health-card-head">'
      +     '<div><div class="guided-section-kicker">Timeline health</div><div class="guided-card-title">' + html(timelineHealthStatusLabel(report.status)) + '</div><div class="guided-card-sub">Checks the timeline sidecar for usable dates, working flashcard links, lane names, and coverage gaps.</div></div>'
      +     '<b class="timeline-health-status is-' + html(report.status) + '">' + html(totals.sidecars + ' sidecar' + (totals.sidecars === 1 ? '' : 's')) + '</b>'
      +   '</div>'
      +   '<div class="guided-progress-row">'
      +     '<span class="guided-progress-pill">' + html(totals.timelineEvents + ' timeline cards') + '</span>'
      +     '<span class="guided-progress-pill">' + html(totals.contextEvents + ' context items') + '</span>'
      +     '<span class="guided-progress-pill' + (totals.missingDeckMatches ? ' is-warning' : '') + '">' + html(totals.missingDeckMatches + ' broken card links') + '</span>'
      +     '<span class="guided-progress-pill' + (!totals.deckComparisons || totals.deckCardsMissingTimeline ? ' is-warning' : '') + '">' + html(deckCoverageLabel) + '</span>'
      +     '<span class="guided-progress-pill' + (totals.reviewItems ? ' is-warning' : '') + '">' + html(totals.reviewItems + ' date review notes') + '</span>'
      +   '</div>'
      +   '<div class="timeline-health-actions"><button type="button" class="btn btn-gold" onclick="showTimelineViewer()">Open full timeline</button><button type="button" class="btn btn-soft" onclick="guidedAuthorSetTab(\'sidecars\')">Open Sidecars setup</button></div>'
      + '</div>'
      + report.sidecars.map(renderTimelineSidecarHealthCard).join('')
      + '</div>';
  }

  function renderTimelineZoomButton(label, value) {
    var active = Math.abs(timelineZoomValue() - value) < .01;
    return '<button type="button" class="timeline-zoom-btn' + (active ? ' is-active' : '') + '" aria-label="Timeline zoom ' + html(label) + '" aria-pressed="' + (active ? 'true' : 'false') + '" onclick="studyDeckTimelineSetZoom(' + html(value) + ')">' + html(label) + '</button>';
  }

  function renderTimelineToolbar() {
    return '<section class="timeline-toolbar-card" aria-label="Timeline display controls">'
      + '<div><span>Zoom</span><strong>' + html(Math.round(timelineZoomValue() * 100)) + '%</strong></div>'
      + '<div class="timeline-zoom-controls">'
      + renderTimelineZoomButton('1x', 1)
      + renderTimelineZoomButton('2x', 2)
      + renderTimelineZoomButton('4x', 4)
      + '</div>'
      + '</section>';
  }

  function timelineFilterCountForLane(events, laneId) {
    laneId = clean(laneId);
    return (events || []).filter(function(event){
      return clean(event && event.laneId) === laneId;
    }).length;
  }

  function timelineTypeFilterCount(events, type) {
    type = clean(type).toLowerCase();
    return (events || []).filter(function(event){
      if (type === 'cards') return !event.isContext;
      if (type === 'context') return !!event.isContext;
      return true;
    }).length;
  }

  function renderTimelineTypeFilterButton(label, value, events) {
    var active = activeTimelineTypeFilter() === value;
    return '<button type="button" class="timeline-filter-type-btn' + (active ? ' is-active' : '') + '"'
      + ' aria-pressed="' + (active ? 'true' : 'false') + '"'
      + ' onclick="studyDeckTimelineSetTypeFilter(\'' + jsString(value) + '\')">'
      + '<span>' + html(label) + '</span><b>' + html(timelineTypeFilterCount(events, value)) + '</b>'
      + '</button>';
  }

  function timelineActiveFilterCount() {
    return activeTimelineCategoryFilters().length
      + (timelineHasSearchFilter() ? 1 : 0)
      + (timelineHasTypeFilter() ? 1 : 0)
      + (timelineHasDateWindowFilter() ? 1 : 0);
  }

  function compactTimelineSummaryValue(value, maxLength) {
    value = clean(value);
    maxLength = Math.max(8, Number(maxLength) || 24);
    if (value.length <= maxLength) return value;
    return value.slice(0, Math.max(1, maxLength - 3)).trim() + '...';
  }

  function timelineFilterSummaryLabel() {
    if (!timelineHasAnyFilter()) return 'All items';
    var bits = [];
    var categoryFilters = activeTimelineCategoryFilters();
    if (timelineHasSearchFilter()) bits.push('Search: ' + compactTimelineSummaryValue(timelineSearchQuery(), 18));
    if (timelineHasDateWindowFilter()) bits.push(compactTimelineSummaryValue(timelineDateWindowLabel(), 24));
    if (categoryFilters.length === 1) {
      var lane = laneById(timelineState.lanes || [], categoryFilters[0]);
      bits.push(compactTimelineSummaryValue(clean(lane && lane.label) || categoryFilters[0], 28));
    } else if (categoryFilters.length > 1) {
      bits.push(categoryFilters.length + ' categories');
    }
    var type = activeTimelineTypeFilter();
    if (type === 'cards') bits.push('Study cards');
    else if (type === 'context') bits.push('Context only');
    if (!bits.length) return timelineActiveFilterCount() + ' active';
    var summary = bits.join(' · ');
    if (summary.length <= 34 || bits.length === 1) return summary;
    if (bits.length === 2 && bits[0].length + bits[1].length <= 32) return summary;
    return bits[0] + ' +' + (bits.length - 1);
  }

  function timelineFilterMatchCount(events) {
    return (events || []).filter(timelineEventMatchesFilters).length;
  }

  function timelineFilterResultLabel(events) {
    var total = (events || []).length;
    var count = timelineFilterMatchCount(events);
    if (!timelineHasAnyFilter()) return total + ' total';
    return count + (timelineHideFilteredItems() ? ' shown' : ' matched');
  }

  function renderTimelineCategoryFilterButton(lane, events) {
    var laneId = clean(lane && lane.id);
    if (!laneId) return '';
    var active = activeTimelineCategoryFilters().indexOf(laneId) !== -1;
    var count = timelineFilterCountForLane(events, laneId);
    var label = clean(lane && lane.label) || laneId;
    return '<button type="button" class="timeline-filter-btn' + (active ? ' is-active' : '') + '"'
      + ' style="--lane-color:' + html(laneColor(lane)) + '"'
      + ' aria-pressed="' + (active ? 'true' : 'false') + '"'
      + ' onclick="studyDeckTimelineToggleCategoryFilter(\'' + jsString(laneId) + '\')">'
      + '<i aria-hidden="true"></i><span>' + html(label) + '</span><b>' + html(count) + '</b>'
      + '</button>';
  }

  function renderTimelineDateEraSwitch(field, activeEra) {
    activeEra = timelineEra(activeEra);
    return '<div class="timeline-filter-era-switch" role="group" aria-label="' + html(field === 'from' ? 'From era' : 'To era') + '">'
      + '<button type="button" class="' + (activeEra === 'BCE' ? 'is-active' : '') + '" aria-pressed="' + (activeEra === 'BCE' ? 'true' : 'false') + '" onclick="studyDeckTimelineSetDateEra(this,\'' + html(field) + '\',\'BCE\')">BCE</button>'
      + '<button type="button" class="' + (activeEra === 'CE' ? 'is-active' : '') + '" aria-pressed="' + (activeEra === 'CE' ? 'true' : 'false') + '" onclick="studyDeckTimelineSetDateEra(this,\'' + html(field) + '\',\'CE\')">CE</button>'
      + '</div>';
  }

  function renderTimelineDateField(field, label, year, era) {
    var inputId = 'timeline-date-' + field;
    var eraId = 'timeline-date-' + field + '-era';
    return '<label class="timeline-filter-date-field"><span>' + html(label) + '</span><div>'
      + '<input id="' + html(inputId) + '" type="number" inputmode="numeric" min="1" step="1" pattern="[0-9]*" value="' + html(year) + '" placeholder="Year" oninput="studyDeckTimelineRefreshDateApply()">'
      + '<input id="' + html(eraId) + '" type="hidden" value="' + html(timelineEra(era)) + '">'
      + renderTimelineDateEraSwitch(field, era)
      + '</div></label>';
  }

  function renderTimelineDateWindowControls() {
    var dateWindow = timelineDateWindow();
    var active = timelineHasDateWindowFilter();
    return '<div class="timeline-filter-date-window' + (active ? ' is-active' : '') + '">'
      + '<div class="timeline-filter-date-head"><div><span>Date window</span><strong>' + html(active ? timelineDateWindowLabel() : 'Exact year range') + '</strong></div><button id="timeline-date-apply" type="button" class="timeline-filter-date-apply" ' + (active ? '' : 'disabled aria-disabled="true" ') + 'onclick="studyDeckTimelineApplyDateWindow()">Apply</button></div>'
      + '<div class="timeline-filter-date-grid">'
      + renderTimelineDateField('from', 'From', dateWindow.fromYear, dateWindow.fromEra)
      + renderTimelineDateField('to', 'To', dateWindow.toYear, dateWindow.toEra)
      + '</div>'
      + '</div>';
  }

  function renderTimelineCategoryFilters(lanes, events) {
    if (!lanes || !lanes.length) return '';
    var hasFilter = timelineHasAnyFilter();
    var activeCount = timelineActiveFilterCount();
    var hiding = timelineHideFilteredItems();
    var resultLabel = timelineFilterResultLabel(events);
    return '<details class="timeline-filter-card' + (hasFilter ? ' is-filtering' : '') + (hiding ? ' is-hiding' : '') + '"' + (timelineState.filterPanelOpen ? ' open' : '') + ' ontoggle="studyDeckTimelineSetFilterPanelOpen(this.open)" aria-label="Timeline filters">'
      + '<summary class="timeline-filter-summary"><span>Filters</span><strong>' + html(timelineFilterSummaryLabel()) + '</strong><em>' + html(resultLabel) + '</em></summary>'
      + '<div class="timeline-filter-body">'
      + '<div class="timeline-filter-head"><div><span>Filter timeline</span><strong>' + html(hasFilter ? activeCount + ' active · ' + resultLabel : resultLabel) + '</strong></div>'
      + '<div class="timeline-filter-actions">'
      + '<button type="button" class="timeline-filter-hide' + (hiding ? ' is-active' : '') + '" aria-pressed="' + (hiding ? 'true' : 'false') + '" ' + (hasFilter ? '' : 'disabled aria-disabled="true" ') + 'onclick="studyDeckTimelineToggleHideFilteredItems()">Hide</button>'
      + '<button type="button" class="timeline-filter-clear" ' + (hasFilter ? '' : 'disabled aria-disabled="true" ') + 'onclick="studyDeckTimelineClearFilters()">Clear</button>'
      + '</div></div>'
      + '<label class="timeline-filter-search"><span>Search</span><input id="timeline-filter-search" type="search" autocomplete="off" value="' + html(timelineSearchQuery()) + '" placeholder="Find Papias, Paul, Temple..." oninput="studyDeckTimelineSetSearchQuery(this.value, this.selectionStart)"></label>'
      + '<div class="timeline-filter-type" role="group" aria-label="Timeline item type">'
      + renderTimelineTypeFilterButton('All', 'all', events)
      + renderTimelineTypeFilterButton('Study cards', 'cards', events)
      + renderTimelineTypeFilterButton('Context only', 'context', events)
      + '</div>'
      + renderTimelineDateWindowControls()
      + '<div class="timeline-filter-section-label">Categories</div>'
      + '<div class="timeline-filter-buttons">'
      + lanes.map(function(lane){ return renderTimelineCategoryFilterButton(lane, events); }).join('')
      + '</div>'
      + '</div>'
      + '</details>';
  }

  function timelineIndexPeriod(event) {
    var year = timelineYear(event && event.sortYear, timelineYear(event && event.startYear, 0));
    if (year < 1) return { key: 'before_1_ce', label: 'Before 1 CE', order: -1 };
    if (year < 50) return { key: '1_49_ce', label: '1-49 CE', order: 1 };
    if (year < 100) {
      var decade = Math.floor(year / 10) * 10;
      return { key: decade + 's_ce', label: decade + 's CE', order: decade };
    }
    var start = Math.floor(year / 25) * 25;
    return { key: start + '_' + (start + 24) + '_ce', label: start + '-' + (start + 24) + ' CE', order: start };
  }

  function renderTimelineIndexButton(event, lanes) {
    var lane = laneById(lanes || [], event.laneId);
    var isSelected = event.id === timelineState.selectedEventId;
    return '<button type="button" class="timeline-index-btn' + (event.isContext ? ' is-context' : '') + (isSelected ? ' is-active' : '') + timelineFilterClassForEvent(event) + '"'
      + ' style="--lane-color:' + html(laneColor(lane)) + '"'
      + ' data-timeline-index-id="' + html(event.id) + '"'
      + ' aria-pressed="' + (isSelected ? 'true' : 'false') + '"'
      + ' aria-label="' + html('Jump to ' + event.label + ', ' + event.displayDate) + '"'
      + ' onclick="studyDeckTimelineSelectEvent(\'' + jsString(event.id) + '\',\'index\')">'
      + '<b class="timeline-index-lane-dot" aria-hidden="true"></b>'
      + '<span class="timeline-index-selected-badge" aria-hidden="true">Selected</span>'
      + '<span class="timeline-index-text"><strong>' + html(timelineVisibleLabel(event)) + '</strong><em>' + html(timelineVisibleDate(event)) + '</em></span>'
      + '</button>';
  }

  function renderTimelineIndex(events, lanes) {
    events = (events || []).slice();
    if (timelineHideFilteredItems()) {
      events = events.filter(timelineEventMatchesFilters);
    }
    events = events.sort(function(a, b){
      return a.sortYear - b.sortYear || a.startYear - b.startYear || a.endYear - b.endYear || a.label.localeCompare(b.label);
    });
    if (!events.length) return '';
    var cardCount = events.filter(function(event){ return !event.isContext; }).length;
    var contextCount = events.length - cardCount;
    var groups = [];
    var groupLookup = {};
    events.forEach(function(event){
      var period = timelineIndexPeriod(event);
      if (!groupLookup[period.key]) {
        groupLookup[period.key] = { period: period, events: [] };
        groups.push(groupLookup[period.key]);
      }
      groupLookup[period.key].events.push(event);
    });
    groups.sort(function(a, b){ return a.period.order - b.period.order; });
    return '<details class="timeline-index-card"' + (timelineState.indexPanelOpen ? ' open' : '') + ' ontoggle="studyDeckTimelineSetIndexPanelOpen(this.open)" aria-label="Timeline item index">'
      + '<summary class="timeline-index-head"><div><span>Item index</span><strong>' + html(events.length) + ' items</strong></div><em>' + html(cardCount + ' cards' + (contextCount ? ' · ' + contextCount + ' context' : '')) + '</em></summary>'
      + '<div class="timeline-index-list">'
      + groups.map(function(group){
          return '<div class="timeline-index-group" role="group" aria-label="' + html(group.period.label) + '">'
            + '<div class="timeline-index-period"><b>' + html(group.period.label) + '</b><em>' + html(group.events.length + ' item' + (group.events.length === 1 ? '' : 's')) + '</em></div>'
            + '<div class="timeline-index-chips">'
            + group.events.map(function(event){ return renderTimelineIndexButton(event, lanes); }).join('')
            + '</div>'
            + '</div>';
        }).join('')
      + '</div>'
      + '</details>';
  }

  function renderStickyYearAxis(minYear, maxYear, boardWidth) {
    var trackWidth = Math.max(1, boardWidth - timelineAxisLabelWidth() - 2);
    return '<section class="timeline-sticky-axis-card" aria-label="Sticky year ruler">'
      + '<div class="timeline-axis-board">'
      + '<div class="timeline-axis-row"><div class="timeline-axis-label"><span>Year</span>'
      + '<div class="timeline-axis-zoom-controls">'
      + renderTimelineZoomButton('1x', 1)
      + renderTimelineZoomButton('2x', 2)
      + renderTimelineZoomButton('4x', 4)
      + '</div></div><div class="timeline-axis-scroll" id="timeline-axis-scroll"><div class="timeline-axis-track" style="width:' + html(trackWidth) + 'px" onpointerdown="studyDeckTimelineStartDateCursorDragAtPoint(event,\'axis\')" onclick="studyDeckTimelinePlaceDateCursor(event,\'axis\')">' + renderTicks(minYear, maxYear) + renderTimelineDateCursor(minYear, maxYear, 'axis') + '</div></div></div>'
      + '</div>'
      + '</section>';
  }

  function timelineBoardScroller() {
    return document.querySelector('.timeline-board-card .timeline-board-scroll');
  }

  function timelineIndexScroller() {
    return document.querySelector('.timeline-index-list');
  }

  function timelinePageScroller() {
    return document.getElementById('app') || document.scrollingElement || document.documentElement || document.body;
  }

  function snapshotTimelinePageScroll() {
    var scroller = timelinePageScroller();
    return {
      appTop: scroller && scroller.scrollTop || 0,
      windowTop: (typeof window !== 'undefined' && (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop)) || 0
    };
  }

  function timelineLaneRowById(laneId) {
    laneId = clean(laneId);
    if (!laneId) return null;
    var rows = document.querySelectorAll('.timeline-lane-row[data-lane-id]');
    for (var i = 0; i < rows.length; i += 1) {
      if (clean(rows[i].getAttribute('data-lane-id')) === laneId) return rows[i];
    }
    return null;
  }

  function snapshotTimelineLaneAnchor(laneId) {
    var row = timelineLaneRowById(laneId);
    if (!row || !row.getBoundingClientRect) return null;
    return {
      laneId: clean(laneId),
      top: row.getBoundingClientRect().top,
      page: snapshotTimelinePageScroll()
    };
  }

  function restoreTimelinePageScroll(snapshot) {
    if (!snapshot) return;
    function restore() {
      var scroller = timelinePageScroller();
      if (scroller) scroller.scrollTop = snapshot.appTop || 0;
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, snapshot.windowTop || 0);
    }
    restore();
    setTimeout(restore, 0);
    setTimeout(restore, 40);
  }

  function restoreTimelineLaneAnchor(snapshot) {
    if (!snapshot) return;
    function restore() {
      var row = timelineLaneRowById(snapshot.laneId);
      var scroller = timelinePageScroller();
      if (!row || !row.getBoundingClientRect || !scroller) {
        restoreTimelinePageScroll(snapshot.page);
        return;
      }
      var delta = row.getBoundingClientRect().top - snapshot.top;
      if (Math.abs(delta) > 1) scroller.scrollTop = Math.max(0, (scroller.scrollTop || 0) + delta);
    }
    restore();
    setTimeout(restore, 0);
    setTimeout(restore, 40);
  }


  function snapshotFlashcardTimelineScroll(panel) {
    var face = panel && panel.closest ? panel.closest('.card-face') : null;
    var nearby = panel && panel.querySelector ? panel.querySelector('.fc-timeline-nearby-lanes') : null;
    return {
      panel: panel || null,
      face: face || null,
      faceTop: face && face.scrollTop || 0,
      app: timelinePageScroller(),
      appTop: timelinePageScroller() && timelinePageScroller().scrollTop || 0,
      nearby: nearby || null,
      nearbyTop: nearby && nearby.scrollTop || 0
    };
  }

  function restoreFlashcardTimelineScroll(snapshot) {
    if (!snapshot) return;
    function restore() {
      if (snapshot.face) snapshot.face.scrollTop = snapshot.faceTop || 0;
      if (snapshot.app) snapshot.app.scrollTop = snapshot.appTop || 0;
      if (snapshot.nearby) snapshot.nearby.scrollTop = snapshot.nearbyTop || 0;
    }
    restore();
    setTimeout(restore, 0);
    setTimeout(restore, 40);
  }

  function scrollFlashcardNearbyRowIntoPanel(row) {
    var scroller = row && row.closest ? row.closest('.fc-timeline-nearby-lanes') : null;
    if (!row || !scroller) return;
    var rowTop = row.offsetTop - scroller.offsetTop;
    var rowBottom = rowTop + row.offsetHeight;
    var visibleTop = scroller.scrollTop;
    var visibleBottom = visibleTop + scroller.clientHeight;
    if (rowTop < visibleTop) scroller.scrollTop = Math.max(0, rowTop - 4);
    else if (rowBottom > visibleBottom) scroller.scrollTop = Math.max(0, rowBottom - scroller.clientHeight + 4);
  }

  function timelineViewIsActive() {
    var view = document.getElementById('timeline');
    return !!(view && view.classList.contains('active'));
  }

  function clampScrollPosition(value, max) {
    value = Number(value) || 0;
    max = Math.max(0, Number(max) || 0);
    return Math.max(0, Math.min(value, max));
  }

  function rememberTimelineScrollState() {
    var board = timelineBoardScroller();
    var index = timelineIndexScroller();
    if (board) timelineState.boardScrollLeft = board.scrollLeft || 0;
    if (index) timelineState.indexScrollTop = index.scrollTop || 0;
    saveTimelineUiState();
  }

  function restoreTimelineIndexScroll() {
    setTimeout(function(){
      var index = timelineIndexScroller();
      if (!index) return;
      index.scrollTop = clampScrollPosition(timelineState.indexScrollTop, index.scrollHeight - index.clientHeight);
      timelineState.indexScrollTop = index.scrollTop || 0;
      saveTimelineUiState();
    }, 0);
  }

  function restoreTimelineSearchFocus(cursorPosition) {
    setTimeout(function(){
      var input = document.getElementById('timeline-filter-search');
      if (!input) return;
      input.focus();
      if (typeof input.setSelectionRange === 'function') {
        var requested = Number(cursorPosition);
        var cursor = Number.isFinite(requested) ? Math.max(0, requested) : input.value.length;
        cursor = Math.min(cursor, input.value.length);
        input.setSelectionRange(cursor, cursor);
      }
    }, 0);
  }

  function syncTimelineAxisScrollers() {
    setTimeout(function(){
      var axis = document.getElementById('timeline-axis-scroll');
      var board = timelineBoardScroller();
      if (!axis || !board) return;
      var syncing = false;
      var savedLeft = clampScrollPosition(timelineState.boardScrollLeft, board.scrollWidth - board.clientWidth);
      board.scrollLeft = savedLeft;
      axis.scrollLeft = savedLeft;
      timelineState.boardScrollLeft = savedLeft;
      function mirror(source, target) {
        if (!timelineViewIsActive()) return;
        if (source !== timelineBoardScroller() && source !== document.getElementById('timeline-axis-scroll')) return;
        if (syncing) return;
        syncing = true;
        timelineState.boardScrollLeft = source.scrollLeft || 0;
        target.scrollLeft = source.scrollLeft;
        syncing = false;
        adjustTimelineDateCursorVisibleEdge();
      }
      board.addEventListener('scroll', function(){ mirror(board, axis); }, { passive: true });
      axis.addEventListener('scroll', function(){ mirror(axis, board); }, { passive: true });
    }, 0);
  }

  function syncTimelineIndexScroller() {
    setTimeout(function(){
      var index = timelineIndexScroller();
      if (!index) return;
      index.scrollTop = clampScrollPosition(timelineState.indexScrollTop, index.scrollHeight - index.clientHeight);
      index.addEventListener('scroll', function(){
        if (!timelineViewIsActive()) return;
        if (index !== timelineIndexScroller()) return;
        timelineState.indexScrollTop = index.scrollTop || 0;
      }, { passive: true });
    }, 0);
  }

  function timelineDateCursorGeometry(source, allowClamp) {
    var minYear = timelineYear(timelineState.timeline && timelineState.timeline.minYear, -40);
    var maxYear = timelineYear(timelineState.timeline && timelineState.timeline.maxYear, 130);
    var element = clean(source) === 'axis'
      ? document.querySelector('.timeline-axis-track')
      : document.querySelector('.timeline-board');
    if (!element || !element.getBoundingClientRect) return null;
    var rect = element.getBoundingClientRect();
    var left = rect.left;
    var width = rect.width;
    if (clean(source) !== 'axis') {
      left += timelineAxisLabelWidth();
      width -= timelineAxisLabelWidth() + 2;
    }
    if (width <= 0) return null;
    return {
      left: left,
      right: left + width,
      width: width,
      minYear: minYear,
      maxYear: maxYear,
      allowClamp: !!allowClamp
    };
  }

  function timelineDateCursorYearFromPointer(event, source, allowClamp) {
    var geometry = timelineDateCursorGeometry(source, allowClamp);
    if (!geometry || !event) return null;
    var clientX = Number(event.clientX);
    if (!Number.isFinite(clientX)) return null;
    if (!geometry.allowClamp && (clientX < geometry.left || clientX > geometry.right)) return null;
    var percent = ((clientX - geometry.left) / geometry.width) * 100;
    if (geometry.allowClamp) percent = Math.max(0, Math.min(100, percent));
    return normalizeTimelineCursorYear(timelineYearFromPercent(percent, geometry.minYear, geometry.maxYear), geometry.minYear, geometry.maxYear);
  }

  function updateTimelineDateCursorDom() {
    var year = activeTimelineCursorYear();
    var timeline = timelineState.timeline || {};
    if (year == null) return;
    var percent = eventPercent(year, timeline.minYear, timeline.maxYear);
    var label = formatYear(year);
    document.querySelectorAll('.timeline-date-cursor').forEach(function(cursor){
      cursor.style.left = percent.toFixed(4) + '%';
      cursor.classList.toggle('is-near-start', percent <= 10);
      cursor.classList.toggle('is-near-end', percent >= 90);
      cursor.setAttribute('aria-label', 'Date cursor at ' + label + '. Drag to move it.');
      var labelNode = cursor.querySelector('.timeline-date-cursor-label');
      if (labelNode) labelNode.textContent = label;
    });
    setTimeout(adjustTimelineDateCursorVisibleEdge, 0);
  }

  function adjustTimelineDateCursorVisibleEdge() {
    var cursor = document.querySelector('.timeline-date-cursor.is-axis');
    var label = cursor && cursor.querySelector ? cursor.querySelector('.timeline-date-cursor-label') : null;
    var scroller = document.getElementById('timeline-axis-scroll');
    if (!cursor || !label || !scroller || !label.getBoundingClientRect || !scroller.getBoundingClientRect) return;
    cursor.classList.remove('is-visible-near-start', 'is-visible-near-end');
    var labelRect = label.getBoundingClientRect();
    var scrollRect = scroller.getBoundingClientRect();
    if (labelRect.right > scrollRect.right - 6) cursor.classList.add('is-visible-near-end');
    else if (labelRect.left < scrollRect.left + 6) cursor.classList.add('is-visible-near-start');
  }

  function ensureTimelineDateCursorDom() {
    var year = activeTimelineCursorYear();
    if (year == null) return;
    var timeline = timelineState.timeline || {};
    var axisTrack = document.querySelector('.timeline-axis-track');
    if (axisTrack && !axisTrack.querySelector('.timeline-date-cursor.is-axis')) {
      axisTrack.insertAdjacentHTML('beforeend', renderTimelineDateCursor(timeline.minYear, timeline.maxYear, 'axis'));
    }
    var board = document.querySelector('.timeline-board');
    var layer = document.querySelector('.timeline-date-cursor-layer');
    if (board && !layer) {
      layer = document.createElement('div');
      layer.className = 'timeline-date-cursor-layer';
      layer.setAttribute('aria-hidden', 'false');
      board.appendChild(layer);
    }
    if (layer && !layer.querySelector('.timeline-date-cursor.is-board')) {
      layer.innerHTML = renderTimelineDateCursor(timeline.minYear, timeline.maxYear, 'board');
    }
  }

  function setTimelineDateCursorYear(year, render) {
    var timeline = timelineState.timeline || {};
    var next = normalizeTimelineCursorYear(year, timeline.minYear, timeline.maxYear);
    if (next == null) return false;
    timelineState.dateCursorYear = next;
    if (render) {
      var pageScroll = snapshotTimelinePageScroll();
      rememberTimelineScrollState();
      saveTimelineUiState();
      renderViewer({ preserveScroll: false });
      restoreTimelinePageScroll(pageScroll);
    } else {
      ensureTimelineDateCursorDom();
      updateTimelineDateCursorDom();
    }
    return true;
  }

  function timelineDateCursorIsBlockedTarget(event) {
    if (!event) return true;
    if (event.button != null && event.button !== 0) return true;
    var target = event.target;
    if (!target || !target.closest) return false;
    return !!target.closest('.timeline-event, .timeline-date-cursor, button, input, select, textarea, summary');
  }

  function removeTimelineDateCursorDragListeners() {
    document.removeEventListener('pointermove', timelineDateCursorPointerMove);
    document.removeEventListener('pointerup', timelineDateCursorPointerUp);
    document.removeEventListener('pointercancel', timelineDateCursorPointerUp);
  }

  function beginTimelineDateCursorDrag(event, source, renderIfMissing) {
    if (!event) return;
    if (event.stopPropagation) event.stopPropagation();
    if (event.preventDefault) event.preventDefault();
    timelineDateCursorSuppressClickUntil = Date.now() + 500;
    removeTimelineDateCursorDragListeners();
    timelineDateCursorDrag = { source: clean(source) === 'axis' ? 'axis' : 'board', moved: false };
    var year = timelineDateCursorYearFromPointer(event, timelineDateCursorDrag.source, true);
    if (year != null) {
      timelineState.dateCursorYear = year;
      ensureTimelineDateCursorDom();
      updateTimelineDateCursorDom();
    }
    document.addEventListener('pointermove', timelineDateCursorPointerMove);
    document.addEventListener('pointerup', timelineDateCursorPointerUp);
    document.addEventListener('pointercancel', timelineDateCursorPointerUp);
  }

  function timelineDateCursorPointerMove(event) {
    if (!timelineDateCursorDrag) return;
    var year = timelineDateCursorYearFromPointer(event, timelineDateCursorDrag.source, true);
    if (year == null) return;
    timelineDateCursorDrag.moved = true;
    timelineState.dateCursorYear = year;
    updateTimelineDateCursorDom();
    if (event && event.preventDefault) event.preventDefault();
  }

  function timelineDateCursorPointerUp(event) {
    if (!timelineDateCursorDrag) return;
    timelineDateCursorPointerMove(event);
    timelineDateCursorDrag = null;
    removeTimelineDateCursorDragListeners();
    saveTimelineUiState();
  }

  function centerTimelineOnYear(year) {
    year = normalizeTimelineCursorYear(year, timelineState.timeline && timelineState.timeline.minYear, timelineState.timeline && timelineState.timeline.maxYear);
    if (year == null) return;
    setTimeout(function(){
      var boardScroller = timelineBoardScroller();
      var board = document.querySelector('.timeline-board');
      if (!boardScroller || !board) return;
      var timeline = timelineState.timeline || {};
      var percent = eventPercent(year, timeline.minYear, timeline.maxYear);
      var trackStart = timelineAxisLabelWidth();
      var trackWidth = Math.max(1, board.offsetWidth - trackStart - 2);
      var target = trackStart + (trackWidth * (percent / 100));
      var nextLeft = clampScrollPosition(Math.round(target - (boardScroller.clientWidth / 2)), boardScroller.scrollWidth - boardScroller.clientWidth);
      boardScroller.scrollLeft = nextLeft;
      var axis = document.getElementById('timeline-axis-scroll');
      if (axis) axis.scrollLeft = clampScrollPosition(nextLeft, axis.scrollWidth - axis.clientWidth);
      timelineState.boardScrollLeft = boardScroller.scrollLeft || 0;
      saveTimelineUiState();
    }, 0);
  }

  function selectedTimelineEvent() {
    return timelineState.eventLookup[timelineState.selectedEventId] || timelineState.events[0] || null;
  }

  function selectedTimelineLaneId() {
    var event = selectedTimelineEvent();
    return clean(event && event.laneId);
  }

  function openTimelineLaneIfCollapsed(laneId) {
    laneId = clean(laneId);
    if (!laneId) return false;
    var collapsed = activeTimelineCollapsedLaneIds();
    var index = collapsed.indexOf(laneId);
    if (index === -1) return false;
    collapsed.splice(index, 1);
    timelineState.collapsedLaneIds = collapsed;
    saveTimelineUiState();
    return true;
  }

  function renderSelectedCalloutBody() {
    var event = selectedTimelineEvent();
    if (!event) return '<div class="timeline-callout-empty">No timeline item selected.</div>';
    return '<div class="timeline-callout-main">'
      + '<div class="timeline-callout-headline">'
      + '<div class="timeline-callout-copy"><div class="timeline-callout-eyebrow"><span>Selected</span><button type="button" class="timeline-callout-find-action" title="Find this selected item on the timeline" onclick="event.stopPropagation();studyDeckTimelineJumpToSelected()">Find on timeline</button></div><strong>' + html(event.label) + '</strong><em>' + html(event.displayDate) + '</em></div>'
      + '<div class="timeline-callout-side"><div class="timeline-callout-action-row">' + (event.card ? renderTimelineStudyCardButton(event, 'timeline-callout-action', 'Study this card') : '<span class="timeline-callout-action-placeholder" aria-hidden="true"></span>') + '</div></div>'
      + '</div>'
      + '<p class="timeline-callout-note">' + html(event.shortNote || timelineDateExplanation(event)) + '</p>'
      + '</div>';
  }

  function renderSelectedCallout() {
    return '<section id="timeline-active-callout" class="timeline-callout-card" aria-live="polite">' + renderSelectedCalloutBody() + '</section>';
  }

  function focusSelectedEventButton(options) {
    options = options || {};
    setTimeout(function(){
      var selected = document.querySelector('.timeline-event.is-selected');
      if (!selected) return;
      var scroller = selected.closest ? selected.closest('.timeline-board-scroll') : null;
      var offsetParent = selected.offsetParent;
      if (scroller && offsetParent) {
        var targetLeft = offsetParent.offsetLeft + selected.offsetLeft + (selected.offsetWidth / 2) - (scroller.clientWidth / 2);
        scroller.scrollLeft = clampScrollPosition(Math.round(targetLeft), scroller.scrollWidth - scroller.clientWidth);
        timelineState.boardScrollLeft = scroller.scrollLeft || 0;
        var axis = document.getElementById('timeline-axis-scroll');
        if (axis) axis.scrollLeft = scroller.scrollLeft;
        saveTimelineUiState();
      }
      if (options.ensureVertical && selected.scrollIntoView) {
        selected.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
    }, 0);
  }

  function focusSelectedIndexButton(options) {
    options = options || {};
    setTimeout(function(){
      var selected = document.querySelector('.timeline-index-btn.is-active');
      var scroller = selected && selected.closest ? selected.closest('.timeline-index-list') : null;
      if (!selected || !scroller) return;
      var itemTop = selected.offsetTop - scroller.offsetTop;
      var itemBottom = itemTop + selected.offsetHeight;
      var visibleTop = scroller.scrollTop;
      var visibleBottom = visibleTop + scroller.clientHeight;
      if (!options.force && itemTop >= visibleTop && itemBottom <= visibleBottom) {
        timelineState.indexScrollTop = scroller.scrollTop || 0;
        saveTimelineUiState();
        return;
      }
      var group = selected.closest ? selected.closest('.timeline-index-group') : null;
      var groupTop = group ? (group.offsetTop - scroller.offsetTop) : (selected.offsetTop - scroller.offsetTop);
      var targetTop = Math.max(0, groupTop - 2);
      if (itemBottom - targetTop > scroller.clientHeight) {
        targetTop = itemBottom - scroller.clientHeight + 8;
      }
      scroller.scrollTop = clampScrollPosition(Math.round(targetTop), scroller.scrollHeight - scroller.clientHeight);
      timelineState.indexScrollTop = scroller.scrollTop || 0;
      saveTimelineUiState();
    }, 0);
  }

  function renderFlashcardMarkerCallout(type, label, date, note, meta) {
    var metaBits = clean(meta).split('|').map(clean).filter(Boolean);
    return '<div class="fc-timeline-marker-callout" aria-live="polite">'
      + '<strong>' + html(type || 'Selected item') + '</strong>'
      + '<div class="fc-timeline-marker-line"><b>' + html(label || 'Timeline marker') + '</b>' + (date ? '<i>' + html(date) + '</i>' : '') + '</div>'
      + (note ? '<em>' + html(note) + '</em>' : '')
      + (metaBits.length ? '<div class="fc-timeline-marker-meta">' + metaBits.map(function(bit){ return '<span>' + html(bit) + '</span>'; }).join('') + '</div>' : '')
      + '</div>';
  }

  function renderFlashcardTimelineButton(item, itemLane, type, label, date, style, isCard, isSoft, extraClass) {
    var classes = isCard ? 'fc-timeline-card-range is-active' : 'fc-timeline-context-marker';
    classes += flashcardMarkerDateClass(item);
    if (isSoft) classes += ' is-soft';
    if (extraClass) classes += ' ' + clean(extraClass);
    return '<button type="button" class="' + classes + '" data-fc-timeline-id="' + html(item.id) + '" style="' + html(style) + '" title="' + html(item.label + ' · ' + item.displayDate) + '" aria-label="' + html(item.label + ', ' + item.displayDate) + '" aria-pressed="' + (isCard ? 'true' : 'false') + '" onclick="event.stopPropagation();studyDeckTimelineFlashMarker(this,\'' + jsString(type) + '\',\'' + jsString(label) + '\',\'' + jsString(date) + '\',\'' + jsString(timelineMarkerNote(item, itemLane)) + '\',\'' + jsString(timelineMarkerMeta(item)) + '\')"><b class="fc-timeline-true-range" aria-hidden="true"></b></button>';
  }

  function renderFlashcardNearbyDisclosure(nearbyEvents) {
    if (!nearbyEvents || !nearbyEvents.length) return '';
    return '<details class="fc-timeline-context">'
      + '<summary><span>' + html(nearbyEvents.length + ' nearby') + '</span><em>Tap one to highlight it above</em></summary>'
      + '<div class="fc-timeline-context-list">'
      + nearbyEvents.map(function(item){
          return '<button type="button" class="fc-timeline-nearby-chip" aria-pressed="false" data-fc-timeline-chip-id="' + html(item.id) + '" onclick="event.stopPropagation();studyDeckTimelineSelectFlashMarkerById(this,\'' + jsString(item.id) + '\')" title="' + html(timelinePillSummary(item)) + '">' + html(timelineVisibleLabel(item)) + ' · ' + html(timelineVisibleDate(item)) + '</button>';
        }).join('')
      + '</div>'
      + '</details>';
  }

  function renderFlashcardPanel(card) {
    var event = findTimelineEventForCard(card);
    if (!event) return '';
    var eventLabel = timelineVisibleLabel(event);
    var eventDate = timelineVisibleDate(event);
    var model = timelineState;
    var timeline = model.timeline || {};
    var lane = laneById(model.lanes || [], event.laneId);
    var minYear = timeline.minYear;
    var maxYear = timeline.maxYear;
    var fitBounds = flashcardTimelineWindowBounds(event, minYear, maxYear, 40);
    var zoomBounds = flashcardTimelineWindowBounds(event, fitBounds.min, fitBounds.max, 20);
    var nearbyEvents = flashcardTimelineWindowEvents(event, model.events, fitBounds);
    var eventMarkerStyle = flashcardMarkerStyle(event, fitBounds.min, fitBounds.max, zoomBounds.min, zoomBounds.max, 9, 12);
    var contextHtml = renderFlashcardNearbyDisclosure(nearbyEvents);
    var soft = /debated|uncertain|approximate|authorship/i.test(event.dateType + ' ' + event.confidence);
    var eventButton = renderFlashcardTimelineButton(event, lane, 'This card', eventLabel, eventDate, eventMarkerStyle, true, soft);
    var nearbyProfiles = nearbyEvents.map(function(item){
      var itemLane = laneById(model.lanes || [], item.laneId);
      return flashcardMarkerProfile(item, itemLane, fitBounds, zoomBounds, 5.6, 8.5);
    });
    var packedRows = packFlashcardTimelineRows(nearbyProfiles);
    var contextRows = packedRows.map(function(row, index){
      var rowTitle = row.items.map(function(profile){ return timelinePillSummary(profile.item); }).join(' | ');
      return '<div class="fc-timeline-lane-row is-nearby' + (row.hasZoomItem ? '' : ' is-outside-zoom') + '">'
        + '<span class="fc-timeline-mini-lane-label" title="' + html(rowTitle) + '">' + html('Nearby ' + (index + 1)) + '</span>'
        + '<div class="fc-timeline-lane-track">'
        + row.items.map(function(profile){
            var item = profile.item;
            var itemType = 'Nearby event';
            var outsideClass = profile.visibleInZoom ? '' : 'is-outside-zoom';
            return renderFlashcardTimelineButton(item, profile.itemLane, itemType, timelineVisibleLabel(item), timelineVisibleDate(item), profile.style, false, false, outsideClass);
          }).join('')
        + '</div>'
        + '</div>';
    }).join('');
    return ''
      + '<div class="fc-timeline-panel" onclick="event.stopPropagation()" style="--lane-color:' + html(laneColor(lane)) + '">'
      +   '<div class="fc-timeline-head"><span>Timeline</span><strong>' + html(eventLabel) + '</strong></div>'
      +   '<div class="fc-timeline-date-row"><span class="fc-timeline-date">' + html(eventDate) + '</span><span class="fc-timeline-lane">' + html(lane.label || event.category || 'Timeline') + '</span><button type="button" class="fc-timeline-zoom-btn" aria-pressed="false" aria-label="Zoom in flashcard timeline" onclick="event.stopPropagation();studyDeckTimelineToggleFlashcardZoom(this)">Zoom In</button></div>'
      +   '<div class="fc-timeline-strip" aria-label="' + html(event.label + ' on the timeline') + '">'
      +     renderFlashcardAxisLabels(fitBounds.min, fitBounds.max, zoomBounds.min, zoomBounds.max)
      +     '<div class="fc-timeline-lanes">'
      +       '<div class="fc-timeline-lane-row is-card" style="--marker-color:' + html(laneColor(lane)) + '"><span class="fc-timeline-mini-lane-label">This card</span><div class="fc-timeline-lane-track">' + eventButton + '</div></div>'
      +       '<div class="fc-timeline-nearby-lanes" aria-label="Nearby timeline events" tabindex="0">'
      +         (contextRows || '<div class="fc-timeline-lane-row is-empty"><span class="fc-timeline-mini-lane-label">Nearby</span><div class="fc-timeline-lane-track"><em class="fc-timeline-empty-lane">No nearby events</em></div></div>')
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   renderFlashcardMarkerCallout('This card', eventLabel, eventDate, timelineMarkerNote(event, lane), timelineMarkerMeta(event))
      +   contextHtml
      +   '<div class="fc-timeline-actions"><button type="button" class="fc-timeline-open-btn" onclick="event.stopPropagation();studyDeckTimelineOpenFullForCard(\'' + jsString(event.cardUid) + '\')">Open full timeline</button></div>'
      + '</div>';
  }

  function renderViewer(options) {
    options = options || {};
    var root = document.getElementById('timeline-root');
    if (!root) return;
    if (options.preserveScroll !== false && timelineViewIsActive()) rememberTimelineScrollState();
    else if (options.preserveScroll !== false) applyStoredTimelineUiState();
    var model = collectTimelineModel();
    var sidecar = model.sidecar;
    var timeline = model.timeline || {};
    var lanes = model.lanes || [];
    var events = model.events || [];
    var cardEvents = events.filter(function(event){ return !event.isContext; });
    var boardEvents = timelineHideFilteredItems() ? events.filter(timelineEventMatchesFilters) : events;
    var boardWidth = timelineBoardWidth();
    if (reconcileTimelineSelectionWithFilters(events)) saveTimelineUiState();
    if (!sidecar || !events.length) {
      root.innerHTML = '<div class="timeline-shell">'
        + '<div class="top-bar"><button type="button" class="back-btn" onclick="showHome()">←</button><span class="top-title" style="flex:1">Timeline</span></div>'
        + '<div class="timeline-empty-card"><strong>No timeline data found</strong><span>Load a timeline sidecar to preview date ranges here.</span></div>'
        + '</div>';
      return;
    }
    root.innerHTML = '<div class="timeline-shell">'
      + '<div class="top-bar"><button type="button" class="back-btn" onclick="showHome()">←</button><span class="top-title" style="flex:1">Timeline</span></div>'
      + '<section class="timeline-hero-card timeline-hero-compact">'
      + '<div><div class="timeline-kicker">Reference timeline</div><h2>' + html(timelinePublicTitle(timeline, sidecar)) + '</h2></div>'
      + '<div class="timeline-stat-line"><span>' + html(cardEvents.length) + ' cards</span><span>' + html(lanes.length) + ' categories</span><span>' + html(formatYear(timeline.minYear)) + ' to ' + html(formatYear(timeline.maxYear)) + '</span></div>'
      + '</section>'
      + renderTimelineCategoryFilters(lanes, events)
      + renderSelectedCallout()
      + renderStickyYearAxis(timeline.minYear, timeline.maxYear, boardWidth)
      + '<section class="timeline-board-card" aria-label="Graphic timeline viewer">'
      + '<div class="timeline-board-scroll">'
      + '<div class="timeline-board" style="width:' + html(boardWidth) + 'px;--timeline-zoom:' + html(timelineZoomValue()) + '" onpointerdown="studyDeckTimelineStartDateCursorDragAtPoint(event,\'board\')" onclick="studyDeckTimelinePlaceDateCursor(event,\'board\')">'
      + renderBoardGrid(timeline.minYear, timeline.maxYear)
      + renderTimelineBoardCursorLayer(timeline.minYear, timeline.maxYear)
      + renderContextRow(boardEvents, lanes, timeline.minYear, timeline.maxYear, boardWidth)
      + renderLaneRows(boardEvents, lanes, timeline.minYear, timeline.maxYear, boardWidth)
      + '</div>'
      + '</div>'
      + '</section>'
      + renderTimelineIndex(events, lanes)
      + renderTimelineCoverageHealthCheck()
      + '</div>';
    syncTimelineAxisScrollers();
    syncTimelineIndexScroller();
    if (options.preserveScroll !== false) restoreTimelineIndexScroll();
    setTimeout(adjustTimelineDateCursorVisibleEdge, 50);
  }

  window.renderTimelineHomeEntry = renderHomeEntry;
  window.renderTimelineViewer = renderViewer;
  window.studyDeckTimelineBuildHealthReport = buildTimelineHealthReport;
  window.studyDeckTimelineRenderAuthorHealth = renderAuthorHealth;
  window.studyDeckTimelineRememberScroll = rememberTimelineScrollState;
  window.studyDeckTimelineSetZoom = function(value){
    var next = Number(value);
    if (!Number.isFinite(next)) next = 1;
    var cursorYear = activeTimelineCursorYear();
    var pageScroll = snapshotTimelinePageScroll();
    rememberTimelineScrollState();
    timelineState.zoom = Math.max(1, Math.min(4, next));
    saveTimelineUiState();
    renderViewer({ preserveScroll: false });
    if (cursorYear != null) centerTimelineOnYear(cursorYear);
    else focusSelectedEventButton();
    restoreTimelinePageScroll(pageScroll);
  };
  window.studyDeckTimelinePlaceDateCursor = function(event, source) {
    if (Date.now() < timelineDateCursorSuppressClickUntil) return;
    if (timelineDateCursorIsBlockedTarget(event)) return;
    var year = timelineDateCursorYearFromPointer(event, source, false);
    if (year == null) return;
    if (setTimelineDateCursorYear(year, false)) saveTimelineUiState();
  };
  window.studyDeckTimelineStartDateCursorDrag = function(event, source) {
    beginTimelineDateCursorDrag(event, source, false);
  };
  window.studyDeckTimelineStartDateCursorDragAtPoint = function(event, source) {
    if (timelineDateCursorIsBlockedTarget(event)) return;
    beginTimelineDateCursorDrag(event, source, true);
  };
  window.studyDeckTimelineSetCoverageNextOpen = function(open) {
    if (typeof authorMode === 'undefined' || !authorMode) return;
    timelineState.coverageNextOpen = !!open;
    saveTimelineUiState();
  };
  window.studyDeckTimelineSetFilterPanelOpen = function(open) {
    timelineState.filterPanelOpen = !!open;
    saveTimelineUiState();
  };
  window.studyDeckTimelineSetIndexPanelOpen = function(open) {
    timelineState.indexPanelOpen = !!open;
    saveTimelineUiState();
  };
  window.studyDeckTimelineToggleLaneCollapse = function(laneId) {
    laneId = clean(laneId);
    if (!laneId) return;
    var laneAnchor = snapshotTimelineLaneAnchor(laneId);
    rememberTimelineScrollState();
    var collapsed = activeTimelineCollapsedLaneIds();
    var index = collapsed.indexOf(laneId);
    if (index === -1) collapsed.push(laneId);
    else collapsed.splice(index, 1);
    timelineState.collapsedLaneIds = collapsed;
    saveTimelineUiState();
    renderViewer({ preserveScroll: false });
    restoreTimelineLaneAnchor(laneAnchor);
  };
  window.studyDeckTimelineJumpToSelected = function() {
    var event = selectedTimelineEvent();
    if (!event) return;
    rememberTimelineScrollState();
    var openedLane = openTimelineLaneIfCollapsed(selectedTimelineLaneId());
    if (openedLane) renderViewer({ preserveScroll: false });
    focusSelectedEventButton({ ensureVertical: true });
    focusSelectedIndexButton({ force: true });
  };
  window.studyDeckTimelineToggleCategoryFilter = function(laneId) {
    laneId = clean(laneId);
    if (!laneId) return;
    var pageScroll = snapshotTimelinePageScroll();
    rememberTimelineScrollState();
    var filters = activeTimelineCategoryFilters();
    var index = filters.indexOf(laneId);
    if (index === -1) filters.push(laneId);
    else filters.splice(index, 1);
    timelineState.activeCategoryFilters = filters;
    if (!filters.length) timelineState.hideFilteredItems = false;
    saveTimelineUiState();
    renderViewer({ preserveScroll: false });
    focusSelectedEventButton();
    restoreTimelinePageScroll(pageScroll);
  };
  window.studyDeckTimelineToggleHideFilteredItems = function() {
    if (!timelineHasAnyFilter()) return;
    var pageScroll = snapshotTimelinePageScroll();
    rememberTimelineScrollState();
    timelineState.hideFilteredItems = !timelineState.hideFilteredItems;
    saveTimelineUiState();
    renderViewer({ preserveScroll: false });
    focusSelectedEventButton();
    restoreTimelinePageScroll(pageScroll);
  };
  window.studyDeckTimelineSetSearchQuery = function(value, cursorPosition) {
    value = String(value == null ? '' : value);
    if (value === timelineState.searchQuery) return;
    var pageScroll = snapshotTimelinePageScroll();
    rememberTimelineScrollState();
    timelineState.searchQuery = value;
    saveTimelineUiState();
    renderViewer({ preserveScroll: false });
    focusSelectedEventButton();
    restoreTimelinePageScroll(pageScroll);
    restoreTimelineSearchFocus(cursorPosition);
  };
  window.studyDeckTimelineSetTypeFilter = function(type) {
    type = clean(type).toLowerCase();
    if (['all', 'cards', 'context'].indexOf(type) === -1) type = 'all';
    if (type === activeTimelineTypeFilter()) return;
    var pageScroll = snapshotTimelinePageScroll();
    rememberTimelineScrollState();
    timelineState.typeFilter = type;
    saveTimelineUiState();
    renderViewer({ preserveScroll: false });
    focusSelectedEventButton();
    restoreTimelinePageScroll(pageScroll);
  };
  window.studyDeckTimelineRefreshDateApply = function() {
    var button = document.getElementById('timeline-date-apply');
    if (!button) return;
    var from = document.getElementById('timeline-date-from');
    var to = document.getElementById('timeline-date-to');
    var hasInput = !!(timelineIntegerYear(from && from.value) || timelineIntegerYear(to && to.value));
    var enabled = hasInput || timelineHasDateWindowFilter();
    button.disabled = !enabled;
    button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  };
  window.studyDeckTimelineSetDateEra = function(button, field, era) {
    field = clean(field).toLowerCase();
    if (field !== 'from' && field !== 'to') return;
    era = timelineEra(era);
    var input = document.getElementById('timeline-date-' + field + '-era');
    if (input) input.value = era;
    var group = button && button.closest ? button.closest('.timeline-filter-era-switch') : null;
    if (group) {
      group.querySelectorAll('button').forEach(function(item){
        var active = clean(item.textContent).toUpperCase() === era;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    window.studyDeckTimelineRefreshDateApply();
  };
  window.studyDeckTimelineApplyDateWindow = function() {
    var from = document.getElementById('timeline-date-from');
    var fromEra = document.getElementById('timeline-date-from-era');
    var to = document.getElementById('timeline-date-to');
    var toEra = document.getElementById('timeline-date-to-era');
    var next = {
      fromYear: timelineIntegerYear(from && from.value),
      fromEra: timelineEra(fromEra && fromEra.value),
      toYear: timelineIntegerYear(to && to.value),
      toEra: timelineEra(toEra && toEra.value)
    };
    var current = timelineDateWindow();
    if (next.fromYear === current.fromYear && next.fromEra === current.fromEra && next.toYear === current.toYear && next.toEra === current.toEra) return;
    var pageScroll = snapshotTimelinePageScroll();
    rememberTimelineScrollState();
    timelineState.dateWindow = next;
    if (!timelineHasAnyFilter()) timelineState.hideFilteredItems = false;
    saveTimelineUiState();
    renderViewer({ preserveScroll: false });
    focusSelectedEventButton();
    restoreTimelinePageScroll(pageScroll);
  };
  window.studyDeckTimelineClearFilters = function() {
    if (!timelineHasAnyFilter()) return;
    var pageScroll = snapshotTimelinePageScroll();
    rememberTimelineScrollState();
    timelineState.activeCategoryFilters = [];
    timelineState.searchQuery = '';
    timelineState.typeFilter = 'all';
    timelineState.dateWindow = { fromYear: '', fromEra: 'CE', toYear: '', toEra: 'CE' };
    timelineState.hideFilteredItems = false;
    saveTimelineUiState();
    renderViewer({ preserveScroll: false });
    focusSelectedEventButton();
    restoreTimelinePageScroll(pageScroll);
  };
  window.studyDeckTimelineClearCategoryFilters = window.studyDeckTimelineClearFilters;
  window.showTimelineViewer = function(){
    if (typeof show === 'function') show('timeline');
    else {
      document.querySelectorAll('.view').forEach(function(view){ view.classList.remove('active'); });
      var view = document.getElementById('timeline');
      if (view) view.classList.add('active');
    }
    if (!timelineHasAnyFilter()) timelineState.filterPanelOpen = false;
    var render = function(){
      renderViewer({ preserveScroll: true });
    };
    if (typeof studyDeckAfterPaint === 'function') studyDeckAfterPaint(render);
    else setTimeout(render, 0);
  };
  window.studyDeckTimelineFlashcardPanelHTML = renderFlashcardPanel;
  window.studyDeckTimelineFlashMarker = function(button, type, label, date, note, meta){
    if (!button) return;
    var panel = button.closest ? button.closest('.fc-timeline-panel') : null;
    if (!panel) return;
    var scrollSnapshot = snapshotFlashcardTimelineScroll(panel);
    var eventId = clean(button.getAttribute('data-fc-timeline-id'));
    panel.querySelectorAll('.fc-timeline-card-range, .fc-timeline-context-marker').forEach(function(item){
      item.classList.toggle('is-active', item === button);
      item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
    });
    panel.querySelectorAll('.fc-timeline-nearby-chip').forEach(function(chip){
      var selected = eventId && clean(chip.getAttribute('data-fc-timeline-chip-id')) === eventId;
      chip.classList.toggle('is-active', selected);
      chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    var callout = panel.querySelector('.fc-timeline-marker-callout');
    if (callout) callout.outerHTML = renderFlashcardMarkerCallout(type, label, date, note, meta);
    restoreFlashcardTimelineScroll(scrollSnapshot);
  };
  window.studyDeckTimelineSelectFlashMarkerById = function(source, eventId){
    eventId = clean(eventId);
    var panel = source && source.closest ? source.closest('.fc-timeline-panel') : null;
    if (!panel || !eventId) return;
    var scrollSnapshot = snapshotFlashcardTimelineScroll(panel);
    var marker = panel.querySelector('[data-fc-timeline-id="' + eventId.replace(/"/g, '\\"') + '"]');
    if (!marker) return;
    if (panel.classList.contains('is-zoomed') && marker.classList.contains('is-outside-zoom')) {
      panel.classList.remove('is-zoomed');
      var zoomButton = panel.querySelector('.fc-timeline-zoom-btn');
      if (zoomButton) {
        zoomButton.textContent = 'Zoom In';
        zoomButton.setAttribute('aria-pressed', 'false');
        zoomButton.setAttribute('aria-label', 'Zoom in flashcard timeline');
      }
    }
    var row = marker.closest ? marker.closest('.fc-timeline-lane-row') : null;
    scrollFlashcardNearbyRowIntoPanel(row);
    marker.click();
    restoreFlashcardTimelineScroll(scrollSnapshot);
  };
  window.studyDeckTimelineToggleFlashcardZoom = function(button){
    var panel = button && button.closest ? button.closest('.fc-timeline-panel') : null;
    if (!panel) return;
    var scrollSnapshot = snapshotFlashcardTimelineScroll(panel);
    var zoomed = !panel.classList.contains('is-zoomed');
    panel.classList.toggle('is-zoomed', zoomed);
    button.textContent = zoomed ? 'Zoom Out' : 'Zoom In';
    button.setAttribute('aria-pressed', zoomed ? 'true' : 'false');
    button.setAttribute('aria-label', zoomed ? 'Zoom out flashcard timeline' : 'Zoom in flashcard timeline');
    restoreFlashcardTimelineScroll(scrollSnapshot);
  };
  window.studyDeckTimelineSelectEvent = function(eventId, source){
    source = clean(source);
    rememberTimelineScrollState();
    timelineState.selectedEventId = clean(eventId);
    saveTimelineUiState();
    var detail = document.getElementById('timeline-detail');
    if (detail) detail.innerHTML = renderDetail();
    var callout = document.getElementById('timeline-active-callout');
    if (callout) callout.innerHTML = renderSelectedCalloutBody();
    document.querySelectorAll('.timeline-event').forEach(function(button){
      var selected = clean(button.getAttribute('data-event-id')) === timelineState.selectedEventId;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    document.querySelectorAll('.timeline-index-btn').forEach(function(button){
      var selected = clean(button.getAttribute('data-timeline-index-id')) === timelineState.selectedEventId;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    if (source === 'index') {
      focusSelectedEventButton({ ensureVertical: true });
    } else if (source === 'board') {
      focusSelectedIndexButton();
    } else {
      focusSelectedEventButton();
      focusSelectedIndexButton({ force: true });
    }
  };
  window.studyDeckTimelineOpenFullForCard = function(uid){
    var event = findTimelineEventForCard({ uid: uid });
    if (event) timelineState.selectedEventId = event.id;
    saveTimelineUiState();
    renderViewer({ preserveScroll: false });
    if (typeof show === 'function') show('timeline');
    focusSelectedEventButton({ ensureVertical: true });
    focusSelectedIndexButton({ force: true });
    var callout = document.getElementById('timeline-active-callout');
    if (callout && callout.scrollIntoView) {
      setTimeout(function(){ callout.scrollIntoView({ block: 'start' }); }, 0);
    }
  };
  window.studyDeckTimelineOpenCard = function(uid){
    var sidecar = timelineState.sidecar || timelineSidecars()[0] || {};
    var found = findCardByUid(uid, findDeckForSidecar(sidecar));
    if (!found || !found.deck || !found.card) {
      alert('That matching flashcard deck is not loaded right now.');
      return;
    }
    var lockInfo = timelineCardLockInfo(found.deck, found.card);
    if (lockInfo && lockInfo.locked) {
      var message = 'Locked: reach ' + (lockInfo.deckName || found.deck.name || 'this deck') + ' Level ' + (lockInfo.cardLevel || 1) + ' to study this card.';
      if (typeof showXpToast === 'function') showXpToast(message, 3600);
      else alert(message);
      return;
    }
    if (typeof openDeck === 'function') openDeck(found.deck.id);
    setTimeout(function(){
      if (typeof openCardInFlash === 'function') openCardInFlash(found.card.id);
    }, 0);
  };
})();
