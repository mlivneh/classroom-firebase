// 🎯 SIMPLIFIED CLASSROOM SDK - 4-DIGIT ROOM CODES ONLY!

class ClassroomSDK {
    constructor() {
        try {
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            this.functions = firebase.app().functions('me-west1');
            console.log('✅ Firebase services initialized in constructor.');
        } catch (e) {
            console.error("❌ CRITICAL: Could not initialize Firebase services.", e);
            alert("Fatal Error: Could not connect to Firebase services. Please refresh.");
        } 
        

        this.playerName = null;
        this.roomCode = null; // קוד חדר 4 ספרות
        this.isTeacher = false;
        this.isInitialized = false;

        // UI components
        this.chatButton = null;
        this.chatContainer = null;
        this.chatMessages = null;
        this.chatInput = null;
        this.aiButton = null;
        this.aiContainer = null;
        this.aiMessages = null;
        this.aiInput = null;
        
        // Listeners
        this.studentsListener = null;
        this.messagesListener = null;
        this.roomListener = null;
    }

    // התחברות אנונימית
    async loginAnonymously() {
        try {
            const userCredential = await this.auth.signInAnonymously();
            console.log('✅ Anonymous login successful:', userCredential.user.uid);
            return userCredential.user;
        } catch (error) {
            console.error('🔥 Anonymous login failed:', error);
            throw error;
        }
    }

    // יצירת קוד חדר ייחודי 4 ספרות
    async generateUniqueRoomCode() {
        let attempts = 0;
        const maxAttempts = 20; // מקסימום 20 ניסיונות
        
        while (attempts < maxAttempts) {
            // יצירת קוד 4 ספרות רנדומלי
            const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
            
            // בדיקה שהקוד לא קיים
            const roomRef = this.db.collection('rooms').doc(roomCode);
            const doc = await roomRef.get();
            
            if (!doc.exists) {
                console.log(`✅ Found unique room code: ${roomCode}`);
                return roomCode;
            }
            
            console.log(`🔄 Room code ${roomCode} exists, trying next...`);
            attempts++;
        }
        
        // אם לא מצאנו אחרי 20 ניסיונות, נחזיר קוד רנדומלי
        const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
        console.log(`✅ Generated random room code: ${randomCode}`);
        return randomCode;
    }

    // 🎯 SIMPLIFIED INIT - 4-digit room codes only!
    async init(appName, user, playerName, roomCode = null) {
        console.log(`🚀 Initializing ${appName}...`);

        // המתנה לוודא שהמשתמש מאומת
        if (!user || !user.uid) {
            throw new Error('User must be authenticated before initialization');
        }

        if (appName === 'teacher-dashboard') {
            // המורה - יוצר חדר חדש עם קוד ייחודי
            this.roomCode = await this.generateUniqueRoomCode();
            this.isTeacher = true;
            this.playerName = '🎓 המורה';
            
            // יצירת/עדכון מסמך החדר
            await this.initializeRoom();
            
        } else if (appName === 'student-app' && roomCode) {
            // התלמיד - מתחבר לחדר קיים
            this.roomCode = roomCode;
            this.isTeacher = false;
            this.playerName = playerName;
            
            // הוספת התלמיד לחדר
            await this.joinRoom(user.uid);
        } else {
            throw new Error('Invalid initialization parameters');
        }

        this.createChatInterface();
        this.createAIInterface();
        
        this.isInitialized = true;
        console.log(`✅ ${appName} initialized. Room: ${this.roomCode}`);
    }

    // יצירת/אתחול חדר למורה
    async initializeRoom() {
        const roomRef = this.db.collection('rooms').doc(this.roomCode);
        
        try {
            await roomRef.set({
                room_code: this.roomCode,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                last_activity: firebase.firestore.FieldValue.serverTimestamp(),
                teacher_uid: this.auth.currentUser.uid,
                settings: {
                    ai_active: false,
                    current_command: null
                }
            }, { merge: true }); // merge כדי לא למחוק נתונים קיימים
            
            console.log(`✅ Room ${this.roomCode} initialized successfully`);
        } catch (error) {
            console.error('🔥 Error initializing room:', error);
            throw error;
        }
    }

