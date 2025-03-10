export class UIManager {
    constructor(onStart, onPause, onResume, onRestart, onDifficultyChange, onTeamSelect, onSpeedChange) {
        this.onStart = onStart;
        this.onPause = onPause;
        this.onResume = onResume;
        this.onRestart = onRestart;
        this.onDifficultyChange = onDifficultyChange;
        this.onTeamSelect = onTeamSelect;
        this.onSpeedChange = onSpeedChange;
        
        // UI elements
        this.elements = {
            scoreYou: document.getElementById('score-you'),
            scoreAI: document.getElementById('score-ai'),
            teamYouName: document.getElementById('team-you-name'),
            teamAIName: document.getElementById('team-ai-name'),
            gameTime: document.getElementById('game-time'),
            mainMenu: document.getElementById('main-menu'),
            pauseMenu: document.getElementById('pause-menu'),
            gameOver: document.getElementById('game-over'),
            finalScore: document.getElementById('final-score'),
            difficulty: document.getElementById('difficulty'),
            playerTeam: document.getElementById('player-team'),
            aiTeam: document.getElementById('ai-team'),
            playerTeamColor: document.getElementById('player-team-color'),
            aiTeamColor: document.getElementById('ai-team-color'),
            gameOverlay: document.getElementById('game-overlay'),
            gameSpeed: document.getElementById('game-speed'),
            speedValue: document.getElementById('speed-value')
        };
        
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
    
    updateScore(playerScore, aiScore) {
        if (this.elements.scoreYou) {
            this.elements.scoreYou.textContent = playerScore;
        }
        
        if (this.elements.scoreAI) {
            this.elements.scoreAI.textContent = aiScore;
        }
    }
    
    updateTeamNames(playerTeam, aiTeam) {
        if (this.elements.teamYouName) {
            this.elements.teamYouName.textContent = playerTeam;
        }
        
        if (this.elements.teamAIName) {
            this.elements.teamAIName.textContent = aiTeam;
        }
    }
    
    updateTeamColorPreview(team, teamName) {
        const teamManager = window.teamManager; // Access from global scope
        if (!teamManager) return;
        
        const teamData = teamManager.getTeamData(teamName);
        const colorElement = team === 'player' ? 
                             this.elements.playerTeamColor : 
                             this.elements.aiTeamColor;
        
        if (colorElement && teamData) {
            // Convert hex color to CSS
            const hexColor = teamData.homeColor.toString(16).padStart(6, '0');
            colorElement.style.backgroundColor = `#${hexColor}`;
        }
    }
    
    updateTime(seconds) {
        if (this.elements.gameTime) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            
            // Format with leading zeros
            const formattedMinutes = String(minutes).padStart(2, '0');
            const formattedSeconds = String(remainingSeconds).padStart(2, '0');
            
            this.elements.gameTime.textContent = `${formattedMinutes}:${formattedSeconds}`;
        }
    }
    
    showMainMenu() {
        // Add dark overlay when showing menus
        this.elements.gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        
        // Hide other menus
        this.elements.pauseMenu.classList.add('hidden');
        this.elements.gameOver.classList.add('hidden');
        
        // Show main menu
        this.elements.mainMenu.classList.remove('hidden');
    }
    
    hideMainMenu() {
        this.elements.mainMenu.classList.add('hidden');
        // Remove dark overlay when game is active
        this.elements.gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    }
    
    showPauseMenu() {
        // Add dark overlay when showing menus
        this.elements.gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.elements.pauseMenu.classList.remove('hidden');
    }
    
    hidePauseMenu() {
        this.elements.pauseMenu.classList.add('hidden');
        // Remove dark overlay when game is active
        this.elements.gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    }
    
    showGameOver(playerScore, aiScore) {
        // Add dark overlay when showing menus
        this.elements.gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        
        // Set the final score text
        let resultText = '';
        
        if (playerScore > aiScore) {
            resultText = `You Win! ${playerScore}-${aiScore}`;
        } else if (playerScore < aiScore) {
            resultText = `You Lose! ${playerScore}-${aiScore}`;
        } else {
            resultText = `Draw! ${playerScore}-${aiScore}`;
        }
        
        this.elements.finalScore.textContent = resultText;
        
        // Show game over screen
        this.elements.gameOver.classList.remove('hidden');
    }
    
    hideGameOver() {
        this.elements.gameOver.classList.add('hidden');
        // Remove dark overlay when game is active
        this.elements.gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    }
    
    // Display a notification message that disappears after a timeout
    showNotification(message, duration = 2000) {
        const notificationContainer = document.getElementById('notification-container');
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.textContent = message;
        
        // Style the notification
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.marginBottom = '10px';
        notification.style.transition = 'opacity 0.5s ease-out';
        notification.style.opacity = '0';
        
        // Add to container
        notificationContainer.appendChild(notification);
        
        // Trigger fade in
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        // Remove after duration
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notificationContainer.removeChild(notification);
            }, 500);
        }, duration);
    }
    
    // Show goal announcement with animation
    showGoalAnnouncement(playerScore, aiScore, callback) {
        // Create goal announcement container if it doesn't exist
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
        goalAnnouncement.appendChild(goalText);
        
        // Get team names
        const teamYouName = this.elements.teamYouName.textContent;
        const teamAIName = this.elements.teamAIName.textContent;
        
        // Create score text
        const scoreText = document.createElement('div');
        scoreText.textContent = `${teamYouName} ${playerScore} - ${aiScore} ${teamAIName}`;
        scoreText.style.fontSize = '40px';
        scoreText.style.fontWeight = 'bold';
        goalAnnouncement.appendChild(scoreText);
        
        // Animate the announcement in
        setTimeout(() => {
            overlay.style.opacity = '1';
            goalAnnouncement.style.opacity = '1';
            
            // Add some animation to the GOAL! text
            goalText.style.transform = 'scale(1.2)';
            goalText.style.transition = 'transform 0.5s ease-in-out';
            
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
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                }, 500);
            }, 3000);
        }, 10);
    }
    
    updateSpeedValueDisplay(speed) {
        if (this.elements.speedValue) {
            this.elements.speedValue.textContent = `${speed.toFixed(1)}x`;
        }
    }
} 