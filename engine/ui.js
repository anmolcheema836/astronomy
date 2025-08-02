// User interface functions and event handlers

// Send chat message function
function sendChatMessage() {
    const messageInput = document.getElementById('chatInput');
    const message = messageInput.value.trim();
    
    if (message && app.currentChatUser) {
        network.sendMessage(app.currentChatUser.id, message);
        messageInput.value = '';
        updateChatDisplay();
    }
}

// Show screen function
function showScreen(screenName) {
    const screens = ['welcomeScreen', 'matchesScreen'];
    screens.forEach(screen => {
        const element = document.getElementById(screen);
        if (screen === screenName) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    });
}

// View profile function  
function viewProfile(user) {
    app.currentProfileUser = user;
    const modal = document.getElementById('profileModal');
    modal.classList.remove('hidden');
    
    // Populate profile data
    const usernameEl = document.getElementById('profileUsername');
    const ageEl = document.getElementById('profileAge');
    const bioEl = document.getElementById('profileBio');
    
    usernameEl.textContent = user.username;
    ageEl.textContent = calculateAge(user.dateOfBirth);
    bioEl.textContent = user.bio || 'No bio available';
}

// Show settings function
function showSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('hidden');
    
    // Populate current user data
    document.getElementById('settingsUsername').value = app.currentUser.username;
    document.getElementById('settingsDateOfBirth').value = app.currentUser.dateOfBirth;
    document.getElementById('settingsTimeOfBirth').value = app.currentUser.timeOfBirth;
    document.getElementById('settingsPlaceOfBirth').value = app.currentUser.placeOfBirth;
}

// Main application functions
async function connect() {
    const usernameEl = document.getElementById('username');
    const dateOfBirthEl = document.getElementById('dateOfBirth');
    const timeOfBirthEl = document.getElementById('timeOfBirth');
    const placeOfBirthEl = document.getElementById('placeOfBirth');
    

    
    const username = usernameEl.value;
    const dateOfBirth = dateOfBirthEl.value;
    const timeOfBirth = timeOfBirthEl.value;
    const placeOfBirth = placeOfBirthEl.value;
    const timeCertain = document.getElementById('timeCertain').checked;
    
    // Get gender selection
    const genderRadios = document.querySelectorAll('input[name="gender"]');
    let gender = null;
    for (const radio of genderRadios) {
        if (radio.checked) {
            gender = radio.value;
            break;
        }
    }
    
    // Get preference selections
    const lookingForMen = document.getElementById('lookingForMen').checked;
    const lookingForWomen = document.getElementById('lookingForWomen').checked;
    

    
    // Calculate natal chart
    const natalPositions = await astrology.calculateNatalChart(dateOfBirth, timeOfBirth, placeOfBirth);
    

        app.currentUser = {
            id: network.myPeerId,
            username,
            ipAddress: app.getUserIP(),
            displayName: `${username}@${app.getUserIP()}`,
            dateOfBirth,
            timeOfBirth,
            placeOfBirth,
            timeCertain,
            gender,
            lookingForMen,
            lookingForWomen,
            ...natalPositions,
            bio: '',
            age: calculateAge(dateOfBirth)
        };

    
    // Save user data
    app.saveUserData();
    
    // Announce presence to network
    network.announcePresence(app.currentUser);
    
    // Switch to matches screen
    const welcomeScreen = document.getElementById('welcomeScreen');
    const matchesScreen = document.getElementById('matchesScreen');
    welcomeScreen.classList.add('hidden');
    matchesScreen.classList.remove('hidden');
    
    // Show profile button
    const profileBtn = document.querySelector('.profile-btn');
    profileBtn.classList.add('visible');
    
    // Find initial matches
    findMatches();
}

function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    age = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
    return age;
}

