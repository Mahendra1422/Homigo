/**
 * Address Autocomplete functionality
 * Provides real-time address suggestions as user types
 */

class AddressAutocomplete {
    constructor(inputSelector, options = {}) {
        this.input = document.querySelector(inputSelector);
        this.options = {
            minLength: 2, // Reduced to match backend validation
            delay: 300,
            maxSuggestions: 5,
            apiEndpoint: '/listings/api/address-suggestions',
            onSelect: null,
            onError: null,
            ...options
        };

        this.suggestionsList = null;
        this.currentIndex = -1;
        this.suggestions = [];
        this.debounceTimer = null;
        this.isLoading = false;

        if (this.input) {
            this.init();
        }
    }

    init() {
        this.createSuggestionsList();
        this.bindEvents();
        this.addStyles();
    }

    createSuggestionsList() {
        // Create suggestions dropdown
        this.suggestionsList = document.createElement('ul');
        this.suggestionsList.className = 'address-suggestions';
        this.suggestionsList.style.display = 'none';

        // Insert after the input field
        this.input.parentNode.style.position = 'relative';
        this.input.parentNode.insertBefore(this.suggestionsList, this.input.nextSibling);
    }

    addStyles() {
        // Add CSS styles if not already present
        if (!document.getElementById('address-autocomplete-styles')) {
            const style = document.createElement('style');
            style.id = 'address-autocomplete-styles';
            style.textContent = `
                .address-suggestions {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    z-index: 1000;
                    background: white;
                    border: 1px solid #ddd;
                    border-top: none;
                    border-radius: 0 0 4px 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    max-height: 200px;
                    overflow-y: auto;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }

                .address-suggestion-item {
                    padding: 12px 16px;
                    cursor: pointer;
                    border-bottom: 1px solid #f0f0f0;
                    transition: background-color 0.2s;
                }

                .address-suggestion-item:hover,
                .address-suggestion-item.active {
                    background-color: #f8f9fa;
                }

                .address-suggestion-item:last-child {
                    border-bottom: none;
                }

                .address-suggestion-main {
                    font-weight: 500;
                    color: #333;
                    margin-bottom: 2px;
                }

                .address-suggestion-details {
                    font-size: 0.85em;
                    color: #666;
                }

                .address-loading {
                    padding: 12px 16px;
                    text-align: center;
                    color: #666;
                    font-style: italic;
                }

                .address-no-results {
                    padding: 12px 16px;
                    text-align: center;
                    color: #999;
                    font-style: italic;
                }

                .address-error {
                    padding: 12px 16px;
                    text-align: center;
                    color: #dc3545;
                    font-size: 0.9em;
                }
            `;
            document.head.appendChild(style);
        }
    }

