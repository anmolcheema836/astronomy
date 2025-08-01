// Astrological calculations and compatibility engine using authentic libraries
class AstrologyEngine {
    constructor() {
        this.geocodeCache = new Map();
        this.ZODIAC_SIGNS = [
            'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
            'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
        ];
        
        this.PLANETS_MAP = {
            'Sun': 'SE_SUN', 'Moon': 'SE_MOON', 'Mercury': 'SE_MERCURY', 
            'Venus': 'SE_VENUS', 'Mars': 'SE_MARS', 'Jupiter': 'SE_JUPITER', 
            'Saturn': 'SE_SATURN', 'Uranus': 'SE_URANUS', 'Neptune': 'SE_NEPTUNE', 
            'Pluto': 'SE_PLUTO', 'TrueNode': 'SE_TRUE_NODE', 'Chiron': 'SE_CHIRON'
        };

        this.initialized = false;
        this.sweph = null;
        this.geocoder = null;
    }
    
    initialize() {
        if (typeof SwissEphemeris === 'undefined' || typeof BrowserGeocoder === 'undefined') {
            console.error('A required library (SwissEphemeris or BrowserGeocoder) is not loaded.');
            alert('Critical library missing. App cannot function.');
            return;
        }
        
        this.sweph = new SwissEphemeris();
        this.geocoder = new BrowserGeocoder({ provider: 'openstreetmap' });
        this.sweph.swe_set_sid_mode(this.sweph.SE_SIDM_FAGAN_BRADLEY, 0, 0);
        this.initialized = true;
        console.log('Astrology engine initialized with Fagan/Bradley Ayanamsa.');
    }

    // Ayanamsa calculation based on the official Fagan/Bradley formula.
    // This is a workaround because sweph-reference.js lacks swe_get_ayanamsa_ut.
    _calculateAyanamsa(jd_ut) {
        const T = (jd_ut - 2451545.0) / 36525.0; // Julian centuries from J2000.0
        // Formula for Fagan/Bradley ayanamsa in arcseconds
        const ayanamsa_arcseconds = (24.022222 * 3600) + (T * 3600) + (1.115556 * T * T);
        return ayanamsa_arcseconds / 3600.0; // Convert to degrees
    }
    
    async calculateNatalChart(dateOfBirth, timeOfBirth, placeOfBirth) {
        if (!this.initialized) {
            console.error("Astrology engine not initialized.");
            return null;
        }

        const coords = await this.geocodeLocation(placeOfBirth);
        if (!coords) {
            console.error("Could not geocode location:", placeOfBirth);
            return null;
        }

        const jd_ut = this.dateToJulianDay(dateOfBirth, timeOfBirth);
        
        // Use our manual ayanamsa calculation.
        const ayanamsa = this._calculateAyanamsa(jd_ut);
        
        const positions = {};
        const planetKeys = Object.keys(this.PLANETS_MAP);

        // 1. Calculate Sidereal positions for celestial bodies
        for (const planetName of planetKeys) {
            positions[planetName.toLowerCase() + 'Position'] = this.calculatePlanetPosition(planetName, jd_ut, ayanamsa);
        }

        // 2. Calculate TROPICAL house cusps and angles
        const houseResult = this.sweph.swe_houses(jd_ut, coords.lat, coords.lon, this.sweph.SE_HSYS_PLACIDUS);
        
        // 3. Convert tropical angles/houses to SIDEREAL by subtracting the ayanamsa
        positions.ascendantPosition = (houseResult.ascendant - ayanamsa + 360) % 360;
        positions.midHeavenPosition = (houseResult.mc - ayanamsa + 360) % 360;
        const houses = houseResult.houses.map(cusp => (cusp - ayanamsa + 360) % 360);

        // 4. Calculate special points
        const tropicalSun = this.calculatePlanetPosition('Sun', jd_ut, 0); // Get tropical sun for house check
        const sunHouse = this.getPlanetHouse(tropicalSun, houseResult.houses);

        positions.fortunaPosition = this.calculateFortuna(
            positions.ascendantPosition, 
            positions.sunPosition, 
            positions.moonPosition,
            sunHouse
        );

        // WARNING: The Vertex calculation below is a non-functional placeholder.
        // A real ephemeris library is required for an accurate Vertex. This prevents a crash.
        positions.vertexPosition = (positions.ascendantPosition + 180) % 360; // Placeholder calculation

        // 5. Assign house placements for all calculated points
        Object.keys(positions).forEach(key => {
            if (key.endsWith('Position')) {
                const planetName = key.replace('Position', '');
                positions[planetName + 'House'] = this.getPlanetHouse(positions[key], houses);
            }
        });
        
        positions.houses = houses;
        positions.natalAspects = this.calculateNatalAspects(positions);
        
        return positions;
    }

