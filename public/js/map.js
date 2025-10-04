/**
 * Enhanced Map functionality for Airbnb listings
 * Features: Display location, address search, reverse geocoding, interactive markers
 */

class ListingMap {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.apiKey = options.apiKey || window.mapToken || "";
        this.map = null;
        this.marker = null;
        this.options = {
            defaultZoom: 13,
            maxZoom: 19,
            retryAttempts: 3,
            retryDelay: 1000,
            ...options
        };
        this.initializationAttempts = 0;
        this.maxInitAttempts = 3;
        
        this.init();
    }

    init() {
        this.initializationAttempts++;
        
        if (typeof L === "undefined") {
            if (this.initializationAttempts < this.maxInitAttempts) {
                console.warn(`Leaflet library not loaded yet, attempt ${this.initializationAttempts}/${this.maxInitAttempts}`);
                setTimeout(() => this.init(), 500);
                return;
            } else {
                this.showError("Map library failed to load. Please refresh the page.");
                return;
            }
        }
        
        if (!this.container) {
            console.error("Map container not found:", this.containerId);
            return;
        }

        try {
            // Get coordinates from data attributes with validation (Bhubaneswar as default)
            const lat = this.validateCoordinate(this.container.getAttribute("data-lat"), 20.2960, -90, 90);
            const lon = this.validateCoordinate(this.container.getAttribute("data-lon"), 85.8246, -180, 180);
            
            this.createMap(lat, lon);
            this.addTileLayer();
            this.addMarker(lat, lon);
            this.addMapControls();
            
            console.log(`Map initialized successfully at coordinates: ${lat}, ${lon}`);
        } catch (error) {
            console.error("Map initialization failed:", error);
            this.showError("Failed to initialize map. Please try refreshing the page.");
        }
    }

    createMap(lat, lon) {
        this.map = L.map(this.containerId, {
            center: [lat, lon],
            zoom: this.options.defaultZoom,
            zoomControl: true,
            scrollWheelZoom: true
        });

        // Add map click handler for reverse geocoding
        this.map.on('click', (e) => {
            this.onMapClick(e);
        });

        // Add visual indicators for clickable map
        if (this.options.enableClickGeocoding) {
            this.addClickableMapStyles();
        } else {
            this.addNonClickableStyles();
        }
    }

    // Add styles to indicate map is clickable
    addClickableMapStyles() {
        const mapContainer = this.map.getContainer();
        
        // Add cursor pointer on hover
        mapContainer.style.cursor = 'crosshair';
        
        // Add hover effect
        mapContainer.addEventListener('mouseenter', () => {
            mapContainer.style.cursor = 'crosshair';
        });
        
        // Reset cursor when dragging
        this.map.on('dragstart', () => {
            mapContainer.style.cursor = 'grabbing';
        });
        
        this.map.on('dragend', () => {
            mapContainer.style.cursor = 'crosshair';
        });
        
        // Show help tooltip on first load
        setTimeout(() => {
            this.showClickHelpTooltip();
        }, 2000);
    }

    // Add visual indicator when pin dropping is disabled
    addNonClickableStyles() {
        // Add a subtle overlay message for non-owners on listing view
        if (window.location.pathname.includes('/listings/') && !window.location.pathname.includes('/edit')) {
            const infoOverlay = document.createElement('div');
            infoOverlay.className = 'map-info-overlay';
            infoOverlay.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 0.85rem;
                z-index: 1000;
                pointer-events: none;
            `;
            infoOverlay.innerHTML = '<i class="fas fa-map-marker-alt"></i> Listing Location';
            
            this.container.style.position = 'relative';
            this.container.appendChild(infoOverlay);
        }
    }

    // Show temporary help tooltip
    showClickHelpTooltip() {
        if (document.querySelector('.click-help-tooltip')) return; // Don't show if already exists
        
        const tooltip = document.createElement('div');
        tooltip.className = 'click-help-tooltip alert alert-info position-absolute';
        tooltip.style.cssText = `
            top: 50px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
            max-width: 280px;
            text-align: center;
            font-size: 0.875rem;
        `;
        tooltip.innerHTML = `
            <i class="fas fa-hand-pointer"></i>
            <strong>Click anywhere on the map</strong><br>
            <small>to drop a pin and set the location</small>
            <button type="button" class="btn-close btn-close-sm ms-2" onclick="this.parentElement.remove()"></button>
        `;
        
        this.container.style.position = 'relative';
        this.container.appendChild(tooltip);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.style.opacity = '0';
                tooltip.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    if (tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                }, 300);
            }
        }, 5000);
    }

    addTileLayer() {
        // Use street map only
        const streetMapUrl = this.apiKey
            ? `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${this.apiKey}`
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

        const attribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
            (this.apiKey ? ', © <a href="https://www.geoapify.com/">Geoapify</a>' : '');

        const tileLayerOptions = {
            attribution: attribution,
            maxZoom: this.options.maxZoom,
            // Performance optimizations
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2,
            // Enable retina tiles if available
            detectRetina: true,
            // Tile loading optimizations
            crossOrigin: true,
            // Error handling
            errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        };

        // Create and add street map layer
        const streetLayer = L.tileLayer(streetMapUrl, tileLayerOptions).addTo(this.map);
        this.currentTileLayer = streetLayer;

        // Track tile loading for performance monitoring
        let tilesLoaded = 0;
        let tilesTotal = 0;

        streetLayer.on('tileloadstart', () => {
            tilesTotal++;
        });

        streetLayer.on('tileload', () => {
            tilesLoaded++;
            if (tilesLoaded === tilesTotal && tilesLoaded > 0) {
                console.log(`Map tiles loaded successfully (${tilesLoaded} tiles)`);
            }
        });

        streetLayer.on('tileerror', (error) => {
            console.warn("Street map tiles failed to load", error);
        });

        // Store layer reference
        this.mapLayers = { street: streetLayer };
    }

    addMarker(lat, lon, options = {}) {
        // Remove existing marker if any
        if (this.marker) {
            this.map.removeLayer(this.marker);
        }

        const markerOptions = {
            draggable: options.draggable || false,
            title: options.title || "Listing Location"
        };

        this.marker = L.marker([lat, lon], markerOptions).addTo(this.map);
        
        const popupContent = options.popupContent || this.createPopupContent(lat, lon);
        this.marker.bindPopup(popupContent);
        
        if (options.openPopup !== false) {
            this.marker.openPopup();
        }

        // Add drag handler if marker is draggable
        if (markerOptions.draggable) {
            this.marker.on('dragend', (e) => {
                const position = e.target.getLatLng();
                this.onMarkerDragEnd(position.lat, position.lng);
            });
        }

        return this.marker;
    }

    createPopupContent(lat, lon) {
        return `
            <div class="map-popup">
                <strong>Listing Location</strong><br>
                <small>Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}</small>
                <br><br>
                <button class="btn btn-sm btn-outline-primary" onclick="listingMap.centerMap(${lat}, ${lon})">
                    <i class="fas fa-crosshairs"></i> Center Map
                </button>
            </div>
        `;
    }

    addMapControls() {
        // Add fullscreen control if available
        if (L.Control && L.Control.Fullscreen) {
            this.map.addControl(new L.Control.Fullscreen());
        }

        // Add scale control
        L.control.scale().addTo(this.map);
    }

    // Handle map click events for pin dropping and reverse geocoding
    async onMapClick(e) {
        if (!this.options.enableClickGeocoding) return;
        
        const { lat, lng } = e.latlng;
        
        // Immediately place a temporary marker
        const tempMarker = L.marker([lat, lng], {
            opacity: 0.7,
            icon: L.icon({
                iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#dc3545" width="30" height="30">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                `),
                iconSize: [30, 30],
                iconAnchor: [15, 30],
                popupAnchor: [0, -30]
            })
        }).addTo(this.map);
        
        // Show loading popup
        const loadingPopup = L.popup()
            .setLatLng(e.latlng)
            .setContent(`
                <div class="click-popup text-center">
                    <div class="spinner-border spinner-border-sm text-primary mb-2" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <br><small>Getting location details...</small>
                </div>
            `)
            .openOn(this.map);
        
        try {
            const address = await this.reverseGeocode(lat, lng);
            
            // Remove temporary marker
            this.map.removeLayer(tempMarker);
            
            // Create popup with location options
            const popupContent = `
                <div class="click-popup">
                    <div class="mb-2">
                        <strong><i class="fas fa-map-marker-alt text-danger"></i> New Location</strong>
                    </div>
                    <div class="mb-2">
                        <small class="text-muted">Address:</small><br>
                        <span class="fw-bold">${address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>
                    </div>
                    <div class="mb-2">
                        <small class="text-muted">Coordinates:</small><br>
                        <code>${lat.toFixed(6)}, ${lng.toFixed(6)}</code>
                    </div>
                    <div class="d-grid gap-2">
                        <button class="btn btn-success btn-sm" onclick="listingMap.confirmLocation(${lat}, ${lng}, '${(address || '').replace(/'/g, "\\'")}')">  
                            <i class="fas fa-check"></i> Use This Location
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="listingMap.map.closePopup()">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </div>
            `;
            
            L.popup()
                .setLatLng(e.latlng)
                .setContent(popupContent)
                .openOn(this.map);
                
        } catch (error) {
            console.error("Reverse geocoding failed:", error);
            
            // Remove temporary marker
            this.map.removeLayer(tempMarker);
            
            // Show error popup with coordinates
            const errorPopup = `
                <div class="click-popup">
                    <div class="mb-2">
                        <strong><i class="fas fa-exclamation-triangle text-warning"></i> Location Selected</strong>
                    </div>
                    <div class="mb-2">
                        <small class="text-muted">Could not get address, but you can still use coordinates:</small><br>
                        <code>${lat.toFixed(6)}, ${lng.toFixed(6)}</code>
                    </div>
                    <div class="d-grid gap-2">
                        <button class="btn btn-success btn-sm" onclick="listingMap.confirmLocation(${lat}, ${lng}, 'Custom Location')">
                            <i class="fas fa-check"></i> Use These Coordinates
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="listingMap.map.closePopup()">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </div>
            `;
            
            L.popup()
                .setLatLng(e.latlng)
                .setContent(errorPopup)
                .openOn(this.map);
        }
    }

    // Handle marker drag end
    async onMarkerDragEnd(lat, lng) {
        try {
            const address = await this.reverseGeocode(lat, lng);
            this.updateLocationFields(lat, lng, address);
            
            // Update popup content
            const popupContent = this.createPopupContent(lat, lng);
            this.marker.setPopupContent(popupContent);
        } catch (error) {
            console.error("Failed to update location:", error);
        }
    }

    // Reverse geocoding function with retry logic
    async reverseGeocode(lat, lng, attempt = 1) {
        if (!this.apiKey) {
            console.warn("API key not available for reverse geocoding");
            return null;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(
                `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${this.apiKey}&format=json`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 429 && attempt <= this.options.retryAttempts) {
                    // Rate limited, retry after delay
                    console.warn(`Rate limited, retrying in ${this.options.retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * attempt));
                    return this.reverseGeocode(lat, lng, attempt + 1);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                return data.results[0].formatted;
            } else {
                console.warn("No geocoding results found for coordinates:", lat, lng);
                return `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error("Geocoding request timed out");
            } else if (attempt <= this.options.retryAttempts && !error.message.includes('429')) {
                console.warn(`Geocoding attempt ${attempt} failed, retrying...`, error.message);
                await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * attempt));
                return this.reverseGeocode(lat, lng, attempt + 1);
            } else {
                console.error("Reverse geocoding error after retries:", error);
            }
        }
        
        return null;
    }

    // Validate coordinate values
    validateCoordinate(value, defaultValue, min, max) {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < min || numValue > max) {
            console.warn(`Invalid coordinate value: ${value}, using default: ${defaultValue}`);
            return defaultValue;
        }
        return numValue;
    }

    // Show error message in the map container
    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="alert alert-danger d-flex align-items-center justify-content-center h-100" style="min-height: 300px;">
                    <div class="text-center">
                        <i class="fas fa-map-marked-alt fa-3x mb-3 text-muted"></i>
                        <h5>Map Error</h5>
                        <p class="mb-0">${message}</p>
                        <button class="btn btn-outline-primary mt-2" onclick="window.location.reload()">
                            <i class="fas fa-redo"></i> Reload Page
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Update form fields with new location data
    updateLocationFields(lat, lng, address) {
        const locationField = document.querySelector('input[name="listing[location]"]');
        const latField = document.querySelector('input[name="listing[latitude]"]');
        const lngField = document.querySelector('input[name="listing[longitude]"]');
        
        if (address && locationField) {
            locationField.value = address;
        }
        
        if (latField) latField.value = lat;
        if (lngField) lngField.value = lng;

        // Trigger change events
        [locationField, latField, lngField].forEach(field => {
            if (field) {
                field.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // Public methods for external use
    centerMap(lat, lng) {
        if (this.map) {
            this.map.setView([lat, lng], this.options.defaultZoom);
        }
    }

    setLocation(lat, lng, address) {
        this.addMarker(lat, lng, {
            popupContent: this.createPopupContent(lat, lng),
            openPopup: true
        });
        this.centerMap(lat, lng);
        this.updateLocationFields(lat, lng, address);
    }

    // Confirm and set location from pin drop
    confirmLocation(lat, lng, address) {
        // Close any open popups
        this.map.closePopup();
        
        // Set the confirmed location
        this.setLocation(lat, lng, address);
        
        // Show success notification
        this.showLocationSetNotification(address);
        
        // Trigger form validation if we're in a form context
        this.triggerFormValidation();
        
        console.log(`Location confirmed: ${address} at ${lat}, ${lng}`);
    }

    // Show success notification for location set
    showLocationSetNotification(address) {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.className = 'alert alert-success alert-dismissible fade show position-fixed';
        notification.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 300px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        `;
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <strong>Location Set!</strong><br>
            <small>${address}</small>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 150);
            }
        }, 4000);
    }

    // Trigger form validation for location fields
    triggerFormValidation() {
        const locationField = document.querySelector('input[name="listing[location]"]');
        if (locationField) {
            // Remove any existing validation classes
            locationField.classList.remove('is-invalid', 'is-valid');
            
            // Add valid class if field has value
            if (locationField.value.trim()) {
                locationField.classList.add('is-valid');
            }
            
            // Trigger validation event
            locationField.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    updateMarkerLocation(lat, lng) {
        if (this.marker) {
            this.marker.setLatLng([lat, lng]);
            this.centerMap(lat, lng);
        }
    }

    // Search for address and update map
    async searchAndSetLocation(address) {
        if (!address || !this.apiKey) return false;

        try {
            const response = await fetch(
                `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&apiKey=${this.apiKey}&limit=1&format=json`
            );
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                const lat = result.lat;
                const lng = result.lon;
                
                this.setLocation(lat, lng, result.formatted);
                return true;
            }
        } catch (error) {
            console.error("Address search failed:", error);
        }
        
        return false;
    }

    // Destroy the map instance
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
            this.marker = null;
        }
    }
}

// Initialize the map efficiently when DOM is ready
let listingMap = null;
let mapInitialized = false;

// Optimized map initialization
function initMap() {
    if (mapInitialized) return;
    
    const mapContainer = document.getElementById("map");
    if (!mapContainer) {
        console.log("Map container not found, skipping map initialization");
        return;
    }
    
    // Check if we're on a page that actually needs the map
    const needsMap = mapContainer.offsetParent !== null; // Check if visible
    if (!needsMap) {
        console.log("Map container not visible, deferring initialization");
        return;
    }
    
    if (typeof L === "undefined") {
        console.warn("Leaflet library not loaded yet");
        // Try again after a short delay
        setTimeout(initMap, 100);
        return;
    }
    
    try {
        mapInitialized = true;
        
        // Check if user can edit this listing (for pin dropping)
        const canEdit = window.canEditListing || false;
        const isEditPage = window.location.pathname.includes('/edit') || window.location.pathname.includes('/new');
        
        listingMap = new ListingMap("map", {
            apiKey: window.mapToken || "",
            defaultZoom: 13,
            enableClickGeocoding: canEdit && isEditPage, // Only enable for owners on edit/new pages
            // Performance optimizations
            preferCanvas: true,
            updateWhenIdle: true
        });
        
        // Make it globally accessible
        window.listingMap = listingMap;
        
        console.log("Map initialized successfully");
    } catch (error) {
        console.error("Failed to initialize map:", error);
        mapInitialized = false; // Allow retry
    }
}

// Use different initialization strategies based on page load state
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
} else if (document.readyState === 'interactive' || document.readyState === 'complete') {
    // DOM is already ready
    if (typeof L !== 'undefined') {
        initMap();
    } else {
        // Wait for Leaflet to load
        const checkLeaflet = setInterval(() => {
            if (typeof L !== 'undefined') {
                clearInterval(checkLeaflet);
                initMap();
            }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkLeaflet);
            if (!mapInitialized) {
                console.error("Timeout waiting for Leaflet library to load");
            }
        }, 10000);
    }
}

// Expose initialization function for manual triggering
window.initMap = initMap;