async function findMatches() {
    const minAgeElement = document.getElementById('minAge');
    const maxAgeElement = document.getElementById('maxAge');
    
    const minAge = parseInt(minAgeElement.value);
    const maxAge = parseInt(maxAgeElement.value);
    
    // Discover peers
    const peers = network.discoverPeers();
    
    const allUsers = [...peers];
    
    // Filter by age and gender preferences
    const filtered = allUsers.filter(user => {
        const userAge = calculateAge(user.dateOfBirth);
        user.age = userAge;
        
        // Gender preference matching (mutual)
        const userWantsMe = (app.currentUser.gender === 'man' && user.lookingForMen) ||
                           (app.currentUser.gender === 'woman' && user.lookingForWomen);
        
        const iWantUser = (user.gender === 'man' && app.currentUser.lookingForMen) ||
                         (user.gender === 'woman' && app.currentUser.lookingForWomen);
        
        return userWantsMe && iWantUser;
    });
    
    // Calculate compatibility for each user
    const matches = await Promise.all(filtered.map(async user => {
        const compatibility = await astrology.calculateCompatibility(app.currentUser, user);
        return {
            ...user,
            ...compatibility
        };
    }));
    
    // Sort by compatibility score
    matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    
    // Update matches list
    app.matches = matches;
    displayMatches(matches, minAge, maxAge);
}

