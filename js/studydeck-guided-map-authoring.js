// StudyDeck Guided Author Tools map authoring helpers.
// Loaded before app.js by index.html; intentionally uses classic-script globals.
// Contains map draft merge helpers, Maps tab state, and the Author Tools Maps editor UI.

var guidedAuthorMapsState = {
  sidecar: 'auto',
  mapId: '',
  cardUid: '',
  labelMapId: '',
  labelKind: 'placeLabels',
  labelIndex: '0',
  questionKey: '',
  briefingUid: '',
  mode: 'locations',
  previewZoom: 'close',
  questionReturnContext: null
};

function guidedAuthorEnsureSidecarMapStore(sidecar) {
  if (!sidecar || typeof sidecar !== 'object') return {};
  if (!sidecar.guidedLearning || typeof sidecar.guidedLearning !== 'object' || Array.isArray(sidecar.guidedLearning)) sidecar.guidedLearning = {};
  var maps = sidecar.guidedLearning.maps;
  if (Array.isArray(maps)) {
    var keyed = {};
    maps.forEach(function(map, idx){
      if (!map || typeof map !== 'object') return;
      var id = guidedNormalizeMapId(map.id || map.mapId || ('map_' + idx));
      if (id) keyed[id] = map;
    });
    maps = keyed;
  }
  if (!maps || typeof maps !== 'object' || Array.isArray(maps)) maps = {};
  sidecar.guidedLearning.maps = maps;
  return maps;
}
function guidedAuthorMapNumber(value, fallback) {
  var num = Number(value);
  if (!Number.isFinite(num)) num = Number(fallback);
  if (!Number.isFinite(num)) num = 0;
  return Math.max(0, Math.min(100, Math.round(num * 10) / 10));
}
function guidedAuthorMapDisplayLabelValue(value) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(function(line){ return String(line || '').replace(/\s+/g, ' ').trim(); })
    .filter(Boolean)
    .join('\n');
}
function guidedAuthorMapZoomViewsInputHTML(inputId, views) {
  var selected = {};
  guidedMapLabelZoomViews(views, ['full', 'region', 'area', 'close']).forEach(function(view){
    selected[view] = true;
  });
  var labels = [
    ['full', 'Full'],
    ['region', 'Region'],
    ['area', 'Area'],
    ['close', 'Close']
  ];
  return '<div class="guided-author-map-zoom-view-control">'
    + '<input type="hidden" id="' + guidedEsc(inputId) + '" value="' + guidedEsc(Object.keys(selected).join(', ')) + '">'
    + '<div class="guided-author-map-zoom-view-options" role="group" aria-label="Allowed zoom views">'
    + labels.map(function(item){
      return '<label><input type="checkbox" value="' + guidedEsc(item[0]) + '"' + (selected[item[0]] ? ' checked' : '') + ' onchange="guidedAuthorMapSyncZoomViews(\'' + guidedEsc(inputId) + '\', this)">'
        + '<span>' + guidedEsc(item[1]) + '</span></label>';
    }).join('')
    + '</div>'
    + '<span class="guided-author-field-hint">Checked views are the exact zoom levels where this label is allowed to appear. If a label says “Hidden by zoom,” add the current view here; if it still hides after that, then a higher-priority pin/label or the map edge is using that space.</span>'
    + '</div>';
}
function guidedAuthorMapSyncZoomViews(inputId, changedBox) {
  var input = document.getElementById(inputId);
  if (!input) return;
  var wrapper = input.closest ? input.closest('.guided-author-map-zoom-view-control') : null;
  var boxes = wrapper ? Array.prototype.slice.call(wrapper.querySelectorAll('input[type="checkbox"]')) : [];
  var checked = boxes.filter(function(box){ return box.checked; }).map(function(box){ return box.value; });
  if (!checked.length && changedBox) {
    changedBox.checked = true;
    checked = [changedBox.value];
  }
  input.value = checked.join(', ');
  Array.prototype.forEach.call(document.querySelectorAll('.guided-map-label.is-selected-label'), function(label){
    label.setAttribute('data-map-label-zoom-views', checked.join(','));
  });
  if (inputId === 'guided-map-location-zoomViews' && typeof guidedAuthorRefreshMapLocationPreview === 'function') {
    guidedAuthorRefreshMapLocationPreview();
  }
  guidedScheduleMapLabelCollisions(document);
}
function guidedAuthorNormalizeMapLabelDraft(value, kind) {
  value = value && typeof value === 'object' ? value : {};
  var out = {
    label: String(value.label || '').trim(),
    x: guidedAuthorMapNumber(value.x, 50),
    y: guidedAuthorMapNumber(value.y, 50)
  };
  if (value.labelDx !== undefined && value.labelDx !== '') out.labelDx = Math.max(-180, Math.min(180, Math.round(Number(value.labelDx) || 0)));
  if (value.labelDy !== undefined && value.labelDy !== '') out.labelDy = Math.max(-180, Math.min(180, Math.round(Number(value.labelDy) || 0)));
  var displayLabel = guidedAuthorMapDisplayLabelValue(value.displayLabel || value.labelDisplay || value.mapDisplayLabel);
  if (displayLabel && displayLabel !== out.label) out.displayLabel = displayLabel;
  if (value.labelAnchor !== undefined && value.labelAnchor !== '') out.labelAnchor = guidedMapLabelAnchor(value.labelAnchor);
  if (value.labelLevel !== undefined && value.labelLevel !== '') out.labelLevel = Math.max(1, Math.min(10, Math.round(Number(value.labelLevel) || 1)));
  if (value.labelPriority !== undefined && value.labelPriority !== '') out.labelPriority = Math.max(1, Math.min(10, Math.round(Number(value.labelPriority) || 1)));
  if (value.crowdingPriority !== undefined && value.crowdingPriority !== '') out.crowdingPriority = Math.max(1, Math.min(10, Math.round(Number(value.crowdingPriority) || 1)));
  if (value.priority !== undefined && value.priority !== '') out.priority = Math.max(0, Math.min(999, Math.round(Number(value.priority) || 0)));
  if (value.zoomViews !== undefined && value.zoomViews !== '') {
    var views = guidedMapLabelZoomViews(value.zoomViews, []);
    if (views.length) out.zoomViews = views;
  }
  if (value.kind !== undefined && value.kind !== '') out.kind = String(value.kind || '').trim();
  if (value.region !== undefined && value.region !== '') out.region = String(value.region || '').trim();
  if (kind === 'landmarkLabels' && out.kind === undefined) out.kind = '';
  if (kind !== 'landmarkLabels' && out.region === undefined) out.region = '';
  return out;
}
function guidedAuthorNormalizeMapLocationDraft(value) {
  value = value && typeof value === 'object' ? value : {};
  var out = {
    mapId: guidedNormalizeMapId(value.mapId || ''),
    x: guidedAuthorMapNumber(value.x, 50),
    y: guidedAuthorMapNumber(value.y, 50),
    label: String(value.label || '').trim(),
    region: String(value.region || '').trim()
  };
  if (value.labelDx !== undefined && value.labelDx !== '') out.labelDx = Math.max(-180, Math.min(180, Math.round(Number(value.labelDx) || 0)));
  if (value.labelDy !== undefined && value.labelDy !== '') out.labelDy = Math.max(-180, Math.min(180, Math.round(Number(value.labelDy) || 0)));
  var displayLabel = guidedAuthorMapDisplayLabelValue(value.displayLabel || value.labelDisplay || value.mapDisplayLabel);
  if (displayLabel && displayLabel !== out.label) out.displayLabel = displayLabel;
  if (value.labelAnchor !== undefined && value.labelAnchor !== '') out.labelAnchor = guidedMapLabelAnchor(value.labelAnchor);
  if (value.labelLevel !== undefined && value.labelLevel !== '') out.labelLevel = Math.max(1, Math.min(10, Math.round(Number(value.labelLevel) || 1)));
  if (value.labelPriority !== undefined && value.labelPriority !== '') out.labelPriority = Math.max(1, Math.min(10, Math.round(Number(value.labelPriority) || 1)));
  if (value.crowdingPriority !== undefined && value.crowdingPriority !== '') out.crowdingPriority = Math.max(1, Math.min(10, Math.round(Number(value.crowdingPriority) || 1)));
  if (value.priority !== undefined && value.priority !== '') out.priority = Math.max(0, Math.min(999, Math.round(Number(value.priority) || 0)));
  if (value.zoomViews !== undefined && value.zoomViews !== '') {
    var views = guidedMapLabelZoomViews(value.zoomViews, []);
    if (views.length) out.zoomViews = views;
  }
  if (value.kind !== undefined && value.kind !== '') out.kind = String(value.kind || '').trim();
  return out;
}
function guidedAuthorNormalizeMapCropDraft(value, fallback) {
  value = value && typeof value === 'object' ? value : {};
  fallback = fallback && typeof fallback === 'object' ? fallback : {};
  return {
    minSize: guidedAuthorMapNumber(value.minSize != null ? value.minSize : fallback.minSize, fallback.minSize != null ? fallback.minSize : 8),
    padding: guidedAuthorMapNumber(value.padding != null ? value.padding : fallback.padding, fallback.padding != null ? fallback.padding : 4)
  };
}
function guidedAuthorNormalizeCardStudyMapDraft(value) {
  value = value && typeof value === 'object' ? value : {};
  var location = guidedAuthorNormalizeMapLocationDraft(value.mapLocation || value.location || value);
  if (value.crop || value.minSize != null || value.padding != null) {
    location.crop = guidedAuthorNormalizeMapCropDraft(value.crop || {
      minSize: value.minSize,
      padding: value.padding
    }, { minSize: 8, padding: 4 });
  }
  var placeLabels = guidedAuthorDraftLineList(value.placeLabels);
  var landmarkLabels = guidedAuthorDraftLineList(value.landmarkLabels);
  if (placeLabels.length) location.placeLabels = placeLabels;
  if (landmarkLabels.length) location.landmarkLabels = landmarkLabels;
  return location;
}
function guidedAuthorMapPanelFromStudyLocation(location) {
  location = location && typeof location === 'object' ? location : {};
  return {
    type: 'location_context',
    mapId: guidedNormalizeMapId(location.mapId || ''),
    useCardLocation: true,
    placeLabels: guidedAuthorDraftLineList(location.placeLabels),
    landmarkLabels: guidedAuthorDraftLineList(location.landmarkLabels),
    crop: guidedAuthorNormalizeMapCropDraft(location.crop, { minSize: 8, padding: 4 })
  };
}
function guidedAuthorFindOrCreateCardMapScreen(entry) {
  if (!entry || typeof entry !== 'object') return null;
  var gl = guidedAuthorEnsureSidecarGuidedLearning(entry);
  if (!Array.isArray(gl.briefingScreens)) gl.briefingScreens = guidedAuthorSidecarArrayField(entry, 'briefingScreens');
  var screen = gl.briefingScreens.find(function(item){ return !!(item && item.mapPanel); });
  if (!screen && gl.briefingScreens[3]) screen = gl.briefingScreens[3];
  if (!screen) {
    screen = { id: 'map_context_04', lines: [], mapPanel: {} };
    gl.briefingScreens.push(screen);
  }
  if (!screen.mapPanel || typeof screen.mapPanel !== 'object') screen.mapPanel = {};
  return screen;
}
function guidedAuthorNormalizeMapOptionDraft(option, idx) {
  option = option && typeof option === 'object' ? option : {};
  var pinLabel = String(option.pinLabel || guidedLettersForIndex(idx)).trim().toUpperCase().slice(0, 1) || guidedLettersForIndex(idx);
  return {
    pinLabel: pinLabel,
    label: 'Pin ' + pinLabel,
    placeLabel: String(option.placeLabel || '').trim(),
    mapId: guidedNormalizeMapId(option.mapId || ''),
    x: guidedAuthorMapNumber(option.x, 50),
    y: guidedAuthorMapNumber(option.y, 50),
    correct: !!option.correct,
    region: String(option.region || '').trim()
  };
}
function guidedAuthorMapDraftMatchesTarget(sidecar, edit) {
  var wanted = String(edit && edit.targetSidecarId || '').trim();
  if (!wanted) return true;
  return String(guidedAuthorStoredSidecarId(sidecar || {})) === wanted;
}
function guidedAuthorApplyMapDraftToSidecar(sidecar, key, edit) {
  if (!guidedAuthorMapDraftMatchesTarget(sidecar, edit)) return false;
  var type = String(edit && edit.type || '').trim();
  if (type === 'cardStudyMap') {
    var cardStudyEntry = guidedAuthorFindSidecarEntryByUid(sidecar, edit.cardUid);
    if (!cardStudyEntry || !cardStudyEntry.entry) return false;
    var studyGl = guidedAuthorEnsureSidecarGuidedLearning(cardStudyEntry.entry);
    var studyLocation = guidedAuthorNormalizeCardStudyMapDraft(edit.value || edit);
    if (!studyLocation.mapId) return false;
    studyGl.mapLocation = studyLocation;
    var studyScreen = guidedAuthorFindOrCreateCardMapScreen(cardStudyEntry.entry);
    if (studyScreen) {
      studyScreen.mapPanel = guidedAuthorMapPanelFromStudyLocation(studyLocation);
    }
    return true;
  }
  if (type === 'mapLocation') {
    var entryItem = guidedAuthorFindSidecarEntryByUid(sidecar, edit.cardUid);
    if (!entryItem || !entryItem.entry) return false;
    var gl = guidedAuthorEnsureSidecarGuidedLearning(entryItem.entry);
    gl.mapLocation = guidedAuthorNormalizeMapLocationDraft(edit.value || edit.mapLocation || edit);
    return !!gl.mapLocation.mapId;
  }
  if (type === 'mapLabel') {
    var mapId = guidedNormalizeMapId(edit.mapId || '');
    var labelKind = edit.labelKind === 'landmarkLabels' ? 'landmarkLabels' : 'placeLabels';
    var maps = guidedAuthorEnsureSidecarMapStore(sidecar);
    var map = maps[mapId] || (maps[mapId] = { id: mapId, title: mapId, asset: guidedMapAssetForId(mapId), placeLabels: [], landmarkLabels: [] });
    if (!Array.isArray(map[labelKind])) map[labelKind] = [];
    var index = Math.max(0, Math.floor(Number(edit.index || 0) || 0));
    map[labelKind][index] = guidedAuthorNormalizeMapLabelDraft(edit.value || edit, labelKind);
    return !!map[labelKind][index].label;
  }
  if (type === 'mapQuestion') {
    var match = guidedAuthorFindSidecarQuestionByDraft(sidecar, { cardUid: edit.cardUid, questionId: edit.questionId, bankQuestionId: edit.questionId });
    if (!match || !match.question) return false;
    var options = Array.isArray(edit.mapOptions) ? edit.mapOptions.map(guidedAuthorNormalizeMapOptionDraft).slice(0, 4) : [];
    if (options.length !== 4) return false;
    var correctCount = options.filter(function(option){ return option.correct; }).length;
    if (correctCount !== 1) return false;
    match.question.mapId = guidedNormalizeMapId(edit.mapId || match.question.mapId || options[0].mapId);
    match.question.mapOptions = options.map(function(option){
      option.mapId = option.mapId || match.question.mapId;
      return option;
    });
    if (edit.crop && typeof edit.crop === 'object') {
      match.question.crop = guidedAuthorNormalizeMapCropDraft(edit.crop, { minSize: 9, padding: 3 });
    }
    return true;
  }
  if (type === 'briefingMapPanel') {
    var entry = guidedAuthorFindSidecarEntryByUid(sidecar, edit.cardUid);
    if (!entry || !entry.entry) return false;
    var glEntry = guidedAuthorEnsureSidecarGuidedLearning(entry.entry);
    if (!Array.isArray(glEntry.briefingScreens)) glEntry.briefingScreens = guidedAuthorSidecarArrayField(entry.entry, 'briefingScreens');
    var briefingId = String(edit.briefingId || '').trim();
    var screen = glEntry.briefingScreens.find(function(item){ return String(item && (item.id || item.key || '') || '') === briefingId; });
    if (!screen) return false;
    screen.mapPanel = guidedSidecarClone(edit.mapPanel || {}) || {};
    return !!screen.mapPanel.mapId || !!screen.mapPanel.useCardLocation;
  }
  return false;
}

