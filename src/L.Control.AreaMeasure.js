L.Control.AreaMeasure = L.Control
		.extend({
			options : {
				position : 'topleft'
			},

			onAdd : function(map) {
				var className = 'leaflet-control-zoom leaflet-bar leaflet-control', container = L.DomUtil
						.create('div', className);

				this
						._createButton(
								'',
								'Area Measure',
								'leaflet-control-area-measure leaflet-bar-part leaflet-bar-part-top-and-bottom',
								container, this._startMeasuring, this);

				return container;
			},

			_createButton : function(html, title, className, container, fn,
					context) {
				var link = L.DomUtil.create('a', className, container);
				link.innerHTML = html;
				link.href = '#';
				link.title = title;

				L.DomEvent.on(link, 'click', L.DomEvent.stopPropagation).on(
						link, 'click', L.DomEvent.preventDefault).on(link,
						'click', fn, context).on(link, 'dblclick',
						L.DomEvent.stopPropagation);

				return link;
			},

			_startMeasuring : function() {
				this._measuring = true;
				L.DomUtil.addClass(this._container,
						'leaflet-control-area-measure-on');
				this._oldCursor = this._map._container.style.cursor;
				this._map._container.style.cursor = 'crosshair';

				this._doubleClickZoom = this._map.doubleClickZoom.enabled();
				this._map.doubleClickZoom.disable();

				L.DomEvent.on(this._map, 'mousemove', this._mouseMove, this)
						.on(this._map, 'click', this._mouseClick, this).on(
								this._map, 'dblclick', this._finishPath, this)
						.on(document, 'keydown', this._onKeyDown, this);

				if (!this._layerPaint) {
					this._layerPaint = L.layerGroup().addTo(this._map);
				}

				if (!this._points) {
					this._points = [];
				}
			},

			_stopMeasuring : function() {
				this._measuring = false;
				L.DomUtil.removeClass(this._container,
						'leaflet-control-area-measure-on');
				this._map._container.style.cursor = this._oldCursor;

				L.DomEvent.off(document, 'keydown', this._onKeyDown, this).off(
						this._map, 'mousemove', this._mouseMove, this).off(
						this._map, 'click', this._mouseClick, this).off(
						this._map, 'dblclick', this._mouseClick, this);

				if (this._doubleClickZoom) {
					this._map.doubleClickZoom.enable();
				}

				if (this._layerPaint) {
					this._layerPaint.clearLayers();
				}

				this._measuring = false;
				this._restartPath();
			},

			_mouseMove : function(e) {
				if (!e.latlng || !this._lastPoint) {
					return;
				}

				if (!this._layerPaintPathTemp) {
					this._layerPaintPathTemp = L.polygon(
							[ this._lastPoint, e.latlng ], {
								color : 'blue',
								weight : 2,
								clickable : false,
								dashArray : '6,3'
							}).addTo(this._layerPaint);
				} else {
					this._layerPaintPathTemp.spliceLatLngs(0, 2,
							this._lastPoint, e.latlng);
				}
			},

			_mouseClick : function(e) {
				// Skip if no coordinates
				if (!e.latlng) {
					return;
				}
				this._lastPoint = e.latlng;
				// If this is already the second click, add the location to the
				// fix path (create one first if we don't have one)
				if (this._lastPoint && !this._layerPaintPath) {
					this._layerPaintPath = L.polygon([ this._lastPoint ], {
						color : 'red',
						weight : 4,
						clickable : false
					}).addTo(this._layerPaint);
				}

				if (this._layerPaintPath) {
					this._layerPaintPath.addLatLng(e.latlng);
				}

				// Upate the end marker to the current location
				if (this._lastCircle) {
					this._layerPaint.removeLayer(this._lastCircle);
				}

				this._lastCircle = new L.CircleMarker(e.latlng, {
					color : 'blue',
					opacity : 1,
					weight : 4,
					fill : true,
					fillOpacity : 1,
					radius : 2,
					clickable : this._lastCircle ? true : false
				}).addTo(this._layerPaint);

				this._lastCircle.on('click', function() {
					this._finishPath();
				}, this);

			},

			_finishPath : function() {
				if (this._layerPaintPath) {
					var points = this._layerPaintPath.getLatLngs();
					var pointsCount = points.length;
					if (pointsCount >= 3) {
						this._area = L.GeometryUtil
								.geodesicArea(this._layerPaintPath.getLatLngs());
					}
				}
				if (this._lastCircle) {
					this._createTooltip(this._lastCircle.getLatLng());
					this._updateTooltipArea(this._area);
					var icon = L.icon({
						iconUrl : 'images/close.png',
						iconAnchor : [ 0, 24 ]
					});
					this._closeButton = new L.Marker(this._lastCircle
							.getLatLng(), {
						icon : icon
					}).addTo(this._layerPaint);

					this._closeButton.on('click', function() {
						this._stopMeasuring();
					}, this);
				}
				// Remove the last end marker as well as the last (moving
				// tooltip)
				if (this._lastCircle) {
					this._layerPaint.removeLayer(this._lastCircle);
				}

				if (this._layerPaint && this._layerPaintPathTemp) {
					this._layerPaint.removeLayer(this._layerPaintPathTemp);
				}

				this._map._container.style.cursor = this._oldCursor;

				L.DomUtil.removeClass(this._container,
						'leaflet-control-area-measure-on');

				L.DomEvent.off(document, 'keydown', this._onKeyDown, this).off(
						this._map, 'mousemove', this._mouseMove, this).off(
						this._map, 'click', this._mouseClick, this).off(
						this._map, 'dblclick', this._mouseClick, this);

				if (this._doubleClickZoom) {
					this._map.doubleClickZoom.enable();
				}

				// Reset everything
				this._restartPath();
			},

			_restartPath : function() {
				this._area = 0;
				this._tooltip = undefined;
				this._lastCircle = undefined;
				this._lastPoint = undefined;
				this._layerPaintPath = undefined;
				this._layerPaintPathTemp = undefined;
				this._closeButton = undefined;
			},

			_createTooltip : function(position) {
				var icon = L.divIcon({
					className : 'leaflet-area-measure-tooltip',
					iconAnchor : [ -5, -5 ]
				});
				this._tooltip = L.marker(position, {
					icon : icon,
					clickable : false
				}).addTo(this._layerPaint);
			},

			_updateTooltipPosition : function(position) {
				this._tooltip.setLatLng(position);
			},
			_updateTooltipArea : function(area) {
				var text = "Total Area:" + L.GeometryUtil.readableArea(area, true);
				this._tooltip._icon.innerHTML = text;
			},

			_round : function(val) {
				return Math.round(val * 10000) / 10000;
			},

			_onKeyDown : function(e) {
				if (e.keyCode == 27) {
					// If not in path exit measuring mode, else just finish path
					this._finishPath();
				}
			}
		});

L.Map.mergeOptions({
	areaMeasureControl : false
});

L.Map.addInitHook(function() {
	if (this.options.areaMeasureControl) {
		this.areaMeasureControl = new L.Control.AreaMeasure();
		this.addControl(this.areaMeasureControl);
	}
});

L.control.areaMeasure = function(options) {
	return new L.Control.AreaMeasure(options);
};