    bindEvents() {
        // Input events
        this.input.addEventListener('input', (e) => this.onInput(e));
        this.input.addEventListener('focus', (e) => this.onFocus(e));
        this.input.addEventListener('blur', (e) => this.onBlur(e));
        this.input.addEventListener('keydown', (e) => this.onKeyDown(e));

        // Document click to close suggestions
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.suggestionsList.contains(e.target)) {
                this.hideSuggestions();
            }
        });
    }

    onInput(e) {
        const query = e.target.value.trim();

        if (query.length < this.options.minLength) {
            this.hideSuggestions();
            return;
        }

        // Debounce the API call
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.fetchSuggestions(query);
        }, this.options.delay);
    }

    onFocus(e) {
        const query = e.target.value.trim();
        if (query.length >= this.options.minLength && this.suggestions.length > 0) {
            this.showSuggestions();
        }
    }

    onBlur(e) {
        // Delay hiding to allow click on suggestions
        setTimeout(() => {
            if (!this.suggestionsList.matches(':hover')) {
                this.hideSuggestions();
            }
        }, 100);
    }

    onKeyDown(e) {
        if (!this.isVisible()) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.moveSelection(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.moveSelection(-1);
                break;
            case 'Enter':
                e.preventDefault();
                this.selectCurrent();
                break;
            case 'Escape':
                e.preventDefault();
                this.hideSuggestions();
                this.input.blur();
                break;
        }
    }

    async fetchSuggestions(query, attempt = 1) {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading();

        try {
            const countryField = document.querySelector('input[name="listing[country]"]');
            const country = countryField ? countryField.value : '';

            const params = new URLSearchParams({
                query: query,
                ...(country && { country: country })
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

            const response = await fetch(`${this.options.apiEndpoint}?${params}`, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 429 && attempt <= 2) {
                    // Rate limited, retry after delay
                    console.warn(`Rate limited, retrying suggestion request...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    return this.fetchSuggestions(query, attempt + 1);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success && data.suggestions) {
                this.suggestions = data.suggestions;
                this.displaySuggestions();
            } else {
                this.showError(data.error || 'No suggestions found');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Address autocomplete request timed out');
                this.showError('Request timed out. Please try again.');
            } else if (attempt <= 2 && !error.message.includes('429')) {
                console.warn(`Address autocomplete attempt ${attempt} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                return this.fetchSuggestions(query, attempt + 1);
            } else {
                console.error('Address autocomplete error:', error);
                this.showError('Unable to load suggestions. Please check your connection.');
            }
            
            if (this.options.onError) {
                this.options.onError(error);
            }
        } finally {
            this.isLoading = false;
        }
    }

    displaySuggestions() {
        this.suggestionsList.innerHTML = '';

        if (this.suggestions.length === 0) {
            this.showNoResults();
            return;
        }

        this.suggestions.forEach((suggestion, index) => {
            const li = document.createElement('li');
            li.className = 'address-suggestion-item';
            li.innerHTML = `
                <div class="address-suggestion-main">${this.escapeHtml(suggestion.address)}</div>
                ${suggestion.city || suggestion.country ? 
                    `<div class="address-suggestion-details">${[suggestion.city, suggestion.country].filter(Boolean).join(', ')}</div>` 
                    : ''}
            `;

            li.addEventListener('click', () => this.selectSuggestion(index));
            li.addEventListener('mouseenter', () => this.setActiveIndex(index));

            this.suggestionsList.appendChild(li);
        });

        this.currentIndex = -1;
        this.showSuggestions();
    }

    showLoading() {
        this.suggestionsList.innerHTML = '<li class="address-loading">Loading suggestions...</li>';
        this.showSuggestions();
    }

    showNoResults() {
        this.suggestionsList.innerHTML = '<li class="address-no-results">No addresses found</li>';
        this.showSuggestions();
    }

    showError(message) {
        this.suggestionsList.innerHTML = `<li class="address-error">${this.escapeHtml(message)}</li>`;
        this.showSuggestions();
    }

    showSuggestions() {
        this.suggestionsList.style.display = 'block';
    }

    hideSuggestions() {
        this.suggestionsList.style.display = 'none';
        this.currentIndex = -1;
    }

    isVisible() {
        return this.suggestionsList.style.display === 'block';
    }

    moveSelection(direction) {
        const items = this.suggestionsList.querySelectorAll('.address-suggestion-item');
        if (items.length === 0) return;

        // Remove current active class
        items.forEach(item => item.classList.remove('active'));

        // Update index
        this.currentIndex += direction;

        // Handle boundaries
        if (this.currentIndex < 0) {
            this.currentIndex = items.length - 1;
        } else if (this.currentIndex >= items.length) {
            this.currentIndex = 0;
        }

        // Add active class to current item
        items[this.currentIndex].classList.add('active');
        items[this.currentIndex].scrollIntoView({ block: 'nearest' });
    }

    setActiveIndex(index) {
        const items = this.suggestionsList.querySelectorAll('.address-suggestion-item');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
        this.currentIndex = index;
    }

    selectCurrent() {
        if (this.currentIndex >= 0 && this.currentIndex < this.suggestions.length) {
            this.selectSuggestion(this.currentIndex);
        }
    }

    selectSuggestion(index) {
        const suggestion = this.suggestions[index];
        if (!suggestion) return;

        // Update input value
        this.input.value = suggestion.address;

        // Update other form fields if they exist
        this.updateRelatedFields(suggestion);

        // Hide suggestions
        this.hideSuggestions();

        // Trigger change event
        this.input.dispatchEvent(new Event('change', { bubbles: true }));

        // Call custom callback
        if (this.options.onSelect) {
            this.options.onSelect(suggestion);
        }

        // Update map if available with error handling
        this.updateMapLocation(suggestion);
    }

    // Update map location with error handling
    updateMapLocation(suggestion) {
        try {
            if (window.listingMap && suggestion.coordinates && suggestion.coordinates.length === 2) {
                const [lng, lat] = suggestion.coordinates;
                
                // Validate coordinates
                if (typeof lat === 'number' && typeof lng === 'number' && 
                    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    
                    window.listingMap.setLocation(lat, lng, suggestion.address);
                    console.log(`Map updated to: ${lat}, ${lng} for address: ${suggestion.address}`);
                    
                    // Show success feedback
                    this.showSuccessFeedback();
                } else {
                    console.warn('Invalid coordinates received:', suggestion.coordinates);
                }
            } else if (window.listingMap && !suggestion.coordinates) {
                console.warn('No coordinates available for selected address');
                // Try to geocode the address
                this.geocodeAndUpdateMap(suggestion.address);
            }
        } catch (error) {
            console.error('Error updating map location:', error);
        }
    }

    // Geocode address and update map as fallback
    async geocodeAndUpdateMap(address) {
        try {
            if (window.listingMap && window.listingMap.searchAndSetLocation) {
                const success = await window.listingMap.searchAndSetLocation(address);
                if (success) {
                    console.log(`Successfully geocoded and mapped address: ${address}`);
                } else {
                    console.warn(`Failed to geocode address: ${address}`);
                }
            }
        } catch (error) {
            console.error('Geocoding fallback failed:', error);
        }
    }

    // Show temporary success feedback
    showSuccessFeedback() {
        if (this.input) {
            const originalBorder = this.input.style.border;
            this.input.style.border = '2px solid #28a745';
            setTimeout(() => {
                this.input.style.border = originalBorder;
            }, 1500);
        }
    }

    updateRelatedFields(suggestion) {
        // Update country field
        const countryField = document.querySelector('input[name=\"listing[country]\"]');
        if (countryField && suggestion.country && !countryField.value) {
            countryField.value = suggestion.country;
        }

        // Update hidden coordinate fields if they exist
        const latField = document.querySelector('input[name=\"listing[latitude]\"]');
        const lngField = document.querySelector('input[name=\"listing[longitude]\"]');
        
        if (suggestion.coordinates) {
            const [lng, lat] = suggestion.coordinates;
            if (latField) latField.value = lat;
            if (lngField) lngField.value = lng;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public method to destroy the autocomplete
    destroy() {
        clearTimeout(this.debounceTimer);
        
        if (this.suggestionsList && this.suggestionsList.parentNode) {
            this.suggestionsList.parentNode.removeChild(this.suggestionsList);
        }
        
        this.input = null;
        this.suggestionsList = null;
        this.suggestions = [];
    }
}

// Auto-initialize for location inputs when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize for new listing form
    const locationInput = document.querySelector('input[name=\"listing[location]\"]');
    if (locationInput) {
        window.addressAutocomplete = new AddressAutocomplete('input[name="listing[location]"]', {
            onSelect: function(suggestion) {
                console.log('Address selected:', suggestion);
            },
            onError: function(error) {
                console.error('Address autocomplete error:', error);
            }
        });
    }
});

// Export for use in other scripts
window.AddressAutocomplete = AddressAutocomplete;