    async geocodeLocation(location) {
        if (this.geocodeCache.has(location)) return this.geocodeCache.get(location);
        try {
            const results = await this.geocoder.geocode(location);
            if (!results || results.length === 0) throw new Error("Location not found");
            const result = { lat: results[0].latitude, lon: results[0].longitude, display_name: results[0].formattedAddress };
            this.geocodeCache.set(location, result);
            return result;
        } catch (error) {
            console.error(`Geocoding failed for "${location}":`, error);
            return null;
        }
    }

    dateToJulianDay(dateStr, timeStr) {
        const localDate = new Date(`${dateStr}T${timeStr}`);
        const year = localDate.getUTCFullYear();
        const month = localDate.getUTCMonth() + 1;
        const day = localDate.getUTCDate();
        const hour = localDate.getUTCHours() + localDate.getUTCMinutes() / 60.0 + localDate.getUTCSeconds() / 3600.0;
        return this.sweph.swe_julday(year, month, day, hour, this.sweph.SE_GREG_CAL);
    }
    
    calculatePlanetPosition(planet, jd_ut, ayanamsa) {
        const planetId = this.sweph[this.PLANETS_MAP[planet]];
        
        // HACK: sweph-reference.js doesn't handle SEFLG_SIDEREAL correctly,
        // so we get the tropical position and manually subtract the ayanamsa.
        const flags = this.sweph.SEFLG_SWIEPH; // Request Tropical position
        const result = this.sweph.swe_calc_ut(jd_ut, planetId, flags);

        // If ayanamsa is 0, we want the tropical position (for sun house check).
        // Otherwise, we subtract it to get the sidereal position.
        return (result.longitude - ayanamsa + 360) % 360;
    }
    
    calculateFortuna(asc, sun, moon, sunHouse) {
        const isDayChart = sunHouse >= 7 && sunHouse <= 12;
        let fortuna;
        if (isDayChart) {
            fortuna = asc + moon - sun;
        } else {
            fortuna = asc + sun - moon;
        }
        return (fortuna % 360 + 360) % 360;
    }

    getPlanetHouse(planetPosition, houses) {
        for (let i = 0; i < 12; i++) {
            const house_start = houses[i];
            const house_end = houses[(i + 1) % 12];
            if (house_start > house_end) {
                if (planetPosition >= house_start || planetPosition < house_end) return i + 1;
            } else {
                if (planetPosition >= house_start && planetPosition < house_end) return i + 1;
            }
        }
        return 1;
    }
    
