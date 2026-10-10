/* TEST-ONLY Leaflet stub — used only for automated verification in an
   offline sandbox with no outbound network access. Never shipped in the
   actual project. Real Leaflet loads from unpkg.com in the deployed/opened
   site.

   Extended for Task 5.4 to support layerGroup()/addLayer()/clearLayers()
   and a spy-able invalidateSize(), in addition to the original
   map/tileLayer/marker support (still used as-is by place-details.js,
   which Task 5.4 does not touch). Tracking globals, all on `window`:
     __STUB_INVALIDATE_SIZE_CALLS__   -> count of invalidateSize() calls
     __STUB_LAYERGROUP_CREATED__      -> count of L.layerGroup() calls (confirms it's used at all)
     __STUB_LAYERGROUP_MARKER_COUNT__ -> markers currently in the group
     __STUB_LAYERGROUP_CLEAR_CALLS__  -> count of clearLayers() calls
     __STUB_MARKER_POPUPS__           -> every popup HTML string ever bound
                                          (across all markers, this page load) */
window.L = (function () {
  function chainable(obj, methods) {
    methods.forEach(function (m) {
      obj[m] = function () { return obj; };
    });
    return obj;
  }

  return {
    map: function (id, opts) {
      const mapObj = chainable({ _stub: "map" }, ["setView", "removeLayer"]);
      mapObj.invalidateSize = function () {
        window.__STUB_INVALIDATE_SIZE_CALLS__ = (window.__STUB_INVALIDATE_SIZE_CALLS__ || 0) + 1;
        return mapObj;
      };
      return mapObj;
    },

    tileLayer: function (url, opts) {
      return chainable({ _stub: "tileLayer" }, ["addTo"]);
    },

    marker: function (coords) {
      const markerObj = chainable({ _stub: "marker", _coords: coords }, ["addTo"]);
      markerObj.bindPopup = function (html) {
        markerObj._popupHtml = html;
        window.__STUB_MARKER_POPUPS__ = window.__STUB_MARKER_POPUPS__ || [];
        window.__STUB_MARKER_POPUPS__.push(html);
        return markerObj;
      };
      return markerObj;
    },

    layerGroup: function () {
      window.__STUB_LAYERGROUP_CREATED__ = (window.__STUB_LAYERGROUP_CREATED__ || 0) + 1;
      const layers = [];
      const groupObj = chainable({ _stub: "layerGroup" }, ["addTo"]);
      groupObj.addLayer = function (layer) {
        layers.push(layer);
        window.__STUB_LAYERGROUP_MARKER_COUNT__ = layers.length;
        return groupObj;
      };
      groupObj.clearLayers = function () {
        layers.length = 0;
        window.__STUB_LAYERGROUP_CLEAR_CALLS__ = (window.__STUB_LAYERGROUP_CLEAR_CALLS__ || 0) + 1;
        window.__STUB_LAYERGROUP_MARKER_COUNT__ = 0;
        return groupObj;
      };
      groupObj.getLayers = function () { return layers.slice(); };
      return groupObj;
    }
  };
})();