function guidedAuthorMapsSetState(field, value) {
  if (!guidedAuthorMapsState || typeof guidedAuthorMapsState !== 'object') guidedAuthorMapsState = {};
  if (field === 'mode') guidedAuthorMapsClearLabelReturn();
  guidedAuthorMapsState[field] = String(value == null ? '' : value);
  renderGuidedView();
}
function guidedAuthorMapsClearLabelReturn() {
  if (!guidedAuthorMapsState || typeof guidedAuthorMapsState !== 'object') return;
  guidedAuthorMapsState.labelReturnMode = '';
  guidedAuthorMapsState.labelReturnCardUid = '';
  guidedAuthorMapsState.labelReturnQuestionKey = '';
}
function guidedAuthorMapsRememberLabelReturn(sourceMode) {
  if (!guidedAuthorMapsState || typeof guidedAuthorMapsState !== 'object') guidedAuthorMapsState = {};
  sourceMode = String(sourceMode || guidedAuthorMapsState.mode || '').trim();
  if (sourceMode !== 'locations' && sourceMode !== 'questions') {
    guidedAuthorMapsClearLabelReturn();
    return;
  }
  guidedAuthorMapsState.labelReturnMode = sourceMode;
  guidedAuthorMapsState.labelReturnCardUid = sourceMode === 'locations' ? String(guidedAuthorMapsState.cardUid || '') : '';
  guidedAuthorMapsState.labelReturnQuestionKey = sourceMode === 'questions' ? String(guidedAuthorMapsState.questionKey || '') : '';
}
function guidedAuthorMapsLabelReturnHTML() {
  var mode = guidedAuthorMapsState && guidedAuthorMapsState.labelReturnMode;
  if (mode !== 'locations' && mode !== 'questions') return '';
  var label = mode === 'questions' ? 'Back to Quiz Pins' : 'Back to Card Map Setup';
  var detail = mode === 'questions'
    ? 'Return to the quiz-pin question that opened this shared label.'
    : 'Return to the card study-map setup that opened this shared label.';
  return '<div class="guided-author-map-return-row"><button type="button" onclick="guidedAuthorMapsReturnFromLabels()">← ' + guidedEsc(label) + '</button><span>' + guidedEsc(detail) + '</span></div>';
}
function guidedAuthorMapsReturnFromLabels() {
  var mode = guidedAuthorMapsState && guidedAuthorMapsState.labelReturnMode;
  var cardUid = guidedAuthorMapsState && guidedAuthorMapsState.labelReturnCardUid;
  var questionKey = guidedAuthorMapsState && guidedAuthorMapsState.labelReturnQuestionKey;
  if (mode !== 'locations' && mode !== 'questions') {
    guidedAuthorMapsSetState('mode', 'locations');
    return;
  }
  guidedAuthorMapsClearLabelReturn();
  guidedAuthorMapsState.mode = mode;
  if (mode === 'locations' && cardUid) guidedAuthorMapsState.cardUid = cardUid;
  if (mode === 'questions' && questionKey) guidedAuthorMapsState.questionKey = questionKey;
  if (typeof guidedAuthorSetTab === 'function') {
    guidedAuthorSetTab('maps');
  } else {
    renderGuidedView();
  }
  setTimeout(function(){
    var selector = mode === 'questions' ? '.guided-author-map-question-label-status-list' : '[data-map-location-preview="1"]';
    var target = document.querySelector(selector) || document.querySelector('.guided-author-map-panel');
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 80);
}
function guidedAuthorMapsQuestionReturnHTML() {
  var context = guidedAuthorMapsState && guidedAuthorMapsState.questionReturnContext;
  if (!context || typeof context !== 'object') return '';
  var label = context.questionLabel || context.cardUid || 'selected Map Pin question';
  return '<div class="guided-author-map-return-row guided-author-map-question-return-row"><button type="button" onclick="guidedAuthorMapsReturnToQuestions()">← Back to Questions</button><span>Return to the Questions browser where you opened ' + guidedEsc(label) + '.</span></div>';
}
function guidedAuthorMapsReturnToQuestions() {
  var context = guidedAuthorMapsState && guidedAuthorMapsState.questionReturnContext;
  if (guidedAuthorMapsState) guidedAuthorMapsState.questionReturnContext = null;
  if (context && typeof guidedAuthorQuestionBrowserRestoreFromMapReturn === 'function') {
    guidedAuthorQuestionBrowserRestoreFromMapReturn(context);
    return;
  }
  if (typeof guidedAuthorSetTab === 'function') {
    guidedAuthorSetTab('questions');
  } else if (typeof renderGuidedView === 'function') {
    renderGuidedView();
  }
}
function guidedAuthorMapCardUidForLabel(labelText) {
  var key = normalizeQuizOptionKey(labelText || '');
  if (!key) return '';
  var sidecar = guidedAuthorMapsSidecarWithDrafts(guidedAuthorMapsRawSidecar());
  if (!sidecar) return '';
  var report = guidedAuthorMapManagerReport(sidecar);
  var match = report.cardLocations.find(function(item){
    return normalizeQuizOptionKey(item && item.location && item.location.label || '') === key;
  });
  return match ? match.uid : '';
}
function guidedAuthorMapSharedLabelTarget(labelText, mapId, preferredKind) {
  var key = normalizeQuizOptionKey(labelText || '');
  if (!key || guidedAuthorMapCardUidForLabel(labelText)) return null;
  var sidecar = guidedAuthorMapsSidecarWithDrafts(guidedAuthorMapsRawSidecar());
  if (!sidecar) return null;
  var report = guidedAuthorMapManagerReport(sidecar);
  var maps = Array.isArray(report && report.maps) ? report.maps.slice() : [];
  var targetMapId = String(mapId || '').trim();
  if (targetMapId) {
    maps.sort(function(a, b){
      return (a && a.id === targetMapId ? 0 : 1) - (b && b.id === targetMapId ? 0 : 1);
    });
  }
  var kinds = preferredKind === 'placeLabels' || preferredKind === 'landmarkLabels'
    ? [preferredKind, preferredKind === 'placeLabels' ? 'landmarkLabels' : 'placeLabels']
    : ['landmarkLabels', 'placeLabels'];
  for (var i = 0; i < maps.length; i += 1) {
    var item = maps[i] || {};
    var map = item.map || {};
    for (var k = 0; k < kinds.length; k += 1) {
      var kind = kinds[k];
      var labels = Array.isArray(map[kind]) ? map[kind] : [];
      for (var idx = 0; idx < labels.length; idx += 1) {
        var label = labels[idx] || {};
        var text = guidedTextFromFieldValue(label.label || label.name || label.placeLabel || label.text || '');
        if (normalizeQuizOptionKey(text || '') === key) {
          return { mapId: item.id, labelKind: kind, labelIndex: idx, label: label };
        }
      }
    }
  }
  return null;
}
function guidedAuthorMapSharedLabelActionHTML(labelText, mapId, preferredKind) {
  var target = guidedAuthorMapSharedLabelTarget(labelText, mapId, preferredKind);
  if (!target) return '';
  var buttonLabel = target.labelKind === 'landmarkLabels' ? 'Edit feature label' : 'Edit shared label';
  return '<div class="guided-author-map-label-status-actions"><button type="button" class="guided-author-map-label-status-action" data-map-status-edit-label="' + guidedEsc(labelText || '') + '" data-map-status-edit-map-id="' + guidedEsc(target.mapId || '') + '" data-map-status-edit-kind="' + guidedEsc(target.labelKind || '') + '" data-map-status-edit-index="' + guidedEsc(String(target.labelIndex || 0)) + '" onclick="guidedAuthorMapsOpenSharedLabelFromStatus(this)">' + guidedEsc(buttonLabel) + '</button></div>';
}
function guidedAuthorMapsOpenCardLabelFromStatus(button) {
  var uid = button && button.dataset ? String(button.dataset.mapStatusEditUid || '') : '';
  if (!uid) {
    var label = button && button.dataset ? button.dataset.mapStatusEditLabel : '';
    uid = guidedAuthorMapCardUidForLabel(label);
  }
  if (!uid) {
    if (typeof showXpToast === 'function') showXpToast('That feedback label is not tied to a card location.');
    return;
  }
  guidedAuthorMapsState.mode = 'locations';
  guidedAuthorMapsState.cardUid = uid;
  if (typeof guidedAuthorSetTab === 'function') {
    guidedAuthorSetTab('maps');
  } else {
    renderGuidedView();
  }
  setTimeout(function(){
    var target = document.querySelector('[data-map-location-preview="1"]') || document.querySelector('.guided-author-map-panel');
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 80);
}
function guidedAuthorMapsOpenSharedLabelFromStatus(button) {
  var dataset = button && button.dataset ? button.dataset : {};
  var mapId = String(dataset.mapStatusEditMapId || '').trim();
  var kind = String(dataset.mapStatusEditKind || '').trim();
  var index = String(dataset.mapStatusEditIndex || '').trim();
  if (!mapId || (kind !== 'placeLabels' && kind !== 'landmarkLabels') || index === '') {
    var target = guidedAuthorMapSharedLabelTarget(dataset.mapStatusEditLabel || '', mapId, kind);
    if (target) {
      mapId = target.mapId;
      kind = target.labelKind;
      index = String(target.labelIndex);
    }
  }
  if (!mapId || (kind !== 'placeLabels' && kind !== 'landmarkLabels') || index === '') {
    if (typeof showXpToast === 'function') showXpToast('That label is not tied to a shared map feature.');
    return;
  }
  guidedAuthorMapsRememberLabelReturn(guidedAuthorMapsState.mode);
  guidedAuthorMapsState.mode = 'labels';
  guidedAuthorMapsState.labelMapId = mapId;
  guidedAuthorMapsState.labelKind = kind;
  guidedAuthorMapsState.labelIndex = index;
  if (typeof guidedAuthorSetTab === 'function') {
    guidedAuthorSetTab('maps');
  } else {
    renderGuidedView();
  }
  setTimeout(function(){
    var targetEl = document.getElementById('guided-map-label-label') || document.querySelector('.guided-author-map-panel');
    if (targetEl && targetEl.scrollIntoView) targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 80);
}
function guidedAuthorOpenMapDraftEditorByKey(key) {
  key = String(key || '');
  var edit = guidedAuthorDraftPatch && guidedAuthorDraftPatch.mapEdits
    ? guidedAuthorDraftPatch.mapEdits[key]
    : null;
  if (!edit || typeof edit !== 'object') {
    if (typeof showXpToast === 'function') showXpToast('That map draft could not be found.');
    return;
  }
  var targetId = String(edit.targetSidecarId || '').trim();
  if (targetId && typeof guidedAuthorFindStoredSidecarById === 'function' && guidedAuthorFindStoredSidecarById(targetId)) {
    guidedAuthorMapsState.sidecar = targetId;
  }
  var type = String(edit.type || '').trim();
  if (type === 'mapQuestion') {
    guidedAuthorMapsState.mode = 'questions';
    if (edit.cardUid && edit.questionId) {
      guidedAuthorMapsState.questionKey = String(edit.cardUid) + '::' + String(edit.questionId);
    }
  } else if (type === 'cardStudyMap' || type === 'mapLocation' || type === 'briefingMapPanel') {
    guidedAuthorMapsState.mode = 'locations';
    if (edit.cardUid) guidedAuthorMapsState.cardUid = String(edit.cardUid);
  } else if (type === 'mapLabel') {
    guidedAuthorMapsState.mode = 'labels';
    if (edit.mapId) guidedAuthorMapsState.labelMapId = guidedNormalizeMapId(edit.mapId);
    guidedAuthorMapsState.labelKind = edit.labelKind === 'landmarkLabels' ? 'landmarkLabels' : 'placeLabels';
    if (edit.index != null) guidedAuthorMapsState.labelIndex = String(Math.max(0, Math.floor(Number(edit.index) || 0)));
  } else {
    guidedAuthorMapsState.mode = 'library';
  }
  if (typeof guidedAuthorSetTab === 'function') {
    guidedAuthorSetTab('maps');
  } else {
    renderGuidedView();
  }
  setTimeout(function(){
    var target = document.querySelector('.guided-author-map-panel') || document.querySelector('.guided-author-map-mode-nav');
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, 80);
}
function guidedAuthorMapsStoredSidecarHasMaps(sidecar) {
  var maps = sidecar && sidecar.guidedLearning && sidecar.guidedLearning.maps;
  if (maps && typeof maps === 'object' && !Array.isArray(maps) && Object.keys(maps).length) return true;
  return guidedAuthorSidecarCardEntries(sidecar).some(function(item){
    return !!guidedAuthorSidecarObjectField(item.entry, 'mapLocation')
      || guidedAuthorSidecarArrayField(item.entry, 'questions').some(function(question){
        return guidedNormalizeChallengeInteractionType(question && question.interactionType) === 'map_pin_choice';
      });
  });
}
function guidedAuthorMapsRawSidecar() {
  var sidecars = guidedAuthorStoredSidecars();
  if (!sidecars.length) return null;
  var selected = guidedAuthorMapsState.sidecar && guidedAuthorMapsState.sidecar !== 'auto'
    ? guidedAuthorFindStoredSidecarById(guidedAuthorMapsState.sidecar)
    : null;
  if (selected) return selected;
  return sidecars.find(guidedAuthorMapsStoredSidecarHasMaps) || sidecars[0];
}
function guidedAuthorMapsSidecarWithDrafts(raw) {
  if (!raw) return null;
  return guidedAuthorBuildSidecarWithReviewEdits(raw, { includeNodeSettings: false }).sidecar;
}
function guidedAuthorMapsSidecarSelectorHtml(raw) {
  var sidecars = guidedAuthorStoredSidecars();
  if (!sidecars.length) return guidedAuthorActiveSidecarStatusBlockHtml();
  var selectedId = raw ? guidedAuthorStoredSidecarId(raw) : '';
  if (sidecars.length === 1) return '<div class="guided-author-edit-note is-info">Map target: <strong>' + guidedEsc(guidedAuthorStoredSidecarTitle(sidecars[0])) + '</strong></div>';
  return '<label class="guided-author-field guided-author-map-sidecar-select"><span>Active sidecar</span><select onchange="guidedAuthorMapsSetState(\'sidecar\',this.value)">'
    + sidecars.map(function(sidecar){
      var id = guidedAuthorStoredSidecarId(sidecar);
      var suffix = guidedAuthorMapsStoredSidecarHasMaps(sidecar) ? ' · maps' : ' · no maps';
      return '<option value="' + guidedEsc(id) + '"' + (id === selectedId ? ' selected' : '') + '>' + guidedEsc(guidedAuthorStoredSidecarTitle(sidecar) + suffix) + '</option>';
    }).join('')
    + '</select></label>';
}
function guidedAuthorMapConfigs(sidecar) {
  var maps = sidecar && sidecar.guidedLearning && sidecar.guidedLearning.maps;
  if (Array.isArray(maps)) {
    return maps.map(function(map, idx){
      var id = guidedNormalizeMapId(map && (map.id || map.mapId) || ('map_' + idx));
      return { id: id, map: map || {} };
    }).filter(function(item){ return !!item.id; });
  }
  if (maps && typeof maps === 'object') {
    return Object.keys(maps).map(function(id){
      return { id: guidedNormalizeMapId(id), map: maps[id] || {} };
    }).filter(function(item){ return !!item.id; });
  }
  return [];
}
function guidedAuthorMapAssetForConfig(id, map) {
  return String(map && map.asset || guidedMapAssetForId(id) || '').trim();
}
function guidedAuthorMapConfigById(sidecar, mapId) {
  mapId = guidedNormalizeMapId(mapId || '');
  return (guidedAuthorMapConfigs(sidecar).find(function(item){ return item.id === mapId; }) || {}).map || null;
}
function guidedAuthorMapDraftCount() {
  return Object.keys((guidedAuthorDraftPatch && guidedAuthorDraftPatch.mapEdits) || {}).length;
}
function guidedAuthorMapDraftKey(parts) {
  return (parts || []).map(function(part){ return String(part == null ? '' : part); }).join('::');
}
function guidedAuthorMapAssignDraft(key, edit) {
  if (!key || !edit) return false;
  if (!guidedAuthorDraftPatch.mapEdits || typeof guidedAuthorDraftPatch.mapEdits !== 'object') guidedAuthorDraftPatch.mapEdits = {};
  var raw = guidedAuthorMapsRawSidecar();
  edit.targetSidecarId = raw ? guidedAuthorStoredSidecarId(raw) : '';
  edit.updatedAt = new Date().toISOString();
  guidedAuthorDraftPatch.mapEdits[key] = edit;
  return true;
}
function guidedAuthorMapCommitDrafts(message) {
  guidedAuthorSaveDraftPatch();
  renderGuidedView();
  if (typeof showXpToast === 'function') showXpToast(message || 'Map draft saved. Review Edits can apply it to the active sidecar.');
}
function guidedAuthorMapSaveDraft(key, edit) {
  if (!guidedAuthorMapAssignDraft(key, edit)) return;
  guidedAuthorMapCommitDrafts();
}
function guidedAuthorMapValidCoord(value) {
  var num = Number(value);
  return Number.isFinite(num) && num >= 0 && num <= 100;
}
function guidedAuthorMapManagerReport(sidecar) {
  var report = {
    maps: guidedAuthorMapConfigs(sidecar),
    cardLocations: [],
    labels: 0,
    landmarkLabels: 0,
    mapQuestions: [],
    briefingPanels: [],
    issues: []
  };
  var mapIds = {};
  report.maps.forEach(function(item){
    mapIds[item.id] = true;
    if (!guidedAuthorMapAssetForConfig(item.id, item.map)) report.issues.push({ type: 'asset', message: item.id + ' is missing an asset path.' });
    var places = Array.isArray(item.map.placeLabels) ? item.map.placeLabels : [];
    var landmarks = Array.isArray(item.map.landmarkLabels) ? item.map.landmarkLabels : [];
    report.labels += places.length;
    report.landmarkLabels += landmarks.length;
    places.concat(landmarks).forEach(function(label){
      if (!label || !label.label) report.issues.push({ type: 'label', message: item.id + ' has a blank map label.' });
      if (!guidedAuthorMapValidCoord(label && label.x) || !guidedAuthorMapValidCoord(label && label.y)) {
        report.issues.push({ type: 'label', message: item.id + ' has a label outside the 0-100 coordinate range.' });
      }
    });
  });
  guidedAuthorSidecarCardEntries(sidecar).forEach(function(item){
    var uid = guidedAuthorSidecarEntryUid(item);
    var location = guidedNormalizeMapLocation(guidedAuthorSidecarObjectField(item.entry, 'mapLocation'), item.entry && item.entry.titleHint);
    if (location) {
      report.cardLocations.push({ uid: uid, entry: item.entry, location: location });
      if (!mapIds[location.mapId]) report.issues.push({ type: 'location', uid: uid, message: uid + ' references missing map ' + location.mapId + '.' });
      if (!guidedAuthorMapValidCoord(location.x) || !guidedAuthorMapValidCoord(location.y)) report.issues.push({ type: 'location', uid: uid, message: uid + ' has mapLocation coordinates outside 0-100.' });
    }
    guidedAuthorSidecarArrayField(item.entry, 'questions').forEach(function(question){
      if (guidedNormalizeChallengeInteractionType(question && question.interactionType) !== 'map_pin_choice') return;
      var options = guidedNormalizeMapPinOptions(question, item.entry);
      var correctCount = options.filter(function(option){ return option.correct; }).length;
      var id = String(question && (question.id || question.key || '') || '');
      report.mapQuestions.push({ uid: uid, entry: item.entry, question: question, questionId: id, options: options });
      if (options.length !== 4) report.issues.push({ type: 'question', uid: uid, questionId: id, message: id + ' needs exactly four map pins.' });
      if (correctCount !== 1) report.issues.push({ type: 'question', uid: uid, questionId: id, message: id + ' needs exactly one correct pin.' });
      options.forEach(function(option, idx){
        var expected = 'Pin ' + (option.pinLabel || guidedLettersForIndex(idx));
        if (String(option.label || '') !== expected) report.issues.push({ type: 'leak', uid: uid, questionId: id, message: id + ' should expose quiz labels only as Pin A-D.' });
        if (!guidedAuthorMapValidCoord(option.x) || !guidedAuthorMapValidCoord(option.y)) report.issues.push({ type: 'question', uid: uid, questionId: id, message: id + ' has a pin outside 0-100.' });
      });
    });
    guidedAuthorSidecarArrayField(item.entry, 'briefingScreens').forEach(function(screen, idx){
      if (!screen || !screen.mapPanel) return;
      report.briefingPanels.push({ uid: uid, entry: item.entry, screen: screen, index: idx });
      var panelMapId = guidedNormalizeMapId(screen.mapPanel.mapId || location && location.mapId || '');
      if (panelMapId && !mapIds[panelMapId]) report.issues.push({ type: 'briefing', uid: uid, message: uid + ' briefing map references missing map ' + panelMapId + '.' });
      if (!location && screen.mapPanel.useCardLocation) report.issues.push({ type: 'briefing', uid: uid, message: uid + ' briefing map asks for card location, but mapLocation is missing.' });
    });
  });
  return report;
}
function guidedAuthorMapEditorStage(mapId, overlayHtml, className, viewName) {
  var config = guidedAuthorMapConfigById(guidedAuthorMapsSidecarWithDrafts(guidedAuthorMapsRawSidecar()) || {}, mapId) || {};
  var asset = guidedAuthorMapAssetForConfig(mapId, config);
  var zoomClass = 'is-' + (['full', 'region', 'area', 'close'].indexOf(viewName) !== -1 ? viewName : 'area');
  if (!asset) return '<div class="guided-author-map-stage-empty">Missing map asset for ' + guidedEsc(mapId || 'map') + '</div>';
  return '<div class="guided-author-map-edit-stage guided-map-stage is-revealed ' + guidedEsc(zoomClass) + ' ' + guidedEsc(className || '') + '" data-map-stage="1">'
    + '<img src="' + guidedEsc(asset) + '" alt="' + guidedEsc((config.title || mapId || 'Map') + ' editor preview') + '" onload="guidedRefreshMapLabels(this)">'
    + (overlayHtml || '')
    + '</div>';
}
function guidedAuthorMapEditorMarker(id, x, y, label, extraClass, fieldPrefix) {
  return '<button type="button" id="' + guidedEsc(id) + '" class="guided-author-map-editor-pin ' + guidedEsc(extraClass || '') + '" style="--x:' + guidedEsc(guidedAuthorMapNumber(x, 50)) + ';--y:' + guidedEsc(guidedAuthorMapNumber(y, 50)) + ';" data-x-field="' + guidedEsc(fieldPrefix + '-x') + '" data-y-field="' + guidedEsc(fieldPrefix + '-y') + '" onpointerdown="guidedAuthorMapStartDrag(event)" aria-label="Drag ' + guidedEsc(label || 'map pin') + '">' + guidedEsc(label || '') + '</button>';
}
function guidedAuthorMapQuestionFeedbackPinMarker(option, idx) {
  option = option && typeof option === 'object' ? option : {};
  var pin = option.pinLabel || guidedLettersForIndex(idx);
  var classes = 'guided-map-pin guided-author-map-feedback-drag-pin' + (option.correct ? ' is-correct' : '');
  return '<button type="button" class="' + guidedEsc(classes) + '" style="--x:' + guidedEsc(guidedAuthorMapNumber(option.x, 50)) + ';--y:' + guidedEsc(guidedAuthorMapNumber(option.y, 50)) + ';" data-x-field="guided-map-pin-' + guidedEsc(idx) + '-x" data-y-field="guided-map-pin-' + guidedEsc(idx) + '-y" onpointerdown="guidedAuthorMapStartDrag(event)" aria-label="Drag feedback Pin ' + guidedEsc(pin) + '">' + guidedEsc(pin) + '</button>';
}
function guidedAuthorMapLabelOverlay(mapId) {
  var options = arguments.length > 1 && arguments[1] && typeof arguments[1] === 'object' ? arguments[1] : {};
  var config = guidedAuthorMapConfigById(guidedAuthorMapsSidecarWithDrafts(guidedAuthorMapsRawSidecar()) || {}, mapId) || {};
  var selectedLabelText = options.selectedLabelText != null ? normalizeQuizOptionKey(options.selectedLabelText || '') : null;
  var currentLabelText = options.currentLabelText != null ? normalizeQuizOptionKey(options.currentLabelText || '') : null;
  var allowSelectedState = options.allowSelectedState === true;
  var excludeLabels = {};
  function normalizeWanted(values) {
    var out = {};
    guidedAuthorDraftLineList(values).forEach(function(value){
      var key = normalizeQuizOptionKey(value || '');
      if (key) out[key] = true;
    });
    return out;
  }
  guidedAuthorDraftLineList(options.excludeLabels || options.excludePlaceLabels).forEach(function(value){
    var key = normalizeQuizOptionKey(value || '');
    if (key) excludeLabels[key] = true;
  });
  if (options.currentLocation && options.currentLocation.label) {
    excludeLabels[normalizeQuizOptionKey(options.currentLocation.label || '')] = true;
  }
  var wantedPlaces = options.placeLabels ? normalizeWanted(options.placeLabels) : null;
  var wantedLandmarks = options.landmarkLabels ? normalizeWanted(options.landmarkLabels) : null;
  function labelAllowed(kind, labelText) {
    var key = normalizeQuizOptionKey(labelText || '');
    if (excludeLabels[key]) return false;
    var wanted = kind === 'landmarkLabels' ? wantedLandmarks : wantedPlaces;
    if (!wanted) return true;
    return !!(key && wanted[key]);
  }
  function authorCardLabelsForMap() {
    var sidecar = guidedAuthorMapsSidecarWithDrafts(guidedAuthorMapsRawSidecar()) || {};
    var cards = sidecar.cards && typeof sidecar.cards === 'object' ? sidecar.cards : {};
    return Object.keys(cards).map(function(uid){
      var entry = cards[uid] || {};
      var gl = entry.guidedLearning && typeof entry.guidedLearning === 'object' ? entry.guidedLearning : {};
      var loc = guidedNormalizeMapLocation(gl.mapLocation || entry.mapLocation, entry.titleHint || entry.title || uid);
      if (!loc || guidedNormalizeMapId(loc.mapId) !== guidedNormalizeMapId(mapId)) return null;
      return { uid: uid, location: loc, key: normalizeQuizOptionKey(loc.label || '') };
    }).filter(Boolean);
  }
  var rendered = {};
  function renderCardLabels(kind) {
    var wanted = kind === 'landmarkLabels' ? wantedLandmarks : wantedPlaces;
    if (!wanted) return '';
    return authorCardLabelsForMap().map(function(card){
      if (!card.key || rendered[card.key] || !wanted[card.key] || excludeLabels[card.key]) return '';
      rendered[card.key] = true;
      return guidedMapLabelItemHTML(card.location, 'guided-map-label guided-map-place-label', {
        mapId: mapId,
        kind: 'card',
        index: card.uid,
        requested: true,
        current: !!(currentLabelText && card.key === currentLabelText)
      });
    }).join('');
  }
  var html = renderCardLabels('placeLabels') + renderCardLabels('landmarkLabels');
  html += ['placeLabels', 'landmarkLabels'].map(function(kind){
    return (Array.isArray(config[kind]) ? config[kind] : []).map(function(label, idx){
      var labelText = guidedTextFromFieldValue(label && (label.label || label.name || label.placeLabel));
      var key = normalizeQuizOptionKey(labelText || '');
      if (rendered[key]) return '';
      if (!labelAllowed(kind, labelText)) return '';
      rendered[key] = true;
      var selected = selectedLabelText != null
        ? (!!selectedLabelText && normalizeQuizOptionKey(labelText || '') === selectedLabelText)
        : (allowSelectedState && mapId === guidedAuthorMapsState.labelMapId
          && kind === guidedAuthorMapsState.labelKind
          && String(idx) === String(guidedAuthorMapsState.labelIndex || '0'));
      var current = !!(currentLabelText && normalizeQuizOptionKey(labelText || '') === currentLabelText);
      return guidedMapLabelItemHTML(label, kind === 'placeLabels' ? 'guided-map-label guided-map-place-label' : 'guided-map-label guided-map-landmark-label', {
        mapId: mapId,
        kind: kind === 'placeLabels' ? 'place' : 'landmark',
        index: idx,
        selected: selected && !current,
        current: current
      });
    }).join('');
  }).join('');
  if (options.currentLocation) {
    html += guidedRenderCurrentMapLocationLabelItem(mapId, options.currentLocation, {
      draggable: !!options.currentLocationDraggable,
      dragPrefix: 'guided-map-location'
    });
  }
  return '<div class="guided-map-label-layer">' + html + '</div>';
}
function guidedAuthorMapSetMarkerFromFields(markerId, xId, yId) {
  var marker = document.getElementById(markerId);
  var x = document.getElementById(xId);
  var y = document.getElementById(yId);
  if (!x || !y) return;
  var nextX = guidedAuthorMapNumber(x.value, 50);
  var nextY = guidedAuthorMapNumber(y.value, 50);
  guidedAuthorMapSyncMarkersForFields(xId, yId, nextX, nextY);
  if (xId === 'guided-map-label-x' && yId === 'guided-map-label-y') {
    guidedAuthorMapApplySelectedLabelPosition(nextX, nextY);
  }
  if (xId === 'guided-map-location-x' && yId === 'guided-map-location-y') {
    Array.prototype.forEach.call(document.querySelectorAll('.guided-map-label.is-current-location-label'), function(label){
      label.style.setProperty('--x', nextX);
      label.style.setProperty('--y', nextY);
    });
  }
  if (String(xId || '').indexOf('guided-map-pin-') === 0 && String(yId || '').indexOf('guided-map-pin-') === 0) {
    guidedAuthorRefreshMapQuestionPreview();
    return;
  }
  guidedScheduleMapLabelCollisions(document);
}
function guidedAuthorMapSyncMarkersForFields(xFieldId, yFieldId, xValue, yValue) {
  Array.prototype.forEach.call(document.querySelectorAll('[data-x-field][data-y-field]'), function(marker){
    if (marker.getAttribute('data-x-field') !== xFieldId || marker.getAttribute('data-y-field') !== yFieldId) return;
    marker.style.setProperty('--x', guidedAuthorMapNumber(xValue, 50));
    marker.style.setProperty('--y', guidedAuthorMapNumber(yValue, 50));
  });
}
function guidedAuthorMapApplySelectedLabelPosition(x, y) {
  Array.prototype.forEach.call(document.querySelectorAll('.guided-map-label.is-selected-label'), function(label){
    label.style.setProperty('--x', guidedAuthorMapNumber(x, 50));
    label.style.setProperty('--y', guidedAuthorMapNumber(y, 50));
  });
}
function guidedAuthorMapLabelSelectorForOffset(dxId) {
  return String(dxId || '').indexOf('guided-map-location-') === 0
    ? '.guided-map-label.is-current-location-label'
    : '.guided-map-label.is-selected-label';
}
function guidedAuthorMapApplySelectedLabelOffset(dxId, dyId) {
  var dx = document.getElementById(dxId);
  var dy = document.getElementById(dyId);
  if (!dx || !dy) return;
  var nextDx = Math.max(-180, Math.min(180, Math.round(Number(dx.value) || 0)));
  var nextDy = Math.max(-180, Math.min(180, Math.round(Number(dy.value) || 0)));
  var areaDx = Math.round(nextDx * 1.18);
  var areaDy = Math.round(nextDy * 1.1);
  var closeDx = Math.round(nextDx * 1.55);
  var closeDy = Math.round(nextDy * 1.32);
  Array.prototype.forEach.call(document.querySelectorAll(guidedAuthorMapLabelSelectorForOffset(dxId)), function(label){
    label.style.setProperty('--label-dx', nextDx + 'px');
    label.style.setProperty('--label-dy', nextDy + 'px');
    label.style.setProperty('--label-dx-area', areaDx + 'px');
    label.style.setProperty('--label-dy-area', areaDy + 'px');
    label.style.setProperty('--label-dx-close', closeDx + 'px');
    label.style.setProperty('--label-dy-close', closeDy + 'px');
  });
  guidedScheduleMapLabelCollisions(document);
}
function guidedAuthorMapApplyLabelAnchor(selector, value) {
  var anchor = guidedMapLabelAnchor(value);
  var translate = guidedMapLabelAnchorTranslate(anchor);
  Array.prototype.forEach.call(document.querySelectorAll(selector), function(label){
    label.setAttribute('data-map-label-anchor', anchor);
    label.style.setProperty('--label-anchor-x', translate);
  });
  guidedScheduleMapLabelCollisions(document);
}
function guidedAuthorMapApplySelectedLabelAnchor(value) {
  guidedAuthorMapApplyLabelAnchor('.guided-map-label.is-selected-label', value);
}
function guidedAuthorMapApplyCurrentLocationLabelAnchor(value) {
  guidedAuthorMapApplyLabelAnchor('.guided-map-label.is-current-location-label', value);
}
function guidedAuthorMapApplySelectedLabelDisplay(value) {
  var displayLabel = guidedMapDisplayLabelText({ displayLabel: value }, '');
  Array.prototype.forEach.call(document.querySelectorAll('.guided-map-label.is-selected-label'), function(label){
    var canonical = label.getAttribute('data-map-label-text') || '';
    var text = label.querySelector('.guided-map-label-text');
    label.setAttribute('data-map-label-display-text', displayLabel || canonical);
    if (text) text.textContent = displayLabel || canonical;
  });
  guidedScheduleMapLabelCollisions(document);
}
function guidedAuthorMapLabelOffsetScaleForStage(stage) {
  var view = guidedMapCurrentZoomName(stage);
  if (view === 'close') return { x: 1.55, y: 1.32 };
  if (view === 'area') return { x: 1.18, y: 1.1 };
  return { x: 1, y: 1 };
}
function guidedAuthorMapStartLabelTextDrag(event) {
  var target = event && event.currentTarget;
  var label = target && target.closest && target.closest('.guided-map-label');
  var stage = label && label.closest && label.closest('.guided-map-stage');
  var authorPanel = stage && stage.closest && stage.closest('.guided-author-map-panel');
  if (!target || !label || !stage || !authorPanel) return;
  var prefix = target.getAttribute('data-guided-map-label-drag-prefix') || 'guided-map-label';
  var dxInput = document.getElementById(prefix + '-labelDx');
  var dyInput = document.getElementById(prefix + '-labelDy');
  if (!dxInput || !dyInput) return;
  event.preventDefault();
  event.stopPropagation();
  var scale = guidedAuthorMapLabelOffsetScaleForStage(stage);
  var startClientX = Number(event.clientX) || 0;
  var startClientY = Number(event.clientY) || 0;
  var startDx = Math.max(-180, Math.min(180, Number(dxInput.value) || 0));
  var startDy = Math.max(-180, Math.min(180, Number(dyInput.value) || 0));
  target.classList.add('is-dragging');
  try { target.setPointerCapture(event.pointerId); } catch(e) {}
  function rounded(value) {
    return Math.max(-180, Math.min(180, Math.round(value)));
  }
  function move(ev) {
    var nextDx = rounded(startDx + (((Number(ev.clientX) || 0) - startClientX) / Math.max(.01, scale.x)));
    var nextDy = rounded(startDy + (((Number(ev.clientY) || 0) - startClientY) / Math.max(.01, scale.y)));
    dxInput.value = String(nextDx);
    dyInput.value = String(nextDy);
    guidedAuthorMapApplySelectedLabelOffset(prefix + '-labelDx', prefix + '-labelDy');
  }
  function up(ev) {
    move(ev);
    target.classList.remove('is-dragging');
    try { target.releasePointerCapture(ev.pointerId); } catch(e) {}
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
  }
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
}
function guidedAuthorMapStartDrag(event) {
  var marker = event && event.currentTarget;
  var stage = marker && marker.closest && marker.closest('[data-map-stage="1"]');
  if (!marker || !stage) return;
  event.preventDefault();
  event.stopPropagation();
  try { marker.setPointerCapture(event.pointerId); } catch(e) {}
  function move(ev) {
    var layer = marker.closest && marker.closest('.guided-map-layer-inner');
    var rect = (layer || stage).getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
    var y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
    var xField = document.getElementById(marker.getAttribute('data-x-field'));
    var yField = document.getElementById(marker.getAttribute('data-y-field'));
    var xValue = (Math.round(x * 10) / 10).toFixed(1);
    var yValue = (Math.round(y * 10) / 10).toFixed(1);
    if (xField) xField.value = xValue;
    if (yField) yField.value = yValue;
    if (xField && yField) guidedAuthorMapSyncMarkersForFields(xField.id, yField.id, xValue, yValue);
    if (xField && yField && xField.id === 'guided-map-label-x' && yField.id === 'guided-map-label-y') {
      guidedAuthorMapApplySelectedLabelPosition(xValue, yValue);
    }
    guidedScheduleMapLabelCollisions(document);
  }
  function up(ev) {
    move(ev);
    try { marker.releasePointerCapture(ev.pointerId); } catch(e) {}
    marker.removeEventListener('pointermove', move);
    marker.removeEventListener('pointerup', up);
    marker.removeEventListener('pointercancel', up);
    if (String(marker.getAttribute('data-x-field') || '').indexOf('guided-map-pin-') === 0) {
      guidedAuthorRefreshMapQuestionPreview();
    }
  }
  marker.addEventListener('pointermove', move);
  marker.addEventListener('pointerup', up);
  marker.addEventListener('pointercancel', up);
}
function guidedAuthorMapField(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}
function guidedAuthorCardStudyMapFromFields(fallback) {
  fallback = fallback && typeof fallback === 'object' ? fallback : {};
  var cropFallback = fallback.crop && typeof fallback.crop === 'object' ? fallback.crop : { minSize: 8, padding: 4 };
  var displayLabelField = document.getElementById('guided-map-location-displayLabel');
  return {
    mapId: guidedAuthorMapField('guided-map-location-mapId') || fallback.mapId || '',
    x: guidedAuthorMapField('guided-map-location-x') || fallback.x || 50,
    y: guidedAuthorMapField('guided-map-location-y') || fallback.y || 50,
    label: guidedAuthorMapField('guided-map-location-label') || fallback.label || '',
    displayLabel: displayLabelField ? guidedAuthorMapDisplayLabelValue(displayLabelField.value) : guidedAuthorMapDisplayLabelValue(fallback.displayLabel || ''),
    region: guidedAuthorMapField('guided-map-location-region') || fallback.region || '',
    labelDx: guidedAuthorMapField('guided-map-location-labelDx') || fallback.labelDx || 0,
    labelDy: guidedAuthorMapField('guided-map-location-labelDy') || fallback.labelDy || 0,
    labelAnchor: guidedAuthorMapField('guided-map-location-labelAnchor') || fallback.labelAnchor || fallback.anchor || 'center',
    labelLevel: guidedAuthorMapField('guided-map-location-labelLevel') || fallback.labelLevel || 5,
    labelPriority: guidedAuthorMapField('guided-map-location-labelPriority') || fallback.labelPriority || fallback.crowdingPriority || fallback.labelLevel || 5,
    zoomViews: guidedAuthorMapField('guided-map-location-zoomViews') || fallback.zoomViews || '',
    placeLabels: guidedAuthorDraftLineList(guidedAuthorMapField('guided-map-location-placeLabels')),
    landmarkLabels: guidedAuthorDraftLineList(guidedAuthorMapField('guided-map-location-landmarkLabels')),
    crop: {
      minSize: guidedAuthorMapNumber(guidedAuthorMapField('guided-map-location-minSize'), cropFallback.minSize != null ? cropFallback.minSize : 8),
      padding: guidedAuthorMapNumber(guidedAuthorMapField('guided-map-location-padding'), cropFallback.padding != null ? cropFallback.padding : 4)
    }
  };
}
function guidedAuthorSaveMapLocationDraft(cardUid) {
  var edit = {
    type: 'cardStudyMap',
    cardUid: cardUid,
    value: guidedAuthorCardStudyMapFromFields()
  };
  if (guidedAuthorMapAssignDraft(guidedAuthorMapDraftKey(['cardStudyMap', cardUid]), edit)) {
    guidedAuthorMapCommitDrafts('Card map setup draft saved. Review Edits can apply it to the active sidecar.');
  }
}
function guidedAuthorRefreshMapLocationPreview() {
  var preview = document.querySelector('[data-map-location-preview="1"]');
  if (!preview) return;
  var loc = guidedAuthorCardStudyMapFromFields();
  loc = guidedNormalizeMapLocation(loc, loc.label) || loc;
  var resolved = {
    mapId: loc.mapId,
    location: loc,
    placeLabels: loc.placeLabels || [],
    landmarkLabels: loc.landmarkLabels || [],
    crop: loc.crop || { minSize: 8, padding: 4 }
  };
  var points = [loc].concat(guidedCardStudyMapLabelPoints(resolved));
  preview.outerHTML = guidedAuthorMapRuntimePreview(loc.mapId,
    guidedAuthorMapLabelOverlay(loc.mapId, {
      currentLocation: loc,
      currentLocationDraggable: true,
      placeLabels: resolved.placeLabels,
      landmarkLabels: resolved.landmarkLabels,
      excludeLabels: [loc.label]
    })
      + guidedAuthorMapEditorMarker('guided-map-location-preview-marker', loc.x, loc.y, loc.label || 'Current location', 'is-primary is-runtime-preview', 'guided-map-location'),
    points,
    loc.crop,
    'Card-location preview',
    { attrs: ' data-map-location-preview="1"', editable: true }
  );
  guidedScheduleMapLabelCollisions(document);
}
function guidedAuthorSaveMapLabelDraft(mapId, labelKind, index) {
  var prefix = 'guided-map-label';
  var edit = {
    type: 'mapLabel',
    mapId: mapId,
    labelKind: labelKind === 'landmarkLabels' ? 'landmarkLabels' : 'placeLabels',
    index: Number(index) || 0,
    value: {
      label: guidedAuthorMapField(prefix + '-label'),
      displayLabel: guidedAuthorMapDisplayLabelValue(guidedAuthorMapField(prefix + '-displayLabel')),
      x: guidedAuthorMapField(prefix + '-x'),
      y: guidedAuthorMapField(prefix + '-y'),
      labelDx: guidedAuthorMapField(prefix + '-labelDx'),
      labelDy: guidedAuthorMapField(prefix + '-labelDy'),
      labelAnchor: guidedAuthorMapField(prefix + '-labelAnchor'),
      labelLevel: guidedAuthorMapField(prefix + '-labelLevel'),
      priority: guidedAuthorMapField(prefix + '-priority'),
      zoomViews: guidedAuthorMapField(prefix + '-zoomViews'),
      region: guidedAuthorMapField(prefix + '-region'),
      kind: guidedAuthorMapField(prefix + '-kind')
    }
  };
  guidedAuthorMapSaveDraft(guidedAuthorMapDraftKey(['mapLabel', mapId, edit.labelKind, edit.index]), edit);
}
function guidedAuthorSaveMapQuestionDraft(cardUid, questionId) {
  var mapId = guidedAuthorMapField('guided-map-question-mapId');
  var correctIndex = Math.max(0, Math.min(3, Number(guidedAuthorMapField('guided-map-question-correct') || 0) || 0));
  var options = [0, 1, 2, 3].map(function(idx){
    var pin = guidedLettersForIndex(idx);
    return {
      pinLabel: pin,
      label: 'Pin ' + pin,
      placeLabel: guidedAuthorMapField('guided-map-pin-' + idx + '-place'),
      mapId: mapId,
      x: guidedAuthorMapField('guided-map-pin-' + idx + '-x'),
      y: guidedAuthorMapField('guided-map-pin-' + idx + '-y'),
      region: guidedAuthorMapField('guided-map-pin-' + idx + '-region'),
      correct: idx === correctIndex
    };
  });
  guidedAuthorMapSaveDraft(guidedAuthorMapDraftKey(['mapQuestion', cardUid, questionId]), {
    type: 'mapQuestion',
    cardUid: cardUid,
    questionId: questionId,
    mapId: mapId,
    crop: guidedAuthorMapQuestionCropFromFields(),
    mapOptions: options
  });
}
function guidedAuthorMapQuestionCropFromFields(fallback) {
  fallback = fallback && typeof fallback === 'object' ? fallback : { minSize: 9, padding: 3 };
  return {
    minSize: guidedAuthorMapNumber(guidedAuthorMapField('guided-map-question-minSize'), fallback.minSize != null ? fallback.minSize : 9),
    padding: guidedAuthorMapNumber(guidedAuthorMapField('guided-map-question-padding'), fallback.padding != null ? fallback.padding : 3)
  };
}
function guidedAuthorMapQuestionOptionsFromFields(mapId) {
  return [0, 1, 2, 3].map(function(idx){
    var pin = guidedLettersForIndex(idx);
    return {
      pinLabel: pin,
      label: 'Pin ' + pin,
      placeLabel: guidedAuthorMapField('guided-map-pin-' + idx + '-place'),
      mapId: mapId,
      x: guidedAuthorMapField('guided-map-pin-' + idx + '-x'),
      y: guidedAuthorMapField('guided-map-pin-' + idx + '-y'),
      region: guidedAuthorMapField('guided-map-pin-' + idx + '-region'),
      correct: idx === Math.max(0, Math.min(3, Number(guidedAuthorMapField('guided-map-question-correct') || 0) || 0))
    };
  }).map(guidedAuthorNormalizeMapOptionDraft);
}
function guidedAuthorRefreshMapQuestionPreview() {
  var preview = document.querySelector('[data-map-question-preview="1"]');
  if (!preview) return;
  var mapId = guidedNormalizeMapId(guidedAuthorMapField('guided-map-question-mapId') || '');
  var options = guidedAuthorMapQuestionOptionsFromFields(mapId);
  var crop = guidedAuthorMapQuestionCropFromFields({ minSize: 9, padding: 3 });
  var questionPlaceLabels = options.map(function(option){ return option.placeLabel; }).filter(Boolean);
  preview.outerHTML = guidedAuthorMapRuntimePreview(mapId,
    guidedAuthorMapLabelOverlay(mapId, { placeLabels: questionPlaceLabels })
      + options.map(guidedAuthorMapQuestionFeedbackPinMarker).join(''),
    options,
    crop,
    'Question-pin feedback preview',
    { attrs: ' data-map-question-preview="1"', editable: true }
  );
  guidedScheduleMapLabelCollisions(document);
}
function guidedAuthorMapNumberInput(id, value, markerId) {
  var oninput = markerId ? ' oninput="guidedAuthorMapSetMarkerFromFields(\'' + guidedEsc(markerId) + '\',\'' + guidedEsc(id.replace(/-[xy]$/, '-x')) + '\',\'' + guidedEsc(id.replace(/-[xy]$/, '-y')) + '\')"' : '';
  return '<input id="' + guidedEsc(id) + '" type="number" min="0" max="100" step="0.1" value="' + guidedEsc(guidedAuthorMapNumber(value, 50)) + '"' + oninput + '>';
}
function guidedAuthorMapNudgeCoord(xId, yId, markerId, dx, dy) {
  var x = document.getElementById(xId);
  var y = document.getElementById(yId);
  if (!x || !y) return;
  var nextX = guidedAuthorMapNumber((Number(x.value) || 0) + (Number(dx) || 0), 50);
  var nextY = guidedAuthorMapNumber((Number(y.value) || 0) + (Number(dy) || 0), 50);
  x.value = nextX.toFixed(1);
  y.value = nextY.toFixed(1);
  guidedAuthorMapSetMarkerFromFields(markerId, xId, yId);
}
function guidedAuthorMapNudgeOffset(dxId, dyId, dx, dy) {
  var x = document.getElementById(dxId);
  var y = document.getElementById(dyId);
  if (!x || !y) return;
  var nextX = Math.max(-180, Math.min(180, Math.round((Number(x.value) || 0) + (Number(dx) || 0))));
  var nextY = Math.max(-180, Math.min(180, Math.round((Number(y.value) || 0) + (Number(dy) || 0))));
  x.value = String(nextX);
  y.value = String(nextY);
  guidedAuthorMapApplySelectedLabelOffset(dxId, dyId);
}
function guidedAuthorMapNudgeButtons(xId, yId, markerId, label) {
  var args = '\'' + guidedEsc(xId) + '\',\'' + guidedEsc(yId) + '\',\'' + guidedEsc(markerId) + '\'';
  return '<div class="guided-author-map-nudge-row" aria-label="' + guidedEsc(label || 'Nudge map point') + '">'
    + '<button type="button" onclick="guidedAuthorMapNudgeCoord(' + args + ',-1,0)">←1</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeCoord(' + args + ',1,0)">1→</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeCoord(' + args + ',0,-1)">↑1</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeCoord(' + args + ',0,1)">1↓</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeCoord(' + args + ',-5,0)">←5</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeCoord(' + args + ',5,0)">5→</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeCoord(' + args + ',0,-5)">↑5</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeCoord(' + args + ',0,5)">5↓</button>'
    + '</div>';
}
function guidedAuthorMapOffsetNudgeButtons(dxId, dyId) {
  var args = '\'' + guidedEsc(dxId) + '\',\'' + guidedEsc(dyId) + '\'';
  return '<div class="guided-author-map-nudge-row" aria-label="Nudge label offset">'
    + '<button type="button" onclick="guidedAuthorMapNudgeOffset(' + args + ',-1,0)">←1</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeOffset(' + args + ',1,0)">1→</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeOffset(' + args + ',0,-1)">↑1</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeOffset(' + args + ',0,1)">1↓</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeOffset(' + args + ',-5,0)">←5</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeOffset(' + args + ',5,0)">5→</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeOffset(' + args + ',0,-5)">↑5</button>'
    + '<button type="button" onclick="guidedAuthorMapNudgeOffset(' + args + ',0,5)">5↓</button>'
    + '</div>';
}
function guidedAuthorMapRuntimePreview(mapId, innerHtml, points, crop, label, options) {
  options = options || {};
  var config = guidedAuthorMapConfigById(guidedAuthorMapsSidecarWithDrafts(guidedAuthorMapsRawSidecar()) || {}, mapId) || {};
  var asset = guidedAuthorMapAssetForConfig(mapId, config);
  if (!asset) return '<div class="guided-author-map-stage-empty">Missing map asset for ' + guidedEsc(mapId || 'map') + '</div>';
  return '<div class="guided-author-map-preview-card' + (options.className ? ' ' + guidedEsc(options.className) : '') + '"' + (options.attrs || '') + '>'
    + '<div class="guided-author-map-preview-head"><span>' + guidedEsc(label || 'Runtime preview') + '</span><em class="guided-map-collision-status">Measuring labels</em></div>'
    + guidedRenderMapViewport({ mapId: mapId, asset: asset, options: points || [] }, innerHtml || '', {
      points: points || [],
      crop: crop || { minSize: 12, padding: 5 },
      revealed: true,
      editable: !!options.editable,
      alt: (config.title || mapId || 'Map') + ' runtime preview'
    })
    + '</div>';
}
function guidedAuthorMapModeOptions() {
  return [
    ['library', 'Library'],
    ['locations', 'Card Map Setup'],
    ['questions', 'Quiz Pins'],
    ['labels', 'Advanced Labels']
  ];
}
function guidedAuthorRenderMapModeNav(report) {
  var active = guidedAuthorMapsState.mode || 'locations';
  if (active === 'briefings') active = 'locations';
  guidedAuthorMapsState.mode = active;
  var counts = {
    library: report.maps.length,
    locations: report.cardLocations.length,
    labels: report.labels + report.landmarkLabels,
    questions: report.mapQuestions.length
  };
  return '<div class="guided-author-map-mode-nav" role="tablist" aria-label="Map manager sections">'
    + guidedAuthorMapModeOptions().map(function(item){
      var id = item[0];
      return '<button type="button" class="' + (active === id ? 'is-active' : '') + '" onclick="guidedAuthorMapsSetState(\'mode\',\'' + guidedEsc(id) + '\')" role="tab" aria-selected="' + (active === id ? 'true' : 'false') + '"><span>' + guidedEsc(item[1]) + '</span><em>' + guidedEsc(String(counts[id] || 0)) + '</em></button>';
    }).join('')
    + '</div>';
}
function guidedAuthorMapStudyLabelStatusListHTML(currentLabel, placeLabels, landmarkLabels, mapId) {
  var rows = [];
  var seen = {};
  function add(label, role, roleLabel, preferredKind) {
    var text = guidedTextFromFieldValue(label || '');
    var key = normalizeQuizOptionKey(text || '');
    if (!text || !key || seen[key]) return;
    seen[key] = true;
    var action = '';
    if (role !== 'focus') {
      var cardUid = guidedAuthorMapCardUidForLabel(text);
      if (cardUid) {
        action = '<div class="guided-author-map-label-status-actions"><button type="button" class="guided-author-map-label-status-action" data-map-status-edit-label="' + guidedEsc(text) + '" data-map-status-edit-uid="' + guidedEsc(cardUid) + '" onclick="guidedAuthorMapsOpenCardLabelFromStatus(this)">Edit study label</button></div>';
      } else {
        action = guidedAuthorMapSharedLabelActionHTML(text, mapId, preferredKind);
      }
    }
    rows.push('<div data-map-status-label-text="' + guidedEsc(text) + '" data-map-status-label-role="' + guidedEsc(role || '') + '">'
      + '<strong><span class="guided-author-map-label-name">' + guidedEsc(text) + '</span><span class="guided-author-map-label-role">' + guidedEsc(roleLabel || 'Study label') + '</span></strong>'
      + '<span class="guided-author-map-label-status-state">Measuring</span>'
      + '<small class="guided-author-map-label-status-detail">The study-map preview will explain why this label is visible or hidden at the current zoom.</small>'
      + action
      + '</div>');
  }
  add(currentLabel, 'focus', 'Focus label');
  guidedAuthorDraftLineList(placeLabels).forEach(function(label){ add(label, 'other-card', 'Other card label', 'placeLabels'); });
  guidedAuthorDraftLineList(landmarkLabels).forEach(function(label){ add(label, 'reference', 'Reference label', 'landmarkLabels'); });
  if (!rows.length) return '';
  return '<div class="guided-author-map-label-status-list guided-author-map-study-label-status-list" data-map-status-stage-scope="location-preview">'
    + '<div class="guided-author-map-label-status-title">Study label visibility</div>'
    + rows.join('')
    + '</div>';
}
function guidedAuthorMapQuestionLabelStatusListHTML(options) {
  var rows = [];
  var seen = {};
  (Array.isArray(options) ? options : []).forEach(function(option, idx){
    var text = guidedTextFromFieldValue(option && (option.placeLabel || option.label || ''));
    var key = normalizeQuizOptionKey(text || '');
    if (!text || !key || seen[key]) return;
    seen[key] = true;
    var pin = option && (option.pinLabel || guidedLettersForIndex(idx)) || guidedLettersForIndex(idx);
    var cardUid = guidedAuthorMapCardUidForLabel(text);
    var action = cardUid
      ? '<div class="guided-author-map-label-status-actions"><button type="button" class="guided-author-map-label-status-action" data-map-status-edit-label="' + guidedEsc(text) + '" data-map-status-edit-uid="' + guidedEsc(cardUid) + '" onclick="guidedAuthorMapsOpenCardLabelFromStatus(this)">Edit study label</button></div>'
      : guidedAuthorMapSharedLabelActionHTML(text, option && option.mapId || '', '');
    rows.push('<div data-map-status-label-text="' + guidedEsc(text) + '" data-map-status-label-role="quiz-pin">'
      + '<strong><span class="guided-author-map-label-name">' + guidedEsc(text) + '</span><span class="guided-author-map-label-role">Pin ' + guidedEsc(pin) + ' feedback label</span></strong>'
      + '<span class="guided-author-map-label-status-state">Measuring</span>'
      + '<small class="guided-author-map-label-status-detail">The question feedback preview will explain why this label is visible or hidden at the current zoom.</small>'
      + action
      + '</div>');
  });
  if (!rows.length) return '';
  return '<div class="guided-author-map-label-status-list guided-author-map-question-label-status-list" data-map-status-stage-scope="question-preview">'
    + '<div class="guided-author-map-label-status-title">Feedback label visibility</div>'
    + rows.join('')
    + '</div>';
}
function guidedAuthorRenderMapLibraryPanel(sidecar, report) {
  return '<div class="guided-card guided-author-map-panel"><div class="guided-section-kicker">Map Library</div><div class="guided-card-title">Static basemaps and label layers</div><div class="guided-card-sub">Inspect existing map assets. V1 edits sidecar metadata only; it does not upload or regenerate SVG files.</div>'
    + (report.maps.length ? '<div class="guided-author-map-library">' + report.maps.map(function(item){
      var map = item.map || {};
      var asset = guidedAuthorMapAssetForConfig(item.id, map);
      var places = Array.isArray(map.placeLabels) ? map.placeLabels.length : 0;
      var landmarks = Array.isArray(map.landmarkLabels) ? map.landmarkLabels.length : 0;
      var source = map.source && (map.source.name || map.source.license) || '';
      return '<div class="guided-author-map-library-row"><strong>' + guidedEsc(map.title || item.id) + '</strong><span>' + guidedEsc(item.id) + '</span><span>' + guidedEsc(asset || 'Missing asset') + '</span><span>' + guidedEsc(places + ' place labels · ' + landmarks + ' landmark labels') + '</span><span>' + guidedEsc(source || 'Source not listed') + '</span></div>';
    }).join('') + '</div>' : guidedAuthorEmptyState('No map library in this sidecar.', 'This sidecar does not define reusable map assets or label layers yet. Select a Geography sidecar to inspect map metadata.', ''))
    + '</div>';
}
function guidedAuthorRenderMapLocationPanel(sidecar, report) {
  var locations = report.cardLocations.slice();
  if (!locations.length) return '<div class="guided-card guided-author-map-panel"><div class="guided-section-kicker">Card Map Setup</div>' + guidedAuthorEmptyState('No card map setup found.', 'This sidecar has no card mapLocation metadata. Select a Geography sidecar or add mapLocation data before tuning study maps.', '') + '</div>';
  var selected = locations.find(function(item){ return item.uid === guidedAuthorMapsState.cardUid; }) || locations[0];
  guidedAuthorMapsState.cardUid = selected.uid;
  var resolved = guidedResolveCardStudyMap(selected.entry) || {};
  var loc = resolved.location || selected.location || {};
  var currentLocationLabel = guidedMapLocationLabelItem(loc.mapId, loc);
  var currentLocation = currentLocationLabel && currentLocationLabel.item ? currentLocationLabel.item : loc;
  var markerId = 'guided-map-location-marker';
  var previewMarkerId = 'guided-map-location-preview-marker';
  var crop = resolved.crop || loc.crop || { minSize: 8, padding: 4 };
  var closeSize = crop.minSize != null ? crop.minSize : 8;
  var padding = crop.padding != null ? crop.padding : 4;
  var labelDx = currentLocation.labelDx != null ? currentLocation.labelDx : 0;
  var labelDy = currentLocation.labelDy != null ? currentLocation.labelDy : 0;
  var displayLabel = guidedAuthorMapDisplayLabelValue(currentLocation.displayLabel || loc.displayLabel || '');
  var labelAnchor = guidedMapLabelAnchor(currentLocation.labelAnchor || currentLocation.anchor);
  var labelLevel = currentLocation.labelLevel != null ? currentLocation.labelLevel : 5;
  var labelPriority = currentLocation.labelPriority != null
    ? currentLocation.labelPriority
    : currentLocation.crowdingPriority != null
      ? currentLocation.crowdingPriority
      : currentLocation.priority != null
        ? Math.max(1, Math.min(10, Math.round(Number(currentLocation.priority) / 10) || 5))
        : labelLevel;
  var labelSemanticKind = guidedMapLabelSemanticKind(currentLocation, { kind: 'place' });
  var labelDefaultViews = currentLocation.labelLevel != null
    ? guidedMapLabelZoomViewsForLevel(currentLocation.labelLevel)
    : guidedMapLabelDefaultZoomViews(labelSemanticKind, { kind: 'place' });
  var labelZoomViews = guidedMapLabelZoomViews(currentLocation.zoomViews, labelDefaultViews);
  var anchorOptions = ['left', 'center', 'right'].map(function(item){
    return '<option value="' + item + '"' + (item === labelAnchor ? ' selected' : '') + '>' + item + '</option>';
  }).join('');
  var placeLabels = Array.isArray(resolved.placeLabels) ? resolved.placeLabels : [];
  var landmarkLabels = Array.isArray(resolved.landmarkLabels) ? resolved.landmarkLabels : [];
  var cropPoints = [loc].concat(guidedCardStudyMapLabelPoints({
    mapId: loc.mapId,
    location: loc,
    placeLabels: placeLabels,
    landmarkLabels: landmarkLabels,
    crop: crop
  }));
  var locationPreview = guidedAuthorMapRuntimePreview(loc.mapId,
    guidedAuthorMapLabelOverlay(loc.mapId, {
      currentLocation: currentLocation,
      currentLocationDraggable: true,
      placeLabels: placeLabels,
      landmarkLabels: landmarkLabels,
      excludeLabels: [loc.label]
    })
      + guidedAuthorMapEditorMarker(previewMarkerId, loc.x, loc.y, loc.label || selected.uid, 'is-primary is-runtime-preview', 'guided-map-location'),
    cropPoints,
    { minSize: closeSize, padding: padding },
    'Study map preview',
    { attrs: ' data-map-location-preview="1"', editable: true }
  );
  var mapOptions = report.maps.map(function(item){
    return '<option value="' + guidedEsc(item.id) + '"' + (item.id === loc.mapId ? ' selected' : '') + '>' + guidedEsc(item.map.title || item.id) + '</option>';
  }).join('');
  var contextMap = guidedAuthorMapEditorStage(loc.mapId, guidedAuthorMapLabelOverlay(loc.mapId, {
    currentLocation: currentLocation,
    currentLocationDraggable: true,
    placeLabels: placeLabels,
    landmarkLabels: landmarkLabels,
    excludeLabels: [loc.label]
  }) + guidedAuthorMapEditorMarker(markerId, loc.x, loc.y, loc.label || selected.uid, 'is-primary', 'guided-map-location'), '', 'full');
  var cardSelector = '<select onchange="guidedAuthorMapsSetState(\'cardUid\',this.value)">' + locations.map(function(item){
    return '<option value="' + guidedEsc(item.uid) + '"' + (item.uid === selected.uid ? ' selected' : '') + '>' + guidedEsc(item.uid + ' · ' + (item.entry.titleHint || item.location.label || 'Location')) + '</option>';
  }).join('') + '</select>';
  var anchorGroup = '<section class="guided-author-map-control-group">'
    + '<div class="guided-author-map-control-head"><div><strong>Place anchor</strong><span>Move the real card location. This controls the study pin and the highlighted label for this card everywhere it appears.</span></div></div>'
    + '<div class="guided-author-map-compact-grid is-anchor">'
    + '<label>Map<select id="guided-map-location-mapId">' + mapOptions + '</select></label>'
    + '<label>Card label<input id="guided-map-location-label" value="' + guidedEsc(loc.label || '') + '" oninput="guidedAuthorRefreshMapLocationPreview()"></label>'
    + '<label>Location region<input id="guided-map-location-region" value="' + guidedEsc(loc.region || '') + '"></label>'
    + '<label>X' + guidedAuthorMapNumberInput('guided-map-location-x', loc.x, markerId) + '</label>'
    + '<label>Y' + guidedAuthorMapNumberInput('guided-map-location-y', loc.y, markerId) + '</label>'
    + '</div><div class="guided-author-map-nudge-box"><strong>Nudge place pin</strong>' + guidedAuthorMapNudgeButtons('guided-map-location-x', 'guided-map-location-y', markerId, 'Nudge card location') + '</div></section>';
  var labelGroup = '<section class="guided-author-map-control-group">'
    + '<div class="guided-author-map-control-head"><div><strong>Highlighted label</strong><span>Move the text around the pin without moving the true location. Drag the highlighted label, type offsets, choose its anchor, and set how strongly this place competes for space on other cards.</span></div></div>'
    + '<input type="hidden" id="guided-map-location-labelLevel" value="' + guidedEsc(labelLevel) + '">'
    + '<label class="guided-author-map-display-label-field">Display label<textarea id="guided-map-location-displayLabel" rows="2" oninput="guidedAuthorRefreshMapLocationPreview()" placeholder="Optional line breaks">' + guidedEsc(displayLabel) + '</textarea><span class="guided-author-field-hint">Optional. Use this only for how the label is drawn on the map, for example breaking a long name across two lines. The Card label still controls matching.</span></label>'
    + '<div class="guided-author-map-compact-grid is-label">'
    + '<label>DX<input id="guided-map-location-labelDx" type="number" step="1" value="' + guidedEsc(labelDx) + '" oninput="guidedAuthorMapApplySelectedLabelOffset(\'guided-map-location-labelDx\',\'guided-map-location-labelDy\')"></label>'
    + '<label>DY<input id="guided-map-location-labelDy" type="number" step="1" value="' + guidedEsc(labelDy) + '" oninput="guidedAuthorMapApplySelectedLabelOffset(\'guided-map-location-labelDx\',\'guided-map-location-labelDy\')"></label>'
    + '<label>Anchor<select id="guided-map-location-labelAnchor" onchange="guidedAuthorMapApplyCurrentLocationLabelAnchor(this.value)">' + anchorOptions + '</select></label>'
    + '<label>Crowding priority<input id="guided-map-location-labelPriority" type="number" min="1" max="10" step="1" value="' + guidedEsc(labelPriority) + '" oninput="guidedAuthorRefreshMapLocationPreview()"><span class="guided-author-field-hint">Higher numbers stay visible longer when labels overlap. This only matters when this place appears as a supporting label on another card’s map. The focused card label is always shown.</span></label>'
    + '</div>'
    + '<div class="guided-author-map-label-main-grid is-card-label-zoom">'
    + '<label>Show at zoom levels' + guidedAuthorMapZoomViewsInputHTML('guided-map-location-zoomViews', labelZoomViews) + '</label>'
    + '</div>'
    + '<div class="guided-author-field-hint">This controls when this card’s label appears as a nearby label on other study maps. When this card is the focus, its highlighted label still stays visible at every zoom level.</div>'
    + '<div class="guided-author-map-nudge-box"><strong>Nudge highlighted label</strong>' + guidedAuthorMapOffsetNudgeButtons('guided-map-location-labelDx', 'guided-map-location-labelDy') + '</div></section>';
  var cropGroup = '<section class="guided-author-map-control-group">'
    + '<div class="guided-author-map-control-head"><div><strong>Study zoom</strong><span>Close size and padding tune how tightly study surfaces crop around this card. Smaller values zoom closer and leave less extra space.</span></div></div>'
    + '<div class="guided-author-map-compact-grid is-crop">'
    + '<label>Close size<input id="guided-map-location-minSize" type="number" min="1" max="100" step="0.1" value="' + guidedEsc(closeSize) + '" oninput="guidedAuthorRefreshMapLocationPreview()"><span class="guided-author-field-hint">Smaller = closer study-map zoom.</span></label>'
    + '<label>Padding<input id="guided-map-location-padding" type="number" min="0" max="50" step="0.1" value="' + guidedEsc(padding) + '" oninput="guidedAuthorRefreshMapLocationPreview()"><span class="guided-author-field-hint">Lower = tighter around the pin and selected labels.</span></label>'
    + '</div></section>';
  var labelListGroup = '<section class="guided-author-map-control-group">'
    + '<div class="guided-author-map-control-head"><div><strong>Visible study labels</strong><span>Choose the other labels this card may show while studying. Card-backed places use their own Card Map Setup positions; seas, rivers, and regions come from Advanced Labels.</span></div></div>'
    + '<div class="guided-author-map-label-list-grid">'
    + '<label>Other card labels<textarea id="guided-map-location-placeLabels" rows="5" oninput="guidedAuthorRefreshMapLocationPreview()">' + guidedEsc(placeLabels.join('\n')) + '</textarea></label>'
    + '<label>Reference labels<textarea id="guided-map-location-landmarkLabels" rows="5" oninput="guidedAuthorRefreshMapLocationPreview()">' + guidedEsc(landmarkLabels.join('\n')) + '</textarea></label>'
    + '</div>'
    + guidedAuthorMapStudyLabelStatusListHTML(loc.label || selected.uid, placeLabels, landmarkLabels, loc.mapId)
    + '</section>';
  return '<div class="guided-card guided-author-map-panel"><div class="guided-node-head"><div><div class="guided-section-kicker">Card Map Setup</div><div class="guided-card-title">' + guidedAuthorHelpTitle('Set up this card’s study map', 'maps-coordinate-fields', 'This is the main place to edit the map for one study card. The place anchor is the true location of the card. The highlighted label is the name learners should connect to that pin. Study zoom controls how close the Close view gets on study surfaces like flashcards and briefing maps. Visible study labels chooses which nearby card labels and shared reference labels are allowed to appear with this card. Use this screen for card-backed places such as Jerusalem, Sinai, or Rome. Use Quiz Pins only for A-D answer choices, because wrong-answer pins should not move the real card location. Use Advanced Labels only for shared features such as rivers, seas, regions, and broad context labels.') + '</div><div class="guided-card-sub">Tune the true place pin, highlighted label, study zoom, and nearby study labels for one card.</div></div>' + cardSelector + '</div>'
    + '<div class="guided-author-map-work-surface"><div class="guided-author-map-surface-head"><strong>Move the true place pin</strong><span>Drag the dot on the full atlas, or use X/Y below.</span></div>' + contextMap + '</div>'
    + '<div class="guided-author-map-work-surface"><div class="guided-author-map-surface-head"><strong>Check the learner-facing study map</strong><span>This preview reflects the same card label, visible labels, and Close crop used by study surfaces.</span></div>' + locationPreview + '</div>'
    + '<div class="guided-author-map-setup-groups">' + anchorGroup + labelGroup + cropGroup + labelListGroup + '</div>'
    + '<div class="guided-author-actions"><button class="btn btn-gold" onclick="guidedAuthorSaveMapLocationDraft(\'' + guidedEsc(selected.uid) + '\')">Save study-map draft</button></div></div>';
}
function guidedAuthorRenderMapLabelsPanel(sidecar, report) {
  if (!report.maps.length) return '<div class="guided-card guided-author-map-panel"><div class="guided-section-kicker">Labels</div>' + guidedAuthorEmptyState('No shared map labels found.', 'This sidecar does not define map label layers. Select a Geography sidecar before tuning rivers, seas, regions, or context labels.', '') + '</div>';
  var selectedMap = report.maps.find(function(item){ return item.id === guidedAuthorMapsState.labelMapId; }) || report.maps[0];
  guidedAuthorMapsState.labelMapId = selectedMap.id;
  var kind = guidedAuthorMapsState.labelKind === 'landmarkLabels' ? 'landmarkLabels' : 'placeLabels';
  var labels = Array.isArray(selectedMap.map[kind]) ? selectedMap.map[kind] : [];
  if (!labels.length && kind === 'placeLabels' && Array.isArray(selectedMap.map.landmarkLabels) && selectedMap.map.landmarkLabels.length) {
    kind = 'landmarkLabels';
    guidedAuthorMapsState.labelKind = kind;
    labels = selectedMap.map.landmarkLabels;
  }
  var index = Math.max(0, Math.min(Math.max(0, labels.length - 1), Number(guidedAuthorMapsState.labelIndex || 0) || 0));
  guidedAuthorMapsState.labelIndex = String(index);
  var label = labels[index] || { label: '', x: 50, y: 50 };
  var displayLabel = guidedAuthorMapDisplayLabelValue(label.displayLabel || label.labelDisplay || label.mapDisplayLabel || '');
  var markerId = 'guided-map-label-marker';
  var anchor = guidedMapLabelAnchor(label.labelAnchor || label.anchor);
  var anchorOptions = ['left', 'center', 'right'].map(function(item){
    return '<option value="' + guidedEsc(item) + '"' + (item === anchor ? ' selected' : '') + '>' + guidedEsc(item.charAt(0).toUpperCase() + item.slice(1)) + '</option>';
  }).join('');
  var labelKind = String(label.kind || (kind === 'placeLabels' ? 'place' : 'context')).trim();
  var typeOptions = ['place', 'river', 'water', 'region', 'context'].map(function(item){
    var description = {
      place: 'Exact place',
      river: 'River',
      water: 'Water body',
      region: 'Region',
      context: 'Broad context'
    }[item] || item;
    return '<option value="' + guidedEsc(item) + '"' + (item === labelKind ? ' selected' : '') + '>' + guidedEsc(description) + '</option>';
  }).join('');
  var semanticKind = guidedMapLabelSemanticKind(label, { kind: kind === 'landmarkLabels' ? 'landmark' : 'place' });
  var labelLevel = guidedMapLabelLevel(label);
  var defaultViews = labelLevel != null
    ? guidedMapLabelZoomViewsForLevel(labelLevel)
    : guidedMapLabelDefaultZoomViews(semanticKind, { kind: kind === 'landmarkLabels' ? 'landmark' : 'place' });
  var selectedZoomViews = guidedMapLabelZoomViews(label.zoomViews, defaultViews);
  var labelPreview = guidedAuthorMapRuntimePreview(selectedMap.id,
    guidedAuthorMapLabelOverlay(selectedMap.id, { allowSelectedState: true })
      + guidedAuthorMapEditorMarker('guided-map-label-preview-marker', label.x, label.y, '•', 'is-label', 'guided-map-label-preview'),
    [{ x: label.x, y: label.y }],
    { minSize: 10, padding: 5 },
    'Label collision preview'
  );
  return '<div class="guided-card guided-author-map-panel"><div class="guided-section-kicker">Labels</div><div class="guided-card-title">' + guidedAuthorHelpTitle('Adjust shared map labels', 'maps-label-offsets', 'Advanced Labels is for shared reference features, not the main label for a study card. Good examples are Jordan River, Dead Sea, Mediterranean Sea, Judea, Galilee, or broad context labels. X and Y mark the real point or rough center of the feature on the atlas. Text DX and Text DY move only the words, so the label can sit away from the feature without changing what it points to. Anchor controls whether the left, center, or right side of the words attaches to the offset. Show at zoom levels is the clearest rule: checked zooms may show the label, unchecked zooms hide it. Crowding priority only matters after the label is allowed at that zoom; it decides which label wins when two labels or a pin need the same space.') + '</div>'
    + guidedAuthorMapsLabelReturnHTML()
    + '<section class="guided-author-map-control-group guided-author-map-label-picker"><div class="guided-author-map-control-head"><div><strong>Choose shared label</strong><span>Use this for rivers, seas, regions, and broad reference labels. Card-backed places are usually tuned in Card Map Setup.</span></div></div><div class="guided-author-map-filter-row"><select onchange="guidedAuthorMapsSetState(\'labelMapId\',this.value)">' + report.maps.map(function(item){
      return '<option value="' + guidedEsc(item.id) + '"' + (item.id === selectedMap.id ? ' selected' : '') + '>' + guidedEsc(item.map.title || item.id) + '</option>';
    }).join('') + '</select><select onchange="guidedAuthorMapsSetState(\'labelKind\',this.value)"><option value="placeLabels"' + (kind === 'placeLabels' ? ' selected' : '') + '>Shared place labels (legacy)</option><option value="landmarkLabels"' + (kind === 'landmarkLabels' ? ' selected' : '') + '>Shared feature labels</option></select><select onchange="guidedAuthorMapsSetState(\'labelIndex\',this.value)">' + labels.map(function(item, idx){
      return '<option value="' + guidedEsc(idx) + '"' + (idx === index ? ' selected' : '') + '>' + guidedEsc((idx + 1) + '. ' + (item.label || 'Untitled')) + '</option>';
    }).join('') + '</select></div><div class="guided-author-map-label-summary"><span><b>Selected</b>' + guidedEsc(label.label || 'Untitled') + '</span><span><b>Type</b>' + guidedEsc(labelKind || 'context') + '</span><span><b>Zoom</b>' + guidedEsc(selectedZoomViews.join(', ') || 'Auto') + '</span></div></section>'
    + '<section class="guided-author-map-work-surface guided-author-map-label-preview-surface"><div class="guided-author-map-surface-head"><div><strong>Preview visibility</strong><span>This shows the label with normal collision and zoom rules. If it disappears here, check the status row below.</span></div></div>' + labelPreview + '</section>'
    + '<section class="guided-author-map-work-surface guided-author-map-label-edit-surface"><div class="guided-author-map-surface-head"><div><strong>Move point and label</strong><span>Drag the dot to move the true feature point. Drag the label text to adjust only the text offset.</span></div></div>' + guidedAuthorMapEditorStage(selectedMap.id, guidedAuthorMapLabelOverlay(selectedMap.id, { allowSelectedState: true }) + guidedAuthorMapEditorMarker(markerId, label.x, label.y, '•', 'is-label', 'guided-map-label')) + '</section>'
    + '<section class="guided-author-map-control-group guided-author-map-label-fields"><div class="guided-author-map-control-head"><div><strong>Label details</strong><span>Set the anchor point, where the words sit, exactly which zoom views can show the label, and how it competes for space when the map is crowded.</span></div></div>'
    + '<div class="guided-author-map-label-main-grid">'
    + '<label>Label<input id="guided-map-label-label" value="' + guidedEsc(label.label || '') + '"></label>'
    + '<label>Display label<textarea id="guided-map-label-displayLabel" rows="2" oninput="guidedAuthorMapApplySelectedLabelDisplay(this.value)" placeholder="Optional line breaks">' + guidedEsc(displayLabel) + '</textarea><span class="guided-author-field-hint">Optional. This changes only how the words are drawn, not how StudyDeck finds the label. Use line breaks here for long labels.</span></label>'
    + '<label>Type<select id="guided-map-label-kind">' + typeOptions + '</select></label>'
    + '<label>Region<input id="guided-map-label-region" value="' + guidedEsc(label.region || '') + '" placeholder="Optional descriptive region"></label>'
    + '<label>Show at zoom levels' + guidedAuthorMapZoomViewsInputHTML('guided-map-label-zoomViews', selectedZoomViews) + '</label>'
    + '</div>'
    + '<div class="guided-author-map-compact-grid is-label-point">'
    + '<label>Point X' + guidedAuthorMapNumberInput('guided-map-label-x', label.x, markerId) + '</label>'
    + '<label>Point Y' + guidedAuthorMapNumberInput('guided-map-label-y', label.y, markerId) + '</label>'
    + '<label>Text DX<input id="guided-map-label-labelDx" type="number" step="1" value="' + guidedEsc(label.labelDx || 0) + '" oninput="guidedAuthorMapApplySelectedLabelOffset(\'guided-map-label-labelDx\',\'guided-map-label-labelDy\')"></label>'
    + '<label>Text DY<input id="guided-map-label-labelDy" type="number" step="1" value="' + guidedEsc(label.labelDy || 0) + '" oninput="guidedAuthorMapApplySelectedLabelOffset(\'guided-map-label-labelDx\',\'guided-map-label-labelDy\')"></label>'
    + '</div>'
    + '<input type="hidden" id="guided-map-label-labelLevel" value="' + guidedEsc(label.labelLevel != null ? label.labelLevel : '') + '">'
    + '<div class="guided-author-map-compact-grid is-label-rules">'
    + '<label>Anchor<select id="guided-map-label-labelAnchor" onchange="guidedAuthorMapApplySelectedLabelAnchor(this.value)">' + anchorOptions + '</select></label>'
    + '<label>Crowding priority<input id="guided-map-label-priority" type="number" min="0" max="999" step="1" value="' + guidedEsc(label.priority != null ? label.priority : '') + '" placeholder="' + (kind === 'placeLabels' ? '50' : '25') + '"><span class="guided-author-field-hint">Used only when labels overlap. Higher priority wins space; lower priority labels may hide.</span></label>'
    + '</div></section>'
    + '<div class="guided-author-map-label-status-list"><div data-map-status-label-text="' + guidedEsc(label.label || '') + '"><strong>Selected label</strong><span class="guided-author-map-label-status-state">Measuring</span><span class="guided-author-map-label-status-detail">Checking zoom and collision rules.</span></div></div>'
    + '<div class="guided-author-map-nudge-group"><div><strong>Nudge point</strong>' + guidedAuthorMapNudgeButtons('guided-map-label-x', 'guided-map-label-y', markerId, 'Nudge label point') + '</div><div><strong>Nudge text offset</strong>' + guidedAuthorMapOffsetNudgeButtons('guided-map-label-labelDx', 'guided-map-label-labelDy') + '</div></div>'
    + '<div class="guided-author-actions"><button class="btn btn-gold" onclick="guidedAuthorSaveMapLabelDraft(\'' + guidedEsc(selectedMap.id) + '\',\'' + guidedEsc(kind) + '\',' + index + ')">Save shared-label draft</button></div></div>';
}
function guidedAuthorRenderMapQuestionsPanel(sidecar, report) {
  if (!report.mapQuestions.length) return '<div class="guided-card guided-author-map-panel"><div class="guided-section-kicker">Map Questions</div>' + guidedAuthorEmptyState('No Map Pin questions found.', 'This sidecar has no map_pin_choice questions to tune. Add Map Pin questions before editing A-D quiz pins.', '') + '</div>';
  var selected = report.mapQuestions.find(function(item){ return (item.uid + '::' + item.questionId) === guidedAuthorMapsState.questionKey; }) || report.mapQuestions[0];
  guidedAuthorMapsState.questionKey = selected.uid + '::' + selected.questionId;
  var question = selected.question || {};
  var options = guidedNormalizeMapPinOptions(question, selected.entry).slice(0, 4);
  while (options.length < 4) options.push({ pinLabel: guidedLettersForIndex(options.length), label: 'Pin ' + guidedLettersForIndex(options.length), placeLabel: '', x: 50, y: 50, correct: false });
  var correctIndex = Math.max(0, options.findIndex(function(option){ return option.correct; }));
  var mapId = guidedNormalizeMapId(question.mapId || options[0].mapId || selected.entry && selected.entry.guidedLearning && selected.entry.guidedLearning.mapLocation && selected.entry.guidedLearning.mapLocation.mapId);
  var questionCrop = question.crop && typeof question.crop === 'object'
    ? guidedAuthorNormalizeMapCropDraft(question.crop, { minSize: 9, padding: 3 })
    : { minSize: 9, padding: 3 };
  var overlays = options.map(function(option, idx){
    return guidedAuthorMapEditorMarker('guided-map-question-marker-' + idx, option.x, option.y, option.pinLabel || guidedLettersForIndex(idx), option.correct ? 'is-correct' : '', 'guided-map-pin-' + idx);
  }).join('');
  var questionPlaceLabels = options.map(function(option){ return option.placeLabel; }).filter(Boolean);
  var runtimePreview = guidedAuthorMapRuntimePreview(mapId,
    guidedAuthorMapLabelOverlay(mapId, { placeLabels: questionPlaceLabels })
      + options.map(guidedAuthorMapQuestionFeedbackPinMarker).join(''),
    options,
    questionCrop,
    'Question-pin feedback preview',
    { attrs: ' data-map-question-preview="1"', editable: true }
  );
  var questionFeedbackStatus = guidedAuthorMapQuestionLabelStatusListHTML(options);
  var questionCropControls = '<div class="guided-author-map-form-grid guided-author-map-crop-controls">'
    + '<label>Close size<input id="guided-map-question-minSize" type="number" min="1" max="100" step="0.1" value="' + guidedEsc(questionCrop.minSize) + '" oninput="guidedAuthorRefreshMapQuestionPreview()"><span class="guided-author-field-hint">Smaller = tighter feedback preview zoom.</span></label>'
    + '<label>Padding<input id="guided-map-question-padding" type="number" min="0" max="50" step="0.1" value="' + guidedEsc(questionCrop.padding) + '" oninput="guidedAuthorRefreshMapQuestionPreview()"><span class="guided-author-field-hint">Lower = less room around A-D pins.</span></label>'
    + '</div>';
  var questionSelector = '<select onchange="guidedAuthorMapsSetState(\'questionKey\',this.value)">' + report.mapQuestions.map(function(item){
    var key = item.uid + '::' + item.questionId;
    return '<option value="' + guidedEsc(key) + '"' + (key === guidedAuthorMapsState.questionKey ? ' selected' : '') + '>' + guidedEsc(item.uid + ' · ' + item.questionId) + '</option>';
  }).join('') + '</select>';
  var pinCards = options.map(function(option, idx){
    var pin = option.pinLabel || guidedLettersForIndex(idx);
    var markerId = 'guided-map-question-marker-' + idx;
    return '<div class="guided-author-map-pin-edit">'
      + '<div class="guided-author-map-pin-edit-head"><strong>Pin ' + guidedEsc(pin) + '</strong><label><input type="radio" name="guided-map-question-correct-radio"' + (idx === correctIndex ? ' checked' : '') + ' onchange="document.getElementById(\'guided-map-question-correct\').value=\'' + idx + '\'"> Correct</label></div>'
      + '<div class="guided-author-map-pin-fields">'
      + '<label class="is-wide">Place label<input id="guided-map-pin-' + idx + '-place" value="' + guidedEsc(option.placeLabel || '') + '"></label>'
      + '<label class="is-wide">Region<input id="guided-map-pin-' + idx + '-region" value="' + guidedEsc(option.region || '') + '"></label>'
      + '<label>X' + guidedAuthorMapNumberInput('guided-map-pin-' + idx + '-x', option.x, markerId) + '</label>'
      + '<label>Y' + guidedAuthorMapNumberInput('guided-map-pin-' + idx + '-y', option.y, markerId) + '</label>'
      + '</div>'
      + '<div class="guided-author-map-nudge-box"><strong>Nudge Pin ' + guidedEsc(pin) + '</strong>' + guidedAuthorMapNudgeButtons('guided-map-pin-' + idx + '-x', 'guided-map-pin-' + idx + '-y', markerId, 'Nudge Pin ' + pin) + '</div>'
      + '</div>';
  }).join('');
  return '<div class="guided-card guided-author-map-panel"><div class="guided-section-kicker">Map Questions</div><div class="guided-card-title">' + guidedAuthorHelpTitle('Place A-D quiz pins', 'maps-answer-leak', 'This screen edits the answer pins for Map Pin quiz questions. These pins are not the same as the true study-card location, because three of the four pins are usually wrong answers. Learners should only see Pin A, Pin B, Pin C, and Pin D before they answer. Place names are stored behind the scenes so feedback can explain the answer after submission. If a place name appears on a blank quiz map, that is answer leakage and should be fixed. Use the feedback preview to check labels after the answer, and use Card Map Setup if a card-owned label needs tuning.') + '</div>'
    + guidedAuthorMapsQuestionReturnHTML()
    + '<div class="guided-author-map-setup-groups">'
    + '<section class="guided-author-map-control-group"><div class="guided-author-map-control-head"><div><strong>Select map question</strong><span>Choose which authored Map Pin question you are editing.</span></div></div>' + questionSelector + '</section>'
    + '<section class="guided-author-map-work-surface"><div class="guided-author-map-surface-head"><div><strong>Move A-D answer pins</strong><span>Drag pins on the full atlas, or use X/Y below for exact placement.</span></div></div>' + guidedAuthorMapEditorStage(mapId, overlays) + '</section>'
    + '<section class="guided-author-map-control-group"><div class="guided-author-map-control-head"><div><strong>Check the feedback map</strong><span>This is the revealed map learners see after answering.</span></div></div>' + runtimePreview + questionFeedbackStatus + '</section>'
    + '<section class="guided-author-map-control-group"><div class="guided-author-map-control-head"><div><strong>Tune feedback close view</strong><span>These crop controls affect the feedback preview for this question, not the blank quiz map.</span></div></div>' + questionCropControls + '</section>'
    + '<section class="guided-author-map-control-group"><div class="guided-author-map-control-head"><div><strong>Pin details</strong><span>Place labels are stored for feedback and author review; learner options still read Pin A-D.</span></div></div><div class="guided-author-map-pin-grid">' + pinCards + '</div></section>'
    + '</div>'
    + '<input id="guided-map-question-mapId" type="hidden" value="' + guidedEsc(mapId) + '"><input id="guided-map-question-correct" type="hidden" value="' + guidedEsc(correctIndex) + '">'
    + '<div class="guided-author-actions"><button class="btn btn-gold" onclick="guidedAuthorSaveMapQuestionDraft(\'' + guidedEsc(selected.uid) + '\',\'' + guidedEsc(selected.questionId) + '\')">Save quiz-pin draft</button></div></div>';
}
function guidedAuthorRenderMapsTab() {
  var raw = guidedAuthorMapsRawSidecar();
  if (!raw) {
    return '<div class="guided-card guided-author-start-card"><div class="guided-kicker">Maps</div>'
      + guidedAuthorEmptyState(
        'No active sidecar is saved yet.',
        'Maps can only edit sidecar-owned map metadata. Load, validate, and save a Geography sidecar as active before tuning card locations, labels, or quiz pins.',
        '<button type="button" class="btn btn-gold" onclick="guidedAuthorCoverageOpenSidecars()">Open Sidecars setup</button>'
      )
      + '</div>';
  }
  var sidecar = guidedAuthorMapsSidecarWithDrafts(raw);
  var report = guidedAuthorMapManagerReport(sidecar);
  var mapDrafts = guidedAuthorMapDraftCount();
  var hasMaps = guidedAuthorMapsStoredSidecarHasMaps(sidecar);
  var activeMode = guidedAuthorMapsState.mode || 'locations';
  if (activeMode === 'briefings') activeMode = 'locations';
  var modeIds = guidedAuthorMapModeOptions().map(function(item){ return item[0]; });
  if (modeIds.indexOf(activeMode) === -1) activeMode = 'locations';
  guidedAuthorMapsState.mode = activeMode;
  var modePanel = activeMode === 'library' ? guidedAuthorRenderMapLibraryPanel(sidecar, report)
    : activeMode === 'locations' ? guidedAuthorRenderMapLocationPanel(sidecar, report)
    : activeMode === 'questions' ? guidedAuthorRenderMapQuestionsPanel(sidecar, report)
    : guidedAuthorRenderMapLabelsPanel(sidecar, report);
  return ''
    + '<div class="guided-card guided-author-start-card">'
    +   '<div class="guided-kicker">Maps</div>'
    +   '<div class="guided-card-title">' + guidedAuthorHelpTitle('Tune map data', 'maps-assets', 'Maps edits the map information stored in the active sidecar. It does not redraw the atlas SVG and it does not write directly to the source JSON file. Card Map Setup is the normal place to tune a card’s real location, highlighted label, study zoom, and nearby study labels. Quiz Pins is only for A-D answer pins in Map Pin questions. Advanced Labels is for shared map features such as rivers, seas, regions, and context labels. Save changes as map drafts, then apply/export them from Review Edits when you want to keep them.') + '</div>'
    +   '<div class="guided-card-sub">Edit study-map locations, quiz pins, and shared labels as drafts before applying them.</div>'
    +   guidedAuthorMapsSidecarSelectorHtml(raw)
    +   '<div class="guided-progress-row"><span class="guided-progress-pill">' + guidedEsc(report.maps.length + ' maps') + '</span><span class="guided-progress-pill">' + guidedEsc(report.cardLocations.length + ' card map setups') + '</span><span class="guided-progress-pill">' + guidedEsc(report.mapQuestions.length + ' quiz pin sets') + '</span><span class="guided-progress-pill">' + guidedEsc(report.briefingPanels.length + ' map pages') + '</span><span class="guided-progress-pill' + (report.issues.length ? ' is-warning' : '') + '">' + guidedEsc(report.issues.length + ' issues') + '</span><span class="guided-progress-pill">' + guidedEsc(mapDrafts + ' map drafts') + '</span></div>'
    +   (!hasMaps ? '<div class="guided-author-edit-note is-warning">This sidecar does not contain map metadata. Select the Geography sidecar to use the map manager.</div>' : '')
    + '</div>'
    + (report.issues.length ? '<div class="guided-card guided-author-map-panel is-warning"><div class="guided-section-kicker">Map validation</div>' + report.issues.slice(0, 8).map(function(issue){ return '<div class="guided-author-map-issue"><strong>' + guidedEsc(issue.type || 'issue') + '</strong><span>' + guidedEsc(issue.message || '') + '</span></div>'; }).join('') + (report.issues.length > 8 ? '<div class="guided-author-map-issue"><strong>More</strong><span>' + guidedEsc(report.issues.length - 8) + ' additional issue(s).</span></div>' : '') + '</div>' : '')
    + guidedAuthorRenderMapModeNav(report)
    + modePanel;
}
