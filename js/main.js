import * as THREE from 'three';
import { createField } from './field.js';
import { createPlayer } from './player.js';
import { createBall } from './ball.js';
import { AIManager } from './ai.js';
import { InputManager } from './input.js';
import { GameManager } from './gameManager.js';
import { SoundManager } from './soundManager.js';
import { UIManager } from './uiManager.js';
import { TeamManager } from './teamManager.js';

class SoccerGame {
    constructor() {
        // Initialize game state
        this.isGameActive = false;
        this.difficulty = 'medium';
        this.scoreYou = 0;
        this.scoreAI = 0;
        this.gameTime = 0;
        this.maxGameTime = 180; // 3 minutes in seconds
        this.speedMultiplier = 1.0; // Default game speed multiplier
        
        // Setup team manager
        this.teamManager = new TeamManager();
        window.teamManager = this.teamManager; // Make available globally
        
        // Setup mouse interaction
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.isMouseDown = false;
        
        // Setup Three.js scene
        this.initializeScene();
        
        // Create game components
        this.createGameComponents();
        
        // Setup managers
        this.setupManagers();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start render loop
        this.animate();
    }
    
    initializeScene() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 30, 40);
        this.camera.lookAt(0, 0, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        
        // Add lights
        this.setupLights();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupLights() {
        // Ambient light - Increased intensity from 0.5 to 1.0
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
        
        // Directional light (sun) - Increased intensity from 0.8 to 1.5
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.directionalLight.position.set(50, 100, 50);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 500;
        this.directionalLight.shadow.camera.left = -100;
        this.directionalLight.shadow.camera.right = 100;
        this.directionalLight.shadow.camera.top = 100;
        this.directionalLight.shadow.camera.bottom = -100;
        this.scene.add(this.directionalLight);
        
        // Additional point lights for field corners - Increased intensity from 0.5 to 1.0
        const cornerLights = [
            { x: 28, z: 18 },
            { x: -28, z: 18 },
            { x: 28, z: -18 },
            { x: -28, z: -18 }
        ];
        
        cornerLights.forEach(pos => {
            const pointLight = new THREE.PointLight(0xffffff, 1.0, 50);
            pointLight.position.set(pos.x, 10, pos.z);
            this.scene.add(pointLight);
        });
        
        // Add a hemispheric light to improve overall scene brightness
        const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1.0);
        this.scene.add(hemisphereLight);
    }
    
    createGameComponents() {
        // Create field
        this.field = createField();
        this.scene.add(this.field);
        
        // Create ball
        this.ball = createBall();
        this.scene.add(this.ball.mesh);
        
        // Create players
        this.players = {
            you: [],
            ai: []
        };
        
        this.createTeams();
        
        // Set active player (initially the closest to ball)
        this.activePlayer = this.players.you[3]; // Start with midfielder
        this.activePlayer.setActive(true);
    }
    
    createTeams() {
        // Get team data
        const playerTeamData = this.teamManager.getPlayerTeamData();
        const aiTeamData = this.teamManager.getAITeamData();
        
        // Clear existing players if any
        if (this.players.you.length > 0) {
            this.players.you.forEach(player => {
                this.scene.remove(player.mesh);
            });
            this.players.you = [];
        }
        
        if (this.players.ai.length > 0) {
            this.players.ai.forEach(player => {
                this.scene.remove(player.mesh);
            });
            this.players.ai = [];
        }
        
        // Create your team
        const yourTeamPositions = [
            { role: 'goalkeeper', x: -28, z: 0 },
            { role: 'defender', x: -22, z: -6 },
            { role: 'defender', x: -22, z: 6 },
            { role: 'midfielder', x: -10, z: 0 },
            { role: 'attacker', x: -5, z: 0 }
        ];
        
        yourTeamPositions.forEach((pos, index) => {
            const color = pos.role === 'goalkeeper' ? 
                playerTeamData.goalKeeperColor : playerTeamData.homeColor;
            const player = createPlayer('you', pos.role, color);
            player.mesh.position.set(pos.x, 0, pos.z);
            this.scene.add(player.mesh);
            this.players.you.push(player);
        });
        
        // Create AI team
        const aiTeamPositions = [
            { role: 'goalkeeper', x: 28, z: 0 },
            { role: 'defender', x: 22, z: -6 },
            { role: 'defender', x: 22, z: 6 },
            { role: 'midfielder', x: 10, z: 0 },
            { role: 'attacker', x: 5, z: 0 }
        ];
        
        aiTeamPositions.forEach((pos, index) => {
            const color = pos.role === 'goalkeeper' ? 
                aiTeamData.goalKeeperColor : aiTeamData.homeColor;
            const player = createPlayer('ai', pos.role, color);
            player.mesh.position.set(pos.x, 0, pos.z);
            this.scene.add(player.mesh);
            this.players.ai.push(player);
        });
    }
    
    setupManagers() {
        // Input manager for handling keyboard events
        this.inputManager = new InputManager();
        
        // AI manager for controlling AI team
        this.aiManager = new AIManager(this.players.ai, this.players.you, this.ball, this.difficulty);
        
        // Share ball physics with AI manager for accurate predictions
        this.aiManager.ball.gravity = this.ball.gravity;
        
        // Game manager for rules, scoring, etc.
        this.gameManager = new GameManager(
            this.ball, 
            this.players, 
            () => this.resetAfterGoal('you'),
            () => this.resetAfterGoal('ai')
        );
        
        // Sound manager for audio effects (now disabled)
        this.soundManager = {
            // Create stub methods that do nothing to disable all sounds
            playKickSound: () => {},
            playGoalSound: () => {},
            playWhistleSound: () => {},
            playGameOverSound: () => {},
            playCrowdAmbience: () => {},
            stopCrowdAmbience: () => {},
            playMissSound: () => {}
        };
        
        // UI manager for updating the HUD and menus
        this.uiManager = new UIManager(
            () => this.startGame(),
            () => this.pauseGame(),
            () => this.resumeGame(),
            () => this.restartGame(),
            (difficulty) => this.setDifficulty(difficulty),
            (teamType, teamName) => this.selectTeam(teamType, teamName),
            (speed) => this.setGameSpeed(speed)
        );
        
        // Update team names in UI
        this.updateTeamNamesInUI();
    }
    
    selectTeam(teamType, teamName) {
        if (teamType === 'player') {
            this.teamManager.setPlayerTeam(teamName);
        } else if (teamType === 'ai') {
            this.teamManager.setAITeam(teamName);
        }
        
        // If we're not in a game, update the teams immediately
        if (!this.isGameActive) {
            this.createTeams();
            this.updateTeamNamesInUI();
        }
    }
    
    updateTeamNamesInUI() {
        const playerTeam = this.teamManager.getPlayerTeamData().shortName;
        const aiTeam = this.teamManager.getAITeamData().shortName;
        this.uiManager.updateTeamNames(playerTeam, aiTeam);
    }
    
    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            if (this.isGameActive) {
                this.inputManager.onKeyDown(event);
                
                // Pause game on Escape key
                if (event.key === 'Escape') {
                    this.pauseGame();
                }
            }
        });
        
        document.addEventListener('keyup', (event) => {
            if (this.isGameActive) {
                this.inputManager.onKeyUp(event);
            }
        });
        
        // Add mouse event listeners
        const canvas = this.renderer.domElement;
        
        // Mouse move tracking
        canvas.addEventListener('mousemove', (event) => {
            if (!this.isGameActive) return;
            
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            // Update input manager with mouse position
            this.inputManager.onMouseMove(event);
        });
        
        // Mouse click for shooting
        canvas.addEventListener('mousedown', (event) => {
            if (!this.isGameActive) return;
            
            // Only respond to left mouse button (button 0)
            if (event.button === 0) {
                this.isMouseDown = true;
                this.handleMouseShoot();
            }
        });
        
        // Reset mouse state on mouse up
        canvas.addEventListener('mouseup', (event) => {
            if (event.button === 0) {
                this.isMouseDown = false;
            }
        });
        
        // Reset mouse state when mouse leaves the window
        canvas.addEventListener('mouseleave', () => {
            this.isMouseDown = false;
        });
        
        // Add touch event listeners for mobile
        console.log("Setting up touch controls - Device has touch:", 'ontouchstart' in window || navigator.maxTouchPoints > 0);
        
        // Check if this is likely a mobile device
        const isMobileDevice = 'ontouchstart' in window || 
                               navigator.maxTouchPoints > 0 || 
                               window.innerWidth <= 1024;
                               
        if (isMobileDevice) {
            console.log("Mobile device detected, initializing touch controls");
            
            // For handling virtual joystick and action buttons
            document.addEventListener('touchstart', (event) => {
                if (!this.isGameActive) return;
                
                // Prevent default to avoid unwanted scrolling/zooming
                event.preventDefault();
                this.inputManager.onTouchStart(event);
                console.log("Touch start detected");
            }, { passive: false });
            
            document.addEventListener('touchmove', (event) => {
                if (!this.isGameActive) return;
                
                // Prevent default to avoid unwanted scrolling/zooming
                event.preventDefault();
                this.inputManager.onTouchMove(event);
            }, { passive: false });
            
            document.addEventListener('touchend', (event) => {
                if (!this.isGameActive) return;
                this.inputManager.onTouchEnd(event);
                console.log("Touch end detected");
            });
            
            document.addEventListener('touchcancel', (event) => {
                if (!this.isGameActive) return;
                this.inputManager.onTouchEnd(event);
            });
            
            // Set up direct touch control handlers for the buttons
            const setupTouchButton = (buttonId, action) => {
                const button = document.getElementById(buttonId);
                if (button) {
                    button.addEventListener('touchstart', (event) => {
                        if (!this.isGameActive) return;
                        event.preventDefault();
                        console.log(`${buttonId} pressed`);
                        
                        switch(action) {
                            case 'pass':
                                this.passBall();
                                break;
                            case 'shoot':
                                this.shootTowardGoal();
                                break;
                            case 'switch':
                                this.switchToNextPlayer();
                                break;
                            case 'pause':
                                this.pauseGame();
                                break;
                        }
                    }, { passive: false });
                } else {
                    console.warn(`Button ${buttonId} not found`);
                }
            };
            
            // Set up each action button
            setupTouchButton('touch-pass-btn', 'pass');
            setupTouchButton('touch-shoot-btn', 'shoot');
            setupTouchButton('touch-switch-btn', 'switch');
            setupTouchButton('touch-pause-btn', 'pause');
            
            // Ensure mobile controls are visible
            const mobileControls = document.getElementById('mobile-controls');
            if (mobileControls) {
                mobileControls.style.display = 'block';
                console.log("Mobile controls container displayed via event listener setup");
            }
        }
    }
    
    startGame() {
        if (this.isGameActive) return;
        
        console.log("Starting game...");
        this.isGameActive = true;
        this.scoreYou = 0;
        this.scoreAI = 0;
        this.gameTime = 0;
        
        // Reset positions
        this.resetPositions();
        
        // Update UI
        this.uiManager.updateScore(this.scoreYou, this.scoreAI);
        this.uiManager.updateGameTime(this.gameTime);
        this.uiManager.hideMainMenu();
        
        // Update team names
        this.updateTeamNamesInUI();
        
        // Reset AI manager and set to a more active difficulty
        console.log("Setting AI difficulty...");
        this.aiManager.setDifficulty(this.difficulty);
        
        // Verify AI is properly initialized
        console.log("AI Team size:", this.players.ai.length);
        console.log("Player Team size:", this.players.you.length);
        console.log("AI initialized:", !!this.aiManager);
        console.log("Game active state:", this.isGameActive);
        
        // Initialize game speed from slider
        const gameSpeedSlider = document.getElementById('game-speed');
        if (gameSpeedSlider) {
            this.setGameSpeed(parseFloat(gameSpeedSlider.value));
            this.uiManager.updateSpeedValueDisplay(this.speedMultiplier);
        }
        
        // Show mobile controls if on a mobile device
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024) {
            console.log("Mobile device detected, activating controls when game starts");
            const mobileControls = document.getElementById('mobile-controls');
            if (mobileControls) {
                // Force display the mobile controls
                mobileControls.style.display = 'flex';
                mobileControls.style.zIndex = '9999';
                mobileControls.style.visibility = 'visible';
                mobileControls.style.pointerEvents = 'auto';
                
                // Use setAttribute with !important to override any other styles
                mobileControls.setAttribute('style', 
                    'display: flex !important; ' + 
                    'z-index: 9999 !important; ' + 
                    'pointer-events: auto !important; ' +
                    'visibility: visible !important;'
                );
                
                console.log("Mobile controls activated and forced visible at game start");
                
                // Setup mobile control positions right after forcing display
                setTimeout(() => this.setupMobileControlPositions(), 100);
            } else {
                console.error("Mobile controls container not found!");
            }
        }
    }
    
    // Position mobile controls correctly
    setupMobileControlPositions() {
        console.log("Setting up mobile control positions");
        const joystickArea = document.getElementById('touch-joystick-area');
        const actionButtons = document.getElementById('touch-action-buttons');
        const pauseButton = document.getElementById('touch-pause-btn');
        
        if (joystickArea) {
            joystickArea.style.position = 'fixed';
            joystickArea.style.bottom = '100px';
            joystickArea.style.left = '30px';
            joystickArea.style.display = 'block';
            joystickArea.style.visibility = 'visible';
            joystickArea.style.zIndex = '10000';
            joystickArea.style.pointerEvents = 'auto';
            
            console.log("Joystick area positioned:", 
                        "display:", joystickArea.style.display,
                        "visibility:", joystickArea.style.visibility,
                        "position:", joystickArea.getBoundingClientRect());
            
            // Initialize joystick position
            const joystickBase = document.getElementById('touch-joystick-base');
            const joystickHandle = document.getElementById('touch-joystick-handle');
            
            if (joystickBase && joystickHandle) {
                const rect = joystickArea.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                joystickBase.style.display = 'block';
                joystickBase.style.visibility = 'visible';
                joystickBase.style.left = `${centerX}px`;
                joystickBase.style.top = `${centerY}px`;
                joystickBase.style.zIndex = '10001';
                
                joystickHandle.style.display = 'block';
                joystickHandle.style.visibility = 'visible';
                joystickHandle.style.left = `${centerX}px`;
                joystickHandle.style.top = `${centerY}px`;
                joystickHandle.style.zIndex = '10002';
                
                console.log("Joystick elements positioned");
            }
        }
        
        if (actionButtons) {
            actionButtons.style.position = 'fixed';
            actionButtons.style.bottom = '120px';
            actionButtons.style.right = '30px';
            actionButtons.style.display = 'flex';
            actionButtons.style.visibility = 'visible';
            actionButtons.style.zIndex = '10000';
            actionButtons.style.pointerEvents = 'auto';
            
            // Make all buttons visible
            const buttons = actionButtons.querySelectorAll('.touch-btn');
            buttons.forEach(btn => {
                btn.style.display = 'flex';
                btn.style.visibility = 'visible';
                btn.style.zIndex = '10001';
                console.log(`Button ${btn.id} made visible`);
            });
        }
        
        if (pauseButton) {
            pauseButton.style.position = 'fixed';
            pauseButton.style.top = '20px';
            pauseButton.style.right = '20px';
            pauseButton.style.display = 'flex';
            pauseButton.style.visibility = 'visible';
            pauseButton.style.zIndex = '10001';
        }
        
        // Adjust for smaller screens
        this.adjustControlsForScreenSize();
    }
    
    // Adjust controls based on screen size
    adjustControlsForScreenSize() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const joystickArea = document.getElementById('touch-joystick-area');
        const actionButtons = document.getElementById('touch-action-buttons');
        
        if (screenWidth < 375) {
            // Extra small screens (iPhone SE, etc.)
            if (joystickArea) {
                joystickArea.style.bottom = '70px';
                joystickArea.style.left = '20px';
                joystickArea.style.width = '100px';
                joystickArea.style.height = '100px';
            }
            
            if (actionButtons) {
                actionButtons.style.bottom = '90px';
                actionButtons.style.right = '15px';
                actionButtons.style.gap = '20px';
                
                // Make buttons smaller
                const buttons = actionButtons.querySelectorAll('.touch-btn');
                buttons.forEach(btn => {
                    btn.style.width = '60px';
                    btn.style.height = '60px';
                    btn.style.fontSize = '12px';
                });
            }
        } else if (screenWidth < 768) {
            // Small to medium screens (most phones)
            if (joystickArea) {
                joystickArea.style.bottom = '90px';
                joystickArea.style.left = '25px';
            }
            
            if (actionButtons) {
                actionButtons.style.bottom = '110px';
                actionButtons.style.right = '25px';
            }
        }
        
        console.log(`Controls adjusted for screen size: ${screenWidth}x${screenHeight}`);
    }
    
    pauseGame() {
        this.isGameActive = false;
        this.uiManager.showPauseMenu();
    }
    
    resumeGame() {
        this.isGameActive = true;
        this.uiManager.hidePauseMenu();
    }
    
    restartGame() {
        this.startGame();
    }
    
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        if (this.aiManager) {
            this.aiManager.setDifficulty(difficulty);
        }
    }
    
    resetAfterGoal(scoringTeam) {
        if (scoringTeam === 'you') {
            this.scoreYou++;
        } else {
            this.scoreAI++;
        }
        
        // Update score UI
        this.uiManager.updateScore(this.scoreYou, this.scoreAI);
        
        // Play sound
        this.soundManager.playGoalSound();
        
        // Show goal announcement before resetting positions
        this.uiManager.showGoalAnnouncement(this.scoreYou, this.scoreAI, () => {
            // Reset positions after the announcement animation completes
            this.resetPositions();
        });
    }
    
    resetPositions() {
        // Reset ball position and state
        this.ball.reset();
        
        // Reset player positions
        this.players.you.forEach((player, index) => {
            const startPos = [
                { x: -28, z: 0 },  // goalkeeper
                { x: -22, z: -6 }, // defender
                { x: -22, z: 6 },  // defender
                { x: -10, z: 0 },  // midfielder
                { x: -5, z: 0 }    // attacker
            ][index];
            
            player.mesh.position.set(startPos.x, 0, startPos.z);
            player.velocity.set(0, 0, 0);
        });
        
        this.players.ai.forEach((player, index) => {
            const startPos = [
                { x: 28, z: 0 },  // goalkeeper
                { x: 22, z: -6 }, // defender
                { x: 22, z: 6 },  // defender
                { x: 10, z: 0 },  // midfielder
                { x: 5, z: 0 }    // attacker
            ][index];
            
            player.mesh.position.set(startPos.x, 0, startPos.z);
            player.velocity.set(0, 0, 0);
        });
        
        // Reset active player
        this.players.you.forEach(player => player.setActive(false));
        this.activePlayer = this.players.you[3]; // Start with midfielder
        this.activePlayer.setActive(true);
        
        // Reset the game manager's goal handling state
        if (this.gameManager) {
            this.gameManager.isGoalInProgress = false;
        }
    }
    
    endGame() {
        this.isGameActive = false;
     
        // Play game over sound
        this.soundManager.playGameOverSound();
        
        // Show game over screen with final scores
        this.uiManager.showGameOver(this.scoreYou, this.scoreAI);
    }
    
    update(deltaTime) {
        if (!this.isGameActive) return;
        
        // Update game time
        this.gameTime += deltaTime;
        this.uiManager.updateGameTime(Math.min(this.gameTime, this.maxGameTime));
        
        // Check if game time is up
        if (this.gameTime >= this.maxGameTime) {
            this.endGame();
            return;
        }
        
        // Update ball physics - pass players array for collision detection
        this.ball.update(deltaTime, this.players);
        
        // Always update mouse direction when there is an active player
        if (this.activePlayer) {
            this.inputManager.updateMouseDirection(this.activePlayer.mesh.position, this.camera);
        }
        
        // Update player movement - controlled by input for active player
        if (this.activePlayer) {
            // Get movement direction (either from keyboard or mouse)
            const inputDirection = this.inputManager.getMovementDirection();
            
            // Only process movement if there's input
            if (inputDirection.length() > 0) {
                // Convert Vector2 to Vector3 for 3D movement (y in 2D maps to z in 3D)
                const moveDirection = new THREE.Vector3(inputDirection.x, 0, inputDirection.y);
                
                // Determine appropriate speed - always use sprint speed for human players
                let speed;
                if (this.activePlayer.isControllingBall) {
                    // When dribbling, always use sprint speed
                    speed = this.activePlayer.dribbleSprintSpeed;
                } else {
                    // Always use sprint speed when not dribbling
                    speed = this.activePlayer.sprintSpeed;
                }
                
                if (this.isSprintPressed && this.gameManager.canPerformAction(this.activePlayer, 'sprint')) {
                    speed = this.activePlayer.sprintSpeed;
                }
                
                // Pass the speed multiplier to the move method
                this.activePlayer.move(moveDirection, speed, this.speedMultiplier);
            }
            
            // Handle shoot action or tackle (when X key is pressed)
            if (this.inputManager.keys.has('x') || this.isMouseDown) {
                if (this.activePlayer.isControllingBall) {
                    // Player has the ball - perform a shot
                    this.shootTowardGoal();
                } else {
                    // Player doesn't have the ball - attempt a tackle
                    this.attemptTackle();
                }
                
                // Clear the input flags to prevent continuous action
                this.inputManager.keys.delete('x');
                this.isMouseDown = false;
            }
            
            // Handle pass action
            if (this.inputManager.keys.has(' ')) {
                if (this.activePlayer.isControllingBall) {
                    // Player is dribbling - pass to best teammate
                    this.passBall();
                } else {
                    // Regular passing when near the ball
                    const distanceToBall = this.activePlayer.mesh.position.distanceTo(this.ball.mesh.position);
                    if (distanceToBall < 3) {
                        // Find the best teammate to pass to
                        let bestTeammate = null;
                        let bestScore = -Infinity;
                        
                        this.players.you.forEach(teammate => {
                            if (teammate !== this.activePlayer) {
                                const distanceToTeammate = this.ball.mesh.position.distanceTo(teammate.mesh.position);
                                
                                // Don't pass if teammate is too far
                                if (distanceToTeammate > 30) return;
                                
                                const isForward = teammate.mesh.position.x > this.activePlayer.mesh.position.x;
                                
                                // Calculate a score based on multiple factors
                                let score = 0;
                                
                                // Distance factor - prefer passes at reasonable distances (not too close, not too far)
                                const distanceFactor = distanceToTeammate < 8 ? distanceToTeammate / 8 : 
                                                      (distanceToTeammate < 25 ? 1.0 : (30 - distanceToTeammate) / 5);
                                score += distanceFactor * 5;
                                
                                // Direction factor - prefer forward passes
                                score += isForward ? 10 : 0;
                                
                                // Space factor - check if teammate is in open space
                                let isMarked = false;
                                this.players.ai.forEach(opponent => {
                                    if (teammate.mesh.position.distanceTo(opponent.mesh.position) < 5) {
                                        isMarked = true;
                                    }
                                });
                                score += isMarked ? -15 : 10;
                                
                                // Role factor - prefer attacking players
                                score += teammate.role === 'attacker' ? 5 : 
                                        teammate.role === 'midfielder' ? 3 : 0;
                                
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestTeammate = teammate;
                                }
                            }
                        });
                        
                        if (bestTeammate) {
                            // Release the ball from player control
                            this.ball.releaseFromControl();
                            
                            // Calculate pass direction
                            const passDirection = new THREE.Vector3()
                                .subVectors(bestTeammate.mesh.position, this.ball.mesh.position)
                                .normalize();
                            
                            // Calculate pass power based on distance
                            const passDistance = this.ball.mesh.position.distanceTo(bestTeammate.mesh.position);
                            const passStrength = Math.min(25, 15 + passDistance * 0.5);
                            
                            // Apply force to ball
                            this.ball.velocity.copy(passDirection).multiplyScalar(passStrength);
                            
                            // Add slight vertical component for better passes
                            this.ball.velocity.y = Math.min(5, passDistance * 0.2);
                            
                            // Play sound
                            this.soundManager.playKickSound();
                            
                            // Switch active player to the pass target
                            this.switchActivePlayer(bestTeammate);
                        }
                        
                        // Clear the pass key to prevent continuous passing
                        this.inputManager.keys.delete(' ');
                    }
                }
            }
            
            // Handle player switching action (with 'q' key)
            if (this.inputManager.keys.has('q')) {
                // Switch to the next player
                this.switchToNextPlayer();
                
                // Clear the key to prevent continuous switching
                this.inputManager.keys.delete('q');
            }
        }
        
        // Update positions of non-active human players
        this.updateHumanTeamPositioning(deltaTime);
        
        // Update all player positions
        [...this.players.you, ...this.players.ai].forEach(player => {
            player.update(deltaTime, this.ball);
        });
        
        // Update AI team
        this.aiManager.update(deltaTime);
        
        // Check for ball possession and automatically switch active player
        this.updateActivePlayers();
        
        // Check for goals and boundaries
        this.gameManager.update();
        
        // Update camera
        this.updateCamera();
    }
    
    updateActivePlayers() {
        // Don't automatically switch players too frequently
        // This gives the player time to use the 'q' key manually
        if (!this.lastAutoSwitchTime) {
            this.lastAutoSwitchTime = 0;
        }
        
        // Add a small delay between automatic switches (0.5 seconds)
        const currentTime = Date.now() / 1000;
        const autoSwitchDelay = 0.5; // seconds
        
        // If we've recently switched, don't auto-switch again
        if (currentTime - this.lastAutoSwitchTime < autoSwitchDelay) {
            return;
        }
        
        // Find the player closest to the ball on your team
        if (!this.activePlayer.hasBall && !this.activePlayer.isControllingBall) {
            let closestPlayer = null;
            let closestDistance = Infinity;
            
            this.players.you.forEach(player => {
                const distance = player.mesh.position.distanceTo(this.ball.mesh.position);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestPlayer = player;
                }
            });
            
            // If ball is close to this player and far from active player, switch control
            if (closestPlayer && closestDistance < 5) {
                const activeDistance = this.activePlayer.mesh.position.distanceTo(this.ball.mesh.position);
                if (closestPlayer !== this.activePlayer && activeDistance > 8) {
                    this.switchActivePlayer(closestPlayer);
                    this.lastAutoSwitchTime = currentTime; // Update last auto-switch time
                }
            }
        }
        
        // Check for ball possession
        [...this.players.you, ...this.players.ai].forEach(player => {
            const distanceToBall = player.mesh.position.distanceTo(this.ball.mesh.position);
            if (distanceToBall < 1.5) {
                player.hasBall = true;
                
                // Switch active player to the one who has the ball (if on your team)
                if (player.team === 'you' && player !== this.activePlayer) {
                    this.switchActivePlayer(player);
                    this.lastAutoSwitchTime = currentTime; // Update last auto-switch time
                }
            } else {
                player.hasBall = false;
            }
        });
    }
    
    switchActivePlayer(newActivePlayer) {
        // Deactivate current active player
        if (this.activePlayer) {
            this.activePlayer.setActive(false);
        }
        
        // Set new active player
        this.activePlayer = newActivePlayer;
        this.activePlayer.setActive(true);
    }
    
    updateCamera() {
        // Camera follows the ball with slight offset
        const targetPosition = new THREE.Vector3().copy(this.ball.mesh.position);
        
        // Add some offset to see more of the field in the direction of play
        targetPosition.y = 30;
        targetPosition.z += 25;
        
        // Smooth camera movement
        this.camera.position.lerp(targetPosition, 0.05);
        this.camera.lookAt(this.ball.mesh.position);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = Math.min(0.1, this.clock ? (this.clock.getDelta()) : 0.016);
        if (!this.clock) this.clock = new THREE.Clock();
        
        this.update(deltaTime);
        this.renderer.render(this.scene, this.camera);
    }
    
    // Modify the handleMouseShoot method to handle tackling as well
    handleMouseShoot() {
        if (!this.isGameActive || !this.activePlayer) return;
        
        if (this.activePlayer.isControllingBall) {
            // Player has the ball - shoot toward goal
            this.shootTowardGoal();
        } else {
            // Player doesn't have the ball - attempt tackle
            this.attemptTackle();
        }
    }
    
    // Add a new method specifically for shooting toward the goal
    shootTowardGoal() {
        // If player is dribbling, release the ball from control
        if (this.activePlayer.isControllingBall) {
            this.ball.releaseFromControl();
        }
        
        // Get the direction the player is facing
        const playerDirection = new THREE.Vector3(0, 0, 1);
        playerDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.activePlayer.mesh.rotation.y);
        
        // Calculate shooting power based on player role and some randomness
        let shootPower = 25; // Base power
        
        if (this.activePlayer.role === 'attacker') {
            shootPower *= 1.2 + (Math.random() * 0.15); // Attackers shoot harder with some variability
        } else if (this.activePlayer.role === 'midfielder') {
            shootPower *= 1.1 + (Math.random() * 0.1); // Midfielders shoot with moderate power
        } else {
            shootPower *= 0.95 + (Math.random() * 0.15); // Slight variability for defenders
        }
        
        // Enhanced shot variability system
        // Player shots have a chance to be "special" shots that are harder to block
        const specialShotChance = this.activePlayer.role === 'attacker' ? 0.4 : 
                                 this.activePlayer.role === 'midfielder' ? 0.3 : 0.15;
        
        let isSpecialShot = Math.random() < specialShotChance;
        let shotType = "normal";
        
        // Apply more intelligent/varied shot behavior
        if (isSpecialShot) {
            // Determine shot type based on random roll
            const shotRoll = Math.random();
            
            if (shotRoll < 0.33) {
                // Power shot - faster, slightly less accurate
                shotType = "power";
                shootPower *= 1.25;
                // Less randomization for more direct shots
                const minorRandomAngle = (Math.random() - 0.5) * 0.05;
                playerDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), minorRandomAngle);
                
            } else if (shotRoll < 0.66) {
                // Curved shot - apply spin and moderate angle change to curve around defenders
                shotType = "curved";
                // Apply a deliberate angle change to create curved shot
                const curveAngle = (Math.random() > 0.5 ? 1 : -1) * (0.1 + Math.random() * 0.1);
                playerDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), curveAngle);
                
                // Add spin to the ball to enhance the curve effect
                this.ball.spin.set(
                    curveAngle * 10 * (Math.random() + 0.5),  // Side spin
                    (Math.random() * 2 - 1) * 5,               // Top/bottom spin
                    curveAngle * -8 * (Math.random() + 0.5)    // Side spin 
                );
                
            } else {
                // Chip shot - higher arc to go over defenders
                shotType = "chip";
                const chipAngle = (Math.random() - 0.5) * 0.1;
                playerDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), chipAngle);
                // Higher arc for chip shots
                const chipArcBoost = 1.5 + Math.random() * 0.5;
                this.ball.velocity.y = (5 + Math.random() * 3) * chipArcBoost;
            }
            
            console.log(`Player executed a ${shotType} shot`);
        } else {
            // Normal shot with standard randomization
        const randomAngle = (Math.random() - 0.5) * 0.1; // Small random angle variation
        playerDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), randomAngle);
        }
        
        // Apply force to the ball in the calculated direction
        this.ball.velocity.copy(playerDirection).multiplyScalar(shootPower);
        
        // Add vertical velocity for arc (if not already set for chip shots)
        if (shotType !== "chip") {
        const arcHeight = 5 + Math.random() * 3; // Random arc between 5-8
        this.ball.velocity.y = arcHeight;
        }
        
        // Play kick sound
        this.soundManager.playKickSound();
    }
    
    // Modify the existing shootBall method to use the new shootTowardGoal method
    shootBall() {
        if (!this.activePlayer || !this.activePlayer.isControllingBall) return;
        
        // Use the new method that always shoots toward the goal
        this.shootTowardGoal();
        
        // Clear the shoot key to prevent continuous shooting
        this.inputManager.keys.delete('x');
    }
    
    // Modify the shootToPosition method to just call our new method
    // This way both mouse and keyboard shooting use the same logic
    shootToPosition(targetPosition) {
        // Ignore the target position and always shoot toward the goal
        this.shootTowardGoal();
    }
    
    // Add a new method for passing while dribbling
    passBall() {
        if (!this.activePlayer || !this.activePlayer.isControllingBall) return;
        
        // Find the best teammate to pass to
        let bestTeammate = null;
        let bestScore = -Infinity;
        
        this.players.you.forEach(teammate => {
            if (teammate !== this.activePlayer) {
                const distanceToTeammate = this.activePlayer.mesh.position.distanceTo(teammate.mesh.position);
                
                // Don't pass if teammate is too far
                if (distanceToTeammate > 30) return;
                
                const isForward = teammate.mesh.position.x > this.activePlayer.mesh.position.x;
                
                // Calculate a score based on multiple factors
                let score = 0;
                
                // Distance factor - prefer passes at reasonable distances (not too close, not too far)
                const distanceFactor = distanceToTeammate < 8 ? distanceToTeammate / 8 : 
                                      (distanceToTeammate < 25 ? 1.0 : (30 - distanceToTeammate) / 5);
                score += distanceFactor * 5;
                
                // Direction factor - prefer forward passes
                score += isForward ? 10 : 0;
                
                // Space factor - check if teammate is in open space
                let isMarked = false;
                this.players.ai.forEach(opponent => {
                    if (teammate.mesh.position.distanceTo(opponent.mesh.position) < 5) {
                        isMarked = true;
                    }
                });
                score += isMarked ? -15 : 10;
                
                // Role factor - prefer attacking players
                score += teammate.role === 'attacker' ? 5 : 
                        teammate.role === 'midfielder' ? 3 : 0;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestTeammate = teammate;
                }
            }
        });
        
        if (bestTeammate) {
            // Release the ball from player control
            this.ball.releaseFromControl();
            
            // Calculate pass direction
            const passDirection = new THREE.Vector3()
                .subVectors(bestTeammate.mesh.position, this.ball.mesh.position)
                .normalize();
            
            // Calculate pass power based on distance
            const passDistance = this.ball.mesh.position.distanceTo(bestTeammate.mesh.position);
            const passStrength = Math.min(25, 15 + passDistance * 0.5);
            
            // Apply force to ball
            this.ball.velocity.copy(passDirection).multiplyScalar(passStrength);
            
            // Add slight vertical component for better passes
            this.ball.velocity.y = Math.min(5, passDistance * 0.2);
            
            // Play sound
            this.soundManager.playKickSound();
            
            // Switch active player to the pass target
            this.switchActivePlayer(bestTeammate);
        }
        
        // Clear the pass key to prevent continuous passing
        this.inputManager.keys.delete(' ');
    }
    
    // Add a new method to switch to the next player in sequence
    switchToNextPlayer() {
        // Find the current active player's index
        const currentIndex = this.players.you.findIndex(player => player === this.activePlayer);
        
        // Calculate the next player index (wrapping around if necessary)
        const nextIndex = (currentIndex + 1) % this.players.you.length;
        
        // Switch to the next player
        this.switchActivePlayer(this.players.you[nextIndex]);
    }
    
    // Improved method for tackling
    attemptTackle() {
        if (!this.activePlayer) return;
        
        // Find the closest opponent with the ball
        let closestOpponent = null;
        let minDistance = 7; // Increased max tackle distance for better usability (was 6)
        
        this.players.ai.forEach(opponent => {
            if (opponent.isControllingBall || opponent.hasBall) {
                const distance = this.activePlayer.mesh.position.distanceTo(opponent.mesh.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestOpponent = opponent;
                }
            }
        });
        
        // Also try to tackle ball when it's not controlled by anyone
        if (!closestOpponent && !this.ball.isControlled) {
            // Check if the ball is within tackle range
            const ballDistance = this.activePlayer.mesh.position.distanceTo(this.ball.mesh.position);
            if (ballDistance < 5) { // Extended range for free ball tackles
                // Try to gain control of the free ball
                if (this.ball.velocity.length() < 15) { // Only if ball is not moving too fast
                    if (Math.random() < 0.7) { // 70% chance to gain control
                        // Set ball position slightly ahead of player
                        const controlOffset = this.activePlayer.direction.clone().multiplyScalar(1.2);
                        this.ball.mesh.position.copy(this.activePlayer.mesh.position).add(controlOffset);
                        this.ball.mesh.position.y = 0.5; // Ball radius
                        
                        // Give ball to player
                        this.ball.isControlled = true;
                        this.ball.controllingPlayer = this.activePlayer;
                        this.activePlayer.startControllingBall(this.ball);
                        
                        console.log("Gained control of free ball with tackle!");
                        this.soundManager.playKickSound();
                        return;
                    } else {
                        // Failed to control, but still apply some force to the ball
                        const tackleDirection = this.activePlayer.direction.clone().normalize();
                        this.ball.velocity.copy(tackleDirection).multiplyScalar(8);
                        this.ball.velocity.y = 1 + Math.random();
                        return;
                    }
                }
            }
        }
        
        // If there's a nearby opponent with the ball
        if (closestOpponent) {
            console.log(`Attempting tackle: distance=${minDistance.toFixed(2)}, opponent=${closestOpponent.role}`);
            
            // Calculate tackle direction
            const tackleDirection = new THREE.Vector3()
                .subVectors(closestOpponent.mesh.position, this.activePlayer.mesh.position)
                .normalize();
            
            // Add a burst of speed for the tackling animation - use sprint speed as base
            const tackleSpeed = this.activePlayer.sprintSpeed * 2.0; // Use sprintSpeed instead of base speed
            this.activePlayer.velocity.copy(tackleDirection).multiplyScalar(tackleSpeed);
            
            // Apply field boundaries during tackle
            this.activePlayer.constrainPositionToField(this.activePlayer.mesh.position);
            
            // Determine success chance based on role and distance
            let successChance = 0.8; // Increased from 0.75
            
            // Role-based adjustments
            if (this.activePlayer.role === 'defender') {
                successChance += 0.15; // Defenders are good at tackling
            } else if (this.activePlayer.role === 'midfielder') {
                successChance += 0.05; // Midfielders are decent
            }
            
            // Distance-based adjustment
            const distanceFactor = 1.0 - (minDistance / 8); // Linear falloff
            successChance *= distanceFactor;
            
            // Opponent's role affects success
            if (closestOpponent.role === 'attacker') {
                successChance *= 0.9; // Attackers are harder to tackle
            }
            
            // Record the tackler's position at the time of tackle attempt
            const tackleStartPosition = this.activePlayer.mesh.position.clone();
            
            // Record opponent's position at time of tackle attempt
            const opponentPosition = closestOpponent.mesh.position.clone();
            
            // Determine if tackle is successful
            if (Math.random() < successChance) {
                // Calculate actual tackle collision position (for more realistic physics)
                const collisionPoint = new THREE.Vector3().lerpVectors(
                    tackleStartPosition, opponentPosition, 0.7
                );
                
                // Ensure the opponent's control of the ball is released
                if (closestOpponent.isControllingBall) {
                closestOpponent.stopControllingBall();
                }
                
                // Ensure the ball is released from control
                this.ball.releaseFromControl();
                this.ball.controllingPlayer = null;
                this.ball.isControlled = false;
                
                // Calculate direction after tackle
                // Ball should move in direction of tackle but slightly deflected
                const tackleDeflection = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.5, // Small random x deflection
                    0,
                    (Math.random() - 0.5) * 0.5  // Small random z deflection
                );
                const tackleResultDirection = tackleDirection.clone().add(tackleDeflection).normalize();
                
                // Distance-based power adjustment - close tackles give player more control
                let kickPower = 5;
                if (minDistance < 3) { // Increased from 2 for more control opportunities
                    // Very close tackles - player gets more control
                    kickPower = 3;
                    
                    // Better chance to gain control for very close, successful tackles
                    if (Math.random() < 0.7) { // Increased from 0.5 (70% chance)
                        // Set ball position slightly ahead of player for cleaner animation
                        const controlOffset = this.activePlayer.direction.clone().multiplyScalar(1.2);
                        this.ball.mesh.position.copy(this.activePlayer.mesh.position).add(controlOffset);
                        this.ball.mesh.position.y = 0.5; // Ball radius
                        
                        // Give ball to player
                        this.ball.isControlled = true;
                        this.ball.controllingPlayer = this.activePlayer;
                        this.activePlayer.startControllingBall(this.ball);
                        
                        console.log("Successful tackle: Player gained control of the ball!");
                        this.soundManager.playKickSound();
                        return;
                    }
                }
                
                // Set ball position to collision point for realistic tackle
                this.ball.mesh.position.copy(collisionPoint);
                this.ball.mesh.position.y = 0.5; // Ball radius
                
                // Give ball a bit of momentum in tackle direction
                this.ball.velocity.copy(tackleResultDirection).multiplyScalar(kickPower);
                
                // Small vertical component for a slight bounce
                this.ball.velocity.y = 1 + Math.random() * 2;
                
                // Reset ball spin
                this.ball.spin.set(0, 0, 0);
                
                // Apply field boundaries to ensure ball stays in play
                this.ball.handleFieldBoundaries(this.ball.mesh.position);
                
                // Good tackling sound effect
                this.soundManager.playKickSound();
                
                console.log("Successful tackle!");
            } else {
                // Failed tackle animation and effects
                
                // Slow down player after failed tackle (recovery time)
                this.activePlayer.velocity.multiplyScalar(0.3);
                
                // Tackled player gets a small boost to escape (for AI tactical advantage)
                closestOpponent.velocity.add(
                    tackleDirection.clone().multiplyScalar(-2) // Push in opposite direction of tackle
                );
                
                console.log("Failed tackle!");
            }
        }
    }
    
    // New method to handle positioning of non-active human players
    updateHumanTeamPositioning(deltaTime) {
        // Define role-specific behaviors
        const roleBehaviors = {
            goalkeeper: {
                forwardBias: 0.0,
                stayNearGoal: true,
                maxForwardPosition: -22
            },
            attacker: {
                forwardBias: 0.9,
                defensiveContribution: 0.3,
                maxBackwardPosition: -15
            },
            midfielder: {
                forwardBias: 0.6,
                defensiveContribution: 0.6
            },
            defender: {
                forwardBias: 0.3,
                defensiveContribution: 0.9,
                maxForwardPosition: 5
            }
        };
        
        // Base movement speed multiplier for automated movement
        const movementSpeed = 1.3; // Increased from 0.75 to reflect sprint speed
        
        // Determine if we're in attack or defense mode
        // We're in attack mode if the ball is in the opponent's half or if our team has the ball
        const ballX = this.ball.mesh.position.x;
        const ballZ = this.ball.mesh.position.z;
        const inOpponentHalf = ballX > 0;
        
        // Check if our team has ball possession
        let ourTeamHasBall = false;
        this.players.you.forEach(player => {
            if (player.hasBall || player.isControllingBall) {
                ourTeamHasBall = true;
            }
        });
        
        const inAttackMode = inOpponentHalf || ourTeamHasBall;
        
        // Update each non-active player
        this.players.you.forEach(player => {
            // Skip the active player
            if (player === this.activePlayer) return;
            
            // Get behavior for this role
            const behavior = roleBehaviors[player.role];
            
            // Calculate target position based on role, ball position, and game situation
            const targetPosition = new THREE.Vector3();
            
            if (player.role === 'goalkeeper') {
                // Goalkeeper positioning - always stay near goal with limited forward movement
                targetPosition.x = -28; // Base position at goal
                
                // Move slightly based on ball position, but stay close to goal
                if (ballX < -10) { // Ball close to our goal
                    // Come forward slightly if ball is close to goal
                    targetPosition.x = Math.max(-28, Math.min(-26, ballX + 2));
                    // Follow ball horizontally but with limited range
                    targetPosition.z = Math.max(-4, Math.min(4, ballZ * 0.6));
                } else {
                    // Standard position with small adjustment based on ball side
                    targetPosition.z = Math.max(-3, Math.min(3, ballZ * 0.2));
                }
            } else if (inAttackMode) {
                // Attacking positioning for non-goalkeeper players
                
                // For attackers and midfielders, move forward in attack
                if (player.role === 'attacker') {
                    // Find open space in opponent's half
                    targetPosition.x = Math.max(5, ballX + 5 * behavior.forwardBias);
                    
                    // Calculate spread position based on number of attackers
                    const attackerCount = this.players.you.filter(p => p.role === 'attacker').length;
                    const attackerIndex = this.players.you.filter(p => p.role === 'attacker').indexOf(player);
                    
                    if (attackerCount === 1) {
                        // Single attacker - position centrally but slightly offset from ball
                        targetPosition.z = ballZ * 0.3;
                    } else {
                        // Multiple attackers - spread across width
                        const spreadWidth = 16;
                        const normalizedIndex = attackerIndex / Math.max(1, attackerCount - 1);
                        targetPosition.z = (normalizedIndex * 2 - 1) * spreadWidth;
                        
                        // Shift slightly toward ball side
                        targetPosition.z += ballZ * 0.2;
                    }
                } else if (player.role === 'midfielder') {
                    // Midfielders provide support in attack
                    targetPosition.x = ballX * 0.5; // Behind the ball for support
                    
                    // Spread midfielders across width
                    const midfielderCount = this.players.you.filter(p => p.role === 'midfielder').length;
                    const midfielderIndex = this.players.you.filter(p => p.role === 'midfielder').indexOf(player);
                    
                    if (midfielderCount === 1) {
                        // Single midfielder provides central support
                        targetPosition.z = ballZ * 0.5;
                    } else {
                        // Multiple midfielders - one supports attack, others cover defensively
                        const spreadWidth = 14;
                        const normalizedIndex = midfielderIndex / Math.max(1, midfielderCount - 1);
                        targetPosition.z = (normalizedIndex * 2 - 1) * spreadWidth;
                    }
                    
                    // Don't go too far forward for midfielders
                    targetPosition.x = Math.min(15, targetPosition.x);
                } else if (player.role === 'defender') {
                    // Defenders maintain defensive shape even in attack
                    targetPosition.x = Math.min(behavior.maxForwardPosition, ballX * 0.3 - 10);
                    
                    // Spread defenders across width
                    const defenderCount = this.players.you.filter(p => p.role === 'defender').length;
                    const defenderIndex = this.players.you.filter(p => p.role === 'defender').indexOf(player);
                    
                    if (defenderCount === 1) {
                        // Single defender stays central
                        targetPosition.z = 0;
                    } else {
                        // Multiple defenders spread across width
                        const spreadWidth = 16;
                        const normalizedIndex = defenderIndex / Math.max(1, defenderCount - 1);
                        targetPosition.z = (normalizedIndex * 2 - 1) * spreadWidth;
                    }
                }
            } else {
                // Defensive positioning for non-goalkeeper players
                
                if (player.role === 'attacker') {
                    // Attackers don't come too far back on defense, stay ready for counter
                    targetPosition.x = Math.min(10, Math.max(behavior.maxBackwardPosition, ballX * 0.3));
                    
                    // Position attackers across width for counter-attack
                    const attackerCount = this.players.you.filter(p => p.role === 'attacker').length;
                    const attackerIndex = this.players.you.filter(p => p.role === 'attacker').indexOf(player);
                    
                    if (attackerCount === 1) {
                        // Single attacker positions slightly to ball side
                        targetPosition.z = ballZ * 0.3;
                    } else {
                        // Multiple attackers spread out
                        const spreadWidth = 18;
                        const normalizedIndex = attackerIndex / Math.max(1, attackerCount - 1);
                        targetPosition.z = (normalizedIndex * 2 - 1) * spreadWidth;
                    }
                } else if (player.role === 'midfielder') {
                    // Midfielders form defensive line
                    targetPosition.x = Math.min(-5, Math.max(-15, ballX * 0.7 - 5));
                    
                    // Midfielders position based on ball and opponents
                    const midfielderCount = this.players.you.filter(p => p.role === 'midfielder').length;
                    const midfielderIndex = this.players.you.filter(p => p.role === 'midfielder').indexOf(player);
                    
                    // Check for opponent attackers to mark
                    const opponentAttackers = this.players.ai.filter(p => p.role === 'attacker');
                    
                    if (opponentAttackers.length > 0 && midfielderIndex < opponentAttackers.length) {
                        // Mark opponent attacker
                        const opponentPos = opponentAttackers[midfielderIndex].mesh.position;
                        
                        // Position between opponent and our goal
                        const goalPos = new THREE.Vector3(-28, 0, 0);
                        targetPosition.copy(opponentPos).lerp(goalPos, 0.4);
                    } else {
                        // Standard defensive positioning
                        if (midfielderCount === 1) {
                            // Single midfielder shadows ball
                            targetPosition.z = ballZ * 0.7;
                        } else {
                            // Multiple midfielders spread out but biased towards ball
                            const spreadWidth = 14;
                            const normalizedIndex = midfielderIndex / Math.max(1, midfielderCount - 1);
                            const baseZ = (normalizedIndex * 2 - 1) * spreadWidth;
                            targetPosition.z = baseZ + (ballZ * 0.3);
                        }
                    }
                } else if (player.role === 'defender') {
                    // Find nearest opponent attacker to mark
                    let nearestAttacker = null;
                    let nearestAttackerDistance = Infinity;
                    
                    this.players.ai.forEach(opponent => {
                        if (opponent.role === 'attacker') {
                            const distance = player.mesh.position.distanceTo(opponent.mesh.position);
                            if (distance < nearestAttackerDistance) {
                                nearestAttackerDistance = distance;
                                nearestAttacker = opponent;
                            }
                        }
                    });
                    
                    // If there's a nearby attacker to mark, position between them and goal
                    if (nearestAttacker && nearestAttackerDistance < 20) {
                        // Get attacker position
                        const attackerPos = nearestAttacker.mesh.position.clone();
                        const goalPos = new THREE.Vector3(-28, 0, 0);
                        
                        // Position between attacker and goal - closer to goal for better defense
                        targetPosition.copy(attackerPos).lerp(goalPos, 0.6);
                        
                        // Ensure defender stays in defensive half
                        targetPosition.x = Math.min(-5, targetPosition.x);
                    } else {
                        // No attacker to mark - form defensive line
                        targetPosition.x = Math.min(-18, ballX - 5); // Deep in our half, ahead of goal
                        
                        // Position defenders across the width
                        const defenderCount = this.players.you.filter(p => p.role === 'defender').length;
                        const defenderIndex = this.players.you.filter(p => p.role === 'defender').indexOf(player);
                        
                        if (defenderCount === 1) {
                            // Single defender stays central
                            targetPosition.z = 0;
                        } else {
                            // Multiple defenders spread out
                            const spreadWidth = 16;
                            const normalizedIndex = defenderIndex / Math.max(1, defenderCount - 1);
                            targetPosition.z = (normalizedIndex * 2 - 1) * spreadWidth;
                            
                            // Shift slightly toward ball side
                            targetPosition.z += ballZ * 0.2;
                        }
                    }
                }
            }
            
            // Calculate distance to target position
            const distanceToTarget = player.mesh.position.distanceTo(targetPosition);
            
            // Only move if not already at target
            if (distanceToTarget > 1.5) {
                // Calculate direction to target
                const direction = new THREE.Vector3()
                    .subVectors(targetPosition, player.mesh.position)
                    .normalize();
                
                // Determine movement speed - always use sprint speed for urgency
                // Use sprintSpeed instead of regular speed
                const urgencyFactor = distanceToTarget > 10 ? 1.8 : 1.5; // Further increased
                const moveSpeed = player.sprintSpeed * movementSpeed * urgencyFactor;
                
                // Move player towards target, applying the game speed multiplier
                player.move(direction, moveSpeed, this.speedMultiplier);
            }
        });
    }
    
    setGameSpeed(speed) {
        this.speedMultiplier = parseFloat(speed);
        
        // Update AI manager with new speed multiplier if it exists
        if (this.aiManager) {
            this.aiManager.speedMultiplier = this.speedMultiplier;
        }
    }
}

// Wait for the DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    new SoccerGame();
}); 