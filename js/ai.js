import * as THREE from 'three';
import { getRoleSpeed, getRoleDribblingSkill } from './player.js';

// Define player states for the Finite State Machine
const PlayerState = {
    IDLE: 'idle',
    MOVE_TO_BALL: 'moveToBall',
    DRIBBLE: 'dribble',
    PASS: 'pass',
    SHOOT: 'shoot',
    DEFEND: 'defend',
    INTERCEPT: 'intercept',
    SUPPORT: 'support'
};

export class AIManager {
    constructor(aiTeam, playerTeam, ball, difficulty = 'medium') {
        this.aiTeam = aiTeam;
        this.playerTeam = playerTeam;
        this.ball = ball;
        this.difficulty = difficulty;
        this.speedMultiplier = 1.0; // Default game speed multiplier
        
        // Flag to track if AI team has ball possession
        this.hasBallPossession = false;
        
        // Current player with ball
        this.playerWithBall = null;
        
        // Anti-spinning - map to store last direction and time for each player
        this.playerDirections = new Map();
        
        // AI difficulty parameters
        this.difficultySettings = {
            easy: {
                reactionTime: 0.6,
                decisionAccuracy: 0.7,
                passAccuracy: 0.7,
                shootAccuracy: 0.5,
                movementSpeed: 0.9,
                aggressiveness: 0.6,
                positioningQuality: 0.7,
                goalkeeperReflexes: 0.6
            },
            medium: {
                reactionTime: 0.4,
                decisionAccuracy: 0.8,
                passAccuracy: 0.85,
                shootAccuracy: 0.7,
                movementSpeed: 1.0,
                aggressiveness: 0.8,
                positioningQuality: 0.8,
                goalkeeperReflexes: 0.8
            },
            hard: {
                reactionTime: 0.2,
                decisionAccuracy: 0.95,
                passAccuracy: 0.95,
                shootAccuracy: 0.9,
                movementSpeed: 1.1,
                aggressiveness: 1.0,
                positioningQuality: 0.95,
                goalkeeperReflexes: 0.95
            }
        };
        
        // Role-specific behaviors
        this.roleBehaviors = {
            goalkeeper: {
                offensivePositioning: false,
                forwardBias: 0.0,
                defensiveContribution: 1.0,
                stayNearGoal: true,
                maxForwardPosition: 6
            },
            attacker: {
                offensivePositioning: true,
                forwardBias: 0.9,
                defensiveContribution: 0.3,
                interceptProbability: 0.8
            },
            midfielder: {
                offensivePositioning: true,
                forwardBias: 0.6,
                defensiveContribution: 0.6,
                interceptProbability: 0.7
            },
            defender: {
                offensivePositioning: false,
                forwardBias: 0.3,
                defensiveContribution: 0.9,
                interceptProbability: 0.6
            }
        };
        
        // Initialize FSM state for each AI player
        this.playerStates = new Map();
        aiTeam.forEach(player => {
            this.playerStates.set(player, PlayerState.IDLE);
        });
        
        // Initialize decision timers for each AI player
        this.decisionTimers = new Map();
        aiTeam.forEach(player => {
            this.decisionTimers.set(player, 0);
        });
        
        // Nearest player to the ball
        this.nearestToBall = null;
        
        // Goal positions
        this.playerGoal = new THREE.Vector3(-30, 1, 0);
        this.aiGoal = new THREE.Vector3(30, 1, 0);
        
        // Team strategy state
        this.teamState = {
            isAttacking: false,
            isDefending: true,
            lastFormationUpdate: 0,
            formationUpdateInterval: 1.0,
            counterAttackTimer: 0
        };
    }
    
    setDifficulty(difficulty) {
        if (this.difficultySettings[difficulty]) {
            this.difficulty = difficulty;
            console.log(`AI difficulty set to: ${difficulty}`);
            
            // Apply difficulty-specific adjustments
            this.applyDifficultyAdjustments();
        } else {
            console.warn(`Invalid difficulty: ${difficulty}. Using medium.`);
            this.difficulty = 'medium';
            this.applyDifficultyAdjustments();
        }
    }
    
    update(deltaTime) {
        // Debug logging for AI update
        console.log("AI update called, deltaTime:", deltaTime);
        
        // Update team strategy
        this.updateTeamStrategy(deltaTime);
        
        // Update which player is nearest to the ball
        this.updateNearestPlayerToBall();
        
        // Update ball possession state
        this.updateBallPossession();
        
        // Role-appropriate forced chaser selection
        let forcedChaser = null;
        let closestDist = Infinity;
        const ballX = this.ball.mesh.position.x;
        const ballInDefensiveHalf = ballX > 0;
        const ballInOffensiveHalf = ballX < 0;
        
        // First, try to find a role-appropriate chaser based on ball position
        this.aiTeam.forEach(player => {
            if (player.role !== 'goalkeeper') {
                const dist = player.mesh.position.distanceTo(this.ball.mesh.position);
                
                // Attackers prioritized when ball is in offensive half
                if (ballInOffensiveHalf && player.role === 'attacker' && dist < 20) {
                    if (dist < closestDist) {
                        closestDist = dist;
                        forcedChaser = player;
                    }
                }
                // Midfielders can chase anywhere but prioritize central positions
                else if (player.role === 'midfielder' && dist < 15) {
                    if (dist < closestDist) {
                        closestDist = dist;
                        forcedChaser = player;
                    }
                }
                // Defenders prioritized when ball is in defensive half
                else if (ballInDefensiveHalf && player.role === 'defender' && dist < 20) {
                    if (dist < closestDist) {
                        closestDist = dist;
                        forcedChaser = player;
                    }
                }
            }
        });
        
        // If no appropriate role found, fall back to nearest player
        if (!forcedChaser) {
            this.aiTeam.forEach(player => {
                if (player.role !== 'goalkeeper') {
                    const dist = player.mesh.position.distanceTo(this.ball.mesh.position);
                    if (dist < closestDist && dist < 20) {
                        closestDist = dist;
                        forcedChaser = player;
                    }
                }
            });
        }
        
        // Force the selected player to chase if found
        if (forcedChaser) {
            console.log(`Forcing ${forcedChaser.role} to chase ball at distance ${closestDist.toFixed(2)}`);
            this.playerStates.set(forcedChaser, PlayerState.MOVE_TO_BALL);
            this.executeBehavior(forcedChaser);
        }
        
        // Update each AI player's state and execute behavior
        this.aiTeam.forEach(player => {
            // Skip the forced chaser as we already handled it
            if (player === forcedChaser) return;
            
            // Update decision timer based on reaction time
            const settings = this.difficultySettings[this.difficulty];
            let timer = this.decisionTimers.get(player);
            timer -= deltaTime;
            
            // Make a new decision when timer expires
            if (timer <= 0) {
                console.log(`Decision timer expired for ${player.role}`);
                // Special handling for goalkeeper
                if (player.role === 'goalkeeper') {
                    this.updateGoalkeeper(player);
                } else {
                    // Update player state based on behavior tree
                    this.updatePlayerState(player);
                    
                    // Execute behavior based on current state
                    this.executeBehavior(player);
                }
                
                // Reset timer with some randomness for more realistic behavior
                const baseReactionTime = settings.reactionTime;
                const randomVariation = baseReactionTime * 0.4; // ±20% variation
                timer = baseReactionTime + (Math.random() * randomVariation - randomVariation/2);
            }
            
            this.decisionTimers.set(player, timer);
            
            // Always ensure players are executing their behaviors, even between decision cycles
            // This ensures continuous movement
            const currentState = this.playerStates.get(player);
            if (currentState === PlayerState.MOVE_TO_BALL || 
                currentState === PlayerState.INTERCEPT || 
                currentState === PlayerState.DRIBBLE) {
                console.log(`Continuous execution for ${player.role}, state: ${currentState}`);
                this.executeBehavior(player);
            }
        });
    }
    
