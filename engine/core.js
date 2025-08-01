// engine/core.js

// Core application state and data management
class SearchsterApp {
    constructor() {
        this.currentUser = null;
        this.matches = [];
        this.notifications = [];
        this.mutedIPs = new Set();
        this.chatHistory = new Map();
        this.currentChatUser = null;
        
        // Initialize on page load
        this.init();
    }
    
    init() {
        // Load saved data from localStorage
        this.loadUserData();
        this.loadChatHistory();
        this.loadMutedIPs();
        
        // Delay DOM-dependent operations
        this.domReady = false;
    }
    
    // Initialize DOM-dependent features
    initializeDOMFeatures() {
        this.domReady = true;
        
        // Start notification polling
        this.startNotificationPolling();
        
        // Auto-refresh matches every minute
        setInterval(() => {
            const matchesScreen = document.getElementById('matchesScreen');
            if (matchesScreen && !matchesScreen.classList.contains('hidden')) {
                findMatches();
            }
        }, 60000);
    }
    
    // User data management
    saveUserData() {
        // Create downloadable user data file
        const userData = JSON.stringify(this.currentUser, null, 2);
        this.createDownloadLink(userData, 'searchster_profile.txt', 'text/plain');
    }
    
    loadUserData() {
        // User data loading handled via file input on welcome screen
        this.currentUser = null;
    }
    
    createDownloadLink(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Chat history management
    saveChatHistory() {
        // Chat history saved in session memory only
    }
    
    loadChatHistory() {
        // No persistent chat history
        this.chatHistory = new Map();
    }
    
    // IP muting management
    saveMutedIPs() {
        // Muted IPs stored in session memory only
    }
    
    loadMutedIPs() {
        // No persistent muted IPs
        this.mutedIPs = new Set();
    }
    
    muteIP(ipAddress) {
        this.mutedIPs.add(ipAddress);
        this.saveMutedIPs();
    }
    
    // Notification management
    startNotificationPolling() {
        setInterval(() => {
            this.checkNotifications();
        }, 5000); // Check every 5 seconds
    }
    
    checkNotifications() {
        // Real P2P notifications handled by network module
        this.updateNotificationBell();
    }
    
    addNotification(notification) {
        this.notifications.unshift(notification);
        this.updateNotificationBell();
    }
    
    updateNotificationBell() {
        if (!this.domReady) return;
        
        const bell = document.getElementById('notificationBell');
        const unreadCount = this.notifications.filter(n => !n.read).length;
        bell.classList.add('notification-badge');
        bell.setAttribute('data-count', unreadCount);
    }
    
    // Get user's IP address (simulated)
    getUserIP() {
        return this.generateIP();
    }
    
    generateIP() {
        const ip = `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
        return ip;
    }
}

// REMOVE THIS LINE: let app = null;