function displayMatches(matches, minAge, maxAge) {
    const matchesList = document.getElementById('matchesList');
    
    matchesList.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <p>Matches found in the ${minAge}-${maxAge} age range.</p>
            <p>Displaying compatibility results.</p>
        </div>
    `;
    
    // Separate high compatibility and other matches
    const highCompatibility = matches.filter(m => m.compatibilityScore >= 0.6);
    const otherMatches = matches.filter(m => m.compatibilityScore < 0.6);
    
    let html = '';
    
    html += '<h3 style="color: var(--cosmic-purple); margin-bottom: 1rem;">High Compatibility Matches</h3>';
    html += highCompatibility.map(createMatchCard).join('');
    
    html += '<h3 style="color: var(--text-muted); margin: 2rem 0 1rem 0;">Other Matches</h3>';
    html += otherMatches.map(createMatchCard).join('');
    
    matchesList.innerHTML = html;
}

function createMatchCard(match) {
    const verifiedBadge = match.timeCertain ? '<span class="badge badge-golden">✓ Verified</span>' : '';
    const genderBadge = match.gender === 'man' ? '<span class="badge badge-male">♂</span>' : '<span class="badge badge-female">♀</span>';
    
    return `
        <div class="match-card" onclick="openChat('${match.id}')">
            <div class="match-header">
                <div class="match-username">
                    ${genderBadge}
                    ${verifiedBadge}
                    <span>${match.displayName}</span>
                </div>
                <div class="compatibility-score">${(match.compatibilityScore * 100).toFixed(1)}%</div>
            </div>
            
            <div class="match-details">
                <div class="detail-item">
                    <div class="detail-label">Age</div>
                    <div class="detail-value">${match.age}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Venus-Mars</div>
                    <div class="detail-value">${(match.venusMarsSynastry * 100).toFixed(1)}%</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Full Chart</div>
                    <div class="detail-value">${(match.fullChartSynastry * 100).toFixed(1)}%</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${match.placeOfBirth}</div>
                </div>
            </div>
            
            <p style="margin-top: 1rem; color: var(--text-gray); font-style: italic;">"${match.bio}"</p>
        </div>
    `;
}

// Chat functions
function openChat(userId) {
    const user = app.matches.find(m => m.id === userId);
    
    app.currentChatUser = user;
    
    // Connect to peer
    network.connectToPeer(userId);
    
    // Update chat header
    const chatUsername = document.getElementById('chatUsername');
    chatUsername.textContent = user.displayName;
    
    // Load chat history
    updateChatDisplay();
    
    // Show chat panel
    const chatPanel = document.getElementById('chatPanel');
    chatPanel.classList.add('open');
}

function closeChat() {
    const chatPanel = document.getElementById('chatPanel');
    chatPanel.classList.remove('open');
    app.currentChatUser = null;
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    // Send message through network
    network.sendMessage(app.currentChatUser.id, message);
    
    input.value = '';
    updateChatDisplay();
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
}

function updateChatDisplay() {
    const messagesContainer = document.getElementById('chatMessages');
    const messages = app.chatHistory.get(app.currentChatUser.id) || [];
    
    const html = messages.map(msg => {
        const isOwn = msg.type === 'sent' || msg.from === network.myPeerId;
        const className = isOwn ? 'message own' : 'message other';
        const time = new Date(msg.timestamp).toLocaleTimeString();
        
        return `
            <div class="${className}">
                <div>${msg.message}</div>
                <div style="font-size: 0.8em; opacity: 0.7; margin-top: 0.5rem;">${time}</div>
            </div>
        `;
    }).join('');
    
    messagesContainer.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function saveChat() {
    const messages = app.chatHistory.get(app.currentChatUser.id) || [];
    
    const chatText = messages.map(msg => {
        const sender = msg.type === 'sent' ? 'You' : app.currentChatUser.username;
        const time = new Date(msg.timestamp).toLocaleString();
        return `[${time}] ${sender}: ${msg.message}`;
    }).join('\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${app.currentChatUser.username}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Save to localStorage
    app.saveChatHistory();
}

// Profile functions
async function openProfile() {
    await showProfile(app.currentUser, true);
}

async function viewChatUserProfile() {
    const compatibility = await astrology.calculateCompatibility(app.currentUser, app.currentChatUser);
    showProfile(app.currentChatUser, false, compatibility);
}

async function showProfile(user, isOwnProfile, synastryData = null) {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileContent');
    
    const verifiedBadge = user.timeCertain ? '<span class="badge badge-golden">✓ Verified</span>' : '';
    const genderBadge = user.gender === 'man' ? '<span class="badge badge-male">♂</span>' : '<span class="badge badge-female">♀</span>';
    
    let html = `
        <div class="profile-header">
            <div class="profile-avatar">
                <img src="${user.profileImage}" alt="Profile" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
            </div>
            <div>
                <h2>${genderBadge} ${verifiedBadge} ${user.displayName}</h2>
                <p style="color: var(--text-muted);">Born: ${user.dateOfBirth} at ${user.timeOfBirth}</p>
                <p style="color: var(--text-muted);">Location: ${user.placeOfBirth}</p>
            </div>
        </div>
    `;
    
    // Bio section with profile image upload
    html += `
        <div style="margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="color: var(--cosmic-purple);">Bio</h3>
                <div style="display: flex; gap: 0.5rem;">
                    ${isOwnProfile ? '<button class="copy-btn" onclick="editBio()">Edit Bio</button>' : ''}
                    ${isOwnProfile ? '<button class="copy-btn" onclick="uploadProfileImage()">Change Image</button>' : ''}
                </div>
            </div>
            <div style="background: rgba(51, 65, 85, 0.5); border-radius: 0.5rem; padding: 1rem; min-height: 60px;">
                ${user.bio}
            </div>
        </div>
    `;
    
    // Natal chart data
    const natalDataHTML = await generateNatalDataHTML(user);
    html += `
        <div style="margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="color: var(--cosmic-purple);">Natal Chart Data</h3>
                <button class="copy-btn" onclick="copyNatalData('${user.id}')">Copy Data</button>
            </div>
            <div class="natal-data" style="background: rgba(139, 92, 246, 0.1); padding: 1rem; border-radius: 0.5rem; border: 1px solid rgba(139, 92, 246, 0.3);">
                ${natalDataHTML}
            </div>
        </div>
    `;
    
    // Synastry data for other users
    html += `
        <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="color: var(--cosmic-purple);">Synastry Analysis</h3>
                <button class="copy-btn" onclick="copySynastryData()">Copy Analysis</button>
            </div>
            <div class="natal-data">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 1.2rem; font-weight: bold; color: var(--cosmic-purple);">
                            ${(synastryData.compatibilityScore * 100).toFixed(1)}%
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Overall</div>
                    </div>
                    <div>
                        <div style="font-size: 1.2rem; font-weight: bold; color: var(--cosmic-pink);">
                            ${(synastryData.venusMarsSynastry * 100).toFixed(1)}%
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Venus-Mars</div>
                    </div>
                    <div>
                        <div style="font-size: 1.2rem; font-weight: bold; color: var(--text-white);">
                            ${(synastryData.fullChartSynastry * 100).toFixed(1)}%
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Full Chart</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

async function generateNatalDataHTML(user) {
    // Ensure we have calculated positions
    const natalData = await astrology.calculateNatalChart(user.dateOfBirth, user.timeOfBirth, user.placeOfBirth);
    Object.assign(user, natalData);
    
    const planets = [
        { name: 'Sun', position: user.sunPosition, house: user.sunPositionHouse },
        { name: 'Moon', position: user.moonPosition, house: user.moonPositionHouse },
        { name: 'Mercury', position: user.mercuryPosition, house: user.mercuryPositionHouse },
        { name: 'Venus', position: user.venusPosition, house: user.venusPositionHouse },
        { name: 'Mars', position: user.marsPosition, house: user.marsPositionHouse },
        { name: 'Jupiter', position: user.jupiterPosition, house: user.jupiterPositionHouse },
        { name: 'Saturn', position: user.saturnPosition, house: user.saturnPositionHouse },
        { name: 'Uranus', position: user.uranusPosition, house: user.uranusPositionHouse },
        { name: 'Neptune', position: user.neptunePosition, house: user.neptunePositionHouse },
        { name: 'Pluto', position: user.plutoPosition, house: user.plutoPositionHouse },
        { name: 'True Node', position: user.trueNodePosition, house: user.trueNodePositionHouse },
        { name: 'Chiron', position: user.chironPosition, house: user.chironPositionHouse },
        { name: 'Fortuna', position: user.fortunaPosition, house: user.fortunaPositionHouse },
        { name: 'Vertex', position: user.vertexPosition, house: user.vertexPositionHouse },
        { name: 'Ascendant', position: user.ascendantPosition, house: user.ascendantPositionHouse },
        { name: 'Midheaven', position: user.midHeavenPosition, house: user.midHeavenPositionHouse }
    ];
    
    // Generate detailed natal chart in requested format
    let html = '<div style="font-family: monospace; font-size: 0.9rem; line-height: 1.6; color: white;">';
    
    // Display each planet with aspects in the specified format
    planets.forEach(planet => {
        const planetData = astrology.formatDetailedPlanetPosition(planet.name, planet.position, planet.house, user);
        html += `<div style="margin-bottom: 0.8rem; padding: 0.2rem;">${planetData}</div>`;
    });
    
    // Add house cusps section
    html += '<hr style="margin: 1.5rem 0; border-color: var(--cosmic-purple);">';
    html += '<h4 style="color: var(--cosmic-purple); margin-bottom: 1rem;">House Cusps</h4>';
    for (let i = 1; i <= 12; i++) {
        const housePosition = user.houses[(i - 1) % 12];
        const houseCusp = astrology.formatHouseCusp(i, housePosition);
        html += `<div style="margin-bottom: 0.3rem; padding: 0.1rem;">${houseCusp}</div>`;
    }
    
    html += '</div>';
    return html;
}

function closeProfile() {
    const modal = document.getElementById('profileModal');
    modal.classList.add('hidden');
}

async function editBio() {
    const bioTextarea = document.getElementById('settingsBio');
    const newBio = bioTextarea.value;
    app.currentUser.bio = newBio.substring(0, 500);
    app.saveUserData();
    network.announcePresence(app.currentUser); // Update network presence
    await showProfile(app.currentUser, true); // Refresh profile display
}

function copyNatalData(userId) {
    const user = app.matches.find(m => m.id === userId);
    const natalText = astrology.generateNatalChartText(user);
    navigator.clipboard.writeText(natalText);
}

async function copySynastryData() {
    const compatibility = await astrology.calculateCompatibility(app.currentUser, app.currentChatUser);
    const synastryText = astrology.generateSynastryText(app.currentUser, app.currentChatUser, compatibility);
    navigator.clipboard.writeText(synastryText);
}

function uploadProfileImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            app.currentUser.profileImage = e.target.result;
            app.saveUserData();

            await showProfile(app.currentUser, true); // Refresh profile display
        };
        reader.readAsDataURL(file);
    });
    input.click();
}