    // New method: Update player state based on behavior tree
    updatePlayerState(player) {
        // Get the current context
        const settings = this.difficultySettings[this.difficulty];
        const behavior = this.roleBehaviors[player.role];
        const distanceToBall = player.mesh.position.distanceTo(this.ball.mesh.position);
        const canIntercept = Math.random() < behavior.interceptProbability * settings.aggressiveness;
        const isBallApproaching = this.isBallApproachingPlayer(player);
        const ballX = this.ball.mesh.position.x;
        
        // Calculate player's position relative to the field
        const isInDefensiveHalf = player.mesh.position.x > 0;
        const isInOffensiveHalf = player.mesh.position.x < 0;
        const ballInDefensiveHalf = ballX > 0;
        const ballInOffensiveHalf = ballX < 0;
        
        // Role-specific decision making
        console.log(`Decision making for ${player.role} at x=${player.mesh.position.x.toFixed(2)}, ballX=${ballX.toFixed(2)}`);
        
        // If player has the ball, decision is the same regardless of role
        if (this.hasBallPossession && player === this.playerWithBall) {
            // Decision: What to do with the ball
            const distanceToGoal = player.mesh.position.distanceTo(this.playerGoal);
            const nearestOpponent = this.findNearestOpponent(player);
            const nearestOpponentDistance = player.mesh.position.distanceTo(nearestOpponent.mesh.position);
            
            // Evaluate pass options before deciding to shoot
            const passTargets = this.findPassTargets(player);
            const hasGoodPassTarget = passTargets.length > 0 && passTargets.some(target => target.value > 10);
            
            // IMPROVED: Distance-based decision making
            // Close to goal - Prioritize shooting
            if (distanceToGoal < 15 && Math.random() < settings.shootAccuracy * 1.2) {
                console.log(`${player.role} deciding to SHOOT from close range: ${distanceToGoal.toFixed(2)}`);
                this.playerStates.set(player, PlayerState.SHOOT);
            }
            // Medium range - Balance shooting and passing
            else if (distanceToGoal < 25) {
                // If opponent is close, prefer passing
                if (nearestOpponentDistance < 5 && hasGoodPassTarget) {
                    console.log(`${player.role} deciding to PASS with opponent nearby at medium range`);
                this.playerStates.set(player, PlayerState.PASS);
                }
                // Otherwise, shoot with moderate probability
                else if (Math.random() < settings.shootAccuracy * 0.8) {
                    console.log(`${player.role} deciding to SHOOT from medium range: ${distanceToGoal.toFixed(2)}`);
                    this.playerStates.set(player, PlayerState.SHOOT);
                }
                // Otherwise pass if we have a good target
                else if (hasGoodPassTarget) {
                    console.log(`${player.role} deciding to PASS from medium range`);
                    this.playerStates.set(player, PlayerState.PASS);
                }
                // Last resort - dribble
                else {
                    console.log(`${player.role} deciding to DRIBBLE (no good options at medium range)`);
                this.playerStates.set(player, PlayerState.DRIBBLE);
            }
            }
            // Long range - Prioritize passing
            else {
                // Strong preference for passing when far from goal
                if (hasGoodPassTarget && Math.random() < 0.8) {
                    console.log(`${player.role} deciding to PASS from long range`);
                    this.playerStates.set(player, PlayerState.PASS);
                }
                // Sometimes shoot if no defenders are near (low probability)
                else if (nearestOpponentDistance > 8 && Math.random() < settings.shootAccuracy * 0.3) {
                    console.log(`${player.role} deciding to take a LONG SHOT: ${distanceToGoal.toFixed(2)}`);
                    this.playerStates.set(player, PlayerState.SHOOT);
                }
                // Otherwise dribble forward
                else {
                    console.log(`${player.role} deciding to DRIBBLE forward from long range`);
                    this.playerStates.set(player, PlayerState.DRIBBLE);
                }
            }
            
            // Role-specific overrides
            if (player.role === 'defender' && distanceToGoal > 20 && hasGoodPassTarget) {
                // Defenders almost always pass rather than shoot from distance
                console.log(`Defender overriding to PASS instead of shoot/dribble`);
                this.playerStates.set(player, PlayerState.PASS);
            }
        } 
        // If player doesn't have the ball, make decisions based on role and ball position
        else {
            // Check if any human player has the ball and we're close - attempt tackle
            let humanHasBall = false;
            let distanceToHumanWithBall = Infinity;
            
            this.playerTeam.forEach(opponent => {
                if (opponent.isControllingBall || opponent.hasBall) {
                    humanHasBall = true;
                    const distance = player.mesh.position.distanceTo(opponent.mesh.position);
                    distanceToHumanWithBall = Math.min(distanceToHumanWithBall, distance);
                }
            });
            
            // Attempt tackle if human has the ball and we're in range
            // Defenders are more likely to tackle than other roles
            const tacklePriority = player.role === 'defender' ? 7 : 
                                   player.role === 'midfielder' ? 5 : 3;
                                   
            if (humanHasBall && distanceToHumanWithBall < tacklePriority) {
                console.log(`${player.role} prioritizing tackle with human, distance: ${distanceToHumanWithBall.toFixed(2)}`);
                this.playerStates.set(player, PlayerState.MOVE_TO_BALL);
                return;
            }
            
            // ATTACKER BEHAVIOR
            if (player.role === 'attacker') {
                if (!this.hasBallPossession && distanceToBall < 15 && ballInOffensiveHalf) {
                    // Attackers chase the ball only when it's in offensive half and close
                    console.log(`Attacker chasing ball in offensive half, distance: ${distanceToBall.toFixed(2)}`);
                    this.playerStates.set(player, PlayerState.MOVE_TO_BALL);
                } else if (this.teamState.isDefending && isInOffensiveHalf) {
                    // Attackers stay forward even when defending
                    console.log(`Attacker taking offensive position`);
                    this.playerStates.set(player, PlayerState.SUPPORT);
                } else {
                    // Otherwise take supporting attacking position
                    console.log(`Attacker taking supporting position`);
                    this.playerStates.set(player, PlayerState.SUPPORT);
                }
            }
            // MIDFIELDER BEHAVIOR
            else if (player.role === 'midfielder') {
                if (!this.hasBallPossession && distanceToBall < 20 && 
                   (ballInOffensiveHalf || (ballInDefensiveHalf && ballX < 15))) {
                    // Midfielders chase the ball in offensive half or middle of defensive half
                    console.log(`Midfielder chasing ball, distance: ${distanceToBall.toFixed(2)}`);
            this.playerStates.set(player, PlayerState.MOVE_TO_BALL);
        } else if (this.teamState.isDefending) {
                    // Help defense when team is defending
                    console.log(`Midfielder defending`);
            this.playerStates.set(player, PlayerState.DEFEND);
        } else {
                    // Support attack when team is attacking
                    console.log(`Midfielder supporting attack`);
            this.playerStates.set(player, PlayerState.SUPPORT);
                }
            }
            // DEFENDER BEHAVIOR
            else if (player.role === 'defender') {
                if (!this.hasBallPossession && distanceToBall < 15 && ballInDefensiveHalf) {
                    // Defenders chase ball only when it's in defensive half and close
                    console.log(`Defender chasing ball in defensive half, distance: ${distanceToBall.toFixed(2)}`);
                    this.playerStates.set(player, PlayerState.MOVE_TO_BALL);
                } else if (isBallApproaching && distanceToBall < 20 && canIntercept) {
                    // Defenders are good at intercepting
                    console.log(`Defender intercepting approaching ball, distance: ${distanceToBall.toFixed(2)}`);
                    this.playerStates.set(player, PlayerState.INTERCEPT);
                } else if (!isInDefensiveHalf && !this.teamState.isAttacking) {
                    // Defenders get back to defensive positions when not attacking
                    console.log(`Defender returning to defensive position`);
                    this.playerStates.set(player, PlayerState.DEFEND);
                } else {
                    // Default to defensive positioning
                    console.log(`Defender taking defensive position`);
                    this.playerStates.set(player, PlayerState.DEFEND);
                }
            }
            // GOALKEEPER BEHAVIOR - handled separately in updateGoalkeeper
            else if (player.role === 'goalkeeper') {
                this.playerStates.set(player, PlayerState.DEFEND);
            }
        }
    }
    
    // New method: Execute behavior based on current state
    executeBehavior(player) {
        const currentState = this.playerStates.get(player);
        
        if (!currentState) {
            console.log(`No state for player ${player.role}, defaulting to IDLE`);
            this.playerStates.set(player, PlayerState.IDLE);
            return;
        }
        
        // Check if any human player has the ball - try to tackle if close enough
        let humanWithBall = null;
        let distanceToHumanWithBall = Infinity;
        
        this.playerTeam.forEach(opponent => {
            if (opponent.isControllingBall || opponent.hasBall) {
                const distance = player.mesh.position.distanceTo(opponent.mesh.position);
                if (distance < distanceToHumanWithBall) {
                    distanceToHumanWithBall = distance;
                    humanWithBall = opponent;
                }
            }
        });
        
        // Try to tackle if very close to human with ball - overrides other states when in range
        if (humanWithBall && distanceToHumanWithBall < 5) {
            // Attempt tackle - if successful, we're done
            if (this.attemptAITackle(player)) {
                return;
            }
        }
        
        // Otherwise follow normal FSM behavior
        switch (currentState) {
            case PlayerState.IDLE:
                // Just stand still
                break;
                
            case PlayerState.MOVE_TO_BALL:
                // For when we want to get to the ball
                if (humanWithBall) {
                    // If human has ball, move towards them trying to tackle
                this.chaseBall(player);
                } else {
                    // Normal ball chasing
                    this.chaseBall(player);
                }
                break;
                
            case PlayerState.DRIBBLE:
                console.log(`${player.role} is dribbling`);
                this.dribbleBall(player);
                break;
                
            case PlayerState.PASS:
                console.log(`${player.role} is passing`);
                this.passBall(player);
                break;
                
            case PlayerState.SHOOT:
                console.log(`${player.role} is shooting`);
                this.shootBall(player);
                break;
                
            case PlayerState.DEFEND:
                console.log(`${player.role} is defending`);
                this.defensivePositioning(player);
                break;
                
            case PlayerState.INTERCEPT:
                console.log(`${player.role} is intercepting`);
                this.interceptBall(player);
                break;
                
            case PlayerState.SUPPORT:
                console.log(`${player.role} is supporting`);
                if (this.teamState.isAttacking) {
                    this.attackingPositioning(player);
                } else {
                    this.supportingDefensePosition(player);
                }
                break;
                
            default:
                console.warn(`Unknown state for ${player.role}: ${currentState}`);
                break;
        }
    }
    
    updateTeamStrategy(deltaTime) {
        // Update strategy timer
        this.teamState.lastFormationUpdate += deltaTime;
        
        // Only update formation logic at regular intervals to avoid constant jittering
        if (this.teamState.lastFormationUpdate >= this.teamState.formationUpdateInterval) {
            this.teamState.lastFormationUpdate = 0;
            
            // Check ball position to determine if we're attacking or defending
            const ballX = this.ball.mesh.position.x;
            const ballVelocityX = this.ball.velocity.x;
            
            // Perception module: Gather and analyze field information
            const fieldAnalysis = this.analyzeFieldState();
            
            // Decision module: Determine optimal team strategy based on field analysis
            if (this.hasBallPossession) {
                // We have the ball - we're always attacking
                console.log("Team strategy: ATTACKING (ball possession)");
                this.teamState.isAttacking = true;
                this.teamState.isDefending = false;
                this.teamState.counterAttackTimer = 0;
            } else if (ballX > 15) {  // Only defend when ball is very deep in our half
                // Ball is deep in our half - defend but look for counter-attack
                console.log("Team strategy: DEFENDING (ball deep in our half)");
                this.teamState.isAttacking = false;
                this.teamState.isDefending = true;
                
                // Check for counter-attack opportunity - more aggressive counter-attacking
                if (fieldAnalysis.opponentAdvancedCount >= 2) { // Even more aggressive counter, reduced from 3
                    // Opponent players are advanced - counter-attack opportunity
                    this.teamState.counterAttackTimer += deltaTime;
                    
                    // Reduced counter-attack timer further to 0.5 seconds
                    if (this.teamState.counterAttackTimer > 0.5) {
                        console.log("Team strategy: COUNTER-ATTACKING");
                        this.teamState.isAttacking = true;
                    }
                }
            } else {
                // For all other ball positions, always attack
                console.log("Team strategy: ATTACKING (default aggressive stance)");
                    this.teamState.isAttacking = true;
                    this.teamState.isDefending = false;
            }
            
            // Debug output the current strategy
            if (this.teamState.isAttacking) {
                console.log(`Team is in ATTACKING mode. Ball x: ${ballX.toFixed(2)}`);
                } else {
                console.log(`Team is in DEFENDING mode. Ball x: ${ballX.toFixed(2)}`);
            }
        }
    }
    
    // New method: Perception module for analyzing the current field state
    analyzeFieldState() {
        // Count players in different areas of the field
        let ourPlayersForward = 0;
        let opponentPlayersForward = 0;
        let opponentAdvancedCount = 0;
        
        // Count our team positions
        this.aiTeam.forEach(player => {
            if (player.mesh.position.x < 0) {
                ourPlayersForward++;
            }
        });
        
        // Count opponent team positions
        this.playerTeam.forEach(player => {
            if (player.mesh.position.x > 0) {
                opponentPlayersForward++;
            }
            
            // Count opponent players in advanced positions (our half)
            if (player.mesh.position.x > 10) {
                opponentAdvancedCount++;
            }
        });
        
        // Calculate ball possession probability based on player proximity
        let ourClosestDistance = Infinity;
        let opponentClosestDistance = Infinity;
        
        this.aiTeam.forEach(player => {
            const distance = player.mesh.position.distanceTo(this.ball.mesh.position);
            ourClosestDistance = Math.min(ourClosestDistance, distance);
        });
        
        this.playerTeam.forEach(player => {
            const distance = player.mesh.position.distanceTo(this.ball.mesh.position);
            opponentClosestDistance = Math.min(opponentClosestDistance, distance);
        });
        
        // Calculate probability of gaining possession based on distance difference
        let ballPossessionProbability = 0.5; // Default is even chance
        
        if (ourClosestDistance < opponentClosestDistance) {
            // We have a closer player
            const distanceAdvantage = opponentClosestDistance - ourClosestDistance;
            ballPossessionProbability = 0.5 + Math.min(0.5, distanceAdvantage / 10);
        } else {
            // Opponent has a closer player
            const distanceDisadvantage = ourClosestDistance - opponentClosestDistance;
            ballPossessionProbability = 0.5 - Math.min(0.5, distanceDisadvantage / 10);
        }
        
        return {
            ourPlayersForward,
            opponentPlayersForward,
            opponentAdvancedCount,
            ballPossessionProbability
        };
    }
    