    // הוספת תלמיד לחדר
    async joinRoom(studentUID) {
        const studentRef = this.db.collection('rooms').doc(this.roomCode)
                                 .collection('students').doc(studentUID);
        
        try {
            await studentRef.set({
                uid: studentUID,
                name: this.playerName,
                joined_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`✅ ${this.playerName} joined room`);
        } catch (error) {
            console.error('🔥 Error joining room:', error);
            throw error;
        }
    }

    // האזנה לתלמידים
    listenForStudents(callback) {
        if (!this.roomCode) return;
        
        const studentsCollection = this.db.collection('rooms').doc(this.roomCode)
                                         .collection('students');
        
        this.studentsListener = studentsCollection.onSnapshot(snapshot => {
            const students = [];
            snapshot.forEach(doc => {
                students.push(doc.data());
            });
            console.log('👨‍🎓 Students updated:', students.length);
            
            if (typeof callback === 'function') {
                callback(students);
            }
        }, error => {
            console.error("🔥 Error listening for students:", error);
        });
    }

    // האזנה להודעות
    listenForMessages(callback) {
        if (!this.roomCode) return;
        
        this.displayedMessageIds = new Set();
        
        const messagesCollection = this.db.collection('rooms').doc(this.roomCode)
                                         .collection('messages')
                                         .orderBy('timestamp', 'asc');
        
        this.messagesListener = messagesCollection.onSnapshot(snapshot => {
            const newMessages = [];
            snapshot.docChanges().forEach(change => {
                const msg = change.doc.data();
                const messageId = change.doc.id;
                
                if (!this.displayedMessageIds.has(messageId)) {
                    this.displayedMessageIds.add(messageId);
                    
                    // סינון הודעות פרטיות - הצג רק אם:
                    // 1. זו הודעה ציבורית (is_private = false או לא מוגדר)
                    // 2. זו הודעה פרטית שנשלחה אליך
                    // 3. אתה המורה (יכול לראות הכל)
                    const isPrivate = msg.is_private === true;
                    const isRecipient = msg.recipient_uid === this.auth.currentUser?.uid;
                    const isSender = msg.sender_uid === this.auth.currentUser?.uid;
                    
                    if (!isPrivate || this.isTeacher || isRecipient || isSender) {
                        newMessages.push(msg);
                    }
                }
            });
            
            if (newMessages.length > 0 && typeof callback === 'function') {
                callback(newMessages);
            }
        }, error => {
            console.error("🔥 Error listening for messages:", error);
        });
    }

    // האזנה לעדכוני חדר (פקודות, AI וכו')
    listenForRoomUpdates(commandCallback) {
        if (!this.roomCode) return;
        
        const roomRef = this.db.collection('rooms').doc(this.roomCode);

        this.roomListener = roomRef.onSnapshot(doc => {
            if (doc.exists) {
                const roomData = doc.data();
                
                // טיפול בפקודות
                const command = roomData.settings?.current_command;
                if (command && typeof commandCallback === 'function') {
                    console.log('⚡️ Command received:', command);
                    commandCallback(command);
                }

                // טיפול בסטטוס AI
                if (this.aiButton) {
                    if (roomData.settings?.ai_active === true) {
                        this.aiButton.style.display = 'block';
                        console.log('🤖 AI activated');
                    } else {
                        this.aiButton.style.display = 'none';
                        console.log('🤖 AI deactivated');
                    }
                }
            }
        }, error => {
            console.error("🔥 Error listening for room updates:", error);
        });
    }

    // שליחת הודעה
    async sendMessage(content) {
        if (!content || !content.trim() || !this.roomCode) return;

        try {
            const messagesCollection = this.db.collection('rooms').doc(this.roomCode)
                                             .collection('messages');
            await messagesCollection.add({
                sender: this.playerName,
                sender_uid: this.auth.currentUser?.uid,
                content: content,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                is_teacher: this.isTeacher
            });
        } catch (error) {
            console.error('🔥 Error sending message:', error);
            throw error;
        }
    }

    // שליחת פקודה (רק למורה)
    async sendCommand(commandName, payload = {}) {
        const roomRef = this.db.collection('rooms').doc(this.roomCode);
        await roomRef.update({
            'settings.current_command': {
                command: commandName,
                payload: payload,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            },
            'last_activity': firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // החלפת מצב AI (רק למורה)
    async toggleAI() {
        const roomRef = this.db.collection('rooms').doc(this.roomCode);
        const doc = await roomRef.get();
        const currentAI = doc.exists ? doc.data().settings?.ai_active : false;
        
        await roomRef.update({
            'settings.ai_active': !currentAI,
            'last_activity': firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return !currentAI;
    }

    // ניקוי
    cleanup() {
        if (this.studentsListener) {
            this.studentsListener();
            this.studentsListener = null;
        }
        if (this.messagesListener) {
            this.messagesListener();
            this.messagesListener = null;
        }
        if (this.roomListener) {
            this.roomListener();
            this.roomListener = null;
        }
    }

    // מחזיר את קוד החדר
    getRoomCode() {
        return this.roomCode;
    }

    // ========== CHAT INTERFACE ==========
    createChatInterface() {
        if (document.getElementById('classroom-chat-btn')) return;
        
        this.chatButton = document.createElement('button');
        this.chatButton.id = 'classroom-chat-btn';
        this.chatButton.innerHTML = '💬';
        this.chatButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: #007bff; color: white; border: none; font-size: 24px; cursor: grab; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000;';
        this.chatButton.onclick = () => this.toggleChat();
        this.makeDraggable(this.chatButton);
        document.body.appendChild(this.chatButton);

        this.chatContainer = document.createElement('div');
        this.chatContainer.id = 'classroom-chat-container';
        this.chatContainer.style.cssText = 'position: fixed; bottom: 100px; right: 20px; width: 350px; height: 400px; background: white; border-radius: 15px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); z-index: 999; display: none; overflow: hidden;';
        
        const chatHeader = document.createElement('div');
        chatHeader.style.cssText = 'background: #007bff; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; cursor: grab;';
        chatHeader.innerHTML = `
            <span>💬 צ'אט כיתתי</span>
            <button id="chat-minimize-btn" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 5px;">−</button>
        `;
        
        this.makeDraggable(this.chatContainer, chatHeader);
        
        chatHeader.querySelector('#chat-minimize-btn').onclick = (e) => {
            e.stopPropagation();
            this.toggleChat();
        };
        
        this.chatContainer.appendChild(chatHeader);
        
        const chatContent = document.createElement('div');
        chatContent.style.cssText = 'height: calc(100% - 60px); display: flex; flex-direction: column;';
        
        this.chatMessages = document.createElement('div');
        this.chatMessages.id = 'classroom-chat-messages';
        this.chatMessages.style.cssText = 'flex: 1; padding: 15px; overflow-y: auto; background: #f8f9fa;';
        this.chatMessages.innerHTML = '<div style="text-align: center; color: #999; font-style: italic;">טרם נשלחו הודעות</div>';
        
        const chatInputArea = document.createElement('div');
        chatInputArea.style.cssText = 'padding: 15px; border-top: 1px solid #eee; background: white;';
        
        this.chatInput = document.createElement('input');
        this.chatInput.type = 'text';
        this.chatInput.placeholder = 'כתוב הודעה...';
        this.chatInput.style.cssText = 'width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 20px; outline: none; font-size: 14px;';
        
        this.chatInput.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const messageContent = this.chatInput.value.trim();
                if (messageContent) {
                    this.sendMessage(messageContent);
                    this.chatInput.value = '';
                }
            }
        };
        
        chatInputArea.appendChild(this.chatInput);
        chatContent.appendChild(this.chatMessages);
        chatContent.appendChild(chatInputArea);
        this.chatContainer.appendChild(chatContent);
        document.body.appendChild(this.chatContainer);
    }

    enableChat() {
        if (this.chatButton) {
            this.chatButton.style.display = 'block';
        }
    }

    toggleChat() {
        if (!this.chatContainer) return;
        
        const isVisible = this.chatContainer.style.display !== 'none';
        this.chatContainer.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible && this.chatInput) {
            this.chatInput.focus();
        }
    }

    addChatMessage(sender, content, messageObj) {
        if (!this.chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = 'margin-bottom: 10px; padding: 8px 12px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
        
        const senderSpan = document.createElement('div');
        senderSpan.style.cssText = 'font-weight: bold; color: #007bff; font-size: 12px; margin-bottom: 4px;';
        senderSpan.textContent = sender;
        
        const contentSpan = document.createElement('div');
        contentSpan.style.cssText = 'color: #333; line-height: 1.4;';
        contentSpan.textContent = content;
        
        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(contentSpan);
        
        // הסר את ההודעה הראשונה אם זה "טרם נשלחו הודעות"
        if (this.chatMessages.children.length === 1 && 
            this.chatMessages.children[0].textContent.includes('טרם נשלחו הודעות')) {
            this.chatMessages.innerHTML = '';
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    // ========== AI INTERFACE ==========
    createAIInterface() {
        if (document.getElementById('classroom-ai-btn')) return;
        
        this.aiButton = document.createElement('button');
        this.aiButton.id = 'classroom-ai-btn';
        this.aiButton.innerHTML = '🤖';
        this.aiButton.style.cssText = 'position: fixed; bottom: 20px; right: 90px; width: 60px; height: 60px; border-radius: 50%; background: #28a745; color: white; border: none; font-size: 24px; cursor: grab; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000; display: none;';
        this.aiButton.onclick = () => this.toggleAI();
        this.makeDraggable(this.aiButton);
        document.body.appendChild(this.aiButton);

        this.aiContainer = document.createElement('div');
        this.aiContainer.id = 'classroom-ai-container';
        this.aiContainer.style.cssText = 'position: fixed; bottom: 100px; right: 20px; width: 400px; height: 500px; background: white; border-radius: 15px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); z-index: 999; display: none; overflow: hidden;';
        
        const aiHeader = document.createElement('div');
        aiHeader.style.cssText = 'background: #28a745; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; cursor: grab;';
        aiHeader.innerHTML = `
            <span>🤖 עוזר AI</span>
            <button id="ai-minimize-btn" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 5px;">−</button>
        `;
        
        this.makeDraggable(this.aiContainer, aiHeader);
        
        aiHeader.querySelector('#ai-minimize-btn').onclick = (e) => {
            e.stopPropagation();
            this.toggleAI();
        };
        
        this.aiContainer.appendChild(aiHeader);
        
        const aiContent = document.createElement('div');
        aiContent.style.cssText = 'height: calc(100% - 60px); display: flex; flex-direction: column;';
        
        this.aiMessages = document.createElement('div');
        this.aiMessages.id = 'classroom-ai-messages';
        this.aiMessages.style.cssText = 'flex: 1; padding: 15px; overflow-y: auto; background: #f8f9fa;';
        this.aiMessages.innerHTML = '<div style="text-align: center; color: #999; font-style: italic;">שאל את העוזר AI...</div>';
        
        const aiInputArea = document.createElement('div');
        aiInputArea.style.cssText = 'padding: 15px; border-top: 1px solid #eee; background: white;';
        
        this.aiInput = document.createElement('input');
        this.aiInput.type = 'text';
        this.aiInput.placeholder = 'שאל שאלה...';
        this.aiInput.style.cssText = 'width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 20px; outline: none; font-size: 14px;';
        
        this.aiInput.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const prompt = this.aiInput.value.trim();
                if (prompt) {
                    this.sendAIMessage(prompt);
                    this.aiInput.value = '';
                }
            }
        };
        
        aiInputArea.appendChild(this.aiInput);
        aiContent.appendChild(this.aiMessages);
        aiContent.appendChild(aiInputArea);
        this.aiContainer.appendChild(aiContent);
        document.body.appendChild(this.aiContainer);
    }

    toggleAI() {
        if (!this.aiContainer) return;
        
        const isVisible = this.aiContainer.style.display !== 'none';
        this.aiContainer.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible && this.aiInput) {
            this.aiInput.focus();
        }
    }

    async sendAIMessage(prompt) {
        // ודא שהפונקציות מאותחלות
        if (!this.functions) {
            this.addAIMessage("🤖", "שגיאה: שירות ה-AI לא זמין", false);
            return;
        }
        // ודא שהמשתמש מאומת
        let user = this.auth.currentUser;
        if (!user) {
            try {
                const userCredential = await this.auth.signInAnonymously();
                user = userCredential.user;
            } catch (authError) {
                this.addAIMessage("🤖", "שגיאה בהרשאות. לא ניתן להתחבר לשירות ה-AI. נסה לרענן את הדף.", false);
                return;
            }
        }
        if (!user || !user.uid) {
            this.addAIMessage("🤖", "שגיאה בהרשאות. לא ניתן להתחבר לשירות ה-AI.", false);
            return;
        }
        try {
            this.addAIMessage(this.playerName || "אתה", prompt, true);
            // ודא שהטוקן עדכני
            await user.getIdToken(true);
            const askGeminiFunction = this.functions.httpsCallable('askGemini');
            const result = await askGeminiFunction({prompt: prompt});
            this.addAIMessage("🤖", result.data.result, false);
        } catch (error) {
            let errorMsg = "שגיאה בשירות ה-AI";
            if (error.code === 'functions/unauthenticated') {
                errorMsg = "שגיאה בהרשאות. אנא התחבר מחדש.";
            } else if (error.code === 'functions/failed-precondition') {
                errorMsg = "שירות ה-AI לא מוגדר. פנה למנהל המערכת.";
            } else if (error.code === 'functions/internal') {
                errorMsg = "שגיאה פנימית בשירות ה-AI. נסה שוב.";
            }
            this.addAIMessage("🤖", errorMsg, false);
        }
    }

    addAIMessage(sender, content, isUser) {
        if (!this.aiMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `margin-bottom: 10px; padding: 8px 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); ${isUser ? 'background: #007bff; color: white; margin-left: 20px;' : 'background: white; color: #333; margin-right: 20px;'}`;
        
        const senderSpan = document.createElement('div');
        senderSpan.style.cssText = `font-weight: bold; font-size: 12px; margin-bottom: 4px; ${isUser ? 'color: rgba(255,255,255,0.8);' : 'color: #28a745;'}`;
        senderSpan.textContent = sender;
        
        const contentSpan = document.createElement('div');
        contentSpan.style.cssText = 'line-height: 1.4;';
        contentSpan.textContent = content;
        
        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(contentSpan);
        
        // הסר את ההודעה הראשונה אם זה "שאל את העוזר AI..."
        if (this.aiMessages.children.length === 1 && 
            this.aiMessages.children[0].textContent.includes('שאל את העוזר AI')) {
            this.aiMessages.innerHTML = '';
        }
        
        this.aiMessages.appendChild(messageDiv);
        this.aiMessages.scrollTop = this.aiMessages.scrollHeight;
    }

    // ========== UTILITY FUNCTIONS ==========
    makeDraggable(element, dragHandle = null) {
        const handle = dragHandle || element;
        
        const handleMouseDown = (e) => {
            e.preventDefault();
            const startX = e.clientX - element.offsetLeft;
            const startY = e.clientY - element.offsetTop;
            
            const handleMouseMove = (e) => {
                element.style.left = (e.clientX - startX) + 'px';
                element.style.top = (e.clientY - startY) + 'px';
            };
            
            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        };
        
        handle.addEventListener('mousedown', handleMouseDown);
    }

    showGameNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 15px 25px; border-radius: 25px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 10000;
            font-weight: bold; font-size: 16px; animation: slideDown 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        // הוספת CSS לאנימציות
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideDown { from { transform: translateX(-50%) translateY(-100%); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
                @keyframes slideUp { from { transform: translateX(-50%) translateY(0); opacity: 1; } to { transform: translateX(-50%) translateY(-100%); opacity: 0; } }
            `;
            document.head.appendChild(style);
        }
    }

    // שליחת הודעה פרטית (רק למורה)
    async sendPrivateMessage(content, recipientUid) {
        if (!content || !content.trim() || !this.roomCode || !recipientUid) return;

        try {
            const messagesCollection = this.db.collection('rooms').doc(this.roomCode)
                                             .collection('messages');
            await messagesCollection.add({
                sender: this.playerName,
                sender_uid: this.auth.currentUser?.uid,
                recipient_uid: recipientUid,
                content: content,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                is_teacher: this.isTeacher,
                is_private: true
            });
        } catch (error) {
            console.error('🔥 Error sending private message:', error);
            throw error;
        }
    }

    // בדיקת זמינות שירות ה-AI
    async testAIService() {
        if (!this.functions) {
            return { available: false, error: "Firebase Functions not initialized", code: "functions/not-initialized" };
        }

        // ודא שהמשתמש מאומת לפני הקריאה לפונקציה בענן
        let user = this.auth.currentUser;
        if (!user) {
            try {
                const userCredential = await this.auth.signInAnonymously();
                user = userCredential.user;
            } catch (authError) {
                return { available: false, error: "Authentication failed", code: "auth-failed" };
            }
        }

        if (!user || !user.uid) {
            return { available: false, error: "User not authenticated", code: "auth-missing" };
        }

        try {
            const askGeminiFunction = this.functions.httpsCallable('askGemini');
            const result = await askGeminiFunction({ prompt: "שלום" });

            return { available: true, result: result.data.result, code: "success" };
        } catch (error) {
            return { available: false, error: error.message, code: error.code || "unknown" };
        }
    }
}