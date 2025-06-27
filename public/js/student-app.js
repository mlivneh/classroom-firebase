// public/js/student-app.js - SIMPLIFIED VERSION - 4-DIGIT ROOM CODES ONLY!

const App = {
    classroom: null,

    init: function() {
        // קריאת קוד החדר מה-URL
        this.loadRoomCodeFromURL();
        
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }
    },

    // קריאת קוד החדר מה-URL
    loadRoomCodeFromURL: function() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('classroom');
        
        if (roomCode) {
            const roomCodeInput = document.getElementById('teacher-uid');
            if (roomCodeInput) {
                roomCodeInput.value = roomCode;
                roomCodeInput.style.background = '#e8f5e8'; // רקע ירוק קל
                roomCodeInput.placeholder = 'קוד החדר (הועתק אוטומטית)';
                
                // הודעה למשתמש
                const loginBox = document.querySelector('.login-box');
                if (loginBox) {
                    const infoDiv = document.createElement('div');
                    infoDiv.style.cssText = 'background: #e8f5e8; color: #2e7d32; padding: 10px; border-radius: 6px; margin: 10px 0; font-size: 14px;';
                    infoDiv.innerHTML = '✅ קוד החדר הועתק אוטומטית! פשוט הזן את שמך ולחץ "הצטרף לשיעור"';
                    loginBox.insertBefore(infoDiv, loginBox.firstChild);
                }
            }
        }
    },

    handleLogin: async function(event) {
        event.preventDefault();
        const playerNameInput = document.getElementById('player-name');
        const roomCodeInput = document.getElementById('teacher-uid');
        const playerName = playerNameInput.value.trim();
        const roomCode = roomCodeInput ? roomCodeInput.value.trim() : null;

        if (!playerName) {
            alert('חובה להזין שם!');
            return;
        }

        if (!roomCode) {
            alert('חובה להזין קוד חדר!');
            return;
        }

        // בדיקה שקוד החדר הוא 4 ספרות
        if (!/^\d{4}$/.test(roomCode)) {
            alert('קוד החדר חייב להיות 4 ספרות!');
            return;
        }

        try {
            console.log(`Login attempt for: ${playerName} in room: ${roomCode}`);
            this.classroom = new ClassroomSDK();

            // --- AUTHENTICATION FLOW ---
            // 1. Sign in anonymously to get a unique user object containing the UID
            const user = await this.classroom.loginAnonymously();

            // 2. Hide login screen and show main app container AFTER successful sign-in
            const loginContainer = document.getElementById('login-container');
            if(loginContainer) loginContainer.style.display = 'none';
            
            const mainContainer = document.getElementById('main-container');
            if(mainContainer) mainContainer.style.display = 'block';

            // 3. Initialize the SDK with the user object, player name, and room code
            await this.classroom.init('student-app', user, playerName, roomCode);

            // 4. Setup UI and listeners
            if (this.classroom.createChatInterface) {
                this.classroom.createChatInterface();
                this.classroom.enableChat();
            }
            if (this.classroom.createAIInterface) {
                this.classroom.createAIInterface();
            }
            
            // Listen for messages and add them to chat
            this.classroom.listenForMessages((messages) => {
                messages.forEach(message => {
                    this.classroom.addChatMessage(message.sender, message.content, message);
                });
            });
            
            // Listen for room updates (commands)
            this.classroom.listenForRoomUpdates(this.executeCommand.bind(this));

            console.log('✅ Student app initialized successfully with new system!');

        } catch (error) {
            console.error("❌ Failed to initialize student app:", error);
            alert("ההתחברות לחדר נכשלה. אנא ודא שחיבור האינטרנט תקין ורענן את הדף.");
        }
    },

    // Command execution
    executeCommand: function(command) {
        if (!command || !command.command) return;
        
        console.log(`🎯 Executing command: ${command.command}`, command.payload);
        
        switch (command.command) {
            case 'LOAD_CONTENT':
                const iframe = document.getElementById('content-frame');
                if (iframe && command.payload && command.payload.url) {
                    // Show nice notification
                    if (this.classroom && this.classroom.showGameNotification) {
                        if (command.payload.url === 'about:blank') {
                            this.classroom.showGameNotification(`📺 המסך נוקה`);
                        } else {
                            this.classroom.showGameNotification(`📱 טוען תוכן חדש מהמורה...`);
                        }
                    }
                    
                    // Load the content
                    iframe.src = command.payload.url;
                    
                    console.log(`✅ Content loaded: ${command.payload.url}`);
                }
                break;
                
            case 'SHOW_MESSAGE':
                // Direct message from teacher
                if (command.payload && command.payload.message) {
                    if (this.classroom && this.classroom.showGameNotification) {
                        this.classroom.showGameNotification(`💬 המורה: ${command.payload.message}`);
                    }
                    
                    // Also add to chat if it's open
                    if (this.classroom && this.classroom.addChatMessage) {
                        this.classroom.addChatMessage('🎓 המורה', command.payload.message);
                    }
                }
                break;
                
            case 'STOP_CONTENT':
                // Stop current content
                const iframe2 = document.getElementById('content-frame');
                if (iframe2) {
                    iframe2.src = 'about:blank';
                    if (this.classroom && this.classroom.showGameNotification) {
                        this.classroom.showGameNotification(`⏹️ התוכן הופסק על ידי המורה`);
                    }
                }
                break;
                
            case 'CLEAR_SCREEN':
                // Clear screen command
                const iframe3 = document.getElementById('content-frame');
                if (iframe3) {
                    iframe3.src = 'about:blank';
                    if (this.classroom && this.classroom.showGameNotification) {
                        this.classroom.showGameNotification(`🧹 המסך נוקה`);
                    }
                }
                break;
                
            default:
                console.log(`❓ Unknown command: ${command.command}`);
                break;
        }
    }
};

// Run the app when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});