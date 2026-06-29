// StudyDeck Guided map helpers.
// Loaded before app.js by index.html; intentionally uses classic-script globals.
// Contains shared map metadata normalization, zoom/crop, label-collision, and Map Pin render helpers.

function guidedNormalizeMapId(value) {
  var key = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!key) return '';
  if (key === 'atlas' || key === 'bible_atlas' || key === 'bible_world' || key === 'bible_world_atlas' || key === 'master_atlas' || key === 'geography_master_atlas_v1' || key === 'geography_bible_atlas_v1') return 'geography_bible_atlas_v1';
  if (key === 'israel' || key === 'israel_inset' || key === 'southern_levant' || key === 'southern_levant_inset' || key === 'geography_israel_inset_v1') return 'geography_israel_inset_v1';
  if (key === 'galilee' || key === 'galilee_inset' || key === 'geography_galilee_inset_v1') return 'geography_galilee_inset_v1';
  if (key === 'geography_world_overview_v1') return 'geography_world_overview_v1';
  if (key === 'world' || key === 'world_overview' || key === 'eastern_mediterranean') return 'geography_bible_atlas_v1';
  return key;
}
function guidedMapAssetForId(mapId) {
  mapId = guidedNormalizeMapId(mapId);
  var assets = {
    geography_bible_atlas_v1: 'assets/maps/geography-bible-atlas-v1.svg',
    geography_galilee_inset_v1: 'assets/maps/geography-galilee-inset-v1.svg',
    geography_israel_inset_v1: 'assets/maps/geography-israel-inset-v1.svg',
    geography_world_overview_v1: 'assets/maps/geography-world-overview-v1.svg'
  };
  return assets[mapId] || '';
}
function guidedMapConfigForId(mapId) {
  mapId = guidedNormalizeMapId(mapId);
  if (!mapId) return null;
  var sidecars = guidedSidecarStore && Array.isArray(guidedSidecarStore.sidecars) ? guidedSidecarStore.sidecars : [];
  for (var i = 0; i < sidecars.length; i += 1) {
    var maps = sidecars[i] && sidecars[i].guidedLearning && sidecars[i].guidedLearning.maps;
    var found = null;
    if (maps && !Array.isArray(maps) && typeof maps === 'object') found = maps[mapId];
    if (!found && Array.isArray(maps)) {
      found = maps.find(function(map){ return guidedNormalizeMapId(map && (map.id || map.mapId || map.key)) === mapId; });
    }
    if (found && typeof found === 'object') return found;
  }
  var asset = guidedMapAssetForId(mapId);
  return asset ? { id: mapId, asset: asset, placeLabels: [], landmarkLabels: [] } : null;
}
function guidedMapLabelZoomViews(value, fallback) {
  var allowed = {};
  function add(view) {
    view = String(view || '').trim().toLowerCase();
    if (['full', 'region', 'area', 'close'].indexOf(view) !== -1) allowed[view] = true;
  }
  if (Array.isArray(value)) value.forEach(add);
  else if (typeof value === 'string') value.split(/[\s,|/]+/).forEach(add);
  else if (value && typeof value === 'object') Object.keys(value).forEach(function(key){ if (value[key]) add(key); });
  if (!Object.keys(allowed).length) {
    (fallback || ['full', 'region', 'area', 'close']).forEach(add);
  }
  return Object.keys(allowed);
}
function guidedMapLabelAnchor(value) {
  var key = String(value || '').trim().toLowerCase();
  if (key === 'start') key = 'left';
  if (key === 'end') key = 'right';
  if (key !== 'left' && key !== 'right') key = 'center';
  return key;
}
function guidedMapLabelAnchorTranslate(value) {
  var anchor = guidedMapLabelAnchor(value);
  if (anchor === 'left') return '0%';
  if (anchor === 'right') return '-100%';
  return '-50%';
}
function guidedMapLabelPriority(item, meta) {
  item = item || {};
  var crowdingPriority = Number(item.labelPriority != null ? item.labelPriority : item.crowdingPriority);
  var level = guidedMapLabelLevel(item);
  var raw = Number.isFinite(crowdingPriority)
    ? Math.max(1, Math.min(10, Math.round(crowdingPriority))) * 10
    : item.priority != null
      ? item.priority
      : level != null
        ? level * 10
        : null;
  var priority = Number(raw);
  if (!Number.isFinite(priority)) {
    priority = meta && meta.kind === 'place' ? 50 : 25;
  }
  if (meta && meta.requested) priority += 30;
  if (meta && meta.current) priority += 55;
  if (meta && meta.selected) priority += 40;
  return Math.max(0, Math.min(999, Math.round(priority)));
}
function guidedMapLabelLevel(item) {
  var raw = item && (item.labelLevel != null ? item.labelLevel : item.level);
  var level = Number(raw);
  if (!Number.isFinite(level)) return null;
  return Math.max(1, Math.min(10, Math.round(level)));
}
function guidedMapLabelZoomViewsForLevel(level) {
  level = Number(level);
  if (!Number.isFinite(level)) return [];
  var views = [];
  if (level >= 8) views.push('full');
  if (level >= 6) views.push('region');
  if (level >= 3) views.push('area');
  if (level >= 1) views.push('close');
  return views;
}
function guidedMapLabelSemanticKind(item, meta) {
  item = item || {};
  meta = meta || {};
  var raw = item.semanticType || item.labelType || item.kind || item.type || '';
  var label = guidedTextFromFieldValue(item.label || item.name || item.placeLabel);
  var key = normalizeQuizOptionKey(raw || '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  var labelKey = normalizeQuizOptionKey(label || '');
  if (key === 'place' || key === 'city' || key === 'exact') return 'place';
  if (key === 'river' || key === 'stream' || key === 'waterway') return 'river';
  if (key === 'water' || key === 'sea' || key === 'lake' || key === 'gulf' || key === 'body_of_water') return 'water';
  if (key === 'region' || key === 'territory' || key === 'country' || key === 'peninsula') return 'region';
  if (key === 'context' || key === 'broad' || key === 'landmark') return 'context';
  if (/\briver\b/.test(labelKey) || labelKey === 'nile') return 'river';
  if (/\bsea\b|\bgulf\b|\blake\b/.test(labelKey)) return 'water';
  if (/\bpeninsula\b/.test(labelKey) || ['judea', 'galilee', 'lower_galilee', 'mesopotamia', 'egypt'].indexOf(labelKey) !== -1) return 'region';
  if (meta.kind === 'landmark') return 'context';
  return 'place';
}
function guidedMapLabelDefaultZoomViews(semanticKind, meta) {
  meta = meta || {};
  if (meta.current || meta.selected) return ['full', 'region', 'area', 'close'];
  if (semanticKind === 'context') return ['full', 'region'];
  if (semanticKind === 'region') return meta.requested ? ['region', 'area', 'close'] : ['full', 'region', 'area'];
  if (semanticKind === 'river' || semanticKind === 'water') return meta.requested ? ['region', 'area', 'close'] : ['full', 'region', 'area'];
  return meta.requested ? ['full', 'region', 'area', 'close'] : ['full', 'region', 'area'];
}
function guidedMapLabelStableId(mapId, kind, index, label) {
  var labelKey = normalizeQuizOptionKey(label || 'label') || 'label';
  return [guidedNormalizeMapId(mapId || 'map'), kind || 'label', index == null ? 0 : index, labelKey].join('__');
}
function guidedMapLabelTextKey(value) {
  return normalizeQuizOptionKey(guidedTextFromFieldValue(value && typeof value === 'object' ? (value.label || value.name || value.placeLabel) : value) || '');
}
function guidedMapFindConfiguredLabel(mapId, labelText) {
  var config = guidedMapConfigForId(mapId);
  var key = normalizeQuizOptionKey(labelText || '');
  if (!config || !key) return null;
  var kinds = ['placeLabels', 'landmarkLabels'];
  for (var k = 0; k < kinds.length; k += 1) {
    var kind = kinds[k];
    var items = Array.isArray(config[kind]) ? config[kind] : [];
    for (var i = 0; i < items.length; i += 1) {
      if (guidedMapLabelTextKey(items[i]) === key) {
        return {
          item: items[i],
          kind: kind === 'landmarkLabels' ? 'landmark' : 'place',
          index: i
        };
      }
    }
  }
  return null;
}
function guidedMapSidecarCardEntriesForMap(mapId) {
  mapId = guidedNormalizeMapId(mapId);
  if (!mapId) return [];
  var sidecars = guidedSidecarStore && Array.isArray(guidedSidecarStore.sidecars) ? guidedSidecarStore.sidecars : [];
  var out = [];
  var seen = {};
  function addEntry(uid, entry) {
    if (!entry || typeof entry !== 'object') return;
    uid = uid || entry.cardUid || entry.uid || entry.id || '';
    var gl = entry.guidedLearning && typeof entry.guidedLearning === 'object' ? entry.guidedLearning : {};
    var location = guidedNormalizeMapLocation(gl.mapLocation || entry.mapLocation, entry.titleHint || entry.title || uid);
    if (!location || guidedNormalizeMapId(location.mapId) !== mapId) return;
    var key = uid || normalizeQuizOptionKey(location.label || '');
    if (key && seen[key]) return;
    if (key) seen[key] = true;
    out.push({
      uid: uid,
      entry: entry,
      location: location,
      labelKey: normalizeQuizOptionKey(location.label || '')
    });
  }
  function collectCards(cards) {
    if (Array.isArray(cards)) {
      cards.forEach(function(entry, idx){ addEntry(entry && (entry.cardUid || entry.uid || entry.id) || String(idx), entry); });
    } else if (cards && typeof cards === 'object') {
      Object.keys(cards).forEach(function(uid){ addEntry(uid, cards[uid]); });
    }
  }
  sidecars.forEach(function(sidecar){
    collectCards(sidecar && sidecar.cards);
    collectCards(sidecar && sidecar.guidedLearning && sidecar.guidedLearning.cards);
  });
  return out;
}
function guidedMapFindCardLabel(mapId, labelText) {
  var key = normalizeQuizOptionKey(labelText || '');
  if (!key) return null;
  var cards = guidedMapSidecarCardEntriesForMap(mapId);
  for (var i = 0; i < cards.length; i += 1) {
    if (cards[i].labelKey === key) {
      var item = Object.assign({
        cardUid: cards[i].uid,
        kind: guidedMapLabelSemanticKind(cards[i].location, { kind: 'place' })
      }, cards[i].location);
      return {
        item: item,
        kind: 'card',
        index: cards[i].uid || i
      };
    }
  }
  return null;
}
function guidedMapLocationLabelItem(mapId, location) {
  location = location && typeof location === 'object' ? location : null;
  if (!location) return null;
  var label = guidedTextFromFieldValue(location.label || location.name || location.placeLabel);
  var x = Number(location.x);
  var y = Number(location.y);
  if (!label || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  var configured = guidedMapFindCardLabel(mapId, label) || guidedMapFindConfiguredLabel(mapId, label);
  var base = configured && configured.item ? Object.assign({}, configured.item) : {};
  var item = Object.assign({}, base, location);
  item.label = label;
  item.x = Math.max(0, Math.min(100, x));
  item.y = Math.max(0, Math.min(100, y));
  if (!item.kind && configured && configured.kind === 'place') item.kind = 'place';
  if (!item.kind && configured && configured.kind === 'card' && base.kind) item.kind = base.kind;
  if (!item.region && base.region) item.region = base.region;
  return {
    item: item,
    kind: configured && configured.kind || 'place',
    index: configured && configured.index != null ? configured.index : 'current'
  };
}
function guidedMapDisplayLabelText(value, fallback) {
  var raw = null;
  if (value && typeof value === 'object') {
    if (value.displayLabel != null) raw = value.displayLabel;
    else if (value.labelDisplay != null) raw = value.labelDisplay;
    else if (value.mapDisplayLabel != null) raw = value.mapDisplayLabel;
  } else if (value != null) {
    raw = value;
  }
  if (raw == null || raw === '') return fallback || '';
  var text = String(raw)
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(function(line){ return String(line || '').replace(/\s+/g, ' ').trim(); })
    .filter(Boolean)
    .join('\n');
  return text || fallback || '';
}
function guidedMapLabelItemHTML(item, className, meta) {
  item = item || {};
  meta = meta || {};
  var x = Number(item.x);
  var y = Number(item.y);
  var label = guidedTextFromFieldValue(item.label || item.name || item.placeLabel);
  if (!label || !Number.isFinite(x) || !Number.isFinite(y)) return '';
  var displayLabel = guidedMapDisplayLabelText(item, label);
  var clampedX = Math.max(0, Math.min(100, x));
  var clampedY = Math.max(0, Math.min(100, y));
  var rawKind = normalizeQuizOptionKey(item.kind || item.type || '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  var dx = Number(item.labelDx != null ? item.labelDx : (item.dx != null ? item.dx : item.offsetX));
  var dy = Number(item.labelDy != null ? item.labelDy : (item.dy != null ? item.dy : item.offsetY));
  var areaDx = Number.isFinite(dx) ? Math.round(dx * 1.18) : null;
  var areaDy = Number.isFinite(dy) ? Math.round(dy * 1.1) : null;
  var closeDx = Number.isFinite(dx) ? Math.round(dx * 1.55) : null;
  var closeDy = Number.isFinite(dy) ? Math.round(dy * 1.32) : null;
  var labelKind = meta.kind || (className && className.indexOf('landmark') !== -1 ? 'landmark' : 'place');
  var semanticKind = guidedMapLabelSemanticKind(item, meta);
  var labelLevel = guidedMapLabelLevel(item);
  var defaultViews = labelLevel != null
    ? guidedMapLabelZoomViewsForLevel(labelLevel)
    : guidedMapLabelDefaultZoomViews(semanticKind, meta);
  var zoomViews = guidedMapLabelZoomViews((meta.current || meta.selected) ? null : item.zoomViews, defaultViews);
  var priority = guidedMapLabelPriority(item, { kind: labelKind, requested: !!meta.requested, current: !!meta.current, selected: !!meta.selected });
  var stableId = guidedMapLabelStableId(meta.mapId, labelKind, meta.index, label);
  var anchor = guidedMapLabelAnchor(item.labelAnchor || item.anchor);
  var draggable = !!(meta.selected || meta.draggable);
  var dragPrefix = meta.dragPrefix || 'guided-map-label';
  var hasCardAnchorDot = labelKind === 'card' && !meta.current && semanticKind === 'place';
  var anchorDot = hasCardAnchorDot
    ? '<span class="guided-map-card-anchor-dot" data-map-label-anchor-dot-for="' + guidedEsc(stableId) + '" aria-hidden="true" style="--x:' + guidedEsc(clampedX) + ';--y:' + guidedEsc(clampedY) + ';"></span>'
    : '';
  return ''
    + anchorDot
    + '<span class="' + className + (rawKind ? ' is-' + guidedEsc(rawKind) : '') + ' is-semantic-' + guidedEsc(semanticKind) + (meta.current ? ' is-current-location-label' : '') + (meta.selected ? ' is-selected-label' : '') + '" data-map-label-id="' + guidedEsc(stableId) + '" data-map-label-kind="' + guidedEsc(labelKind) + '" data-map-label-semantic-kind="' + guidedEsc(semanticKind) + '" data-map-label-level="' + guidedEsc(labelLevel != null ? labelLevel : '') + '" data-map-label-priority="' + guidedEsc(priority) + '" data-map-label-zoom-views="' + guidedEsc(zoomViews.join(',')) + '" data-map-label-anchor="' + guidedEsc(anchor) + '" data-map-label-text="' + guidedEsc(label) + '" data-map-label-display-text="' + guidedEsc(displayLabel) + '" style="--x:' + guidedEsc(clampedX) + ';--y:' + guidedEsc(clampedY) + ';--label-anchor-x:' + guidedEsc(guidedMapLabelAnchorTranslate(anchor)) + ';'
    +   (Number.isFinite(dx) ? '--label-dx:' + guidedEsc(dx) + 'px;' : '')
    +   (Number.isFinite(dy) ? '--label-dy:' + guidedEsc(dy) + 'px;' : '')
    +   (areaDx != null ? '--label-dx-area:' + guidedEsc(areaDx) + 'px;' : '')
    +   (areaDy != null ? '--label-dy-area:' + guidedEsc(areaDy) + 'px;' : '')
    +   (closeDx != null ? '--label-dx-close:' + guidedEsc(closeDx) + 'px;' : '')
    +   (closeDy != null ? '--label-dy-close:' + guidedEsc(closeDy) + 'px;' : '')
    + '">'
    +   '<span class="guided-map-label-text"' + (draggable ? ' data-guided-map-label-drag="1" data-guided-map-label-drag-prefix="' + guidedEsc(dragPrefix) + '" onpointerdown="guidedAuthorMapStartLabelTextDrag(event)" title="Drag label text"' : '') + '>' + guidedEsc(displayLabel) + '</span>'
    + '</span>';
}
function guidedRenderMapLabelLayer(mapId, options) {
  options = options || {};
  var config = guidedMapConfigForId(mapId);
  if (!config) return '';
  function normalizeWanted(values) {
    var out = {};
    guidedAuthoredChallengeValueList(values).forEach(function(value){
      var label = guidedTextFromFieldValue(value && typeof value === 'object' ? (value.label || value.name || value.placeLabel) : value);
      var key = normalizeQuizOptionKey(label || '');
      if (key) out[key] = true;
    });
    return out;
  }
  function filterItems(items, wantedValues) {
    items = Array.isArray(items) ? items : [];
    var wanted = normalizeWanted(wantedValues);
    var wantedKeys = Object.keys(wanted);
    return items.filter(function(item){
      var label = guidedTextFromFieldValue(item && (item.label || item.name || item.placeLabel));
      var key = normalizeQuizOptionKey(label || '');
      if (exclude[key]) return false;
      return !wantedKeys.length || !!wanted[key];
    });
  }
  function renderCardLabels(wantedValues, requested, kindHint) {
    var wanted = normalizeWanted(wantedValues);
    var wantedKeys = Object.keys(wanted);
    var cards = guidedMapSidecarCardEntriesForMap(mapId);
    return cards.map(function(card, idx){
      var key = card.labelKey;
      if (exclude[key] || rendered[key]) return '';
      if (wantedKeys.length && !wanted[key]) return '';
      rendered[key] = true;
      var item = Object.assign({}, card.location);
      item.kind = item.kind || guidedMapLabelSemanticKind(item, { kind: 'place' });
      var labelKind = kindHint || 'card';
      return guidedMapLabelItemHTML(item, 'guided-map-label guided-map-place-label', {
        mapId: mapId,
        kind: labelKind,
        index: card.uid || ('card_' + idx),
        requested: requested,
        current: !!(currentPlaceKey && currentPlaceKey === key)
      });
    }).join('');
  }
  var html = '';
  var exclude = normalizeWanted(options.excludeLabels || options.excludePlaceLabels);
  var rendered = {};
  var requestedLandmarks = Object.keys(normalizeWanted(options.landmarkLabels)).length > 0;
  var requestedPlaces = Object.keys(normalizeWanted(options.placeLabels)).length > 0;
  var currentPlaceKey = normalizeQuizOptionKey(options.currentPlaceLabel || options.currentLabel || '');
  if (options.landmarks || options.landmarkLabels) {
    html += renderCardLabels(options.landmarkLabels, requestedLandmarks, 'card');
    html += filterItems(config.landmarkLabels, options.landmarkLabels).map(function(item, idx){
      var label = guidedTextFromFieldValue(item && (item.label || item.name || item.placeLabel));
      var key = normalizeQuizOptionKey(label || '');
      if (rendered[key] || guidedMapFindCardLabel(mapId, label)) return '';
      rendered[key] = true;
      return guidedMapLabelItemHTML(item, 'guided-map-label guided-map-landmark-label', {
        mapId: mapId,
        kind: 'landmark',
        index: idx,
        requested: requestedLandmarks
      });
    }).join('');
  }
  if (options.places || options.placeLabels) {
    html += renderCardLabels(options.placeLabels, requestedPlaces, 'card');
    html += filterItems(config.placeLabels, options.placeLabels).map(function(item, idx){
      var label = guidedTextFromFieldValue(item && (item.label || item.name || item.placeLabel));
      var key = normalizeQuizOptionKey(label || '');
      if (rendered[key] || guidedMapFindCardLabel(mapId, label)) return '';
      rendered[key] = true;
      return guidedMapLabelItemHTML(item, 'guided-map-label guided-map-place-label', {
        mapId: mapId,
        kind: 'place',
        index: idx,
        requested: requestedPlaces,
        current: !!(currentPlaceKey && currentPlaceKey === normalizeQuizOptionKey(label || ''))
      });
    }).join('');
  }
  return html ? '<div class="guided-map-label-layer" aria-hidden="true">' + html + '</div>' : '';
}
function guidedRenderCurrentMapLocationLabel(mapId, location, meta) {
  var html = guidedRenderCurrentMapLocationLabelItem(mapId, location, meta);
  return html ? '<div class="guided-map-label-layer" aria-hidden="true">' + html + '</div>' : '';
}
function guidedRenderCurrentMapLocationLabelItem(mapId, location, meta) {
  var resolved = guidedMapLocationLabelItem(mapId, location);
  if (!resolved) return '';
  meta = meta || {};
  return guidedMapLabelItemHTML(resolved.item, resolved.kind === 'landmark' ? 'guided-map-label guided-map-landmark-label' : 'guided-map-label guided-map-place-label', {
      mapId: mapId,
      kind: resolved.kind,
      index: resolved.index,
      current: true,
      draggable: !!meta.draggable,
      dragPrefix: meta.dragPrefix || 'guided-map-location'
    })
    ;
}
function guidedNormalizeMapLocation(value, fallbackLabel) {
  if (!value || typeof value !== 'object') return null;
  var mapId = guidedNormalizeMapId(value.mapId || value.map || value.id);
  var x = Number(value.x);
  var y = Number(value.y);
  if (!mapId || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  x = Math.max(0, Math.min(100, x));
  y = Math.max(0, Math.min(100, y));
  var out = {
    mapId: mapId,
    x: x,
    y: y,
    label: guidedTextFromFieldValue(value.label) || guidedTextFromFieldValue(value.name) || fallbackLabel || '',
    region: guidedTextFromFieldValue(value.region) || ''
  };
  var displayLabel = guidedMapDisplayLabelText(value, '');
  if (displayLabel && displayLabel !== out.label) out.displayLabel = displayLabel;
  if (value.labelDx !== undefined && value.labelDx !== '') out.labelDx = Math.max(-180, Math.min(180, Math.round(Number(value.labelDx) || 0)));
  if (value.labelDy !== undefined && value.labelDy !== '') out.labelDy = Math.max(-180, Math.min(180, Math.round(Number(value.labelDy) || 0)));
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
  if (value.crop && typeof value.crop === 'object') out.crop = Object.assign({}, value.crop);
  if (value.placeLabels !== undefined || value.places !== undefined || value.labels !== undefined) {
    out.placeLabels = guidedTextArrayFromChallengeField(value.placeLabels || value.places || value.labels);
  }
  if (value.landmarkLabels !== undefined || value.landmarks !== undefined) {
    out.landmarkLabels = guidedTextArrayFromChallengeField(value.landmarkLabels || value.landmarks);
  }
  if (value.cropPlaceLabels !== undefined) out.cropPlaceLabels = guidedTextArrayFromChallengeField(value.cropPlaceLabels);
  if (value.cropLandmarkLabels !== undefined) out.cropLandmarkLabels = guidedTextArrayFromChallengeField(value.cropLandmarkLabels);
  if (value.includeLabelsInCrop === true) out.includeLabelsInCrop = true;
  return out;
}
function guidedNormalizeMapPinOptions(entry, card) {
  entry = entry || {};
  var mapId = guidedNormalizeMapId(entry.mapId || entry.map || entry.mapKey);
  var correctLabel = guidedTextFromFieldValue(entry.answer)
    || guidedTextFromFieldValue(entry.correctAnswer)
    || guidedTextFromFieldValue(entry.correctLabel);
  var options = Array.isArray(entry.mapOptions) ? entry.mapOptions.slice() : [];
  var normalized = options.map(function(option, index){
    var pinLabel = guidedTextFromFieldValue(option && (option.pinLabel || option.pin || option.letter)) || guidedLettersForIndex(index);
    var rawLabel = guidedTextFromFieldValue(option && option.label) || '';
    var placeLabel = guidedTextFromFieldValue(option && (option.placeLabel || option.name || option.place || option.value)) || rawLabel || '';
    var learnerLabel = /^pin\s+[a-z0-9]+$/i.test(rawLabel) ? rawLabel : ('Pin ' + pinLabel);
    var optionMapId = guidedNormalizeMapId(option && (option.mapId || option.map) || mapId);
    var x = Number(option && option.x);
    var y = Number(option && option.y);
    if (!placeLabel || !optionMapId || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    var correct = guidedChallengeOptionIsCorrect(option)
      || (correctLabel && normalizeQuizOptionKey(placeLabel) === normalizeQuizOptionKey(correctLabel));
    return {
      label: learnerLabel,
      pinLabel: pinLabel,
      placeLabel: placeLabel,
      mapId: optionMapId,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      region: guidedTextFromFieldValue(option && option.region) || '',
      correct: !!correct
    };
  }).filter(Boolean);
  if (normalized.length && !normalized.some(function(option){ return option.correct; })) {
    normalized[0].correct = true;
  }
  return normalized;
}

function guidedBriefingMapPanelLabelPoints(mapId, panel) {
  var config = guidedMapConfigForId(mapId);
  if (!config) return [];
  function wantedLookup(values) {
    var lookup = {};
    guidedAuthoredChallengeValueList(values).forEach(function(value){
      var label = guidedTextFromFieldValue(value && typeof value === 'object' ? (value.label || value.name || value.placeLabel) : value);
      var key = normalizeQuizOptionKey(label || '');
      if (key) lookup[key] = true;
    });
    return lookup;
  }
  function collect(items, wantedValues) {
    var wanted = wantedLookup(wantedValues);
    var keys = Object.keys(wanted);
    if (!keys.length) return [];
    return (Array.isArray(items) ? items : []).filter(function(item){
      var label = guidedTextFromFieldValue(item && (item.label || item.name || item.placeLabel));
      return !!wanted[normalizeQuizOptionKey(label || '')];
    }).map(function(item){
      var x = Number(item && item.x);
      var y = Number(item && item.y);
      return Number.isFinite(x) && Number.isFinite(y) ? { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : null;
    }).filter(Boolean);
  }
  function collectCardLabels(wantedValues) {
    var wanted = wantedLookup(wantedValues);
    var keys = Object.keys(wanted);
    if (!keys.length) return [];
    return guidedMapSidecarCardEntriesForMap(mapId).filter(function(card){
      return !!wanted[card.labelKey];
    }).map(function(card){
      var x = Number(card && card.location && card.location.x);
      var y = Number(card && card.location && card.location.y);
      return Number.isFinite(x) && Number.isFinite(y) ? { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : null;
    }).filter(Boolean);
  }
  var crop = panel && panel.crop && typeof panel.crop === 'object' ? panel.crop : {};
  var cropPlaceLabels = panel && panel.cropPlaceLabels;
  var cropLandmarkLabels = panel && panel.cropLandmarkLabels;
  var includeLabels = panel && panel.includeLabelsInCrop === true;
  var includeLandmarks = crop.includeLandmarksInCrop === true || crop.includeLandmarks === true;
  var cropPlaces = includeLabels && !cropPlaceLabels ? panel && panel.placeLabels : cropPlaceLabels;
  var cropLandmarks = cropLandmarkLabels || panel && panel.landmarkLabels;
  return collectCardLabels(cropPlaces)
    .concat(collect(config.placeLabels, cropPlaces))
    .concat((includeLandmarks || cropLandmarkLabels) ? collectCardLabels(cropLandmarks) : [])
    .concat((includeLandmarks || cropLandmarkLabels) ? collect(config.landmarkLabels, cropLandmarks) : []);
}
function guidedNormalizeBriefingMapPanel(value, card) {
  if (value == null) return null;
  if (value === true) value = {};
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  var cardLocation = guidedNormalizeMapLocation(card && card.guidedLearning && card.guidedLearning.mapLocation, guidedLearnFallbackTitle(card));
  var mapId = guidedNormalizeMapId(value.mapId || value.map || value.mapKey || (cardLocation && cardLocation.mapId) || '');
  if (!mapId || !guidedMapAssetForId(mapId)) return null;
  return {
    mapId: mapId,
    useCardLocation: value.useCardLocation !== false,
    placeLabels: guidedTextArrayFromChallengeField(value.placeLabels || value.places || value.labels),
    landmarkLabels: guidedTextArrayFromChallengeField(value.landmarkLabels || value.landmarks),
    cropPlaceLabels: guidedTextArrayFromChallengeField(value.cropPlaceLabels),
    cropLandmarkLabels: guidedTextArrayFromChallengeField(value.cropLandmarkLabels),
    includeLabelsInCrop: value.includeLabelsInCrop === true,
    crop: value.crop && typeof value.crop === 'object' ? Object.assign({}, value.crop) : null
  };
}

function guidedFindCardStudyMapBriefing(card) {
  return guidedLearnBriefingScreensForCard(card).find(function(briefing){
    return !!(briefing && briefing.mapPanel);
  }) || null;
}

function guidedResolveCardStudyMap(card, briefing) {
  if (!card) return null;
  var location = guidedNormalizeMapLocation(card && card.guidedLearning && card.guidedLearning.mapLocation, guidedLearnFallbackTitle(card));
  if (!location) return null;
  var panel = briefing && briefing.mapPanel ? briefing.mapPanel : null;
  if (!panel) {
    var mapBriefing = guidedFindCardStudyMapBriefing(card);
    panel = mapBriefing && mapBriefing.mapPanel ? mapBriefing.mapPanel : null;
  }
  var mapId = guidedNormalizeMapId((location && location.mapId) || (panel && panel.mapId) || '');
  var asset = guidedMapAssetForId(mapId);
  if (!mapId || !asset) return null;
  var placeLabels = Array.isArray(location.placeLabels) && location.placeLabels.length
    ? location.placeLabels.slice()
    : guidedTextArrayFromChallengeField(panel && panel.placeLabels);
  var landmarkLabels = Array.isArray(location.landmarkLabels) && location.landmarkLabels.length
    ? location.landmarkLabels.slice()
    : guidedTextArrayFromChallengeField(panel && panel.landmarkLabels);
  var cropPlaceLabels = Array.isArray(location.cropPlaceLabels) && location.cropPlaceLabels.length
    ? location.cropPlaceLabels.slice()
    : guidedTextArrayFromChallengeField(panel && panel.cropPlaceLabels);
  var cropLandmarkLabels = Array.isArray(location.cropLandmarkLabels) && location.cropLandmarkLabels.length
    ? location.cropLandmarkLabels.slice()
    : guidedTextArrayFromChallengeField(panel && panel.cropLandmarkLabels);
  var crop = location.crop && typeof location.crop === 'object'
    ? Object.assign({}, location.crop)
    : panel && panel.crop && typeof panel.crop === 'object'
      ? Object.assign({}, panel.crop)
      : { minSize: 8, padding: 4 };
  return {
    mapId: mapId,
    asset: asset,
    location: location,
    placeLabels: placeLabels,
    landmarkLabels: landmarkLabels,
    cropPlaceLabels: cropPlaceLabels,
    cropLandmarkLabels: cropLandmarkLabels,
    includeLabelsInCrop: location.includeLabelsInCrop === true || panel && panel.includeLabelsInCrop === true,
    crop: crop,
    panel: panel || null
  };
}

function guidedCardStudyMapLabelPoints(resolved) {
  if (!resolved) return [];
  return guidedBriefingMapPanelLabelPoints(resolved.mapId, {
    placeLabels: resolved.placeLabels,
    landmarkLabels: resolved.landmarkLabels,
    cropPlaceLabels: resolved.cropPlaceLabels,
    cropLandmarkLabels: resolved.cropLandmarkLabels,
    includeLabelsInCrop: resolved.includeLabelsInCrop,
    crop: resolved.crop
  });
}

function guidedMapPinsForQuestion(question) {
  question = question || {};
  var options = (question.options && question.options.length ? question.options : question.mapOptions || []).filter(function(option){
    return option && Number.isFinite(Number(option.x)) && Number.isFinite(Number(option.y));
  });
  var mapId = guidedNormalizeMapId(question.mapId || question.mapLocation && question.mapLocation.mapId || options[0] && options[0].mapId);
  return {
    mapId: mapId,
    asset: guidedMapAssetForId(mapId),
    options: options.map(function(option, idx){
      var pinLabel = option.pinLabel || guidedLettersForIndex(idx);
      var rawLabel = guidedTextFromFieldValue(option.label) || '';
      var placeLabel = guidedTextFromFieldValue(option.placeLabel) || (/^pin\s+[a-z0-9]+$/i.test(rawLabel) ? '' : rawLabel);
      return Object.assign({}, option, {
        pinLabel: pinLabel,
        placeLabel: placeLabel,
        label: /^pin\s+[a-z0-9]+$/i.test(rawLabel) ? rawLabel : ('Pin ' + pinLabel),
        x: Math.max(0, Math.min(100, Number(option.x))),
        y: Math.max(0, Math.min(100, Number(option.y)))
      });
    })
  };
}
function guidedMapPinKey(value) {
  return normalizeQuizOptionKey(value || '').replace(/^pin\s+/, '');
}
function guidedMapCropForPoints(points, options) {
  options = options || {};
  points = (points || []).map(function(point){
    return {
      x: Number(point && point.x),
      y: Number(point && point.y)
    };
  }).filter(function(point){
    return Number.isFinite(point.x) && Number.isFinite(point.y);
  });
  if (!points.length) return { enabled: false, x: 0, y: 0, size: 100, scale: 1 };
  var minX = Math.min.apply(null, points.map(function(point){ return point.x; }));
  var maxX = Math.max.apply(null, points.map(function(point){ return point.x; }));
  var minY = Math.min.apply(null, points.map(function(point){ return point.y; }));
  var maxY = Math.max.apply(null, points.map(function(point){ return point.y; }));
  var padding = Number.isFinite(Number(options.padding)) ? Number(options.padding) : 4;
  var minSize = Number.isFinite(Number(options.minSize)) ? Number(options.minSize) : 10;
  var range = Math.max(maxX - minX, maxY - minY);
  var size = Math.min(100, Math.max(minSize, range + padding * 2));
  var centerX = (minX + maxX) / 2;
  var centerY = (minY + maxY) / 2;
  var x = Math.max(0, Math.min(100 - size, centerX - size / 2));
  var y = Math.max(0, Math.min(100 - size, centerY - size / 2));
  var scale = 100 / size;
  return {
    enabled: scale > 1.08,
    x: x,
    y: y,
    size: size,
    scale: scale
  };
}
function guidedMapCropStyle(crop) {
  crop = crop || { x: 0, y: 0, size: 100, scale: 1 };
  var scale = Number(crop.scale) || 1;
  var left = -Number(crop.x || 0) * scale;
  var top = -Number(crop.y || 0) * scale;
  var width = scale * 100;
  var height = scale * 100;
  return [
    '--map-close-scale:' + guidedEsc(scale.toFixed(5)),
    '--map-close-left:' + guidedEsc(left.toFixed(3)) + '%',
    '--map-close-top:' + guidedEsc(top.toFixed(3)) + '%',
    '--map-close-width:' + guidedEsc(width.toFixed(3)) + '%',
    '--map-close-height:' + guidedEsc(height.toFixed(3)) + '%',
    '--map-view-left:' + guidedEsc(left.toFixed(3)) + '%',
    '--map-view-top:' + guidedEsc(top.toFixed(3)) + '%',
    '--map-view-width:' + guidedEsc(width.toFixed(3)) + '%',
    '--map-view-height:' + guidedEsc(height.toFixed(3)) + '%',
    '--map-crop-x:' + guidedEsc(Number(crop.x || 0).toFixed(3)) + '%',
    '--map-crop-y:' + guidedEsc(Number(crop.y || 0).toFixed(3)) + '%',
    '--map-crop-size:' + guidedEsc(Number(crop.size || 100).toFixed(3)) + '%'
  ].join(';');
}
function guidedMapZoomCropForPercent(closeCrop, percent) {
  closeCrop = closeCrop || { x: 0, y: 0, size: 100, scale: 1 };
  var amount = Math.max(0, Math.min(100, Number(percent))) / 100;
  if (!Number.isFinite(amount)) amount = 1;
  var closeSize = Math.max(1, Math.min(100, Number(closeCrop.size) || 100));
  var size = 100 - ((100 - closeSize) * amount);
  var x = (Number(closeCrop.x) || 0) * amount;
  var y = (Number(closeCrop.y) || 0) * amount;
  var scale = 100 / size;
  return { enabled: closeCrop.enabled, x: x, y: y, size: size, scale: scale };
}
function guidedMapZoomNameForPercent(percent) {
  var value = Math.max(0, Math.min(100, Number(percent)));
  if (!Number.isFinite(value)) value = 100;
  if (value < 18) return 'full';
  if (value < 53) return 'region';
  if (value < 88) return 'area';
  return 'close';
}
function guidedMapZoomPresetValue(preset) {
  var key = String(preset || '').toLowerCase();
  if (key === 'full') return 0;
  if (key === 'region') return 35;
  if (key === 'area') return 70;
  return 100;
}
function guidedMapNonQuizPinScaleForPercent(percent) {
  var amount = Math.max(0, Math.min(100, Number(percent)));
  if (!Number.isFinite(amount)) amount = 100;
  return 0.39 + ((amount / 100) * 0.61);
}
var guidedMapLabelResizeListenerReady = false;
var guidedMapLabelCollisionFrame = 0;
var guidedMapLabelCollisionTimers = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
function guidedMapRectsOverlap(a, b, padding) {
  padding = Number(padding) || 0;
  return !(a.right + padding < b.left || a.left - padding > b.right || a.bottom + padding < b.top || a.top - padding > b.bottom);
}
function guidedMapRectInside(container, rect, padding) {
  padding = Number(padding) || 0;
  return rect.left >= container.left + padding
    && rect.right <= container.right - padding
    && rect.top >= container.top + padding
    && rect.bottom <= container.bottom - padding;
}
function guidedMapScaleRect(rect, scale) {
  var amount = Math.max(0.1, Math.min(1, Number(scale) || 1));
  if (amount >= 0.999) return rect;
  var width = rect.width * amount;
  var height = rect.height * amount;
  var centerX = rect.left + (rect.width / 2);
  var centerY = rect.top + (rect.height / 2);
  return {
    left: centerX - (width / 2),
    right: centerX + (width / 2),
    top: centerY - (height / 2),
    bottom: centerY + (height / 2),
    width: width,
    height: height
  };
}
function guidedMapCollisionZoomScaleForPin(pin) {
  var stage = pin && pin.closest ? pin.closest('.guided-map-stage, .guided-author-map-edit-stage') : null;
  var view = guidedMapCurrentZoomName(stage);
  if (view === 'full') return 0.39;
  if (view === 'region') return 0.60;
  if (view === 'area') return 0.82;
  return 1;
}
function guidedMapCollisionRectForPin(pin) {
  if (!pin || !pin.getBoundingClientRect) return null;
  var rect = pin.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  var scale = 1;
  var zoomScale = guidedMapCollisionZoomScaleForPin(pin);
  if (pin.classList && pin.classList.contains('guided-author-map-editor-pin')) {
    scale = pin.classList.contains('is-primary') || pin.classList.contains('is-label')
      ? Math.max(0.12, 0.26 * zoomScale)
      : Math.max(0.2, 0.42 * zoomScale);
  } else if (pin.classList && (pin.classList.contains('fc-map-pin') || pin.classList.contains('guided-briefing-map-pin'))) {
    scale = 0.58;
  } else if (pin.closest && pin.closest('.guided-map-feedback-panel')) {
    scale = 0.64;
  }
  return guidedMapScaleRect(rect, scale);
}
function guidedMapCurrentZoomName(stage) {
  if (!stage || !stage.classList) return 'close';
  if (stage.classList.contains('is-full')) return 'full';
  if (stage.classList.contains('is-region')) return 'region';
  if (stage.classList.contains('is-area')) return 'area';
  return 'close';
}
function guidedMapStageIsWorthResolving(stage) {
  if (!stage || !stage.getBoundingClientRect || !stage.isConnected) return false;
  var rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  if (typeof window === 'undefined') return true;
  var margin = 240;
  var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  return rect.bottom >= -margin
    && rect.top <= viewportHeight + margin
    && rect.right >= -margin
    && rect.left <= viewportWidth + margin;
}
function guidedMapStatusViewLabel(view) {
  var key = String(view || '').toLowerCase();
  if (key === 'full') return 'Full';
  if (key === 'region') return 'Region';
  if (key === 'area') return 'Area';
  return 'Close';
}
function guidedMapStatusViewList(value) {
  var views = guidedMapLabelZoomViews(value, []);
  if (!views.length) return 'none';
  return views.map(guidedMapStatusViewLabel).join(', ');
}
function guidedMapLabelStatusCopy(label, hidden, reason, view, role) {
  var viewLabel = guidedMapStatusViewLabel(view);
  var roleText = String(role || '').toLowerCase();
  if (!label) {
    if (roleText === 'quiz-pin') {
      return {
        state: 'Unavailable',
        detail: 'Hidden because this Quiz Pins feedback label is listed on an A-D pin, but it is not rendered in the current feedback preview. Check spelling, or make sure the place has a card-owned label or shared map label.'
      };
    }
    return {
      state: 'Unavailable',
      detail: 'Hidden because this label is listed in Card Map Setup, but it is not rendered in the current study-map preview. Check spelling, or make sure it belongs in Other card labels or Reference labels.'
    };
  }
  if (hidden) {
    if (reason === 'pin') {
      if (roleText === 'quiz-pin') {
        return {
          state: 'Hidden by pin',
          detail: 'Hidden because this A-D pin’s feedback label would overlap a visible feedback pin in the ' + viewLabel + ' view. Tune the label in Card Map Setup for that place, or loosen this question’s feedback crop.'
        };
      }
      return {
        state: 'Hidden by pin',
        detail: 'Hidden because this label would overlap a visible pin in the ' + viewLabel + ' view. Move the label offset, use a closer/wider crop, or remove a competing nearby label.'
      };
    }
    if (reason === 'label') {
      if (roleText === 'quiz-pin') {
        return {
          state: 'Hidden by label',
          detail: 'Hidden because a higher-priority feedback label is already using that space in the ' + viewLabel + ' view. Tune one of the card labels, or use a different feedback zoom/crop.'
        };
      }
      return {
        state: 'Hidden by label',
        detail: 'Hidden because a higher-priority label is already using that space in the ' + viewLabel + ' view. Move one label, lower the competing label, or use a different zoom view.'
      };
    }
    if (reason === 'edge') {
      if (roleText === 'quiz-pin') {
        return {
          state: 'Hidden at edge',
          detail: 'Hidden because this feedback label would run outside the question feedback map in the ' + viewLabel + ' view. Move the label inward in Card Map Setup, or loosen this question’s feedback Close size/Padding crop.'
        };
      }
      return {
        state: 'Hidden at edge',
        detail: 'Hidden because the label would run outside the map panel in the ' + viewLabel + ' view. Move the label inward or loosen this card’s Close size/Padding crop.'
      };
    }
    if (reason === 'zoom') {
      var allowedViews = label ? guidedMapStatusViewList(label.getAttribute('data-map-label-zoom-views') || '') : '';
      if (roleText === 'quiz-pin') {
        return {
          state: 'Hidden by zoom',
          detail: 'Hidden because this A-D pin’s feedback label is not allowed in the ' + viewLabel + ' view. It is currently allowed in: ' + allowedViews + '. To show it here, edit that place label and check ' + viewLabel + ' in its zoom views, unless a higher-priority label or pin still needs the space.'
        };
      }
      return {
        state: 'Hidden by zoom',
        detail: 'Hidden because this label is not allowed in the ' + viewLabel + ' view. It is currently allowed in: ' + allowedViews + '. To show it here, check ' + viewLabel + ' in Advanced Labels > Show at zoom levels. A higher-priority label or pin can still hide it if they overlap.'
      };
    }
    return {
      state: 'Hidden',
      detail: 'Hidden because the preview could not keep this label readable at the current zoom. Try changing zoom, crop, or nearby labels.'
    };
  }
  if (reason === 'current') {
    return {
      state: 'Visible: focus',
      detail: 'Visible because this is the selected card’s label. StudyDeck keeps the focus label visible at every zoom level so the learner can tell which pin belongs to the card.'
    };
  }
  if (reason === 'selected') {
    return {
      state: 'Visible: editing',
      detail: 'Visible because this label is selected for editing, so the authoring tool keeps it on screen while you tune it.'
    };
  }
  if (reason === 'callout') {
    return {
      state: 'Visible with callout',
      detail: 'Visible because this is an important focus or selected label. It would normally collide at this zoom, so StudyDeck keeps it visible with callout styling instead of hiding it.'
    };
  }
  var kind = reason || label.getAttribute('data-map-label-semantic-kind') || 'place';
  if (roleText === 'quiz-pin') {
    return {
      state: 'Visible',
      detail: 'Visible because this A-D pin’s feedback label is allowed in the ' + viewLabel + ' view and is not colliding with a feedback pin, another label, or the map edge.'
    };
  }
  var kindText = kind === 'river' ? 'river label'
    : kind === 'water' ? 'water label'
    : kind === 'region' ? 'region label'
    : kind === 'context' ? 'broad context label'
    : roleText === 'reference' ? 'reference label'
    : roleText === 'other-card' ? 'other card label'
    : 'place label';
  return {
    state: 'Visible',
    detail: 'Visible because this ' + kindText + ' is allowed in the ' + viewLabel + ' view and is not colliding with the pin, another label, or the map edge.'
  };
}
function guidedSyncMapCardAnchorDots(stage, labels) {
  if (!stage || !stage.querySelectorAll) return;
  labels = Array.isArray(labels) ? labels : Array.prototype.slice.call(stage.querySelectorAll('.guided-map-label'));
  var byId = {};
  labels.forEach(function(label){
    var id = label.getAttribute('data-map-label-id') || '';
    if (id) byId[id] = label;
  });
  Array.prototype.forEach.call(stage.querySelectorAll('.guided-map-card-anchor-dot'), function(dot){
    var id = dot.getAttribute('data-map-label-anchor-dot-for') || '';
    var label = id ? byId[id] : null;
    var hidden = !label
      || label.classList.contains('is-collision-hidden')
      || label.classList.contains('is-zoom-hidden')
      || label.classList.contains('is-edge-hidden');
    dot.classList.toggle('is-hidden', hidden);
  });
}
function guidedUpdateMapLabelStatusRows(panel, stage) {
  if (!panel || !panel.querySelectorAll || !stage || !stage.querySelectorAll) return;
  var view = guidedMapCurrentZoomName(stage);
  var labels = Array.prototype.slice.call(stage.querySelectorAll('.guided-map-label'));
  var byText = {};
  labels.forEach(function(label){
    var text = String(label.getAttribute('data-map-label-text') || '').trim().toLowerCase();
    if (!text || byText[text]) return;
    byText[text] = label;
  });
  Array.prototype.forEach.call(panel.querySelectorAll('[data-map-status-label-text]'), function(row){
    var scope = row.getAttribute('data-map-status-stage-scope') || '';
    var scopeParent = row.closest ? row.closest('[data-map-status-stage-scope]') : null;
    if (!scope && scopeParent) scope = scopeParent.getAttribute('data-map-status-stage-scope') || '';
    if (scope === 'location-preview' && !(stage.closest && stage.closest('[data-map-location-preview="1"]'))) return;
    if (scope === 'question-preview' && !(stage.closest && stage.closest('[data-map-question-preview="1"]'))) return;
    var key = String(row.getAttribute('data-map-status-label-text') || '').trim().toLowerCase();
    var label = byText[key];
    var state = row.querySelector('.guided-author-map-label-status-state');
    var detail = row.querySelector('.guided-author-map-label-status-detail');
    var role = row.getAttribute('data-map-status-label-role') || '';
    row.classList.remove('is-visible', 'is-hidden');
    if (!label) {
      row.classList.add('is-hidden');
      var missingCopy = guidedMapLabelStatusCopy(null, true, 'missing', view, role);
      if (state) state.textContent = missingCopy.state;
      if (detail) detail.textContent = missingCopy.detail;
      row.dataset.mapStatusReason = 'missing';
      row.dataset.mapStatusView = view;
      return;
    }
    var reason = label.dataset.mapLabelHiddenReason || '';
    var hidden = label.classList.contains('is-collision-hidden') || label.classList.contains('is-zoom-hidden') || label.classList.contains('is-edge-hidden');
    row.classList.add(hidden ? 'is-hidden' : 'is-visible');
    var copy = guidedMapLabelStatusCopy(label, hidden, reason, view, role);
    if (state) state.textContent = copy.state;
    if (detail) detail.textContent = copy.detail;
    row.dataset.mapStatusReason = reason || (hidden ? 'hidden' : 'visible');
    row.dataset.mapStatusView = view;
  });
}
function guidedResolveMapLabelCollisionsForStage(stage) {
  if (!stage || !stage.querySelector) return null;
  if (!guidedMapStageIsWorthResolving(stage)) return null;
  var labels = Array.prototype.slice.call(stage.querySelectorAll('.guided-map-label'));
  if (!labels.length) return null;
  var view = guidedMapCurrentZoomName(stage);
  var stageRect = stage.getBoundingClientRect();
  var authorMapPanel = stage.closest('.guided-author-map-panel');
  var preserveSelectedLabel = !!authorMapPanel;
  var pins = Array.prototype.slice.call(stage.querySelectorAll('.guided-map-pin, .fc-map-pin, .guided-briefing-map-pin, .guided-author-map-editor-pin'));
  var pinRects = pins.map(guidedMapCollisionRectForPin).filter(Boolean);
  var counts = { visible: 0, hiddenCollision: 0, hiddenZoom: 0, hiddenEdge: 0 };
  labels.forEach(function(label){
    label.classList.remove('is-collision-hidden', 'is-zoom-hidden', 'is-edge-hidden', 'is-callout-label');
    label.dataset.mapLabelHiddenReason = '';
  });
  var candidates = labels.map(function(label, index){
    var views = String(label.getAttribute('data-map-label-zoom-views') || '').split(',').map(function(item){ return item.trim(); }).filter(Boolean);
    var priority = Number(label.getAttribute('data-map-label-priority') || 0);
    if (!Number.isFinite(priority)) priority = 0;
    return {
      label: label,
      index: index,
      priority: priority,
      views: views,
      current: label.classList.contains('is-current-location-label'),
      selected: label.classList.contains('is-selected-label')
    };
  }).sort(function(a, b){
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.index - b.index;
  });
  var accepted = [];
  candidates.forEach(function(item){
    var label = item.label;
    if (!item.current && !item.selected && item.views.length && item.views.indexOf(view) === -1) {
      label.classList.add('is-zoom-hidden');
      label.dataset.mapLabelHiddenReason = 'zoom';
      counts.hiddenZoom += 1;
      return;
    }
    var rect = (label.querySelector('.guided-map-label-text') || label).getBoundingClientRect();
    if (!rect.width || !rect.height) {
      counts.hiddenCollision += 1;
      label.classList.add('is-collision-hidden');
      label.dataset.mapLabelHiddenReason = 'empty';
      return;
    }
    var pinCollision = pinRects.some(function(pinRect){ return guidedMapRectsOverlap(rect, pinRect, 3); });
    var edgeCollision = !guidedMapRectInside(stageRect, rect, 4);
    var labelCollision = accepted.some(function(otherRect){ return guidedMapRectsOverlap(rect, otherRect, 3); });
    if (item.current || (item.selected && preserveSelectedLabel)) {
      if (pinCollision || edgeCollision || labelCollision) label.classList.add('is-callout-label');
      label.dataset.mapLabelHiddenReason = item.current ? (label.classList.contains('is-callout-label') ? 'callout' : 'current') : (label.classList.contains('is-callout-label') ? 'callout' : 'selected');
      accepted.push(rect);
      counts.visible += 1;
      return;
    }
    if (edgeCollision) {
      label.classList.add('is-edge-hidden');
      label.dataset.mapLabelHiddenReason = 'edge';
      counts.hiddenEdge += 1;
      return;
    }
    if (pinCollision) {
      label.classList.add('is-collision-hidden');
      label.dataset.mapLabelHiddenReason = 'pin';
      counts.hiddenCollision += 1;
      return;
    }
    if (labelCollision) {
      label.classList.add('is-collision-hidden');
      label.dataset.mapLabelHiddenReason = 'label';
      counts.hiddenCollision += 1;
      return;
    }
    accepted.push(rect);
    label.dataset.mapLabelHiddenReason = label.getAttribute('data-map-label-semantic-kind') || '';
    counts.visible += 1;
  });
  stage.dataset.visibleMapLabels = String(counts.visible);
  stage.dataset.hiddenMapLabelsCollision = String(counts.hiddenCollision);
  stage.dataset.hiddenMapLabelsZoom = String(counts.hiddenZoom);
  stage.dataset.hiddenMapLabelsEdge = String(counts.hiddenEdge);
  var panel = stage.closest('.guided-map-pin-panel, .fc-map-panel, .guided-briefing-map-panel, .guided-author-map-preview-card, .guided-author-map-panel');
  var status = panel && panel.querySelector('.guided-map-collision-status');
  if (status) {
    var hidden = counts.hiddenCollision + counts.hiddenZoom + counts.hiddenEdge;
    status.textContent = counts.visible + ' visible · ' + hidden + ' hidden';
    status.dataset.visibleMapLabels = String(counts.visible);
    status.dataset.hiddenMapLabels = String(hidden);
  }
  if (panel) guidedUpdateMapLabelStatusRows(panel, stage);
  var authorPanel = stage.closest('.guided-author-map-panel');
  if (authorPanel && authorPanel !== panel) guidedUpdateMapLabelStatusRows(authorPanel, stage);
  guidedSyncMapCardAnchorDots(stage, labels);
  return counts;
}
function guidedResolveMapLabelCollisions(scope) {
  var root = scope && scope.querySelector ? scope : document;
  Array.prototype.forEach.call(root.querySelectorAll('.guided-map-stage.is-revealed, .guided-author-map-edit-stage'), function(stage){
    guidedResolveMapLabelCollisionsForStage(stage);
  });
}
function guidedScheduleMapLabelCollisions(scope) {
  if (typeof window === 'undefined' || !document || !document.querySelectorAll) return;
  if (guidedMapLabelCollisionFrame) window.cancelAnimationFrame(guidedMapLabelCollisionFrame);
  guidedMapLabelCollisionFrame = window.requestAnimationFrame(function(){
    guidedMapLabelCollisionFrame = 0;
    guidedResolveMapLabelCollisions(scope || document);
  });
}
function guidedScheduleMapLabelCollisionsAfterZoom(scope) {
  if (typeof window === 'undefined') return;
  var target = scope || document;
  if (guidedMapLabelCollisionTimers && target && typeof target === 'object') {
    var previous = guidedMapLabelCollisionTimers.get(target);
    if (previous) window.clearTimeout(previous);
    guidedMapLabelCollisionTimers.set(target, window.setTimeout(function(){
      guidedMapLabelCollisionTimers.delete(target);
      guidedScheduleMapLabelCollisions(target);
    }, 290));
    return;
  }
  window.setTimeout(function(){
    guidedScheduleMapLabelCollisions(target);
  }, 290);
}
function guidedRefreshMapLabels(element) {
  var panel = element && element.closest ? element.closest('.guided-map-pin-panel, .fc-map-panel, .guided-briefing-map-panel, .guided-author-map-preview-card, .guided-author-map-panel') : null;
  if (!panel) {
    guidedScheduleMapLabelCollisions(document);
    return;
  }
  var slider = panel.querySelector('.guided-map-zoom-slider');
  if (slider) guidedApplyMapZoom(panel, Number(slider.value));
  else guidedScheduleMapLabelCollisions(panel);
}
function guidedEnsureMapLabelResizeListener() {
  if (guidedMapLabelResizeListenerReady || typeof window === 'undefined') return;
  guidedMapLabelResizeListenerReady = true;
  window.addEventListener('resize', function(){
    guidedScheduleMapLabelCollisions(document);
  });
}
function guidedApplyMapZoom(panel, percent) {
  if (!panel || !panel.querySelector) return;
  var stage = panel.querySelector('.guided-map-stage');
  if (!stage) return;
  var closeCrop = {
    enabled: stage.dataset.closeEnabled === 'true',
    x: Number(stage.dataset.closeX) || 0,
    y: Number(stage.dataset.closeY) || 0,
    size: Number(stage.dataset.closeSize) || 100
  };
  closeCrop.scale = 100 / Math.max(1, closeCrop.size);
  var crop = guidedMapZoomCropForPercent(closeCrop, percent);
  var scale = Number(crop.scale) || 1;
  stage.style.setProperty('--map-view-left', (-Number(crop.x || 0) * scale).toFixed(3) + '%');
  stage.style.setProperty('--map-view-top', (-Number(crop.y || 0) * scale).toFixed(3) + '%');
  stage.style.setProperty('--map-view-width', (scale * 100).toFixed(3) + '%');
  stage.style.setProperty('--map-view-height', (scale * 100).toFixed(3) + '%');
  stage.style.setProperty('--map-nonquiz-pin-scale', guidedMapNonQuizPinScaleForPercent(percent).toFixed(3));
  var name = guidedMapZoomNameForPercent(percent);
  ['full', 'region', 'area', 'close'].forEach(function(item){
    panel.classList.toggle('is-' + item, item === name);
    stage.classList.toggle('is-' + item, item === name);
  });
  var slider = panel.querySelector('.guided-map-zoom-slider');
  if (slider && document.activeElement !== slider) slider.value = String(Math.round(Math.max(0, Math.min(100, Number(percent)))));
  Array.prototype.forEach.call(panel.querySelectorAll('.guided-map-zoom-btn'), function(btn){
    var active = guidedMapZoomPresetValue(btn.getAttribute('data-map-zoom-preset')) === guidedMapZoomPresetValue(name);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  var legacyToggle = panel.querySelector('.guided-map-view-toggle');
  if (legacyToggle) {
    var isFull = name === 'full';
    legacyToggle.setAttribute('aria-pressed', isFull ? 'true' : 'false');
    legacyToggle.textContent = isFull ? 'Close view' : 'Context map';
  }
  guidedScheduleMapLabelCollisions(panel);
}
function guidedSetMapZoomPreset(button, preset) {
  var panel = button && button.closest ? button.closest('.guided-map-pin-panel, .fc-map-panel, .guided-briefing-map-panel, .guided-author-map-preview-card') : null;
  guidedApplyMapZoom(panel, guidedMapZoomPresetValue(preset));
}
function guidedSetMapZoomSlider(input) {
  var panel = input && input.closest ? input.closest('.guided-map-pin-panel, .fc-map-panel, .guided-briefing-map-panel, .guided-author-map-preview-card') : null;
  guidedApplyMapZoom(panel, Number(input && input.value));
}
function guidedRenderMapCropRect(crop) {
  return '';
}
function guidedRenderMapZoomControls(crop) {
  if (!crop || !crop.enabled) return '';
  var presets = [
    ['full', 'Full'],
    ['region', 'Region'],
    ['area', 'Area'],
    ['close', 'Close']
  ];
  return ''
    + '<div class="guided-map-zoom-row" onclick="event.stopPropagation()">'
    +   '<div class="guided-map-zoom-presets" role="group" aria-label="Map zoom presets">'
    +     presets.map(function(item){
            var active = item[0] === 'close';
            return '<button type="button" class="guided-map-zoom-btn' + (active ? ' is-active' : '') + '" data-map-zoom-preset="' + guidedEsc(item[0]) + '" onclick="guidedSetMapZoomPreset(this,\'' + guidedEsc(item[0]) + '\')" aria-pressed="' + (active ? 'true' : 'false') + '">' + guidedEsc(item[1]) + '</button>';
          }).join('')
    +   '</div>'
    +   '<input class="guided-map-zoom-slider" type="range" min="0" max="100" step="1" value="100" oninput="guidedSetMapZoomSlider(this)" aria-label="Map zoom">'
    + '</div>';
}
function guidedRenderMapViewToggle(crop) {
  return guidedRenderMapZoomControls(crop);
}
function guidedToggleMapContext(button) {
  var panel = button && button.closest ? button.closest('.guided-map-pin-panel, .fc-map-panel, .guided-briefing-map-panel') : null;
  if (!panel) return;
  var stage = panel.querySelector ? panel.querySelector('.guided-map-stage') : null;
  var context = !(stage && stage.classList.contains('is-full'));
  panel.classList.toggle('is-context', context);
  guidedApplyMapZoom(panel, context ? 0 : 100);
  button.setAttribute('aria-pressed', context ? 'true' : 'false');
  button.textContent = context ? 'Close view' : 'Context map';
}
function guidedRenderMapViewport(map, innerHTML, options) {
  options = options || {};
  guidedEnsureMapLabelResizeListener();
  var crop = guidedMapCropForPoints(options.points || map && map.options || [], options.crop || {});
  return guidedRenderMapZoomControls(crop)
    + '<div class="guided-map-stage is-close' + (options.revealed ? ' is-revealed' : '') + '"' + (options.editable ? ' data-map-stage="1"' : '') + ' data-close-enabled="' + (crop && crop.enabled ? 'true' : 'false') + '" data-close-x="' + guidedEsc(Number(crop.x || 0).toFixed(3)) + '" data-close-y="' + guidedEsc(Number(crop.y || 0).toFixed(3)) + '" data-close-size="' + guidedEsc(Number(crop.size || 100).toFixed(3)) + '" style="' + guidedMapCropStyle(crop) + '">'
    +   '<div class="guided-map-layer-inner">'
    +     '<img src="' + guidedEsc(map.asset) + '" alt="' + guidedEsc(options.alt || 'Map for this location question') + '" onload="guidedRefreshMapLabels(this)">'
    +     (innerHTML || '')
    +     guidedRenderMapCropRect(crop)
    +   '</div>'
    + '</div>';
}
function guidedRenderBriefingMapPanel(card, briefing) {
  var resolved = guidedResolveCardStudyMap(card, briefing);
  if (!resolved) return '';
  var location = resolved.location;
  var points = [location].concat(guidedCardStudyMapLabelPoints(resolved));
  return ''
    + '<div class="guided-briefing-map-panel" onclick="event.stopPropagation()">'
    +   guidedRenderMapViewport({ mapId: resolved.mapId, asset: resolved.asset, options: points }, ''
          + guidedRenderMapLabelLayer(resolved.mapId, {
              placeLabels: resolved.placeLabels,
              landmarkLabels: resolved.landmarkLabels,
              excludeLabels: [location.label]
            })
          + guidedRenderCurrentMapLocationLabel(resolved.mapId, location)
          + '<span class="guided-briefing-map-pin" style="--x:' + guidedEsc(location.x) + ';--y:' + guidedEsc(location.y) + ';" aria-label="' + guidedEsc(location.label || 'Current location') + '"></span>', {
          points: points,
          crop: resolved.crop,
          revealed: true,
          alt: 'Map context for ' + (location.label || 'this location')
        })
    + '</div>';
}
function guidedBriefingWithMapForCard(card) {
  return guidedFindCardStudyMapBriefing(card);
}
function guidedRenderStudyCardMapBlock(card) {
  if (!guidedResolveCardStudyMap(card)) return '';
  var mapHtml = guidedRenderBriefingMapPanel(card, guidedBriefingWithMapForCard(card));
  if (!mapHtml) return '';
  return ''
    + '<details class="guided-study-map-details">'
    +   '<summary><span>Map context</span><strong>View</strong></summary>'
    +   mapHtml
    + '</details>';
}
function guidedRenderMapPinMarkers(map, state) {
  state = state || {};
  var selectedKey = guidedMapPinKey(state.selectedLabel || '');
  var correctKey = guidedMapPinKey(state.correctPinLabel || '');
  return (map.options || []).map(function(option, idx){
    var pinLabel = option.pinLabel || guidedLettersForIndex(idx);
    var pinKey = guidedMapPinKey(pinLabel);
    var labelKey = guidedMapPinKey(option.label || ('Pin ' + pinLabel));
    var selected = selectedKey && (selectedKey === pinKey || selectedKey === labelKey);
    var correct = correctKey && correctKey === pinKey;
    var classes = ['guided-map-pin'];
    if (state.feedback) {
      if (correct) classes.push('is-correct');
      if (selected) classes.push(correct ? 'is-selected-correct' : 'is-selected-wrong');
    }
    if (!state.feedback) {
      return '<button type="button" class="' + classes.join(' ') + ' is-answer-pin" style="--x:' + guidedEsc(option.x) + ';--y:' + guidedEsc(option.y) + ';" data-map-pin-answer="' + idx + '" onclick="guidedAnswerCurrentQuestion(' + idx + ')" aria-label="Select Pin ' + guidedEsc(pinLabel) + '">' + guidedEsc(pinLabel) + '</button>';
    }
    return '<span class="' + classes.join(' ') + '" style="--x:' + guidedEsc(option.x) + ';--y:' + guidedEsc(option.y) + ';" aria-label="Pin ' + guidedEsc(pinLabel) + '">' + guidedEsc(pinLabel) + '</span>';
  }).join('');
}
function guidedRenderMapPinInteraction(question) {
  var map = guidedMapPinsForQuestion(question);
  if (!map.asset || !map.options.length) return guidedRenderChoiceInteraction(question);
  var quizCrop = question && question.crop && typeof question.crop === 'object' && !Array.isArray(question.crop)
    ? question.crop
    : { minSize: 9, padding: 3 };
  return ''
    + '<div class="guided-map-pin-panel">'
    +   guidedRenderMapViewport(map, guidedRenderMapPinMarkers(map), {
          points: map.options,
          crop: quizCrop,
          alt: 'Map for this location question'
        })
    +   '<div class="guided-map-pin-options">' + map.options.map(function(option, idx){
          return '<button class="guided-option guided-map-pin-option" onclick="guidedAnswerCurrentQuestion(' + idx + ')"><span class="guided-option-letter">' + guidedEsc(option.pinLabel || guidedLettersForIndex(idx)) + '</span><span class="guided-option-text">' + guidedEsc(option.label || ('Pin ' + guidedLettersForIndex(idx))) + '</span></button>';
        }).join('') + '</div>'
    + '</div>';
}
function guidedRenderMapPinFeedback(feedback, question) {
  var map = guidedMapPinsForQuestion(question);
  if (!map.asset || !map.options.length) return '';
  var correct = map.options.find(function(option){ return option && option.correct; });
  var feedbackCrop = question && question.crop && typeof question.crop === 'object' ? question.crop : { minSize: 9, padding: 3 };
  return ''
    + '<div class="guided-map-pin-panel guided-map-feedback-panel">'
    +   guidedRenderMapViewport(map, ''
        + guidedRenderMapLabelLayer(map.mapId, { places: true, landmarks: true })
        + guidedRenderMapPinMarkers(map, {
            feedback: true,
            selectedLabel: feedback && feedback.selectedLabel,
            correctPinLabel: correct && correct.pinLabel
          }), {
          points: map.options,
          crop: feedbackCrop,
          revealed: true,
          alt: 'Map with location labels revealed'
        })
    + '</div>';
}
