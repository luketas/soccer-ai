import * as THREE from 'three';

export class GameManager {
    constructor(ball, players, onPlayerGoal, onAIGoal) {
        this.ball = ball;
        this.players = players;
        this.onPlayerGoal = onPlayerGoal;
        this.onAIGoal = onAIGoal;
        
        // Goal dimensions and positions
        this.goalDimensions = {
            width: 12,
            height: 6,
            depth: 2
        };
        
        this.goalPositions = {
            player: new THREE.Vector3(-30, 0, 0),
            ai: new THREE.Vector3(30, 0, 0)
        };
        
        // Field boundaries
        this.fieldBoundaries = {
            x: 30, // Width boundary
            z: 20  // Length boundary
        };
        
        // Game state
        this.isGoalScored = false;
        this.goalCooldown = 0;
        
        // Flag to prevent multiple goal detections in short time
        this.goalScoredRecently = false;
        
        // Flag to indicate we're in the process of handling a goal
        this.isGoalInProgress = false;
    }
    
    update() {
        // Skip goal detection during cooldown
        if (this.goalCooldown > 0) {
            this.goalCooldown -= 1/60; // Assuming 60fps
            return;
        }
        
        // Check if goals were scored
        this.checkForGoals();
        
        // Enforce field boundaries for players
        this.enforceBoundaries();
    }
    
    checkForGoals() {
        // Skip goal detection if:
        // 1. A goal was recently scored
        // 2. The ball is already marked as in a goal
        // 3. We're in the process of handling a goal
        if (this.goalScoredRecently || this.ball.isInGoal || this.isGoalInProgress) return;
        
        const ballPosition = this.ball.mesh.position;
        
        // Check for player goal (AI scores)
        if (this.isInGoal(ballPosition, 'player')) {
            // Set all flags to prevent further goal detection
            this.goalScoredRecently = true;
            this.isGoalInProgress = true;
            this.goalCooldown = 1; // 1 second cooldown
            this.ball.isInGoal = true; // Set the ball as in goal to freeze it
            
            // Trigger the goal callback
            this.onAIGoal();
            
            // Reset the recently scored flag after 1 second
            setTimeout(() => {
                this.goalScoredRecently = false;
                // Keep isGoalInProgress true until the play is reset
            }, 1000);
        }
        // Check for AI goal (player scores) - only if no player goal was detected
        else if (this.isInGoal(ballPosition, 'ai')) {
            // Set all flags to prevent further goal detection
            this.goalScoredRecently = true;
            this.isGoalInProgress = true;
            this.goalCooldown = 1; // 1 second cooldown
            this.ball.isInGoal = true; // Set the ball as in goal to freeze it
            
            // Trigger the goal callback
            this.onPlayerGoal();
            
            // Reset the recently scored flag after 1 second
            setTimeout(() => {
                this.goalScoredRecently = false;
                // Keep isGoalInProgress true until the play is reset
            }, 1000);
        }
    }
    
    isInGoal(ballPosition, goalSide) {
        const goalPos = this.goalPositions[goalSide];
        const halfWidth = this.goalDimensions.width / 2;
        const halfHeight = this.goalDimensions.height;
        const goalDepth = this.goalDimensions.depth;
        
        // Improved goal detection with larger detection area
        if (goalSide === 'player') {
            // Player goal (left side)
            return (
                ballPosition.x <= goalPos.x + 0.5 && // Some tolerance for the ball radius
                ballPosition.x >= goalPos.x - goalDepth - 1 && // Extended detection area inside goal
                Math.abs(ballPosition.z - goalPos.z) < halfWidth &&
                ballPosition.y < halfHeight
            );
        } else {
            // AI goal (right side)
            return (
                ballPosition.x >= goalPos.x - 0.5 && // Some tolerance for the ball radius
                ballPosition.x <= goalPos.x + goalDepth + 1 && // Extended detection area inside goal
                Math.abs(ballPosition.z - goalPos.z) < halfWidth &&
                ballPosition.y < halfHeight
            );
        }
    }
    
    enforceBoundaries() {
        // Ensure players stay within field boundaries
        const allPlayers = [...this.players.you, ...this.players.ai];
        
        allPlayers.forEach(player => {
            const pos = player.mesh.position;
            
            // X-axis boundaries
            if (Math.abs(pos.x) > this.fieldBoundaries.x) {
                pos.x = Math.sign(pos.x) * this.fieldBoundaries.x;
            }
            
            // Z-axis boundaries
            if (Math.abs(pos.z) > this.fieldBoundaries.z) {
                pos.z = Math.sign(pos.z) * this.fieldBoundaries.z;
            }
        });
    }
    
    // Check if player can perform an action based on their position
    canPerformAction(player, actionType) {
        switch (actionType) {
            case 'shoot':
                // Can only shoot if close to the ball
                return player.mesh.position.distanceTo(this.ball.mesh.position) < 3;
                
            case 'pass':
                // Can only pass if close to the ball
                return player.mesh.position.distanceTo(this.ball.mesh.position) < 3;
                
            case 'sprint':
                // Always allow sprinting as stamina system is disabled
                return true;
                
            default:
                return true;
        }
    }
    
    // Find the best player to target for a pass
    findBestPassTarget(source) {
        const team = source.team === 'you' ? this.players.you : this.players.ai;
        
        let bestTarget = null;
        let bestScore = -Infinity;
        
        team.forEach(player => {
            if (player !== source) {
                let score = 0;
                const distance = source.mesh.position.distanceTo(player.mesh.position);
                
                // Prefer closer teammates but not too close
                if (distance < 5) {
                    score -= 2; // Too close
                } else if (distance < 15) {
                    score += 5; // Good passing distance
                } else {
                    score -= (distance - 15); // Far but possible
                }
                
                // Prefer teammates ahead of current player (in attacking direction)
                const attackingDirection = source.team === 'you' ? 1 : -1;
                const isForward = (player.mesh.position.x - source.mesh.position.x) * attackingDirection > 0;
                
                if (isForward) {
                    score += 8;
                }
                
                // Consider player roles
                if (player.role === 'attacker') {
                    score += 5;
                }
                
                // Check opponent proximity
                const opponents = source.team === 'you' ? this.players.ai : this.players.you;
                let isHeavilyMarked = false;
                
                opponents.forEach(opponent => {
                    if (player.mesh.position.distanceTo(opponent.mesh.position) < 3) {
                        isHeavilyMarked = true;
                    }
                });
                
                if (isHeavilyMarked) {
                    score -= 10;
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = player;
                }
            }
        });
        
        return bestTarget;
    }
} 