async function recalculateNatalChart() {
    // Force recalculation of natal chart
    const natalData = await astrology.calculateNatalChart(
        app.currentUser.dateOfBirth, 
        app.currentUser.timeOfBirth, 
        app.currentUser.placeOfBirth
    );
    
    // Update user data with new calculations
    Object.assign(app.currentUser, natalData);
    
    // Update network presence
    network.announcePresence(app.currentUser);
    
    // Refresh profile display
    await showProfile(app.currentUser, true);
}

// Notification functions
function toggleNotifications() {
    const modal = document.getElementById('notificationModal');
    const list = document.getElementById('notificationsList');
    
    // Mark all as read
    app.notifications.forEach(n => n.read = true);
    app.updateNotificationBell();
    
    // Display notifications
    const html = app.notifications.map(createNotificationHTML).join('');
    
    list.innerHTML = html;
    modal.classList.remove('hidden');
}

function createNotificationHTML(notification) {
    const time = notification.timestamp.toLocaleTimeString();
    const isRequest = notification.type === 'chat_request';
    
    return `
        <div style="border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${notification.from.username}@${notification.from.ipAddress}</strong>
                    <span style="color: var(--text-muted);"> ${notification.message}</span>
                </div>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${time}</span>
            </div>
            ${isRequest ? `
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <button class="copy-btn" onclick="acceptChatRequest('${notification.from.id}')">OPEN</button>
                    <button class="copy-btn" onclick="ignoreChatRequest('${notification.from.ipAddress}')">IGNORE</button>
                </div>
            ` : ''}
        </div>
    `;
}

