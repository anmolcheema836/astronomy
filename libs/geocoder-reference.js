// Geocoder Reference Library
// Browser-compatible geocoding functionality
// Based on node-geocoder: https://github.com/nchaulet/node-geocoder

class BrowserGeocoder {
    constructor(options = {}) {
        this.provider = options.provider || 'openstreetmap';
        this.apiKey = options.apiKey || null;
        this.language = options.language || 'en';
        this.region = options.region || null;
        this.cache = new Map();
    }
    
    // Forward geocoding - address to coordinates
    async geocode(address) {
        const cacheKey = `geocode:${address}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        let result;
        switch (this.provider) {
            case 'openstreetmap':
                result = await this.geocodeWithOSM(address);
                break;
            case 'google':
                result = await this.geocodeWithGoogle(address);
                break;
            default:
                result = await this.geocodeWithOSM(address);
        }
        
        this.cache.set(cacheKey, result);
        return result;
    }
    
    // Reverse geocoding - coordinates to address
    async reverse(coords) {
        const cacheKey = `reverse:${coords.lat},${coords.lon}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        let result;
        switch (this.provider) {
            case 'openstreetmap':
                result = await this.reverseWithOSM(coords);
                break;
            case 'google':
                result = await this.reverseWithGoogle(coords);
                break;
            default:
                result = await this.reverseWithOSM(coords);
        }
        
        this.cache.set(cacheKey, result);
        return result;
    }
    

    
    // OpenStreetMap geocoding
    async geocodeWithOSM(address) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.length === 0) {
                return [];
            }
            
            const item = data[0];
            return [{
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                formattedAddress: item.display_name,
                country: item.address?.country || null,
                state: item.address?.state || null,
                city: item.address?.city || item.address?.town || item.address?.village || null,
                zipcode: item.address?.postcode || null,
                streetName: item.address?.road || null,
                streetNumber: item.address?.house_number || null,
                extra: {
                    osm_id: item.osm_id,
                    osm_type: item.osm_type,
                    place_id: item.place_id
                }
            }];
        } catch (error) {
            throw new Error(`Geocoding failed: ${error.message}`);
        }
    }
    
    // OpenStreetMap reverse geocoding
    async reverseWithOSM(coords) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&addressdetails=1`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data || data.error) {
                return [];
            }
            
            return [{
                latitude: parseFloat(data.lat),
                longitude: parseFloat(data.lon),
                formattedAddress: data.display_name,
                country: data.address?.country || null,
                state: data.address?.state || null,
                city: data.address?.city || data.address?.town || data.address?.village || null,
                zipcode: data.address?.postcode || null,
                streetName: data.address?.road || null,
                streetNumber: data.address?.house_number || null,
                extra: {
                    osm_id: data.osm_id,
                    osm_type: data.osm_type,
                    place_id: data.place_id
                }
            }];
        } catch (error) {
            throw new Error(`Reverse geocoding failed: ${error.message}`);
        }
    }
    
    // Google geocoding (requires API key)
    async geocodeWithGoogle(address) {
        if (!this.apiKey) {
            throw new Error('Google Geocoding requires an API key');
        }
        
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}&language=${this.language}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status !== 'OK' || data.results.length === 0) {
                return [];
            }
            
            const result = data.results[0];
            const location = result.geometry.location;
            
            return [{
                latitude: location.lat,
                longitude: location.lng,
                formattedAddress: result.formatted_address,
                country: this.extractAddressComponent(result.address_components, 'country'),
                state: this.extractAddressComponent(result.address_components, 'administrative_area_level_1'),
                city: this.extractAddressComponent(result.address_components, 'locality'),
                zipcode: this.extractAddressComponent(result.address_components, 'postal_code'),
                streetName: this.extractAddressComponent(result.address_components, 'route'),
                streetNumber: this.extractAddressComponent(result.address_components, 'street_number'),
                extra: {
                    place_id: result.place_id,
                    types: result.types
                }
            }];
        } catch (error) {
            throw new Error(`Google geocoding failed: ${error.message}`);
        }
    }
    
    // Google reverse geocoding
    async reverseWithGoogle(coords) {
        if (!this.apiKey) {
            throw new Error('Google Geocoding requires an API key');
        }
        
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lon}&key=${this.apiKey}&language=${this.language}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status !== 'OK' || data.results.length === 0) {
                return [];
            }
            
            const result = data.results[0];
            const location = result.geometry.location;
            
            return [{
                latitude: location.lat,
                longitude: location.lng,
                formattedAddress: result.formatted_address,
                country: this.extractAddressComponent(result.address_components, 'country'),
                state: this.extractAddressComponent(result.address_components, 'administrative_area_level_1'),
                city: this.extractAddressComponent(result.address_components, 'locality'),
                zipcode: this.extractAddressComponent(result.address_components, 'postal_code'),
                streetName: this.extractAddressComponent(result.address_components, 'route'),
                streetNumber: this.extractAddressComponent(result.address_components, 'street_number'),
                extra: {
                    place_id: result.place_id,
                    types: result.types
                }
            }];
        } catch (error) {
            throw new Error(`Google reverse geocoding failed: ${error.message}`);
        }
    }
    
    // Extract specific address component from Google results
    extractAddressComponent(components, type) {
        const component = components.find(comp => comp.types.includes(type));
        return component ? component.long_name : null;
    }
    
    // Batch geocoding
    async batchGeocode(addresses) {
        const results = [];
        for (const address of addresses) {
            try {
                const result = await this.geocode(address);
                results.push({ query: address, results: result });
            } catch (error) {
                results.push({ query: address, error: error.message });
            }
        }
        return results;
    }
    
    // Search for locations with suggestions
    async suggest(query, limit = 10) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            return data.map(item => ({
                display_name: item.display_name,
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                type: item.type,
                importance: item.importance
            }));
        } catch (error) {
            throw new Error(`Location suggestion failed: ${error.message}`);
        }
    }
}

// Global instance for browser use
if (typeof window !== 'undefined') {
    window.BrowserGeocoder = BrowserGeocoder;
}

// Export for Node.js use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrowserGeocoder;
}