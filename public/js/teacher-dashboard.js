class TeacherDashboard {
    constructor() {
        this.sdk = null;
        this.students = [];
        this.activities = [];
        this.isAiActive = false; // Track AI status
        this.aiWarningShown = false; // למנוע הודעות חוזרות
        
        // 🔧 תיקון עיברית - הגדרת locale
        this.locale = 'he-IL';
        this.rtlSupport = true;
    }

    // Debugging utility עם תמיכה בעיברית
    debugLog(message, data = null) {
        const debugEnabled = true;
        if (!debugEnabled) return;
        
        const debugConsoleContent = document.querySelector('.enhanced-debug-console .debug-content');
        if(debugConsoleContent) {
            const logEntry = document.createElement('div');
            logEntry.style.direction = 'rtl';
            logEntry.style.textAlign = 'right';
            logEntry.innerHTML = `<div>[${new Date().toLocaleTimeString(this.locale)}] ${message}</div>`;
            if (data) {
                const dataPre = document.createElement('pre');
                dataPre.style.cssText = 'margin-left: 20px; color: #ffaa00; direction: ltr; text-align: left;';
                dataPre.textContent = JSON.stringify(data, null, 2);
                logEntry.appendChild(dataPre);
            }
            debugConsoleContent.appendChild(logEntry);
            debugConsoleContent.scrollTop = debugConsoleContent.scrollHeight;
        }
        console.log(`[TEACHER DEBUG] ${message}`, data);
    }

    async init() {
        this.debugLog("🚀 מאתחל לוח בקרת המורה...");
        this.sdk = new ClassroomSDK();

        // שלב 1: ביצוע התחברות אנונימית למורה
        let user;
        try {
            user = await this.sdk.loginAnonymously();
            this.debugLog("👑 המורה התחבר בהצלחה", { uid: user.uid });
            
            // המתנה נוספת לוודא שהמשתמש מאומת לחלוטין
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error("🔥 המורה נכשל בהתחברות:", error);
            this.updateConnectionStatus(false);
            return;
        }

        // שלב 2: אתחול ה-SDK
        try {
            await this.sdk.init('teacher-dashboard', user);
            this.debugLog(`✅ לוח המורה אותחל בהצלחה עם חדר: ${this.sdk.getRoomCode()}`);
        } catch (error) {
            console.error("🔥 נכשל באתחול לוח המורה:", error);
            this.updateConnectionStatus(false);
            return;
        }
        
        // שלב 3: הפעלת המאזינים
        this.sdk.listenForStudents(this.updateStudentsList.bind(this));
        this.sdk.listenForMessages(this.addMessage.bind(this));
        this.sdk.listenForRoomUpdates((command) => {
            if (command) {
                this.addActivity(`⚡ פקודה בוצעה: ${command.command}`);
            }
        });

        // 🔧 תיקון: הפעלת AI מיד למורה
        // המתנה לאימות מלא
        console.log('⏳ Waiting for full authentication...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('✅ Authentication complete, initializing AI...');
        await this.initializeTeacherAI();

        this.updateConnectionStatus(true);
        this.setupEventListeners();
        this.updateRoomDisplay();
        this.debugLog("✅ לוח המורה אותחל בהצלחה.");
    }

    // 🆕 פונקציה חדשה להפעלת AI למורה
    async initializeTeacherAI() {
        this.debugLog("🤖 מאתחל AI למורה...");
        
        try {
            // 1. בדיקת זמינות שירות AI
            const aiStatus = await this.testAIService();
            if (!aiStatus) {
                this.debugLog("⚠️ שירות AI לא זמין, אך ממשיך...");
            }
            
            // 2. הצגת כפתור AI בכל מקרה (גם אם השירות לא זמין)
            this.showTeacherAIButton();
            
            // 3. עדכון סטטוס AI בממשק
            await this.checkAIStatus();
            
            // 4. הוספת הודעה לפעילות
            this.addActivity("🤖 ממשק AI הופעל למורה");
            
            this.debugLog("✅ AI המורה אותחל בהצלחה");
            
        } catch (error) {
            console.error("🔥 שגיאה באתחול AI המורה:", error);
            this.debugLog("❌ אתחול AI המורה נכשל", error);
            
            // גם במקרה של שגיאה - הצג את הכפתור
            this.showTeacherAIButton();
            this.addActivity("⚠️ AI זמין אך עם מגבלות");
        }
    }

    // 🆕 פונקציה להצגת כפתור AI למורה
    showTeacherAIButton() {
        const aiBtn = document.getElementById('openAiSetupBtn');
        if (aiBtn) {
            aiBtn.style.display = 'block';
            aiBtn.style.opacity = '1';
            
            // הוסף אינדיקטור שהמורה יכול להשתמש ב-AI
            const teacherIndicator = document.createElement('div');
            teacherIndicator.className = 'teacher-ai-indicator';
            teacherIndicator.innerHTML = '🎓';
            teacherIndicator.style.cssText = `
                position: absolute; top: -5px; left: -5px;
                background: #28a745; color: white;
                border-radius: 50%; width: 20px; height: 20px;
                font-size: 12px; display: flex;
                align-items: center; justify-content: center;
            `;
            
            if (!aiBtn.querySelector('.teacher-ai-indicator')) {
                aiBtn.style.position = 'relative';
                aiBtn.appendChild(teacherIndicator);
            }
            
            this.debugLog("🤖 כפתור AI הוצג למורה");
        }
    }

    // Check current AI status from Firestore
    async checkAIStatus() {
        if (!this.sdk || !this.sdk.db) {
            this.debugLog("❌ לא ניתן לבדוק סטטוס AI - SDK/DB לא מוכן");
            return;
        }
        
        try {
            const roomRef = this.sdk.db.collection('rooms').doc(this.sdk.getRoomCode());
            const doc = await roomRef.get();
            
            if (doc.exists) {
                const roomData = doc.data();
                this.isAiActive = roomData.settings?.ai_active === true;
                this.updateAIButton();
                
                this.debugLog(`🤖 סטטוס AI נבדק: ${this.isAiActive ? 'פעיל' : 'כבוי'}`);
            } else {
                this.debugLog("⚠️ מסמך החדר לא נמצא לבדיקת סטטוס AI");
            }
        } catch (error) {
            console.error("🔥 שגיאה בבדיקת סטטוס AI:", error);
            this.debugLog("❌ בדיקת סטטוס AI נכשלה", error);
        }
    }

    // Update AI button appearance
    updateAIButton() {
        const aiBtn = document.getElementById('openAiSetupBtn');
        if (aiBtn) {
            const icon = aiBtn.querySelector('.tool-icon');
            const label = aiBtn.querySelector('.tool-label');
            const desc = aiBtn.querySelector('.tool-desc');
            
            if (this.isAiActive) {
                icon.textContent = '🤖';
                label.textContent = 'AI פעיל';
                desc.textContent = 'לחץ לכיבוי AI';
                aiBtn.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
            } else {
                icon.textContent = '🔴';
                label.textContent = 'AI כבוי';
                desc.textContent = 'לחץ להפעלת AI';
                aiBtn.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
            }
        }
    }

    // 🔧 עדכון testAIService - לוגיקה משופרת
    async testAIService() {
    // בדיקה מקיפה של כל הרכיבים הנדרשים
    if (!this.sdk) {
        this.debugLog("❌ SDK לא זמין לבדיקת AI");
        return false;
    }
    
    if (!this.sdk.auth?.currentUser) {
        this.debugLog("❌ משתמש לא מאומת לבדיקת AI");
        return false;
    }
    
    if (!this.sdk.functions) {
        this.debugLog("❌ Firebase Functions לא מאותחל");
        return false;
    }
        
        this.debugLog("🔍 בודק זמינות שירות AI...");
        
        try {
            const result = await this.sdk.testAIService();
            
            if (result.available) {
                this.debugLog("✅ שירות AI זמין ועובד", result);
                return true;
            } else {
                this.debugLog("❌ שירות AI לא זמין", result);
                
                // הצג הודעה מפורטת למורה
                let errorDetails = "שירות ה-AI לא זמין";
                if (result.code === 'functions/failed-precondition') {
                    errorDetails = "שירות ה-AI לא מוגדר (חסר מפתח API)";
                } else if (result.code === 'functions/unauthenticated') {
                    errorDetails = "שגיאת הרשאות במערכת";
                } else if (result.code === 'functions/not-initialized') {
                    errorDetails = "Firebase Functions לא מאותחל";
                }
                
                // הצג התראה חד פעמית
                if (!this.aiWarningShown) {
                    this.aiWarningShown = true;
                    setTimeout(() => {
                        if (confirm(`⚠️ ${errorDetails}\n\nהאם תרצה לנסות שוב?`)) {
                            this.testAIService();
                        }
                    }, 1000);
                }
                
                return false;
            }
        } catch (error) {
            this.debugLog("🔥 בדיקת שירות AI נכשלה עם שגיאה", error);
            console.error("שגיאת בדיקת AI:", error);
            return false;
        }
    }

    updateConnectionStatus(isConnected) {
        const statusDiv = document.getElementById('connectionStatus');
        if (!statusDiv) return;
        if (isConnected) {
            statusDiv.textContent = '🟢 מחובר ל-Firebase';
            statusDiv.className = 'connection-status connected';
        } else {
            statusDiv.textContent = '🔴 לא מחובר';
            statusDiv.className = 'connection-status disconnected';
        }
    }

    updateStudentsList(studentsData) {
        this.students = studentsData;
        const studentsListDiv = document.getElementById('studentsList');
        const studentsCountSpan = document.getElementById('studentsCount');
        if (!studentsListDiv || !studentsCountSpan) return;
        const noStudentsDiv = studentsListDiv.querySelector('.no-students');
        
        const currentItems = studentsListDiv.querySelectorAll('.student-item');
        currentItems.forEach(item => item.remove());
        studentsCountSpan.textContent = this.students.length;

        if (this.students.length === 0) {
            if(noStudentsDiv) noStudentsDiv.style.display = 'block';
        } else {
            if(noStudentsDiv) noStudentsDiv.style.display = 'none';
            const template = document.getElementById('studentTemplate');
            if (!template) return;
            
            this.students.forEach(student => {
                const studentName = student.name || 'תלמיד לא ידוע';
                const studentElement = document.importNode(template.content, true);
                studentElement.querySelector('.student-name').textContent = studentName;
                
                // הוספת כפתור הודעה פרטית
                const privateMsgBtn = document.createElement('button');
                privateMsgBtn.textContent = 'הודעה פרטית';
                privateMsgBtn.className = 'private-message-btn';
                privateMsgBtn.style.marginRight = '10px';
                privateMsgBtn.onclick = () => this.openPrivateMessageModal(student);
                
                // הוספת הכפתור לאלמנט התלמיד
                const actionsDiv = studentElement.querySelector('.student-actions') || studentElement;
                actionsDiv.appendChild(privateMsgBtn);
                studentsListDiv.appendChild(studentElement);
            });
        }
        this.addActivity(`רשימת התלמידים עודכנה. ${this.students.length} תלמידים מחוברים.`);
    }

    // 🔧 תיקון #1: הודעות undefined - פונקציה מלאה ומתוקנת
    addMessage(messages) {
        // אם זה array של הודעות - עבור על כל אחת
        if (Array.isArray(messages)) {
            messages.forEach(message => this.addSingleMessage(message));
            return;
        }
        
        // אם זו הודעה יחידה
        this.addSingleMessage(messages);
    }

    addSingleMessage(message) {
        const messagesArea = document.getElementById('messagesArea');
        const messagesCountSpan = document.getElementById('messagesCount');
        if (!messagesArea) return;

        // 🔧 תיקון הבעיה: validation מלא על כל השדות
        const sender = message?.sender || 'משתמש לא ידוע';
        const content = message?.content || 'הודעה ריקה';
        const timestamp = message?.timestamp;
        const isTeacher = message?.is_teacher === true;
        const isPrivate = message?.is_private === true;

        // הסר הודעת "אין הודעות עדיין" אם קיימת
        const noMessages = messagesArea.querySelector('.no-messages');
        if (noMessages) {
            noMessages.remove();
        }

        // עדכון מונה הודעות
        if (messagesCountSpan) {
            const currentCount = parseInt(messagesCountSpan.textContent) || 0;
            messagesCountSpan.textContent = currentCount + 1;
        }

        // יצירת אלמנט ההודעה עם validation מלא
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-item';
        messageDiv.style.direction = 'rtl';
        messageDiv.style.textAlign = 'right';
        
        // אייקון מיוחד למורה או הודעה פרטית
        let senderIcon = '';
        if (isTeacher) {
            senderIcon = '🎓 ';
        } else if (isPrivate) {
            senderIcon = '🔒 ';
        }

        // זמן מעוצב
        let timeString = 'זמן לא ידוע';
        if (timestamp) {
            try {
                // אם זה Firestore timestamp
                const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                timeString = date.toLocaleTimeString(this.locale);
            } catch (e) {
                console.warn('לא ניתן לפרסר timestamp:', timestamp);
                timeString = new Date().toLocaleTimeString(this.locale);
            }
        }

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${senderIcon}${sender}</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-content">${content}</div>
            ${isPrivate ? '<div class="message-private-indicator">הודעה פרטית</div>' : ''}
        `;

        // הוספת סגנון מיוחד להודעות פרטיות
        if (isPrivate) {
            messageDiv.style.borderLeft = '4px solid #ffc107';
            messageDiv.style.background = '#fff9c4';
        }

        messagesArea.appendChild(messageDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;

        // רישום לוג מפורט לdebug
        this.debugLog(`📨 הודעה חדשה התקבלה`, {
            sender,
            content: content.substring(0, 50) + '...',
            isTeacher,
            isPrivate,
            timestamp: timeString
        });

        // הוספה לפעילות
        const activityText = isPrivate 
            ? `💬 הודעה פרטית מ-${sender}` 
            : `💬 הודעה מ-${sender}`;
        this.addActivity(activityText);
    }

    addActivity(activityText) {
        const activitiesArea = document.getElementById('activitiesArea');
        if (!activitiesArea) return;

        const activityDiv = document.createElement('div');
        activityDiv.className = 'activity-item';
        activityDiv.style.direction = 'rtl';
        activityDiv.style.textAlign = 'right';
        activityDiv.innerHTML = `
            <span class="activity-time">${new Date().toLocaleTimeString(this.locale)}</span>
            <span class="activity-text">${activityText}</span>
        `;
        activitiesArea.appendChild(activityDiv);
        activitiesArea.scrollTop = activitiesArea.scrollHeight;
    }

    sendCommand(command, payload = {}) {
        if (!this.sdk) return;
        this.sdk.sendCommand(command, payload);
        this.addActivity(`📤 נשלחה פקודה: ${command}`);
    }

    sendMessageToClass(content) {
        if (!content || !content.trim()) return;
        
        if (this.sdk) {
            this.sdk.sendMessage(content);
            this.addActivity(`💬 נשלחה הודעה לכיתה: ${content}`);
        }
    }

    // 🔧 עדכון toggleAIForClass - שיפורים למורה
    async toggleAIForClass() {
        if (!this.sdk) return;
        
        this.debugLog("🔄 מחליף מצב AI לכיתה...");
        
        try {
            // בדיקת זמינות AI לפני החלפה
            const aiAvailable = await this.testAIService();
            if (!aiAvailable && !this.isAiActive) {
                alert("⚠️ שירות ה-AI לא זמין כרגע. לא ניתן להפעיל.");
                return;
            }
            
            const newStatus = await this.sdk.toggleAI();
            this.isAiActive = newStatus;
            this.updateAIButton();
            
            if (newStatus) {
                this.addActivity('🤖 AI הופעל לכיתה - התלמידים יכולים להשתמש');
                this.debugLog("✅ AI הופעל עבור הכיתה");
                
                // הצג הודעה מעודדת
                this.showAIActivationMessage();
            } else {
                this.addActivity('🔴 AI כובה לכיתה - התלמידים לא יכולים להשתמש');
                this.debugLog("🔴 AI כובה עבור הכיתה");
            }
            
        } catch (error) {
            console.error("🔥 שגיאה בהחלפת מצב AI:", error);
            this.debugLog("❌ החלפת AI נכשלה", error);
            alert("שגיאה בהחלפת מצב ה-AI: " + error.message);
        }
    }

    // 🆕 הודעת עידוד להפעלת AI עם תמיכה בעיברית
    showAIActivationMessage() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white; padding: 15px 20px; border-radius: 8px;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
            font-weight: bold; max-width: 300px;
            animation: slideInRight 0.5s ease;
            direction: rtl; text-align: right;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">🤖</span>
                <div>
                    <div>AI הופעל בהצלחה!</div>
                    <div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">
                        התלמידים יכולים עכשיו לשאול שאלות
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // הסר אחרי 4 שניות
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }, 4000);
        
        // הוסף CSS לאנימציות אם לא קיים
        if (!document.getElementById('ai-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    setupEventListeners() {
        // Modal handling
        const openModal = (modalId) => document.getElementById(modalId)?.classList.add('visible');
        const closeModal = (modal) => modal.closest('.modal-overlay')?.classList.remove('visible');

        // Quick message buttons
        document.querySelectorAll('.quick-message-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const message = btn.dataset.message;
                this.sendMessageToClass(message);
            });
        });

        // Content buttons
        document.querySelectorAll('.content-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                this.sendCommand('LOAD_CONTENT', { url });
            });
        });

        // AI toggle
        const aiBtn = document.getElementById('openAiSetupBtn');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => this.toggleAIForClass());
        }

        // Reset classroom
        const resetBtn = document.getElementById('resetClassroomBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetClassroomData());
        }

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                closeModal(e.target);
            });
        });

        // Modal overlays
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal(overlay);
                }
            });
        });

        // Custom content form
        const customContentForm = document.getElementById('customContentForm');
        if (customContentForm) {
            customContentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const url = document.getElementById('customUrl').value.trim();
                if (url) {
                    this.sendCommand('LOAD_CONTENT', { url });
                    closeModal(customContentForm);
                }
            });
        }

        // Message form
        const messageForm = document.getElementById('messageForm');
        if (messageForm) {
            messageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const message = document.getElementById('messageText').value.trim();
                if (message) {
                    this.sendMessageToClass(message);
                    document.getElementById('messageText').value = '';
                    closeModal(messageForm);
                }
            });
        }

        // Private message form
        const privateMessageForm = document.getElementById('privateMessageForm');
        if (privateMessageForm) {
            privateMessageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendPrivateMessage();
            });
        }
    }

    openPrivateMessageModal(student) {
        const modal = document.getElementById('privateMessageModal');
        if (modal) {
            document.getElementById('privateMessageRecipient').textContent = student.name;
            modal.dataset.studentUid = student.uid;
            modal.classList.add('visible');
        }
    }

    async sendPrivateMessage() {
        const modal = document.getElementById('privateMessageModal');
        const content = document.getElementById('privateMessageText').value.trim();
        const studentUid = modal.dataset.studentUid;
        
        if (!content || !studentUid) return;
        
        try {
            await this.sdk.sendPrivateMessage(content, studentUid);
            this.addActivity(`✉️ נשלחה הודעה פרטית ל-${document.getElementById('privateMessageRecipient').textContent}`);
            document.getElementById('privateMessageText').value = '';
            modal.classList.remove('visible');
        } catch (error) {
            console.error("🔥 שגיאה בשליחת הודעה פרטית:", error);
            alert("שגיאה בשליחת הודעה פרטית");
        }
    }

    async resetClassroomData() {
        if (!this.sdk || !confirm('האם אתה בטוח שברצונך לאפס את הכיתה? פעולה זו תמחק את כל הנתונים.')) {
            return;
        }
        
        try {
            // מחיקת החדר מהענן
            const roomRef = this.sdk.db.collection('rooms').doc(this.sdk.getRoomCode());
            await roomRef.delete();
            
            // יצירת חדר חדש
            await this.sdk.initializeRoom();
            
            this.addActivity('🔄 הכיתה אופסה בהצלחה');
            alert('הכיתה אופסה בהצלחה!');
        } catch (error) {
            console.error("🔥 שגיאה באיפוס הכיתה:", error);
            alert("שגיאה באיפוס הכיתה");
        }
    }

    updateRoomDisplay() {
        const roomCodeSpan = document.getElementById('roomCode');
        if (roomCodeSpan && this.sdk) {
            roomCodeSpan.textContent = this.sdk.getRoomCode();
        }
    }
}

// Global functions for HTML buttons עם תמיכה בעיברית
function sendQuickMessage(message) {
    if (window.teacherDashboard) {
        window.teacherDashboard.sendMessageToClass(message);
    }
}

function sendGameContent(url) {
    if (window.teacherDashboard) {
        window.teacherDashboard.sendCommand('LOAD_CONTENT', { url });
    }
}

function sendCustomContent() {
    document.getElementById('customContentModal').classList.add('visible');
}

function toggleAIForClass() {
    if (window.teacherDashboard) {
        window.teacherDashboard.toggleAIForClass();
    }
}

function resetClassroomData() {
    if (window.teacherDashboard) {
        window.teacherDashboard.resetClassroomData();
    }
}

function toggleDebug() {
    const debugConsole = document.querySelector('.enhanced-debug-console');
    if (debugConsole) {
        debugConsole.classList.toggle('visible');
    }
}

function sendMessage() {
    document.getElementById('messageModal').classList.add('visible');
}

function exportData() {
    if (!window.teacherDashboard) return;
    
    const data = {
        students: window.teacherDashboard.students,
        activities: window.teacherDashboard.activities,
        timestamp: new Date().toISOString(),
        roomCode: window.teacherDashboard.sdk?.getRoomCode()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classroom-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function updateAIMenuStatus(isActive) {
    const aiMenuItems = document.querySelectorAll('.ai-menu-item');
    aiMenuItems.forEach(item => {
        item.style.opacity = isActive ? '1' : '0.5';
        item.style.pointerEvents = isActive ? 'auto' : 'none';
    });
}

// פונקציה להעתקת מזהה הכיתה ללוח עם תמיכה בעיברית
function copyClassroomId() {
    if (!window.teacherDashboard || !window.teacherDashboard.sdk) {
        alert('המערכת לא מוכנה עדיין');
        return;
    }
    
    const roomCode = window.teacherDashboard.sdk.getRoomCode();
    
    // העתקה ללוח
    navigator.clipboard.writeText(roomCode).then(() => {
        // שינוי טקסט הכפתור זמנית
        const copyBtn = document.getElementById('copyClassroomIdBtn');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ הועתק!';
            copyBtn.style.background = 'rgba(76, 175, 80, 0.3)';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = 'rgba(255,255,255,0.2)';
            }, 2000);
        }
        
        // הודעה למשתמש
        if (window.teacherDashboard) {
            window.teacherDashboard.addActivity('📋 מזהה הכיתה הועתק ללוח');
        }
    }).catch(err => {
        console.error('שגיאה בהעתקה:', err);
        alert('שגיאה בהעתקת המזהה. נסה להעתיק ידנית.');
    });
}

// פונקציה לבדיקת מצב AI עם הודעות בעיברית
function testAIService() {
    if (window.teacherDashboard) {
        window.teacherDashboard.testAIService().then(result => {
            if (result) {
                alert('✅ שירות ה-AI זמין ועובד תקין!');
            } else {
                alert('❌ שירות ה-AI לא זמין כרגע. בדוק את ההגדרות.');
            }
        });
    }
}

// 🔧 הוספת תמיכה בעיברית לכל המערכת
document.addEventListener('DOMContentLoaded', function() {
    // הגדרת כיוון טקסט לכל האלמנטים הרלוונטיים
    const rtlElements = document.querySelectorAll('.message-item, .activity-item, .student-item');
    rtlElements.forEach(element => {
        element.style.direction = 'rtl';
        element.style.textAlign = 'right';
    });
    
    // הגדרת פונט שתומך בעיברית
    const style = document.createElement('style');
    style.textContent = `
        body, * {
            font-family: 'Segoe UI', Tahoma, Arial, 'Noto Sans Hebrew', 'Hebrew UI', sans-serif !important;
        }
        
        .message-content, .activity-text, .student-name {
            direction: rtl !important;
            text-align: right !important;
            unicode-bidi: embed !important;
        }
        
        .debug-log, .debug-content {
            direction: rtl !important;
            text-align: right !important;
        }
        
        /* תיקון טקסטים עבריים בממשק */
        .dropdown-title, .dropdown-desc, .tool-label, .tool-desc {
            direction: rtl !important;
            text-align: right !important;
        }
    `;
    document.head.appendChild(style);
});

// פונקציה לניפוי שגיאות עם לוגים בעיברית
function debugClassroom() {
    if (!window.teacherDashboard) {
        console.log('לוח המורה לא מאותחל');
        return;
    }
    
    const debug = {
        'חדר': window.teacherDashboard.sdk?.getRoomCode(),
        'תלמידים': window.teacherDashboard.students.length,
        'AI פעיל': window.teacherDashboard.isAiActive,
        'SDK מחובר': !!window.teacherDashboard.sdk,
        'זמן אתחול': new Date().toLocaleTimeString('he-IL')
    };
    
    console.table(debug);
    return debug;
}