function acceptChatRequest(userId) {
    closeNotifications();
    openChat(userId);
}

function ignoreChatRequest(ipAddress) {
    app.muteIP(ipAddress);
    closeNotifications();
}

function closeNotifications() {
    const modal = document.getElementById('notificationModal');
    modal.classList.add('hidden');
}


// --- REWRITTEN LOCATION AUTOCOMPLETE SECTION ---

// Binds the autocomplete feature to the location input fields.
function initializeLocationAutocomplete() {
    const welcomeInput = document.getElementById('placeOfBirth');
    const welcomeBox = document.getElementById('locationSuggestions');
    if (welcomeInput && welcomeBox) {
        bindAutocomplete(welcomeInput, welcomeBox);
    }

    const settingsInput = document.getElementById('settingsPlaceOfBirth');
    const settingsBox = document.getElementById('settingsLocationSuggestions');
    if (settingsInput && settingsBox) {
        bindAutocomplete(settingsInput, settingsBox);
    }
}

// Attaches event listeners to an input field to provide location suggestions.
function bindAutocomplete(inputElement, suggestionsDiv) {
    let debounceTimer;

    inputElement.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (query.length < 3) {
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            // Use the geocoder instance from the astrology engine.
            if (window.astrology && window.astrology.geocoder) {
                try {
                    const suggestions = await window.astrology.geocoder.suggest(query, 5);
                    showLocationSuggestions(suggestions, suggestionsDiv, inputElement);
                } catch (error) {
                    console.error('Location suggestion fetch failed:', error);
                    suggestionsDiv.innerHTML = '';
                    suggestionsDiv.classList.add('hidden');
                }
            } else {
                console.error('Geocoder not available on window.astrology.geocoder');
            }
        }, 300); // Debounce requests to avoid spamming the API.
    });

    // Hide suggestions when the input loses focus, with a delay to allow clicks.
    inputElement.addEventListener('blur', () => {
        setTimeout(() => {
            suggestionsDiv.classList.add('hidden');
        }, 200); 
    });
}

