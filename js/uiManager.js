export class UIManager {
    constructor(onStart, onPause, onResume, onRestart, onDifficultyChange, onTeamSelect, onSpeedChange) {
        this.onStart = onStart;
        this.onPause = onPause;
        this.onResume = onResume;
        this.onRestart = onRestart;
        this.onDifficultyChange = onDifficultyChange;
        this.onTeamSelect = onTeamSelect;
        this.onSpeedChange = onSpeedChange;
        
        // Cache DOM elements
        this.elements = {
            mainMenu: document.getElementById('main-menu'),
            pauseMenu: document.getElementById('pause-menu'),
            gameOver: document.getElementById('game-over'),
            scoreYou: document.getElementById('score-you'),
            scoreAI: document.getElementById('score-ai'),
            gameTime: document.getElementById('game-time'),
            finalScore: document.getElementById('final-score'),
            difficulty: document.getElementById('difficulty'),
            playerTeam: document.getElementById('player-team'),
            aiTeam: document.getElementById('ai-team'),
            playerTeamColor: document.getElementById('player-team-color'),
            aiTeamColor: document.getElementById('ai-team-color'),
            gameSpeed: document.getElementById('game-speed'),
            speedValue: document.getElementById('speed-value')
        };
        
        // Check if this is a mobile device
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Create notification container if it doesn't exist
        if (!document.getElementById('notification-container')) {
            const notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.position = 'absolute';
            notificationContainer.style.top = '20px';
            notificationContainer.style.left = '50%';
            notificationContainer.style.transform = 'translateX(-50%)';
            notificationContainer.style.zIndex = '1000';
            document.body.appendChild(notificationContainer);
        }
        
        // Initialize UI
        this.setupEventListeners();
        this.initMobileControls();
    }
    
    setupEventListeners() {
        // Start game button
        document.getElementById('start-game').addEventListener('click', () => {
            this.onStart();
        });
        
        // Difficulty selector
        this.elements.difficulty.addEventListener('change', (event) => {
            this.onDifficultyChange(event.target.value);
        });
        
        // Team selectors
        this.elements.playerTeam.addEventListener('change', (event) => {
            this.onTeamSelect('player', event.target.value);
            this.updateTeamColorPreview('player', event.target.value);
        });
        
        this.elements.aiTeam.addEventListener('change', (event) => {
            this.onTeamSelect('ai', event.target.value);
            this.updateTeamColorPreview('ai', event.target.value);
        });
        
        // Initialize color previews
        this.updateTeamColorPreview('player', this.elements.playerTeam.value);
        this.updateTeamColorPreview('ai', this.elements.aiTeam.value);
        
        // Pause menu buttons
        document.getElementById('resume-game').addEventListener('click', () => {
            this.onResume();
        });
        
        document.getElementById('restart-game').addEventListener('click', () => {
            this.onRestart();
        });
        
        document.getElementById('quit-game').addEventListener('click', () => {
            this.showMainMenu();
        });
        
        // Game over buttons
        document.getElementById('play-again').addEventListener('click', () => {
            this.onRestart();
        });
        
        document.getElementById('return-menu').addEventListener('click', () => {
            this.showMainMenu();
        });
        
        // Game speed slider
        this.elements.gameSpeed.addEventListener('input', (event) => {
            const speedValue = parseFloat(event.target.value);
            this.updateSpeedValueDisplay(speedValue);
            this.onSpeedChange(speedValue);
        });
    }
    
    // Initialize mobile controls based on device detection
    initMobileControls() {
        const mobileControls = document.getElementById('mobile-controls');
        
        // Force display mobile controls if on a touch device or small screen
        console.log("Checking for mobile device...");
        this.isMobile = 'ontouchstart' in window || 
                       navigator.maxTouchPoints > 0 || 
                       window.innerWidth <= 1024;
        
        console.log("Device is mobile:", this.isMobile, 
                    "ontouchstart:", 'ontouchstart' in window, 
                    "maxTouchPoints:", navigator.maxTouchPoints, 
                    "screen width:", window.innerWidth);
        
        if (this.isMobile) {
            console.log("Mobile device detected! Initializing touch controls");
            
            // Force display mobile controls
            if (mobileControls) {
                // Set important display properties to ensure visibility
                mobileControls.style.display = 'flex';
                mobileControls.style.zIndex = '9999';
                mobileControls.style.pointerEvents = 'auto';
                mobileControls.style.visibility = 'visible';
                
                // Add !important to styles for extra certainty
                mobileControls.setAttribute('style', 
                    'display: flex !important; ' + 
                    'z-index: 9999 !important; ' + 
                    'pointer-events: auto !important; ' +
                    'visibility: visible !important;'
                );
                
                console.log("Mobile controls container displayed with important styles");
                
                // Make sure joystick elements are properly positioned and visible
                const joystickBase = document.getElementById('touch-joystick-base');
                const joystickHandle = document.getElementById('touch-joystick-handle');
                const joystickArea = document.getElementById('touch-joystick-area');
                
                if (joystickArea) {
                    // Position joystick based on screen size
                    const screenWidth = window.innerWidth;
                    joystickArea.style.display = 'block';
                    joystickArea.style.visibility = 'visible';
                    joystickArea.style.zIndex = '10000';
                    joystickArea.style.pointerEvents = 'auto';
                    
                    if (screenWidth < 375) {
                        // For very small screens
                        joystickArea.style.bottom = '70px';
                        joystickArea.style.left = '20px';
                        joystickArea.style.width = '100px';
                        joystickArea.style.height = '100px';
                    } else if (screenWidth < 768) {
                        // For phone screens
                        joystickArea.style.bottom = '90px';
                        joystickArea.style.left = '25px';
                    } else {
                        // For larger screens
                        joystickArea.style.bottom = '100px';
                        joystickArea.style.left = '30px';
                    }
                    
                    console.log("Joystick area displayed:", joystickArea.getBoundingClientRect());
                    
                    if (joystickBase && joystickHandle) {
                        // Position the joystick at the initial position
                        const rect = joystickArea.getBoundingClientRect();
                        const centerX = rect.left + rect.width / 2;
                        const centerY = rect.top + rect.height / 2;
                        
                        joystickBase.style.display = 'block';
                        joystickBase.style.left = `${centerX}px`;
                        joystickBase.style.top = `${centerY}px`;
                        joystickBase.style.visibility = 'visible';
                        
                        joystickHandle.style.display = 'block';
                        joystickHandle.style.left = `${centerX}px`;
                        joystickHandle.style.top = `${centerY}px`;
                        joystickHandle.style.visibility = 'visible';
                        
                        console.log("Joystick elements positioned and displayed");
                    }
                }
                
                // Also make sure action buttons are properly positioned
                const actionButtons = document.getElementById('touch-action-buttons');
                if (actionButtons) {
                    const screenWidth = window.innerWidth;
                    actionButtons.style.display = 'flex';
                    actionButtons.style.visibility = 'visible';
                    actionButtons.style.zIndex = '10000';
                    actionButtons.style.pointerEvents = 'auto';
                    
                    if (screenWidth < 375) {
                        // For very small screens
                        actionButtons.style.bottom = '90px';
                        actionButtons.style.right = '15px';
                        actionButtons.style.gap = '20px';
                    } else if (screenWidth < 768) {
                        // For phone screens
                        actionButtons.style.bottom = '110px';
                        actionButtons.style.right = '25px';
                    } else {
                        // For larger screens
                        actionButtons.style.bottom = '120px';
                        actionButtons.style.right = '30px';
                    }
                    
                    console.log("Action buttons container displayed");
                }
                
                // Verify each button is visible and adjust size based on screen
                const buttons = document.querySelectorAll('.touch-btn');
                buttons.forEach((btn) => {
                    btn.style.display = 'flex';
                    btn.style.visibility = 'visible';
                    btn.style.zIndex = '10001';
                    
                    // Adjust button size for smaller screens
                    if (window.innerWidth < 375) {
                        btn.style.width = '60px';
                        btn.style.height = '60px';
                        btn.style.fontSize = '12px';
                    }
                    
                    console.log(`Button ${btn.id} display set to visible`);
                });
            } else {
                console.error("Mobile controls container not found in the DOM!");
            }
            
            // Show mobile controls info
            const mobileControlsInfo = document.querySelector('.mobile-controls-info');
            if (mobileControlsInfo) {
                mobileControlsInfo.style.display = 'block';
            }
            
            // Add additional meta viewport settings for better mobile experience
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            if (viewportMeta) {
                viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            }
            
            // Add utility function for touch feedback
            document.querySelectorAll('.touch-btn').forEach(button => {
                button.addEventListener('touchstart', (e) => {
                    e.preventDefault(); // Prevent default behavior
                    button.classList.add('touch-btn-active');
                    console.log(`Button ${button.id} touched`);
                }, { passive: false });
                
                button.addEventListener('touchend', (e) => {
                    e.preventDefault(); // Prevent default behavior
                    button.classList.remove('touch-btn-active');
                }, { passive: false });
            });
            
            // Log button elements for debugging
            console.log("Touch buttons initialized:");
            const buttons = document.querySelectorAll('.touch-btn');
            console.log(`Found ${buttons.length} touch buttons`);
            buttons.forEach((btn, index) => {
                console.log(`Button ${index}: ${btn.id}, visible:`, btn.style.display !== 'none');
            });
        } else {
            // Hide mobile controls on desktop
            if (mobileControls) {
                mobileControls.style.display = 'none';
            }
        }
    }
    
    // Update the team color preview
    updateTeamColorPreview(teamType, teamName) {
        const colorElement = teamType === 'player' ? this.elements.playerTeamColor : this.elements.aiTeamColor;
        const teamColors = {
            'Real Madrid': '#FFFFFF',
            'Liverpool': '#C8102E',
            'Bayern Munchen': '#DC052D',
            'Barcelona': '#A50044',
            'Manchester City': '#6CABDD',
            'Manchester United': '#DA291C'
        };
        
        colorElement.style.backgroundColor = teamColors[teamName] || '#FFFFFF';
    }
    
    // Show the main menu
    showMainMenu() {
        this.elements.mainMenu.classList.remove('hidden');
        this.elements.pauseMenu.classList.add('hidden');
        this.elements.gameOver.classList.add('hidden');
    }
    
    // Hide the main menu
    hideMainMenu() {
        this.elements.mainMenu.classList.add('hidden');
    }
    
    // Show the pause menu
    showPauseMenu() {
        this.elements.pauseMenu.classList.remove('hidden');
    }
    
    // Hide the pause menu
    hidePauseMenu() {
        this.elements.pauseMenu.classList.add('hidden');
    }
    
    // Show the game over screen
    showGameOver(yourScore, aiScore) {
        this.elements.gameOver.classList.remove('hidden');
        const result = yourScore > aiScore ? 'You Win!' : (aiScore > yourScore ? 'AI Wins!' : 'It\'s a Draw!');
        this.elements.finalScore.textContent = `${result} Final Score: ${yourScore} - ${aiScore}`;
    }
    
    // Update the scoreboard
    updateScore(yourScore, aiScore) {
        this.elements.scoreYou.textContent = yourScore;
        this.elements.scoreAI.textContent = aiScore;
    }
    
    // Update team names in the UI
    updateTeamNames(playerTeam, aiTeam) {
        const teamYouName = document.getElementById('team-you-name');
        const teamAIName = document.getElementById('team-ai-name');
        
        if (teamYouName) {
            teamYouName.textContent = playerTeam;
        }
        
        if (teamAIName) {
            teamAIName.textContent = aiTeam;
        }
    }
    
    // Update the game time display
    updateGameTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        this.elements.gameTime.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
    
    // Update the speed value display
    updateSpeedValueDisplay(value) {
        this.elements.speedValue.textContent = `${value.toFixed(1)}x`;
    }
    
    // Show a notification message
    showNotification(message, duration = 3000) {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.classList.add('notification');
        notification.textContent = message;
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.marginBottom = '10px';
        notification.style.transition = 'opacity 0.5s ease';
        notification.style.opacity = '0';
        
        container.appendChild(notification);
        
        // Fade in
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        // Fade out and remove
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, duration);
    }
    
    // Show goal announcement with animation
    showGoalAnnouncement(yourScore, aiScore, callback) {
        // Create or get goal announcement container
        let goalAnnouncement = document.getElementById('goal-announcement');
        if (!goalAnnouncement) {
            goalAnnouncement = document.createElement('div');
            goalAnnouncement.id = 'goal-announcement';
            goalAnnouncement.style.position = 'absolute';
            goalAnnouncement.style.top = '50%';
            goalAnnouncement.style.left = '50%';
            goalAnnouncement.style.transform = 'translate(-50%, -50%)';
            goalAnnouncement.style.textAlign = 'center';
            goalAnnouncement.style.color = 'white';
            goalAnnouncement.style.fontFamily = 'Arial, sans-serif';
            goalAnnouncement.style.zIndex = '1001';
            goalAnnouncement.style.textShadow = '2px 2px 5px rgba(0, 0, 0, 0.8)';
            goalAnnouncement.style.opacity = '0';
            goalAnnouncement.style.transition = 'all 0.5s ease-in-out';
            document.body.appendChild(goalAnnouncement);
        } else {
            // Clear existing content
            goalAnnouncement.innerHTML = '';
        }
        
        // Add overlay background
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.zIndex = '1000';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.5s ease-in-out';
        overlay.id = 'goal-overlay';
        document.body.appendChild(overlay);
        
        // Create GOAL! text
        const goalText = document.createElement('div');
        goalText.textContent = 'GOAL!';
        goalText.style.fontSize = '80px';
        goalText.style.fontWeight = 'bold';
        goalText.style.color = '#FFD700'; // Gold color
        goalText.style.marginBottom = '20px';
        goalText.style.transition = 'transform 0.5s ease-in-out';
        goalAnnouncement.appendChild(goalText);
        
        // Get team names
        const teamYouName = document.getElementById('team-you-name').textContent;
        const teamAIName = document.getElementById('team-ai-name').textContent;
        
        // Create score text
        const scoreText = document.createElement('div');
        scoreText.textContent = `${teamYouName} ${yourScore} - ${aiScore} ${teamAIName}`;
        scoreText.style.fontSize = '40px';
        scoreText.style.fontWeight = 'bold';
        goalAnnouncement.appendChild(scoreText);
        
        // Make the announcement responsive
        const updateSize = () => {
            const windowWidth = window.innerWidth;
            if (windowWidth < 600) {
                goalText.style.fontSize = '50px';
                scoreText.style.fontSize = '24px';
            } else {
                goalText.style.fontSize = '80px';
                scoreText.style.fontSize = '40px';
            }
        };
        
        // Call once initially and add resize listener
        updateSize();
        window.addEventListener('resize', updateSize, { once: true });
        
        // Animate the announcement in
        setTimeout(() => {
            overlay.style.opacity = '1';
            goalAnnouncement.style.opacity = '1';
            
            // Add some animation to the GOAL! text
            goalText.style.transform = 'scale(1.2)';
            
            setTimeout(() => {
                goalText.style.transform = 'scale(1)';
            }, 500);
            
            // Remove the announcement after a few seconds
            setTimeout(() => {
                goalAnnouncement.style.opacity = '0';
                overlay.style.opacity = '0';
                
                // Remove the overlay and execute callback after animation completes
                setTimeout(() => {
                    if (document.body.contains(overlay)) {
                        document.body.removeChild(overlay);
                    }
                    if (document.body.contains(goalAnnouncement)) {
                        document.body.removeChild(goalAnnouncement);
                    }
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                }, 500);
            }, 3000);
        }, 10);
    }
} 