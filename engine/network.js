// Peer-to-peer networking and communication
class NetworkEngine {
    constructor() {
        this.connections = new Map();
        this.isConnected = false;
        this.myPeerId = null;
        this.signalingData = new Map();
        
        this.initializeP2P();
    }
    
    initializeP2P() {
        // Generate unique peer ID
        this.myPeerId = this.generatePeerId();
        
        // In a real P2P implementation, this would use WebRTC
        // For now, we'll simulate P2P using localStorage as signaling
        this.startSignalingListener();
    }
    
    generatePeerId() {
        return 'peer_' + Math.random().toString(36).substring(2, 11);
    }
    
    // Simulate P2P signaling using localStorage
    startSignalingListener() {
        // Listen for signaling messages
        setInterval(() => {
            this.checkSignalingMessages();
        }, 1000);
    }
    
    checkSignalingMessages() {
        const signals = localStorage.getItem('p2p_signals');
        const signalData = JSON.parse(signals || '[]');
        signalData.forEach(signal => {
            if (signal.to === this.myPeerId && !signal.processed) {
                this.handleSignalingMessage(signal);
                signal.processed = true;
            }
        });
        
        // Remove processed signals
        const unprocessed = signalData.filter(s => !s.processed);
        localStorage.setItem('p2p_signals', JSON.stringify(unprocessed));
    }
    
    handleSignalingMessage(signal) {
        switch (signal.type) {
            case 'offer':
                this.handleOffer(signal);
                break;
            case 'answer':
                this.handleAnswer(signal);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(signal);
                break;
            case 'chat-message':
                this.handleChatMessage(signal);
                break;
        }
    }
    
    // Send signaling message
    sendSignalingMessage(to, type, data) {
        const existingData = localStorage.getItem('p2p_signals');
        let signals = JSON.parse(existingData || '[]');
        
        signals.push({
            from: this.myPeerId,
            to: to,
            type: type,
            data: data,
            timestamp: Date.now(),
            processed: false
        });
        localStorage.setItem('p2p_signals', JSON.stringify(signals));
    }
    
    // Connect to peer
    connectToPeer(peerId) {
        // Simulate WebRTC connection setup
        const connection = this.createMockConnection(peerId);
        this.connections.set(peerId, connection);
        
        // Send connection offer
        this.sendSignalingMessage(peerId, 'offer', {
            sdp: 'mock-offer-sdp',
            type: 'offer'
        });
        
        return connection;
    }
    
    createMockConnection(peerId) {
        return {
            peerId: peerId,
            state: 'connecting',
            dataChannel: null,
            
            send: (message) => {
                this.sendSignalingMessage(peerId, 'chat-message', {
                    message: message,
                    from: this.myPeerId,
                    timestamp: Date.now()
                });
            },
            
            close: () => {
                this.connections.delete(peerId);
            }
        };
    }
    
    handleOffer(signal) {
        // Simulate accepting the offer
        const connection = this.createMockConnection(signal.from);
        this.connections.set(signal.from, connection);
        connection.state = 'connected';
        
        // Send answer
        this.sendSignalingMessage(signal.from, 'answer', {
            sdp: 'mock-answer-sdp',
            type: 'answer'
        });
    }
    
    handleAnswer(signal) {
        const connection = this.connections.get(signal.from);
        if (connection) {
            connection.state = 'connected';
        }
    }
    
    handleIceCandidate(signal) {
        // Mock ICE candidate handling
    }
    
    handleChatMessage(signal) {
        const { message, from, timestamp } = signal.data;
        
        // Add message to chat history
        app.chatHistory.set(from, app.chatHistory.get(from) || []);
        
        app.chatHistory.get(from).push({
            from: from,
            message: message,
            timestamp: new Date(timestamp),
            type: 'received'
        });
        
        // Update chat UI if this chat is open
        updateChatDisplay();
        
        // Show notification if chat is not open
        app.addNotification({
            id: Date.now(),
            type: 'new_message',
            from: this.findUserById(from),
            timestamp: new Date(),
            message: 'sent you a message'
        });
    }
    
    findUserById(userId) {
        const match = app.matches.find(m => m.id === userId);
        return match;
    }
    
    // Send chat message
    sendMessage(peerId, message) {
        const connection = this.connections.get(peerId);
        if (connection && connection.state === 'connected') {
            // Use signaling for message delivery in simulation
            this.sendSignalingMessage(peerId, 'chat-message', {
                message: message,
                from: this.myPeerId,
                timestamp: new Date().toISOString()
            });
            
            // Add to local chat history
            app.chatHistory.set(peerId, app.chatHistory.get(peerId) || []);
            
            app.chatHistory.get(peerId).push({
                from: this.myPeerId,
                message: message,
                timestamp: new Date(),
                type: 'sent'
            });
        }
        
        return true;
    }
    
    // Get connection status
    getConnectionStatus(peerId) {
        const connection = this.connections.get(peerId);
        return connection ? connection.state : 'disconnected';
    }
    
    // Disconnect from peer
    disconnect(peerId) {
        const connection = this.connections.get(peerId);
        connection.close();
    }
    
    // Get list of connected peers
    getConnectedPeers() {
        const connected = [];
        this.connections.forEach((connection, peerId) => {
            if (connection.state === 'connected') {
                connected.push(peerId);
            }
        });
        return connected;
    }
    
    // Announce presence to network
    announcePresence(userData) {
        // In a real P2P network, this would broadcast to all peers
        // For demo, we'll store in localStorage for other instances to discover
        const announcements = JSON.parse(localStorage.getItem('p2p_announcements') || '[]');
        
        // Remove old announcement from this peer
        const filtered = announcements.filter(a => a.peerId !== this.myPeerId);
        
        // Add new announcement
        filtered.push({
            peerId: this.myPeerId,
            userData: userData,
            timestamp: Date.now(),
            ipAddress: app.getUserIP()
        });
        
        // Keep only recent announcements (last 5 minutes)
        const recent = filtered.filter(a => Date.now() - a.timestamp < 300000);
        
        localStorage.setItem('p2p_announcements', JSON.stringify(recent));
    }
    
    // Discover peers on network
    discoverPeers() {
        const announcements = JSON.parse(localStorage.getItem('p2p_announcements') || '[]');
        const peers = announcements
            .filter(a => a.peerId !== this.myPeerId) // Exclude self
            .filter(a => Date.now() - a.timestamp < 300000) // Recent only
            .map(a => ({
                ...a.userData,
                peerId: a.peerId,
                ipAddress: a.ipAddress
            }));
        
        return peers;
    }
}

// Global network engine instance
const network = new NetworkEngine();