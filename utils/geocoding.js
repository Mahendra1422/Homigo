const axios = require("axios");

/**
 * Geocoding utility to convert addresses to coordinates using Geoapify API
 */
class GeocodingService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://api.geoapify.com/v1/geocode";
    }

    /**
     * Convert an address string to coordinates
     * @param {string} address - The address to geocode
     * @returns {Promise<Object>} - Returns {coordinates: [lng, lat], address: string, success: boolean, error?: string}
     */
    async geocodeAddress(address) {
        if (!address || typeof address !== 'string') {
            return {
                success: false,
                error: "Invalid address provided",
                coordinates: null,
                address: null
            };
        }

        try {
            const response = await axios.get(`${this.baseUrl}/search`, {
                params: {
                    text: address.trim(),
                    apiKey: this.apiKey,
                    limit: 1,
                    format: 'json'
                },
                timeout: 10000 // 10 second timeout
            });

            if (response.data && response.data.results && response.data.results.length > 0) {
                const result = response.data.results[0];
                return {
                    success: true,
                    coordinates: [result.lon, result.lat], // [longitude, latitude] for GeoJSON format
                    address: result.formatted || address,
                    country: result.country || '',
                    city: result.city || result.county || '',
                    state: result.state || '',
                    error: null
                };
            } else {
                return {
                    success: false,
                    error: "No results found for the provided address",
                    coordinates: null,
                    address: address
                };
            }
        } catch (error) {
            console.error("Geocoding error:", error.message);
            
            // Handle specific error cases
            if (error.response) {
                const statusCode = error.response.status;
                if (statusCode === 401) {
                    return {
                        success: false,
                        error: "Invalid API key for geocoding service",
                        coordinates: null,
                        address: address
                    };
                } else if (statusCode === 429) {
                    return {
                        success: false,
                        error: "Rate limit exceeded for geocoding service",
                        coordinates: null,
                        address: address
                    };
                }
            }

            return {
                success: false,
                error: `Geocoding failed: ${error.message}`,
                coordinates: null,
                address: address
            };
        }
    }

    /**
     * Convert coordinates to address (reverse geocoding)
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<Object>} - Returns {address: string, success: boolean, error?: string}
     */
    async reverseGeocode(lat, lng) {
        if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
            return {
                success: false,
                error: "Invalid coordinates provided",
                address: null
            };
        }

        try {
            const response = await axios.get(`${this.baseUrl}/reverse`, {
                params: {
                    lat: lat,
                    lon: lng,
                    apiKey: this.apiKey,
                    limit: 1,
                    format: 'json'
                },
                timeout: 10000
            });

            if (response.data && response.data.results && response.data.results.length > 0) {
                const result = response.data.results[0];
                return {
                    success: true,
                    address: result.formatted || `${lat}, ${lng}`,
                    country: result.country || '',
                    city: result.city || result.county || '',
                    state: result.state || '',
                    error: null
                };
            } else {
                return {
                    success: false,
                    error: "No address found for the provided coordinates",
                    address: `${lat}, ${lng}`
                };
            }
        } catch (error) {
            console.error("Reverse geocoding error:", error.message);
            return {
                success: false,
                error: `Reverse geocoding failed: ${error.message}`,
                address: `${lat}, ${lng}`
            };
        }
    }

    /**
     * Get autocomplete suggestions for address input
     * @param {string} query - The partial address query
     * @param {Object} options - Additional options like country bias
     * @returns {Promise<Array>} - Returns array of suggestion objects
     */
    async getAutocompleteSuggestions(query, options = {}) {
        if (!query || typeof query !== 'string' || query.length < 3) {
            return {
                success: false,
                suggestions: [],
                error: "Query must be at least 3 characters long"
            };
        }

        try {
            const params = {
                text: query.trim(),
                apiKey: this.apiKey,
                limit: options.limit || 5,
                format: 'json'
            };

            // Add country bias if provided
            if (options.country) {
                params.bias = `countrycode:${options.country}`;
            }

            const response = await axios.get(`${this.baseUrl}/autocomplete`, {
                params: params,
                timeout: 5000
            });

            if (response.data && response.data.results) {
                const suggestions = response.data.results.map(result => ({
                    address: result.formatted,
                    coordinates: [result.lon, result.lat],
                    country: result.country || '',
                    city: result.city || result.county || '',
                    state: result.state || ''
                }));

                return {
                    success: true,
                    suggestions: suggestions,
                    error: null
                };
            }

            return {
                success: false,
                suggestions: [],
                error: "No suggestions found"
            };
        } catch (error) {
            console.error("Autocomplete error:", error.message);
            return {
                success: false,
                suggestions: [],
                error: `Autocomplete failed: ${error.message}`
            };
        }
    }
}

// Default fallback coordinates (Bhubaneswar, Odisha, India)
const DEFAULT_COORDINATES = {
    lat: 20.2960,  // Bhubaneswar latitude
    lng: 85.8246   // Bhubaneswar longitude
};

/**
 * Create a geocoding service instance
 * @param {string} apiKey - Geoapify API key
 * @returns {GeocodingService}
 */
function createGeocodingService(apiKey) {
    return new GeocodingService(apiKey);
}

module.exports = {
    GeocodingService,
    createGeocodingService,
    DEFAULT_COORDINATES
};