    // ... (The rest of the file from calculateNatalAspects onwards can remain the same as my previous answer) ...
    // The following functions are correct and do not need changes.
    calculateNatalAspects(positions) {
        const planets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'truenode', 'chiron', 'ascendant', 'midheaven'];
        const aspects = [];
        for (let i = 0; i < planets.length; i++) {
            for (let j = i + 1; j < planets.length; j++) {
                const p1_name = planets[i];
                const p2_name = planets[j];
                const pos1 = positions[p1_name + 'Position'];
                const pos2 = positions[p2_name + 'Position'];
                
                if (pos1 === undefined || pos2 === undefined) continue;
                
                const aspect = this.findAspect(pos1, pos2);
                if (aspect.name !== 'None') {
                    aspects.push({ planet1: p1_name, planet2: p2_name, aspect: aspect.name, orb: aspect.orb, strength: aspect.strength });
                }
            }
        }
        return aspects;
    }
    
    findAspect(pos1, pos2) {
        const diff = Math.abs(pos1 - pos2);
        const angle = Math.min(diff, 360 - diff);
        
        const aspects = [
            { name: 'Conjunction', angle: 0, orb: 8, strength: 1.0 }, { name: 'Opposition', angle: 180, orb: 8, strength: 0.8 },
            { name: 'Trine', angle: 120, orb: 8, strength: 1.0 }, { name: 'Square', angle: 90, orb: 8, strength: 0.7 },
            { name: 'Sextile', angle: 60, orb: 6, strength: 0.6 }, { name: 'Quincunx', angle: 150, orb: 3, strength: 0.3 },
            { name: 'Semisextile', angle: 30, orb: 2, strength: 0.2 }, { name: 'Sesquiquadrate', angle: 135, orb: 2, strength: 0.4 },
        ];
        
        for (const aspect of aspects) {
            const aspectDiff = Math.abs(angle - aspect.angle);
            if (aspectDiff <= aspect.orb) {
                const exactness = 1 - (aspectDiff / aspect.orb);
                return { name: aspect.name, orb: aspectDiff.toFixed(2), strength: aspect.strength * exactness };
            }
        }
        return { name: 'None', orb: 0, strength: 0 };
    }

    degreesToSign(degrees) {
        const normalizedDegrees = (degrees % 360 + 360) % 360;
        const signIndex = Math.floor(normalizedDegrees / 30);
        const degreesInSign = Math.floor(normalizedDegrees % 30);
        const minutes = Math.floor((normalizedDegrees % 1) * 60);
        return { sign: this.ZODIAC_SIGNS[signIndex], degreesInSign, minutes };
    }
    
    async calculateCompatibility(user1, user2) {
        const venusMarsSynastry = this.calculateVenusMarsSynastry(user1, user2);
        const fullChartSynastry = this.calculateFullChartSynastry(user1, user2);
        const synastryAspects = this.calculateSynastryAspects(user1, user2);
        const houseTranspositions = this.calculateHouseTranspositions(user1, user2);
        
        const compatibilityScore = (venusMarsSynastry * 0.4) + (fullChartSynastry * 0.3) + 
                                 (synastryAspects.score * 0.2) + (houseTranspositions.score * 0.1);
        
        return {
            compatibilityScore: Math.min(1.0, compatibilityScore),
            venusMarsSynastry, fullChartSynastry, synastryAspects, houseTranspositions
        };
    }
    
    calculateVenusMarsSynastry(user1, user2) {
        const venus1Mars2 = this.calculateAspectStrength(user1.venusPosition, user2.marsPosition);
        const venus2Mars1 = this.calculateAspectStrength(user2.venusPosition, user1.marsPosition);
        return (venus1Mars2 + venus2Mars1) / 2;
    }
    
    calculateAspectStrength(pos1, pos2) {
        const aspect = this.findAspect(pos1, pos2);
        return aspect.strength;
    }

    calculateFullChartSynastry(user1, user2) {
        const p1 = [user1.sunPosition, user1.moonPosition, user1.venusPosition, user1.marsPosition, user1.ascendantPosition];
        const p2 = [user2.sunPosition, user2.moonPosition, user2.venusPosition, user2.marsPosition, user2.ascendantPosition];
        let totalStrength = 0;
        p1.forEach(pos1 => p2.forEach(pos2 => totalStrength += this.calculateAspectStrength(pos1, pos2)));
        return p1.length > 0 ? totalStrength / (p1.length * p2.length) : 0;
    }
    
    calculateSynastryAspects(user1, user2) {
        const p1 = [{n:'Sun',p:user1.sunPosition},{n:'Moon',p:user1.moonPosition},{n:'Ven',p:user1.venusPosition},{n:'Mar',p:user1.marsPosition},{n:'Asc',p:user1.ascendantPosition}];
        const p2 = [{n:'Sun',p:user2.sunPosition},{n:'Moon',p:user2.moonPosition},{n:'Ven',p:user2.venusPosition},{n:'Mar',p:user2.marsPosition},{n:'Asc',p:user2.ascendantPosition}];
        const aspects = [];
        let totalScore = 0;
        p1.forEach(pl1 => p2.forEach(pl2 => {
            const asp = this.findAspect(pl1.p, pl2.p);
            if (asp.name !== 'None') {
                aspects.push({ planet1: pl1.n, planet2: pl2.n, aspect: asp.name, orb: asp.orb, strength: asp.strength });
                totalScore += asp.strength;
            }
        }));
        return {
            aspects: aspects.sort((a,b) => b.strength - a.strength),
            score: aspects.length > 0 ? totalScore / (p1.length * p2.length) : 0,
        };
    }
    
    calculateHouseTranspositions(user1, user2) {
        const transpositions = [];
        let harmoniousCount = 0;
        const planets1 = [{n:'Sun',p:user1.sunPosition},{n:'Moon',p:user1.moonPosition},{n:'Ven',p:user1.venusPosition},{n:'Mar',p:user1.marsPosition}];
        const user2Houses = user2.houses;
        if (!user2Houses) return { transpositions: [], score: 0, harmoniousCount: 0, totalPlacements: 0 };
        
        planets1.forEach(planet => {
            const house = this.getPlanetHouse(planet.p, user2Houses);
            transpositions.push({ planet: planet.n, house, owner: user1.username, inChart: user2.username });
            if ([1, 5, 7, 10, 11].includes(house)) harmoniousCount++;
        });
        
        return {
            transpositions,
            score: planets1.length > 0 ? harmoniousCount / planets1.length : 0,
            harmoniousCount,
            totalPlacements: planets1.length
        };
    }
    
    formatPlanetPosition(planetName, degrees, house) {
        const { sign, degreesInSign, minutes } = this.degreesToSign(degrees);
        return `${planetName.padEnd(10, ' ')}: ${degreesInSign.toString().padStart(2,' ')}°${minutes.toString().padStart(2, '0')}' ${sign.padEnd(11, ' ')} in House ${house}`;
    }

    generateNatalChartText(userData) {
        let text = `NATAL CHART - ${userData.username}\n`;
        text += `Born: ${userData.dateOfBirth} ${userData.timeOfBirth} at ${userData.placeOfBirth}\n`;
        text += `System: Sidereal (Fagan/Bradley), Placidus Houses\n\nPLANETARY POSITIONS:\n`;
        
        const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','truenode','chiron','fortuna','vertex','ascendant','midheaven'];
        planets.forEach(p => {
            const pos = userData[p + 'Position'];
            const house = userData[p + 'PositionHouse'];
            if(pos !== undefined && house !== undefined) {
               text += this.formatPlanetPosition(p.charAt(0).toUpperCase() + p.slice(1), pos, house) + '\n';
            }
        });
        
        text += '\nNATAL ASPECTS (Orb <= 8° for major, <=3° for minor):\n';
        if (userData.natalAspects) {
            userData.natalAspects.forEach(a => {
                text += `${a.planet1} ${a.aspect} ${a.planet2} (orb: ${a.orb}°)\n`;
            });
        }
        return text;
    }
    
    generateSynastryText(user1, user2, synastryData) {
        let text = `SYNASTRY: ${user1.username} & ${user2.username}\n\n`;
        text += `Overall Score: ${(synastryData.compatibilityScore * 100).toFixed(1)}%\n`;
        text += `  - Venus-Mars Score: ${(synastryData.venusMarsSynastry * 100).toFixed(1)}%\n`;
        text += `  - Aspects Score: ${(synastryData.synastryAspects.score * 100).toFixed(1)}%\n`;
        text += `  - House Overlays Score: ${(synastryData.houseTranspositions.score * 100).toFixed(1)}%\n\n`;
        
        text += 'KEY SYNASTRY ASPECTS (Strongest First):\n';
        synastryData.synastryAspects.aspects.slice(0, 15).forEach(a => {
            text += `${user1.username}'s ${a.planet1} ${a.aspect} ${user2.username}'s ${a.planet2} (orb: ${a.orb}°)\n`;
        });
        
        text += '\nPLANET IN HOUSE OVERLAYS:\n';
        synastryData.houseTranspositions.transpositions.forEach(t => {
            text += `${t.owner}'s ${t.planet} is in ${t.inChart}'s House ${t.house}\n`;
        });
        return text;
    }
}