// Displays the fetched location suggestions in the suggestions dropdown.
function showLocationSuggestions(suggestions, suggestionsDiv, inputElement) {
    suggestionsDiv.innerHTML = ''; // Clear previous suggestions.

    if (!suggestions || suggestions.length === 0) {
        suggestionsDiv.classList.add('hidden');
        return;
    }

    // Create and append new suggestion elements.
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'location-suggestion';
        item.textContent = suggestion.display_name;

        // Use 'mousedown' which fires before the input's 'blur' event.
        item.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent the input from losing focus.
            inputElement.value = suggestion.display_name;
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.add('hidden');
            inputElement.focus();
        });

        suggestionsDiv.appendChild(item);
    });

    suggestionsDiv.classList.remove('hidden');
}


// --- END OF REWRITTEN SECTION ---


// Settings management
function openSettings() {
    const modal = document.getElementById('settingsModal');
    const setElementValue = (id, value, isCheckbox = false) => {
        const element = document.getElementById(id);
        element[isCheckbox ? 'checked' : 'value'] = value;
    };
    
    setElementValue('settingsUsername', app.currentUser.username);
    setElementValue('settingsDateOfBirth', app.currentUser.dateOfBirth);
    setElementValue('settingsTimeOfBirth', app.currentUser.timeOfBirth);
    setElementValue('settingsPlaceOfBirth', app.currentUser.placeOfBirth);
    setElementValue('settingsGender', app.currentUser.gender);
    setElementValue('settingsTimeCertain', app.currentUser.timeCertain, true);
    setElementValue('settingsLookingForMen', app.currentUser.lookingForMen, true);
    setElementValue('settingsLookingForWomen', app.currentUser.lookingForWomen, true);
    setElementValue('settingsBio', app.currentUser.bio);
    
    modal.classList.remove('hidden');
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('hidden');
}

async function saveSettings() {
    // Get new values
    const elements = {
        username: document.getElementById('settingsUsername'),
        dateOfBirth: document.getElementById('settingsDateOfBirth'),
        timeOfBirth: document.getElementById('settingsTimeOfBirth'),
        placeOfBirth: document.getElementById('settingsPlaceOfBirth'),
        gender: document.getElementById('settingsGender'),
        timeCertain: document.getElementById('settingsTimeCertain'),
        lookingForMen: document.getElementById('settingsLookingForMen'),
        lookingForWomen: document.getElementById('settingsLookingForWomen'),
        bio: document.getElementById('settingsBio')
    };
    
    const newUsername = elements.username.value.trim();
    const newDateOfBirth = elements.dateOfBirth.value;
    const newTimeOfBirth = elements.timeOfBirth.value;
    const newPlaceOfBirth = elements.placeOfBirth.value;
    const newGender = elements.gender.value;
    const newTimeCertain = elements.timeCertain.checked;
    const newLookingForMen = elements.lookingForMen.checked;
    const newLookingForWomen = elements.lookingForWomen.checked;
    const newBio = elements.bio.value.trim();
    
    // No validation - proceed directly
    
    // Update user data
    const oldData = { ...app.currentUser };
    app.currentUser.username = newUsername;
    app.currentUser.dateOfBirth = newDateOfBirth;
    app.currentUser.timeOfBirth = newTimeOfBirth;
    app.currentUser.placeOfBirth = newPlaceOfBirth;
    app.currentUser.gender = newGender;
    app.currentUser.timeCertain = newTimeCertain;
    app.currentUser.lookingForMen = newLookingForMen;
    app.currentUser.lookingForWomen = newLookingForWomen;
    app.currentUser.bio = newBio.substring(0, 500);
    
    // Recalculate astrological data if birth info changed
    const natalChart = await astrology.calculateNatalChart(newDateOfBirth, newTimeOfBirth, newPlaceOfBirth);
    // Update all planetary positions
    Object.assign(app.currentUser, natalChart);
    
    // Update display name
    app.currentUser.displayName = `${app.currentUser.username}@${app.currentUser.ipAddress}`;
    
    // Save and announce changes
    app.saveUserData();
    network.announcePresence(app.currentUser);
    
    // Close modal
    closeSettings();
    
    // Refresh matches if on matches screen
    const matchesScreen = document.getElementById('matchesScreen');
    findMatches();
}