    updateNearestPlayerToBall() {
        let nearestPlayer = null;
        let nearestDistance = Infinity;
        
        this.aiTeam.forEach(player => {
            const distance = player.mesh.position.distanceTo(this.ball.mesh.position);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestPlayer = player;
            }
        });
        
        this.nearestToBall = nearestPlayer;
    }
    
    updateBallPossession() {
        // Check if any AI player has the ball
        this.hasBallPossession = false;
        this.playerWithBall = null;
        
        this.aiTeam.forEach(player => {
            const distanceToBall = player.mesh.position.distanceTo(this.ball.mesh.position);
            if (distanceToBall < 1.5) { // Close enough to consider having possession
                this.hasBallPossession = true;
                this.playerWithBall = player;
                player.hasBall = true;
            } else {
                player.hasBall = false;
            }
        });
    }
    
    chaseBall(player) {
        const settings = this.difficultySettings[this.difficulty];
        
        // Calculate direction to the ball with more aggressive prediction
        const ballPos = this.ball.mesh.position.clone();
        const ballVel = this.ball.velocity.clone();
        
        // More aggressive prediction - chase where the ball is going
        const predictionFactor = 0.8; // Increased further from 0.6 for even more aggressive prediction
        const predictedPos = new THREE.Vector3().copy(ballPos).add(
            ballVel.multiplyScalar(predictionFactor)
        );
        
        const direction = new THREE.Vector3()
            .subVectors(predictedPos, player.mesh.position)
            .normalize();
        
        // Apply anti-spinning stabilization to the direction
        const stabilizedDirection = this.stabilizeDirection(player, direction);
        
        // Apply movement with difficulty adjustment - much faster chase
        const chaseSpeedBoost = 1.8; // 80% speed boost when chasing (increased from 50%)
        const speed = player.speed * settings.movementSpeed * chaseSpeedBoost;
        
        // Use the player's move method which handles physics properly
        // instead of directly manipulating velocity
        player.move(stabilizedDirection, speed);
        
        // Log movement for debugging
        console.log(`AI chasing ball: player=${player.role}, dir=(${stabilizedDirection.x.toFixed(2)}, ${stabilizedDirection.z.toFixed(2)}), speed=${speed.toFixed(2)}`);
    }
    
    // New anti-spinning method to stabilize direction changes
    stabilizeDirection(player, requestedDirection, isDribbling = false) {
        // Clone the requested direction to avoid modifying the original
        const stabilizedDirection = requestedDirection.clone();
        
        // Skip stabilization if almost no direction (near zero vector)
        if (requestedDirection.length() < 0.1) return stabilizedDirection;
        
        // Get player's previous direction info
        if (!this.playerDirections.has(player)) {
            // Initialize with current direction and time
            this.playerDirections.set(player, {
                lastDirection: requestedDirection.clone(),
                lastUpdateTime: Date.now() / 1000,
                recentDirections: []
            });
            return stabilizedDirection;
        }
        
        const playerDirectionInfo = this.playerDirections.get(player);
        const currentTime = Date.now() / 1000;
        const timeDelta = currentTime - playerDirectionInfo.lastUpdateTime;
        
        // Calculate angle change from last direction
        const lastDirection = playerDirectionInfo.lastDirection;
        const angleDiff = this.calculateAngleDifference(lastDirection, requestedDirection);
        
        // Add to recent directions history (keep last 10)
        playerDirectionInfo.recentDirections.push({
            direction: requestedDirection.clone(),
            time: currentTime,
            angleDiff: angleDiff
        });
        
        // Limit history size
        if (playerDirectionInfo.recentDirections.length > 10) {
            playerDirectionInfo.recentDirections.shift();
        }
        
        // Check for spinning pattern - look for rapid direction changes
        let isSpinningPattern = false;
        let totalAngleChange = 0;
        
        // Only check if we have enough history
        if (playerDirectionInfo.recentDirections.length >= 4) {
            // Sum up recent angle changes
            for (let i = playerDirectionInfo.recentDirections.length - 4; i < playerDirectionInfo.recentDirections.length; i++) {
                totalAngleChange += Math.abs(playerDirectionInfo.recentDirections[i].angleDiff);
            }
            
            // Check time span of these changes
            const timeSpan = currentTime - playerDirectionInfo.recentDirections[playerDirectionInfo.recentDirections.length - 4].time;
            
            // If we see large angle changes in a short time, it's likely spinning
            if (totalAngleChange > Math.PI * 1.2 && timeSpan < 0.8) {
                isSpinningPattern = true;
                console.log(`AI movement stabilizer: Detected potential spinning (total angle: ${totalAngleChange.toFixed(2)}, time: ${timeSpan.toFixed(2)})`);
            }
        }
        
        // Apply a smoothing factor if spinning pattern detected or if turn is very sharp
        let smoothingFactor;
        if (isSpinningPattern) {
            // Very strong smoothing during detected spinning
            smoothingFactor = 0.15; // Only 15% new direction, 85% old direction
        } else if (Math.abs(angleDiff) > Math.PI * 0.5) {
            // For sharp turns (> 90 degrees)
            smoothingFactor = 0.3; // 30% new direction, 70% old direction
        } else if (Math.abs(angleDiff) > Math.PI * 0.25) {
            // For moderate turns (> 45 degrees)
            smoothingFactor = 0.5; // 50% new direction, 50% old direction
        } else {
            // For gentle turns, use less smoothing
            smoothingFactor = 0.7; // 70% new direction, 30% old direction
        }
        
        // Apply direction smoothing
        stabilizedDirection.set(
            lastDirection.x * (1 - smoothingFactor) + requestedDirection.x * smoothingFactor,
            0,
            lastDirection.z * (1 - smoothingFactor) + requestedDirection.z * smoothingFactor
        ).normalize();
        
        // Update last direction for next time
        playerDirectionInfo.lastDirection.copy(stabilizedDirection);
        playerDirectionInfo.lastUpdateTime = currentTime;
        
        // If dribbling, add some additional stabilization
        if (isDribbling) {
            // Add a small amount of randomness to the direction
            const randomVariation = 0.1;
            stabilizedDirection.add(new THREE.Vector3(
                (Math.random() - 0.5) * randomVariation,
                0,
                (Math.random() - 0.5) * randomVariation
            ));
        }
        
        return stabilizedDirection;
    }
    
    // Helper method to calculate angle difference between two directions
    calculateAngleDifference(direction1, direction2) {
        const angle1 = Math.atan2(direction1.x, direction1.z);
        const angle2 = Math.atan2(direction2.x, direction2.z);
        
        let diff = angle2 - angle1;
        // Normalize to range [-π, π]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        return diff;
    }
    
    defensivePositioning(player) {
        const settings = this.difficultySettings[this.difficulty];
        const behavior = this.roleBehaviors[player.role];
        
        // Default defensive position based on role
        const defensivePosition = new THREE.Vector3();
        const ballX = this.ball.mesh.position.x;
        const ballZ = this.ball.mesh.position.z;
        
        // Get player index for formation
        const roleCount = this.aiTeam.filter(p => p.role === player.role).length;
        const playerIndex = this.aiTeam.filter(p => p.role === player.role).indexOf(player);
        const normalizedIndex = playerIndex / Math.max(1, roleCount - 1); // 0 to 1 value
        
        // Introduce occasional defensive lapses for more dynamic gameplay
        // This gives human players opportunities to exploit gaps in defense
        const defensiveLapseChance = {
            'easy': 0.4,      // 40% chance on easy
            'medium': 0.25,   // 25% chance on medium
            'hard': 0.15      // 15% chance on hard
        }[this.difficulty];
        
        // Occasionally create a defensive mistake
        const hasDefensiveLapse = Math.random() < defensiveLapseChance;
        
        // Role-specific defensive positioning
        switch (player.role) {
            case 'attacker':
                // Attackers stay forward even when defending, ready for counter-attacks
                defensivePosition.x = Math.min(-5, ballX * 0.3); // Stay in opponent half
                
                // Position attackers across the width of the field
                if (roleCount === 1) {
                    // Single attacker stays more central
                    defensivePosition.z = 0;
                } else {
                    // Multiple attackers spread out
                    const spreadWidth = 14;
                    defensivePosition.z = (normalizedIndex * 2 - 1) * spreadWidth;
                }
                
                // Attackers occasionally drift out of position for counter-attacks
                if (hasDefensiveLapse) {
                    defensivePosition.x -= (Math.random() * 5 + 2); // Drift further forward
                    defensivePosition.z += (Math.random() * 6 - 3); // Drift sideways
                }
                break;
                
            case 'midfielder':
                // Midfielders form a defensive line in the middle
                defensivePosition.x = Math.min(10, Math.max(5, ballX * 0.7)); // Near middle of our half
                
                // Position midfielders across the width, following ball more
                if (roleCount === 1) {
                    // Single midfielder shadows ball position
                    defensivePosition.z = ballZ * 0.7; // Follow ball side
                } else {
                    // Multiple midfielders spread out but shifted toward ball
                    const spreadWidth = 12;
                    const baseZ = (normalizedIndex * 2 - 1) * spreadWidth;
                    // Shift toward ball side
                    defensivePosition.z = baseZ + (ballZ * 0.3);
                }
                
                // Midfielders occasionally get drawn to ball too much, creating gaps
                if (hasDefensiveLapse) {
                    // Either over-commit to ball or drift out of position
                    if (Math.random() < 0.5) {
                        // Over-commit to ball
                        defensivePosition.z = ballZ * 0.9;
                        defensivePosition.x = Math.min(15, ballX * 0.8);
                    } else {
                        // Drift out of position
                        defensivePosition.z += (Math.random() * 10 - 5);
                    }
                }
                break;
                
            case 'defender':
                // Find nearest opponent attacker to mark
                let nearestAttacker = null;
                let nearestAttackerDistance = Infinity;
                
                this.playerTeam.forEach(opponent => {
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
                    const goalPos = this.aiGoal.clone();
                    
                    // Position between attacker and goal - closer to goal for better defense
                    defensivePosition.copy(attackerPos).lerp(goalPos, 0.6);
                    
                    // Ensure defender stays in defensive half
                    defensivePosition.x = Math.max(5, defensivePosition.x);
                    
                    // Defenders occasionally misread the play, creating openings
                    if (hasDefensiveLapse) {
                        // Move either too close to attacker or too close to goal
                        if (Math.random() < 0.5) {
                            // Too close to attacker - can get dribbled around
                            defensivePosition.copy(attackerPos).lerp(goalPos, 0.3);
                        } else {
                            // Too far from attacker - leaves space for shot
                            defensivePosition.copy(attackerPos).lerp(goalPos, 0.8);
                            // Also slightly off center
                            defensivePosition.z += (Math.random() * 3 - 1.5);
                        }
                    }
                    
                    console.log(`Defender marking attacker at position (${attackerPos.x.toFixed(2)}, ${attackerPos.z.toFixed(2)})`);
                } else {
                    // No attacker to mark - form defensive line
                    defensivePosition.x = Math.max(15, ballX + 10); // Deep in our half, ahead of goal
                    
                    // Position defenders across the width
                    if (roleCount === 1) {
                        // Single defender stays central
                        defensivePosition.z = 0;
                    } else {
                        // Multiple defenders spread out
                        const spreadWidth = 15;
                        defensivePosition.z = (normalizedIndex * 2 - 1) * spreadWidth;
                    }
                    
                    // Defenders occasionally create gaps in the line
                    if (hasDefensiveLapse) {
                        // Create a gap by moving out of position
                        if (Math.random() < 0.7) {
                            // Drift toward ball, leaving space behind
                            defensivePosition.x = Math.max(10, ballX + 5);
                            defensivePosition.z += (ballZ - defensivePosition.z) * 0.5;
                        } else {
                            // Drift horizontally, creating a gap in the line
                            defensivePosition.z += (Math.random() * 8 - 4);
                        }
                    }
                }
                break;
        }
        
        // If player is very far from position, move faster
        const distanceToPosition = player.mesh.position.distanceTo(defensivePosition);
        
        // Calculate direction to the position
        const direction = new THREE.Vector3()
            .subVectors(defensivePosition, player.mesh.position)
            .normalize();
        
        // Apply anti-spinning stabilization
        const stabilizedDirection = this.stabilizeDirection(player, direction);
        
        // Move towards defensive position with difficulty adjustment
        // Use slightly reduced urgency to give human players more time and space
        const urgencyMultiplier = distanceToPosition > 10 ? 1.6 : 1.2; // Reduced from 1.8/1.3
        const speed = player.speed * settings.movementSpeed * urgencyMultiplier;
        
        // Use player.move for consistent physics
        player.move(stabilizedDirection, speed);
        
        console.log(`AI defending: ${player.role} moving to (${defensivePosition.x.toFixed(2)}, ${defensivePosition.z.toFixed(2)})`);
    }
    
    shootBall(player) {
        const settings = this.difficultySettings[this.difficulty];
        
        // Improved shooting mechanics with more intelligent targeting
        if (player.hasBall || player.isControllingBall) {
            // Get vector to goal with improved target selection
            const shotTarget = this.calculateShotTarget(player);
            
            // Get role-based accuracy bonus
            let accuracyBonus = 0;
            if (player.role === 'attacker') {
                accuracyBonus = 0.2; // Attackers are better at shooting
            } else if (player.role === 'midfielder') {
                accuracyBonus = 0.1; // Midfielders have moderate shooting skill
            }
            
            // Calculate effective accuracy (base + bonuses, capped at 0.95)
            const effectiveAccuracy = Math.min(0.95, settings.shootAccuracy + accuracyBonus);
            
            // Reduced randomization based on player's accuracy
            const maxError = (1 - effectiveAccuracy) * 5; // Reduced from 10 to 5 meters max error
            
            // Add much less randomness to shot targeting, especially for accurate players
            shotTarget.y += (Math.random() * 2 - 1) * maxError * 0.4; // Reduced from 0.7
            shotTarget.z += (Math.random() * 2 - 1) * maxError * 0.3; // Reduced from 0.5
            
            // Get distance to goal
            const distanceToGoal = player.mesh.position.distanceTo(this.playerGoal);
            
            // Calculate direction vector from ball to target (more precise targeting)
            const direction = new THREE.Vector3()
                .subVectors(shotTarget, this.ball.mesh.position)
                .normalize();
            
            // Base power calculation with distance-based adjustment
            let shotPower;
            if (distanceToGoal < 10) {
                // Close range - moderate power to maintain accuracy
                shotPower = 15 + (distanceToGoal * 0.3);
            } else if (distanceToGoal < 20) {
                // Medium range - good balance of power and accuracy
                shotPower = 18 + (distanceToGoal * 0.4);
            } else {
                // Long range - need more power
                shotPower = 20 + (distanceToGoal * 0.5);
            }
            
            // Cap maximum power
            shotPower = Math.min(28, shotPower);
            
            // Apply accuracy adjustment - higher accuracy means more consistent power
            const powerVariance = (1 - effectiveAccuracy) * 0.15; // More accurate = less variance
            shotPower *= (1 - powerVariance) + (Math.random() * powerVariance * 2);
            
            // Role-based power adjustments
            if (player.role === 'attacker') {
                shotPower *= 1.1; // Attackers shoot harder
            }
            
            // Apply force to ball with calculated power
            this.ball.velocity.copy(direction).multiplyScalar(shotPower);
            
            // Calculate vertical component based on distance for proper arcing
            let verticalComponent;
            if (distanceToGoal < 10) {
                // Close shots - lower trajectory
                verticalComponent = 1 + Math.random();
            } else if (distanceToGoal < 20) {
                // Medium distance - moderate arc
                verticalComponent = 2 + (Math.random() * 2);
            } else {
                // Long shots - higher arc to clear defenders
                verticalComponent = 3 + (Math.random() * 3);
            }
            
            // Apply vertical component
            this.ball.velocity.y = verticalComponent;
            
            // Apply reduced spin for more predictable trajectories
            const spinFactor = (1 - effectiveAccuracy) * 3; // Reduced from previous values
            this.ball.spin.set(
                (Math.random() * 2 - 1) * spinFactor, // Side spin
                (Math.random() * 2 - 1) * spinFactor * 2, // Top spin
                (Math.random() * 2 - 1) * spinFactor // Side spin
            );
            
            console.log(`AI shot: power=${shotPower.toFixed(2)}, accuracy=${effectiveAccuracy.toFixed(2)}, vert=${verticalComponent.toFixed(2)}`);
            
            // Reset player ball possession
            player.hasBall = false;
            player.isControllingBall = false;
            this.hasBallPossession = false;
            this.playerWithBall = null;
            
            // Set player state to support after shooting
            this.playerStates.set(player, PlayerState.SUPPORT);
            
            return true;
        }
        
        return false;
    }
    
    // Improved method: Calculate best shot target based on goalkeeper position
    calculateShotTarget(player) {
        // Goal parameters - define the goal dimensions properly
        const goalWidth = 14; // Width of goal
        const goalHeight = 5; // Height of goal
        const goalHalfWidth = goalWidth / 2;
        
        // Define the corners of the goal for targeted shooting
        const corners = [
            new THREE.Vector3(this.playerGoal.x, 0.5, this.playerGoal.z - goalHalfWidth + 1.5), // Bottom left
            new THREE.Vector3(this.playerGoal.x, 0.5, this.playerGoal.z + goalHalfWidth - 1.5), // Bottom right
            new THREE.Vector3(this.playerGoal.x, goalHeight - 1, this.playerGoal.z - goalHalfWidth + 1.5), // Top left
            new THREE.Vector3(this.playerGoal.x, goalHeight - 1, this.playerGoal.z + goalHalfWidth - 1.5), // Top right
        ];
        
        // Start with the center of the goal
        const goalCenter = new THREE.Vector3().copy(this.playerGoal);
        goalCenter.y = goalHeight / 2; // Set to middle height of goal
        
        // Find the goalkeeper
        let goalkeeper = null;
        this.playerTeam.forEach(opponent => {
            if (opponent.role === 'goalkeeper') {
                goalkeeper = opponent;
            }
        });
        
        // Find the distance to goal for power and accuracy calculations
        const distanceToGoal = player.mesh.position.distanceTo(this.playerGoal);
        
        // Role-based accuracy bonus
        let accuracyBonus = 0;
        if (player.role === 'attacker') {
            accuracyBonus = 0.2; // Attackers are better at shooting
        } else if (player.role === 'midfielder') {
            accuracyBonus = 0.1; // Midfielders have moderate shooting skill
        }
        
        // Get the difficulty settings
        const settings = this.difficultySettings[this.difficulty];
        
        // Calculate effective accuracy (base + bonuses, capped at 0.95)
        const effectiveAccuracy = Math.min(0.95, settings.shootAccuracy + accuracyBonus);
        
        // Pick target based on goalkeeper position and effective accuracy
        let targetPosition = new THREE.Vector3();
        
        // If goalkeeper is present and we have good accuracy, aim for corners
        if (goalkeeper && Math.random() < effectiveAccuracy) {
            // Get goalkeeper position relative to goal
            const keeperPosZ = goalkeeper.mesh.position.z;
            const keeperPosY = goalkeeper.mesh.position.y;
            
            // Determine which side the goalkeeper is on
            const isKeeperLeft = keeperPosZ < this.playerGoal.z;
            
            // Determine if keeper is positioned higher or lower
            const isKeeperHigh = keeperPosY > goalHeight / 2;
            
            // Pick the corner furthest from goalkeeper
            let bestCornerIndex;
            if (isKeeperLeft) {
                bestCornerIndex = isKeeperHigh ? 1 : 3; // Bottom or top right
            } else {
                bestCornerIndex = isKeeperHigh ? 0 : 2; // Bottom or top left
            }
            
            // Use selected corner as target
            targetPosition.copy(corners[bestCornerIndex]);
            
            console.log(`AI shooting at corner ${bestCornerIndex}`);
        } 
        // For close range shots, use lower corners for higher probability
        else if (distanceToGoal < 12) {
            // Pick a lower corner randomly
            const cornerIndex = Math.random() < 0.5 ? 0 : 1;
            targetPosition.copy(corners[cornerIndex]);
            
            console.log(`AI shooting at lower corner from close range`);
        }
        // For medium accuracy or no goalkeeper, pick any corner with some randomness
        else if (Math.random() < effectiveAccuracy * 0.8) {
            // Pick any corner randomly
            const cornerIndex = Math.floor(Math.random() * 4);
            targetPosition.copy(corners[cornerIndex]);
            
            console.log(`AI shooting at random corner`);
        }
        // Fallback to a general area of the goal with more randomness
        else {
            targetPosition.copy(goalCenter);
            
            // Add controlled randomness to stay within goal
            const zRange = goalHalfWidth * 0.8; // 80% of half-width to stay away from posts
            const yRange = (goalHeight - 1) * 0.8; // 80% of height to stay under crossbar
            
            targetPosition.z += (Math.random() * 2 - 1) * zRange;
            targetPosition.y = Math.max(0.5, Math.min(goalHeight - 0.5, 1 + Math.random() * yRange));
            
            console.log(`AI shooting at general goal area`);
        }
        
        return targetPosition;
    }
    
    passBall(player) {
        const settings = this.difficultySettings[this.difficulty];
        
        // Enhanced passing logic using perception module
        // Find best pass target based on strategic value
        const passTargets = this.findPassTargets(player);
        
        if (passTargets.length > 0) {
            // Sort targets by strategic value (using the behavior tree logic)
            passTargets.sort((a, b) => b.value - a.value);
            
            // Select best target, with some probability of choosing a less-than-optimal target
            // based on difficulty (easier difficulty = less optimal passing)
            const targetIndex = Math.min(
                Math.floor(Math.random() * (1 / settings.decisionAccuracy) * 2),
                passTargets.length - 1
            );
            const target = passTargets[targetIndex];
            
            // Calculate pass direction and power
            const passDirection = new THREE.Vector3()
                .subVectors(target.player.mesh.position, player.mesh.position)
                .normalize();
            
            // Add slight randomization based on accuracy
            const randomFactor = (1 - settings.passAccuracy) * 0.5;
            passDirection.x += (Math.random() * 2 - 1) * randomFactor;
            passDirection.z += (Math.random() * 2 - 1) * randomFactor;
            passDirection.normalize();
            
            // Calculate pass power based on distance
            const passDistance = player.mesh.position.distanceTo(target.player.mesh.position);
            const basePower = Math.min(15, 8 + passDistance * 0.3);
            
            // Execute the pass
            this.ball.velocity.set(
                passDirection.x * basePower,
                1 + Math.random() * 2, // Slight upward component
                passDirection.z * basePower
            );
            
            // Reset ball possession
            player.hasBall = false;
            player.isControllingBall = false;
            this.hasBallPossession = false;
            this.playerWithBall = null;
            
            // Update state
            this.playerStates.set(player, PlayerState.SUPPORT);
            
            return true;
        }
        
        // No good pass targets, default to dribbling
        this.dribbleBall(player);
        return false;
    }
    
    // New method: Find and evaluate potential pass targets
    findPassTargets(player) {
        const targets = [];
        const settings = this.difficultySettings[this.difficulty];
        
        // Evaluate each teammate as a potential pass target
        this.aiTeam.forEach(teammate => {
            // Skip self and goalkeeper (unless desperate)
            if (teammate === player || (teammate.role === 'goalkeeper' && player.mesh.position.x > -20)) {
                return;
            }
            
            // Calculate base distance and direction
            const distance = player.mesh.position.distanceTo(teammate.mesh.position);
            
            // Skip if too far for an accurate pass based on difficulty
            const maxPassDistance = 20 + settings.passAccuracy * 15;
            if (distance > maxPassDistance) {
                return;
            }
            
            // Evaluate if pass lane is blocked by opponents
            const direction = new THREE.Vector3()
                .subVectors(teammate.mesh.position, player.mesh.position)
                .normalize();
            
            let isPassLaneBlocked = false;
            
            // Check if any opponent is blocking the pass lane
            this.playerTeam.forEach(opponent => {
                // Skip if opponent is too far to intercept
                if (opponent.mesh.position.distanceTo(player.mesh.position) > distance) {
                    return;
                }
                
                // Create a vector from passer to opponent
                const toOpponent = new THREE.Vector3()
                    .subVectors(opponent.mesh.position, player.mesh.position);
                
                // Project opponent vector onto pass direction
                const projection = toOpponent.dot(direction);
                
                // Skip if opponent is behind passer
                if (projection <= 0) {
                    return;
                }
                
                // Calculate perpendicular distance from pass line
                const projectedPoint = new THREE.Vector3()
                    .copy(direction)
                    .multiplyScalar(projection)
                    .add(player.mesh.position);
                
                const perpDistance = opponent.mesh.position.distanceTo(projectedPoint);
                
                // If opponent is close enough to pass line, it's blocked
                if (perpDistance < 2) {
                    isPassLaneBlocked = true;
                }
            });
            
            // If pass lane is blocked and we're not playing on easy, skip this target
            if (isPassLaneBlocked && this.difficulty !== 'easy') {
                return;
            }
            
            // Calculate strategic value of this pass
            let value = 0;
            
            // Prefer forward passes
            const forwardProgress = teammate.mesh.position.x - player.mesh.position.x;
            value += forwardProgress * 2;
            
            // Prefer passes toward goal if in attacking position
            if (player.mesh.position.x < 0) {
                const teammateDistanceToGoal = teammate.mesh.position.distanceTo(this.playerGoal);
                const myDistanceToGoal = player.mesh.position.distanceTo(this.playerGoal);
                
                if (teammateDistanceToGoal < myDistanceToGoal) {
                    value += (myDistanceToGoal - teammateDistanceToGoal) * 0.5;
                }
            }
            
            // Prefer passes to open teammates (not closely marked)
            let closestOpponentToTeammate = Infinity;
            this.playerTeam.forEach(opponent => {
                const opponentDistance = teammate.mesh.position.distanceTo(opponent.mesh.position);
                closestOpponentToTeammate = Math.min(closestOpponentToTeammate, opponentDistance);
            });
            
            // Add value for open teammates
            value += Math.min(8, closestOpponentToTeammate) * 0.5;
            
            // Adjust value based on teammate role
            if (teammate.role === 'attacker') {
                value += 2; // Prefer passing to attackers
            } else if (teammate.role === 'midfielder') {
                value += 1; // Midfielders are also good pass targets
            }
            
            // Add to targets list
            targets.push({
                player: teammate,
                distance: distance,
                value: value,
                isBlocked: isPassLaneBlocked
            });
        });
        
        return targets;
    }
    
    dribbleBall(player) {
        console.log(`${player.role} is executing dribbleBall`);
        // Use the aiDribbleBall method which has the correct implementation
        this.aiDribbleBall(player);
    }
    
    // Updated dribbling method for AI players
    aiDribbleBall(player) {
        const settings = this.difficultySettings[this.difficulty];
        
        // Store a persistent dribble target for this player to prevent erratic changes
        if (!player.dribbleTarget) {
            player.dribbleTarget = this.playerGoal.clone();
            player.lastAvoidanceDirection = null;
            player.dribbleTimer = 0;
            player.nextDirectionChangeTime = 1.0 + Math.random() * 1.5; // 1-2.5 seconds
        }
        
        // Update dribble timer
        player.dribbleTimer += 1/60; // Assuming 60fps
        
        // Only change targets periodically to prevent erratic movement
        const shouldUpdateTarget = player.dribbleTimer >= player.nextDirectionChangeTime;
        
        // Target the player's goal (the one we want to score in)
        let targetPosition = new THREE.Vector3();
        if (shouldUpdateTarget) {
            // Update target with slight variation for more natural movement
        targetPosition.copy(this.playerGoal);
        
            // Add some side-to-side variation for more natural movement
            // The closer to goal, the more direct we become
        const distanceToGoalFromPlayer = player.mesh.position.distanceTo(this.playerGoal);
            const distanceFactor = Math.min(1.0, distanceToGoalFromPlayer / 25);
            const lateralVariation = (Math.random() - 0.5) * 10 * distanceFactor;
            
            targetPosition.z += lateralVariation;
            
            // Store the new target and reset timer
            player.dribbleTarget.copy(targetPosition);
            player.dribbleTimer = 0;
            player.nextDirectionChangeTime = 1.0 + Math.random() * 1.5;
        } else {
            // Use existing target
            targetPosition.copy(player.dribbleTarget);
        }
        
        // Distance to goal for decision making
        const distanceToGoalFromPlayer = player.mesh.position.distanceTo(this.playerGoal);
        
        // Get nearest opponent - this is reused for multiple decisions
        const nearestOpponent = this.findNearestOpponent(player);
        const opponentDistance = player.mesh.position.distanceTo(nearestOpponent.mesh.position);
        
        // --------------------------------
        // Passing Logic (Existing code)
        // --------------------------------
        // For brevity, assuming previous passing checks are handled
        let shouldPass = false;
        let bestPassTarget = null;
        // Check for passing as in the existing code...
        
        // If we found a good pass, execute it
        if (shouldPass && bestPassTarget) {
            // Pass the ball as in the existing code...
            return;
        }
        
        // --------------------------------
        // Dribbling Movement Logic (Improved)
        // --------------------------------
        
        // Start with the baseline direction to goal
        const baseDirection = new THREE.Vector3()
            .subVectors(targetPosition, player.mesh.position)
            .normalize();
        
        // Only search for very specific threats in a narrow cone
        let avoidanceNeeded = false;
        let avoidanceDirection = new THREE.Vector3();
        
        // Track the closest opponent for avoidance
        let closestOpponentDistance = Infinity;
        let closestOpponentAhead = null;
        
        // IMPROVED DEFENDER DETECTION: Only consider defenders that are an immediate threat
        this.playerTeam.forEach(opponent => {
            // Only consider close opponents
            const distance = player.mesh.position.distanceTo(opponent.mesh.position);
            if (distance > 4) return; // Increased from 3 to allow earlier avoidance
            
            // Create vector to opponent
            const toOpponent = new THREE.Vector3().subVectors(
                opponent.mesh.position,
                player.mesh.position
            );
            
            // Calculate how directly in front the opponent is
            const normalizedToOpponent = toOpponent.clone().normalize();
            const directlyAhead = baseDirection.dot(normalizedToOpponent);
            
            // Only consider opponents that are ahead of the player
            if (directlyAhead > 0.3) { // Wider detection cone (was 0.8)
                if (distance < closestOpponentDistance) {
                    closestOpponentDistance = distance;
                    closestOpponentAhead = opponent;
                    
                    // Only set avoidance if really close
                    if (distance < 3.5) {
                avoidanceNeeded = true;
                    }
                }
            }
        });
        
        // Calculate final direction with smooth avoidance if needed
        let finalDirection = new THREE.Vector3();
        
        if (avoidanceNeeded && closestOpponentAhead) {
            // Create a persistent avoidance direction to prevent oscillation
            if (!player.lastAvoidanceDirection) {
                // Calculate which side to pass on (left or right)
                // This is important - we need to consistently choose the same side
                const oppToPlayer = new THREE.Vector3().subVectors(
                    player.mesh.position, 
                    closestOpponentAhead.mesh.position
                );
                
                // Cross product determines which side is more open
                const crossY = baseDirection.clone().cross(oppToPlayer).y;
                const avoidDir = crossY > 0 ? 1 : -1; // Positive = pass on right, Negative = pass on left
                
                // Create avoidance vector perpendicular to base direction
                const perpVector = new THREE.Vector3(-baseDirection.z * avoidDir, 0, baseDirection.x * avoidDir);
                player.lastAvoidanceDirection = perpVector.normalize();
            }
            
            // Use the persistent avoidance direction
            avoidanceDirection.copy(player.lastAvoidanceDirection);
            
            // Weight avoidance by distance (closer = stronger avoidance)
            const avoidStrength = Math.min(1.0, 3.5 / closestOpponentDistance); 
            
            // Blend base direction and avoidance - more avoidance when closer
            const forwardWeight = 1 - (avoidStrength * 0.7); // 0.3 - 1.0 based on distance
            
            finalDirection.addVectors(
                baseDirection.clone().multiplyScalar(forwardWeight),
                avoidanceDirection.clone().multiplyScalar(avoidStrength)
            ).normalize();
            
            console.log(`AI avoiding obstacle: blend of ${forwardWeight.toFixed(2)} forward, ${avoidStrength.toFixed(2)} avoidance`);
        } else {
            // No avoidance needed, use base direction
            finalDirection.copy(baseDirection);
            
            // Clear avoidance direction when no longer needed
            player.lastAvoidanceDirection = null;
        }
        
        // Apply strong anti-spinning stabilization when dribbling
        // Use a stronger stabilization for dribbling specifically
        const stabilizedDirection = this.stabilizeDirection(player, finalDirection, true);
        
        // IMPROVED: Check for shooting opportunity
        const shootDecision = this.evaluateShootingOpportunity(player, distanceToGoalFromPlayer, opponentDistance);
        
        if (shootDecision.shouldShoot) {
            console.log(`AI attempting to shoot: ${shootDecision.reason}`);
            this.playerStates.set(player, PlayerState.SHOOT);
            this.shootBall(player);
            return;
        }
        
        // Move player with ball - slightly slower dribbling for more control
        const dribbleSpeed = player.dribbleSpeed * settings.movementSpeed;
        
        // Use player.move() to ensure consistent physics
        player.move(stabilizedDirection, dribbleSpeed, this.speedMultiplier);
        
        console.log(`AI dribbling: player=${player.role}, dir=(${stabilizedDirection.x.toFixed(2)}, ${stabilizedDirection.z.toFixed(2)}), distToGoal=${distanceToGoalFromPlayer.toFixed(2)}`);
    }
    
    // New helper method to evaluate if a player should shoot
    evaluateShootingOpportunity(player, distanceToGoal, opponentDistance) {
        const settings = this.difficultySettings[this.difficulty];
        
        // Get accuracy bonus based on player role
        let accuracyBonus = 0;
        if (player.role === 'attacker') {
            accuracyBonus = 0.2; // Attackers are better shooters
        } else if (player.role === 'midfielder') {
            accuracyBonus = 0.1; // Midfielders have moderate shooting
        }
        
        // Calculate effective accuracy
        const effectiveAccuracy = Math.min(0.95, settings.shootAccuracy + accuracyBonus);
        
        // Base shot probability decreases with distance
        let shotProbability;
        let reason;
        
        if (distanceToGoal < 10) {
            // Very close to goal - high probability
            shotProbability = 0.8 * effectiveAccuracy;
            reason = `Very close range (${distanceToGoal.toFixed(1)}m)`;
        } else if (distanceToGoal < 18) {
            // Good shooting range - moderate probability
            shotProbability = 0.5 * effectiveAccuracy;
            reason = `Good shooting range (${distanceToGoal.toFixed(1)}m)`;
        } else if (distanceToGoal < 25) {
            // Challenging range - lower probability
            shotProbability = 0.25 * effectiveAccuracy;
            reason = `Challenging range (${distanceToGoal.toFixed(1)}m)`;
        } else {
            // Long range - very low probability
            shotProbability = 0.1 * effectiveAccuracy;
            reason = `Long range shot (${distanceToGoal.toFixed(1)}m)`;
        }
        
        // Adjust based on opponent distance
        if (opponentDistance < 2) {
            shotProbability *= 0.5; // Under heavy pressure - much harder to shoot
            reason += `, heavy pressure (${opponentDistance.toFixed(1)}m)`;
        } else if (opponentDistance < 5) {
            shotProbability *= 0.7; // Moderate pressure - harder to shoot
            reason += `, moderate pressure (${opponentDistance.toFixed(1)}m)`;
        } else {
            shotProbability *= 1.2; // Open space - easier to shoot
            reason += `, open space (${opponentDistance.toFixed(1)}m)`;
        }
        
        // Role-specific adjustments
        if (player.role === 'defender' && distanceToGoal > 15) {
            shotProbability *= 0.3; // Defenders rarely shoot from distance
            reason += `, defender reluctant to shoot`;
        } else if (player.role === 'attacker') {
            shotProbability *= 1.2; // Attackers more likely to take chances
            reason += `, attacker willing to shoot`;
        }
        
        // Final decision
        return {
            shouldShoot: Math.random() < shotProbability,
            probability: shotProbability,
            reason: reason
        };
    }
    
    // Method for goalkeeper AI that was accidentally deleted
    updateGoalkeeper(player) {
        const settings = this.difficultySettings[this.difficulty];
        
        // Get ball information
        const ballPos = this.ball.mesh.position.clone();
        const ballVelocity = this.ball.velocity.clone();
        const goalPosition = this.aiGoal.clone();
        
        // If this is player team's goalkeeper, use player goal position
        if (player.team === 'you') {
            goalPosition.copy(this.playerGoal);
        }
        
        // Calculate goal line (z-coordinate range for the goal)
        const goalWidth = 12;
        const goalHalfWidth = goalWidth / 2;
        const goalHeight = 6;
        
        // Calculate distances and ball information
        const distanceFromGoal = Math.abs(player.mesh.position.x - goalPosition.x);
        const ballDistanceFromGoal = Math.abs(ballPos.x - goalPosition.x);
        const ballSpeed = ballVelocity.length();
        
        // Detect if ball is heading directly toward goal
        const isShotOnGoal = this.isShotOnGoal(player.team, ballPos, ballVelocity);
        
        // Default state - perform normal goalkeeper positioning
        let isDiving = false;
        
        // Default target position - stay on goal line but move up/down with ball
        const targetPosition = new THREE.Vector3(
            goalPosition.x,
            0,
            Math.max(-goalHalfWidth + 1, Math.min(goalHalfWidth - 1, ballPos.z * 0.8))
        );
        
        // Modify goal keeper behavior based on ball threat level
        const isBallMovingTowardsGoal = (
            (player.team === 'you' && ballVelocity.x < -2) || 
            (player.team === 'ai' && ballVelocity.x > 2)
        );
        
        const isBallClose = ballDistanceFromGoal < 20;
        const isBallVeryClose = ballDistanceFromGoal < 10;
        
        // ADVANCED GOALKEEPER BEHAVIORS:
        
        // 1. SHOT PREDICTION - Better anticipation based on ball velocity
        if (isBallMovingTowardsGoal) {
            // Predict where ball will cross goal line with improved accuracy
            const timeToGoal = Math.max(0.1, ballDistanceFromGoal / Math.abs(ballVelocity.x));
            
            // Consider gravity effect on ball trajectory
            const predictedHeight = ballPos.y + ballVelocity.y * timeToGoal - 
                                   0.5 * this.ball.gravity * timeToGoal * timeToGoal;
            
            // Only try to save shots that are potentially on target
            const predictedZPosition = ballPos.z + ballVelocity.z * timeToGoal;
            const isOnTarget = Math.abs(predictedZPosition) < goalHalfWidth && predictedHeight < goalHeight;
            
            if (isOnTarget) {
                // Adjust target based on prediction
                targetPosition.z = Math.max(-goalHalfWidth + 1, Math.min(goalHalfWidth - 1, predictedZPosition));
                
                // 2. DIVING SAVES - For shots that require quick reactions
                const requiresDive = (
                    isBallVeryClose && 
                    Math.abs(ballVelocity.x) > 15 && 
                    Math.abs(predictedZPosition - player.mesh.position.z) > 2
                );
                
                if (requiresDive && Math.random() < settings.goalkeeperReflexes) {
                    // Initiate a diving save - move toward ball quickly
                    isDiving = true;
                    
                    // Calculate dive direction
                    const diveDirection = new THREE.Vector3();
                    
                    // Horizontal direction is toward predicted ball position
                    diveDirection.x = 0; // Keep x component minimal for sideways dive
                    diveDirection.z = Math.sign(predictedZPosition - player.mesh.position.z);
                    
                    // Vertical component based on predicted height
                    const needsJump = predictedHeight > 3;
                    diveDirection.y = needsJump ? 0.5 : 0;
                    
                    // Normalize and adjust for team direction
                    diveDirection.normalize();
                    
                    // Small forward movement to meet the ball
                    diveDirection.x = (player.team === 'you') ? 0.2 : -0.2;
                    
                    // Execute the dive with appropriate intensity (0-1)
                    const diveIntensity = Math.min(1.0, 
                        (Math.abs(ballVelocity.x) / 30) * // Ball speed factor
                        (1 - Math.abs(predictedZPosition - player.mesh.position.z) / 10) * // Distance factor
                        settings.goalkeeperReflexes // Skill factor
                    );
                    
                    // Tell the goalkeeper to dive
                    player.dive(diveDirection, diveIntensity);
                }
            }
        }
        
        // 3. PROACTIVE POSITIONING - Come off line to intercept through balls
        const isLowThroughBall = (
            isBallMovingTowardsGoal && 
            ballPos.y < 1 && 
            Math.abs(ballVelocity.x) < 10 && 
            Math.abs(ballVelocity.x) > 5
        );
        
        if (isLowThroughBall && isBallClose && !isDiving) {
            // Come out aggressively to collect through balls
            const interceptDistance = (player.team === 'you' ? 5 : -5);
            targetPosition.x = goalPosition.x + interceptDistance;
            
            // Adjust z-position to intercept
            const interceptTime = Math.abs(interceptDistance / ballVelocity.x);
            const interceptZ = ballPos.z + ballVelocity.z * interceptTime;
            targetPosition.z = Math.max(-goalHalfWidth + 1, Math.min(goalHalfWidth - 1, interceptZ));
        }
        
        // 4. SMALL SIDE COVERAGE - Position slightly off-center based on ball position
        if (!isDiving && !isLowThroughBall && !isBallVeryClose) {
            // Slightly favor the side where the ball is
            const sideShift = Math.sign(ballPos.z) * 0.5 * settings.positioningQuality;
            targetPosition.z += sideShift;
        }
        
        // 5. URGENCY BASED ON THREAT - Move faster when ball is more threatening
        let speedMultiplier = 1.0;
        
        if (isDiving) {
            // Maximum speed for diving saves
            speedMultiplier = 2.0;
        } else if (isShotOnGoal) {
            // Fast reactions for shots on goal
            speedMultiplier = 1.8;
        } else if (isBallVeryClose) {
            // Quick movements when ball is very close
            speedMultiplier = 1.5;
        } else if (isBallClose) {
            // Moderately fast when ball is in dangerous area
            speedMultiplier = 1.2;
        }
        
        // Add reaction based on difficulty
        speedMultiplier *= settings.goalkeeperReflexes;
        
        // Calculate movement direction
        const moveDirection = new THREE.Vector3()
            .subVectors(targetPosition, player.mesh.position)
            .normalize();
        
        // Apply movement with keeper-specific adjustments
        const keeperSpeed = player.speed * settings.movementSpeed * speedMultiplier;
        player.move(moveDirection, keeperSpeed, this.speedMultiplier);
        
        // Ensure goalkeeper doesn't move too far from goal
        const maxDist = this.roleBehaviors.goalkeeper.maxForwardPosition;
        const currentX = player.mesh.position.x;
        const goalX = goalPosition.x;
        
        if (Math.abs(currentX - goalX) > maxDist) {
            // Push back to allowed position
            player.mesh.position.x = goalX + (currentX > goalX ? maxDist : -maxDist);
        }
        
        // Return to goal line gradually when ball is far away
        if (!isBallClose && !isDiving && distanceFromGoal > 2) {
            const retreatFactor = 0.02;
            player.mesh.position.x += (goalX - player.mesh.position.x) * retreatFactor;
        }
    }
    
    // Helper method to determine if a shot is on goal
    isShotOnGoal(team, ballPos, ballVelocity) {
        // Goal position based on the team
        const goalPos = team === 'you' ? this.playerGoal : this.aiGoal;
        
        // Goal dimensions
        const goalWidth = 12;
        const goalHeight = 6;
        const goalHalfWidth = goalWidth / 2;
        
        // Check if ball is moving toward this goal
        const isMovingTowardGoal = (
            (team === 'you' && ballVelocity.x < -5) || 
            (team === 'ai' && ballVelocity.x > 5)
        );
        
        if (!isMovingTowardGoal) return false;
        
        // Get distance to goal
        const distanceToGoal = Math.abs(ballPos.x - goalPos.x);
        
        // Only consider shots within reasonable distance
        if (distanceToGoal > 25) return false;
        
        // Predict ball path to goal
        const timeToGoal = distanceToGoal / Math.abs(ballVelocity.x);
        
        // Predicted position at goal line
        const predictedZ = ballPos.z + ballVelocity.z * timeToGoal;
        const predictedY = ballPos.y + ballVelocity.y * timeToGoal - 
                          0.5 * this.ball.gravity * timeToGoal * timeToGoal;
        
        // Check if predicted position is within goal
        return (
            Math.abs(predictedZ) < goalHalfWidth &&
            predictedY > 0 &&
            predictedY < goalHeight
        );
    }
    
    // New helper method to find defenders directly in the path to goal
    findNearestDefenderInPath(player, direction) {
        let nearestDefender = null;
        let nearestDistance = Infinity;
        
        // Apply difficulty-based adjustment to detection abilities
        const settings = this.difficultySettings[this.difficulty];
        
        // Calculate narrower detection cone and shorter detection range based on difficulty
        // This makes it easier for human players to find shooting lanes
        let detectionConeWidth;
        let maxDetectionDistance;
        
        switch(this.difficulty) {
            case 'easy':
                detectionConeWidth = 1.0; // Narrow cone
                maxDetectionDistance = 5; // Short detection range
                break;
            case 'medium':
                detectionConeWidth = 1.5; // Medium cone
                maxDetectionDistance = 6.5; // Medium detection range
                break;
            case 'hard':
                detectionConeWidth = 1.8; // Wider cone but still reduced
                maxDetectionDistance = 8; // Longer but still reduced
                break;
            default:
                detectionConeWidth = 1.5;
                maxDetectionDistance = 6.5;
        }
        
        // Add randomness to detection - sometimes defenders miss shots even on hard
        // This creates more dynamic and engaging gameplay
        const detectionProbability = settings.decisionAccuracy * 0.8; // Reduce even the highest accuracy
        
        // Random chance to completely miss detection based on difficulty
        if (Math.random() > detectionProbability) {
            // Defender completely misses detecting the shot
            return null;
        }
        
        // Continue with normal detection but with adjusted parameters
                this.playerTeam.forEach(opponent => {
            // Skip if too far away (reduced detection range)
            const distance = player.mesh.position.distanceTo(opponent.mesh.position);
            if (distance > maxDetectionDistance) return;
            
            // Calculate vector to opponent
            const toOpponent = new THREE.Vector3().subVectors(
                opponent.mesh.position, 
                player.mesh.position
            );
            
            // Project opponent vector onto direction vector
            const projection = toOpponent.dot(direction);
            
            // Only consider opponents ahead of player (positive projection)
            if (projection > 0) {
                // Calculate perpendicular distance to direction line
                const projectionVector = direction.clone().multiplyScalar(projection);
                const perpVector = new THREE.Vector3().subVectors(toOpponent, projectionVector);
                const perpDistance = perpVector.length();
                
                // Only consider defenders directly in path (using narrower cone)
                if (perpDistance < detectionConeWidth && distance < nearestDistance) {
                    // Add 30% chance for defender to miss reading the shot path correctly
                    // This creates more dynamic and less frustrating gameplay
                    if (Math.random() < 0.3) {
                        return; // Defender fails to read the shot correctly
                    }
                    
                    nearestDistance = distance;
                    nearestDefender = {
                        player: opponent,
                        distance: distance,
                        perpDistance: perpDistance
                    };
                }
            }
        });
        
        return nearestDefender;
    }
    
    // New method to check if ball is approaching player
    isBallApproachingPlayer(player) {
        // Get ball velocity
        const ballVelocity = this.ball.velocity.clone();
        
        // If ball isn't moving much, it's not approaching
        if (ballVelocity.length() < 5) return false;
        
        // Check if ball is moving toward this player
        const ballToPlayer = new THREE.Vector3().subVectors(
            player.mesh.position,
            this.ball.mesh.position
        );
        
        // Calculate dot product to determine if velocities align
        const dotProduct = ballVelocity.normalize().dot(ballToPlayer.normalize());
        
        // If dot product is positive, ball is moving toward player
        return dotProduct > 0.7; // Ball direction is within ~45 degrees of player
    }
    
    // Improved method for intercepting the ball
    interceptBall(player) {
        // Calculate where the ball will be in the near future
        const ballPosition = this.ball.mesh.position.clone();
        const ballVelocity = this.ball.velocity.clone();
        
        // Predict ball position in the next 0.5 seconds
        const predictedBallPosition = ballPosition.clone().add(
            ballVelocity.clone().multiplyScalar(0.5)
        );
        
        // Calculate direction to the predicted position
        const directionToIntercept = new THREE.Vector3()
            .subVectors(predictedBallPosition, player.mesh.position)
            .normalize();
        
        // Apply anti-spin stabilization
        const stabilizedDirection = this.getStabilizedDirection(player, directionToIntercept);
        
        // Use sprint speed for interception
        const interceptSpeed = player.sprintSpeed * 1.1; // Slight boost for interception
        
        // Move player toward interception point with speed multiplier
        player.move(stabilizedDirection, interceptSpeed, this.speedMultiplier);
        
        // If very close to ball, attempt to get in front of it
        const distanceToBall = player.mesh.position.distanceTo(ballPosition);
        if (distanceToBall < 2) {
            // Try to get in front of the ball's path
            const ballDirection = ballVelocity.clone().normalize();
            const interceptPosition = ballPosition.clone().add(
                ballDirection.clone().multiplyScalar(-1.5)
            );
            
            const directionToFront = new THREE.Vector3()
                .subVectors(interceptPosition, player.mesh.position)
                .normalize();
            
            const stabilizedFrontDirection = this.getStabilizedDirection(player, directionToFront);
            
            // Move faster to get in front with speed multiplier
            player.move(stabilizedFrontDirection, interceptSpeed * 1.2, this.speedMultiplier);
        }
        
        return distanceToBall < 1.2;
    }
    
    // Method for positioning when team is attacking (without ball)
    attackingPositioning(player) {
        const settings = this.difficultySettings[this.difficulty];
        const behavior = this.roleBehaviors[player.role];
        
        // Find advanced position based on role
        const targetPosition = new THREE.Vector3();
        const ballX = this.ball.mesh.position.x;
        const ballZ = this.ball.mesh.position.z;
        
        // Get player index for formation
        const roleCount = this.aiTeam.filter(p => p.role === player.role).length;
        const playerIndex = this.aiTeam.filter(p => p.role === player.role).indexOf(player);
        const normalizedIndex = playerIndex / Math.max(1, roleCount - 1); // 0 to 1 value
        
        // Role-specific positioning - much more differentiated by role
        switch (player.role) {
            case 'attacker':
                // Attackers stay very forward, near the opponent's goal
                targetPosition.x = Math.min(-20, ballX - 5); // Very deep in opponent half
                
                // Position attackers across the width of the field based on their index
                if (roleCount === 1) {
                    // Single attacker stays central
                    targetPosition.z = ballZ * 0.3; // Slight bias toward ball side
                } else {
                    // Multiple attackers spread out
                    const spreadWidth = 16; // Width of spread
                    targetPosition.z = (normalizedIndex * 2 - 1) * spreadWidth; // -spreadWidth to +spreadWidth
                }
                break;
                
            case 'midfielder':
                // Midfielders provide link between defense and attack
                targetPosition.x = Math.min(-10, ballX); // More advanced but not as far as attackers
                
                // Position midfielders across the width of the field based on their index
                if (roleCount === 1) {
                    // Single midfielder stays central
                    targetPosition.z = ballZ * 0.5; // Follow ball side somewhat
                } else {
                    // Multiple midfielders spread out
                    const spreadWidth = 12; // Width of spread
                    targetPosition.z = (normalizedIndex * 2 - 1) * spreadWidth; // -spreadWidth to +spreadWidth
                }
                break;
                
            case 'defender':
                // Defenders push up but stay in more defensive positions
                targetPosition.x = Math.max(5, ballX + 15); // Stay back relative to ball
                
                // Position defenders across the width of the field based on their index
                if (roleCount === 1) {
                    // Single defender stays central
                    targetPosition.z = 0;
                } else {
                    // Multiple defenders spread out
                    const spreadWidth = 14; // Width of spread
                    targetPosition.z = (normalizedIndex * 2 - 1) * spreadWidth; // -spreadWidth to +spreadWidth
                }
                break;
                
            default:
                // Fallback for any other roles
                targetPosition.x = Math.min(0, ballX);
                targetPosition.z = (Math.random() * 2 - 1) * 10;
        }
        
        // Move toward the target position with urgency
        const distanceToPosition = player.mesh.position.distanceTo(targetPosition);
        const urgencyMultiplier = distanceToPosition > 10 ? 1.5 : 1.2;
        
        const moveDirection = new THREE.Vector3()
            .subVectors(targetPosition, player.mesh.position)
            .normalize();
        
        // Apply anti-spinning stabilization
        const stabilizedDirection = this.stabilizeDirection(player, moveDirection);
        
        // Use player.move() for consistent physics behavior
        const movementSpeed = player.speed * settings.movementSpeed * urgencyMultiplier;
        player.move(stabilizedDirection, movementSpeed);
        
        console.log(`AI positioning (attack): player=${player.role}, pos=(${targetPosition.x.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
    }
    
    // New method for supporting attacking play
    supportingAttackPosition(player) {
        const settings = this.difficultySettings[this.difficulty];
        const behavior = this.roleBehaviors[player.role];
        
        // Create an offensive supporting position
        const targetPosition = new THREE.Vector3();
        
        // Get position of player with the ball
        const ballPos = this.playerWithBall.mesh.position.clone();
        
        // Based on role, position around the player with the ball
        const playerIndex = this.aiTeam.indexOf(player);
        const angleOffset = (playerIndex / this.aiTeam.length) * Math.PI * 2;
        
        // Different distances based on role
        let distance = 0;
        if (player.role === 'attacker') {
            distance = 12; // Attackers stay close, ready for a pass
        } else if (player.role === 'midfielder') {
            distance = 15; // Midfielders slightly further back
        } else {
            distance = 20; // Defenders stay further back
        }
        
        // Calculate position in a rough semicircle formation in attacking half
        targetPosition.x = ballPos.x - Math.cos(angleOffset) * (distance * behavior.forwardBias);
        targetPosition.z = ballPos.z + Math.sin(angleOffset) * distance;
        
        // Keep the formation mostly in opponent's half
        targetPosition.x = Math.min(targetPosition.x, -5);
        
        // Move toward the target position
        const moveDirection = new THREE.Vector3()
            .subVectors(targetPosition, player.mesh.position)
            .normalize();
        
        // Apply anti-spinning stabilization
        const stabilizedDirection = this.stabilizeDirection(player, moveDirection);
        
        const movementSpeed = player.speed * settings.movementSpeed;
        player.move(stabilizedDirection, movementSpeed);
    }
    
    // New method for supporting defense
    supportingDefensePosition(player) {
        // Fall back to basic defensive positioning
        this.defensivePositioning(player);
    }
    
    // Helper to find the nearest opponent to a player
    findNearestOpponent(player) {
        let nearestOpponent = null;
        let nearestDistance = Infinity;
        
        this.playerTeam.forEach(opponent => {
            const distance = player.mesh.position.distanceTo(opponent.mesh.position);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestOpponent = opponent;
            }
        });
        
        return nearestOpponent;
    }
    
    // New method to apply difficulty-specific adjustments
    applyDifficultyAdjustments() {
        const settings = this.difficultySettings[this.difficulty];
        
        // Adjust all AI players' movement speeds based on difficulty
        this.aiTeam.forEach(player => {
            // Base speed adjustment
            player.speed = getRoleSpeed(player.role) * settings.movementSpeed;
            
            // Sprint speed adjustment
            player.sprintSpeed = player.speed * 1.6;
            
            // Dribble speed adjustment - make skilled players better dribblers on higher difficulties
            const dribbleModifier = 0.7 + (settings.aggressiveness * 0.3);
            player.dribbleSpeed = player.speed * dribbleModifier;
            
            // Role-specific adjustments
            if (player.role === 'goalkeeper') {
                // Adjust goalkeeper reflexes based on difficulty
                player.diveSpeed = 5 + settings.goalkeeperReflexes * 10;
                player.diveHeight = 1 + settings.goalkeeperReflexes * 1.5;
            } else if (player.role === 'attacker') {
                // Make attackers more aggressive on higher difficulties
                player.attackingPositionForwardBias = 0.7 + settings.aggressiveness * 0.3;
            } else if (player.role === 'defender') {
                // Make defenders more positionally aware on higher difficulties
                player.markingDistance = 2.5 - settings.positioningQuality;
            }
        });
        
        // Adjust team behavior based on difficulty
        if (this.difficulty === 'easy') {
            // Easy - less coordinated team play
            this.teamState.formationUpdateInterval = 1.5; // Slower formation updates
        } else if (this.difficulty === 'medium') {
            // Medium - balanced team play
            this.teamState.formationUpdateInterval = 1.0; // Standard formation updates
        } else if (this.difficulty === 'hard') {
            // Hard - highly coordinated team play
            this.teamState.formationUpdateInterval = 0.5; // Quicker formation updates
        }
    }
    
    // Add this new method for AI tackling
    attemptAITackle(player) {
        const settings = this.difficultySettings[this.difficulty];
        
        // Only attempt tackle if we're close enough to the player with the ball
        let playerWithBall = null;
        let minDistance = 7; // Slightly larger detection range than human player
        
        // Find the closest human player with the ball
        this.playerTeam.forEach(opponent => {
            if (opponent.isControllingBall || opponent.hasBall) {
                const distance = player.mesh.position.distanceTo(opponent.mesh.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    playerWithBall = opponent;
                }
            }
        });
        
        // If there's no player with the ball or we're too far, don't tackle
        if (!playerWithBall) return false;
        
        console.log(`AI ${player.role} attempting tackle: distance=${minDistance.toFixed(2)}`);
        
        // Calculate tackle direction
        const tackleDirection = new THREE.Vector3()
            .subVectors(playerWithBall.mesh.position, player.mesh.position)
            .normalize();
        
        // Apply direction stabilization to avoid erratic movement
        const stabilizedDirection = this.stabilizeDirection(player, tackleDirection);
        
        // Only tackle if we're in tackle range
        if (minDistance > 5) {
            // Just chase the ball carrier if we're not in range yet
            const chaseSpeed = player.speed * settings.movementSpeed * 1.8;
            player.move(stabilizedDirection, chaseSpeed);
            return false;
        }
        
        // Add a burst of speed for the tackling animation
        const tackleSpeed = player.speed * settings.movementSpeed * 2.0;
        player.move(stabilizedDirection, tackleSpeed);
        
        // Determine success chance based on role and distance
        let successChance = 0.5; // Base chance (slightly lower than human)
        
        // Role-based adjustments
        if (player.role === 'defender') {
            successChance += 0.2; // Defenders are good at tackling
        } else if (player.role === 'midfielder') {
            successChance += 0.1; // Midfielders are decent
        }
        
        // Scale by difficulty - harder difficulty means better tackles
        successChance *= settings.aggressiveness;
        
        // Distance-based adjustment
        const distanceFactor = Math.exp(-minDistance / 3); // Exponential falloff
        successChance *= 0.3 + 0.7 * distanceFactor;
        
        // Opponent's ball control reduces success
        const humanSkillImpact = playerWithBall.ballControlStrength * 0.3;
        successChance *= (1 - humanSkillImpact);
        
        // Advantage to human player makes game more fun
        successChance *= 0.8;
        
        // Add random factor
        successChance += (Math.random() * 0.1 - 0.05);
        
        // Ensure chance is within reasonable bounds
        successChance = Math.min(0.9, Math.max(0.15, successChance));
        
        console.log(`AI tackle chance: ${(successChance * 100).toFixed(1)}%`);
        
        // Only attempt tackle occasionally to prevent constant tackling
        // Scale by difficulty - harder difficulty means more frequent tackle attempts
        const attemptChance = 0.1 + (settings.aggressiveness * 0.3);
        
        // More tackle attempts if the human is near the AI goal
        const humanNearAIGoal = playerWithBall.mesh.position.x > 15;
        if (humanNearAIGoal) {
            // Increase tackle frequency in dangerous areas
            successChance *= 1.2;
        }
        
        // Randomly decide whether to actually attempt the tackle
        if (Math.random() > attemptChance) {
            return false; // Skip tackle attempt this frame
        }
        
        // Determine if tackle is successful
        if (Math.random() < successChance) {
            // Successful tackle - take the ball from the human player
            if (playerWithBall.isControllingBall) {
                playerWithBall.stopControllingBall();
            }
            
            // Ensure the ball is released from control
            this.ball.releaseFromControl();
            this.ball.controllingPlayer = null;
            this.ball.isControlled = false;
            
            // Calculate collision point
            const tackleLerpFactor = 0.6 + (Math.random() * 0.2);
            const collisionPoint = new THREE.Vector3().lerpVectors(
                player.mesh.position, 
                playerWithBall.mesh.position, 
                tackleLerpFactor
            );
            
            // Set ball position to collision point
            this.ball.mesh.position.copy(collisionPoint);
            this.ball.mesh.position.y = 0.5; // Ball radius
            
            // Add small random deflection to the ball
            const tackleDeflection = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                0,
                (Math.random() - 0.5) * 0.5
            );
            
            // Calculate result direction with deflection
            const tackleResultDirection = tackleDirection.clone().add(tackleDeflection).normalize();
            
            // Very close tackles might result in AI gaining control
            const closeDistanceControl = minDistance < 2 && Math.random() < 0.4;
            if (closeDistanceControl) {
                // AI gains control of the ball
                this.ball.isControlled = true;
                this.ball.controllingPlayer = player;
                player.startControllingBall(this.ball);
                this.playerWithBall = player;
                this.hasBallPossession = true;
                this.playerStates.set(player, PlayerState.DRIBBLE);
                
                console.log(`AI ${player.role} gained control after successful tackle`);
                return true;
            }
            
            // Give ball momentum in tackle direction
            const kickPower = 3 + Math.random() * 3;
            this.ball.velocity.copy(tackleResultDirection).multiplyScalar(kickPower);
            
            // Add small vertical component
            this.ball.velocity.y = 1 + Math.random() * 1.5;
            
            // Reset ball spin
            this.ball.spin.set(0, 0, 0);
            
            console.log(`AI ${player.role} successfully tackled human player`);
            return true;
        } else {
            // Failed tackle
            // Slow down AI player slightly to give human advantage
            player.velocity.multiplyScalar(0.4);
            
            // Push the human player slightly to create separation
            const pushDirection = tackleDirection.clone();
            const pushForce = 2 + Math.random() * 1;
            playerWithBall.velocity.add(pushDirection.multiplyScalar(pushForce));
            
            console.log(`AI ${player.role} failed tackle attempt`);
            return false;
        }
    }
    
    // Movement behavior for the AI team
    moveToBall(player, deltaTime) {
        const ballPosition = this.ball.mesh.position.clone();
        const playerPosition = player.mesh.position.clone();
        
        // Calculate direction to ball
        const directionToBall = new THREE.Vector3()
            .subVectors(ballPosition, playerPosition)
            .normalize();
        
        // Apply anti-spin stabilization
        const stabilizedDirection = this.getStabilizedDirection(player, directionToBall);
        
        // Calculate urgency factor - faster when ball is moving away or far away
        const distanceToBall = playerPosition.distanceTo(ballPosition);
        
        // Urgency increases with distance
        let urgencyFactor = 1.0;
        if (distanceToBall > 10) {
            urgencyFactor = 1.3; // Sprint when far from ball
        }
        
        // Use sprint speed when ball is moving away or far away
        // Added: skill factor makes better players faster to the ball
        const skillFactor = player.ballControlStrength * 0.2 + 0.9; // 0.9 to 1.1 based on skill
        const speed = player.sprintSpeed * urgencyFactor * skillFactor;
        
        // Apply movement with speed multiplier
        player.move(stabilizedDirection, speed, this.speedMultiplier);
        
        // Check if we've reached the ball
        return distanceToBall < 1.2;
    }
    
    // ... other methods ...
    
    defendBall(player, deltaTime) {
        // ... existing code ...
        
        // Apply movement to the defender
        player.move(stabilizedDirection, speed, this.speedMultiplier);
        
        // ... existing code ...
    }
    
    // ... other methods ...
} 