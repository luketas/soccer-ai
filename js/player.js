import * as THREE from 'three';

export function createPlayer(team, role, color) {
    // Create player object with goalkeeper role
    const player = {
        team: team,
        role: role,
        mesh: null,
        isActive: false,
        hasBall: false,
        isControllingBall: false, // New property for dribbling
        ballControlDistance: 1.5, // Increased from 1.2 for more consistent control at all speeds
        ballControlStrength: getRoleDribblingSkill(role), // How well this player controls the ball
        velocity: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(0, 0, 0),
        speed: getRoleSpeed(role),
        sprintSpeed: getRoleSpeed(role) * 1.6,
        dribbleSpeed: getRoleSpeed(role) * 0.9, // Increased from 0.8 to improve base dribbling speed
        dribbleSprintSpeed: getRoleSpeed(role) * 1.5, // Increased from 1.3 to improve sprint dribbling
        // Stamina properties removed but kept max value for compatibility
        maxStamina: 100,
        isDiving: false,  // Goalkeeper diving state
        diveTime: 0,      // Time since starting a dive
        diveRecoveryTime: 1.0, // Time needed to recover from a dive
        lastDirection: null,
        goalkeepingReflexes: role === 'goalkeeper' ? 0.8 : 0.3, // Added goalkeeper reflexes attribute
        
        // Anti-spinning detection properties
        directionChangeHistory: [], // Array to track recent direction changes
        lastRotationTime: 0,       // Time of last significant rotation
        potentialSpinningDetected: false, // Flag for potential spinning
        spinningPreventionTimeout: 0,    // Timeout for spinning prevention
        
        update: function(deltaTime, ball) {
            // Apply velocity to position
            this.mesh.position.x += this.velocity.x * deltaTime;
            this.mesh.position.z += this.velocity.z * deltaTime;
            
            // Apply gravity if player is in the air (like during a jump or dive)
            if (this.mesh.position.y > 0) {
                this.velocity.y -= 20 * deltaTime; // gravity
                this.mesh.position.y += this.velocity.y * deltaTime;
                
                // Stop when hitting the ground
                if (this.mesh.position.y < 0) {
                    this.mesh.position.y = 0;
                    this.velocity.y = 0;
                }
            }
            
            // Update goalkeeper dive state
            if (this.isDiving) {
                this.diveTime += deltaTime;
                
                // Slow down horizontal movement after initial dive
                if (this.diveTime > 0.3) {
                    this.velocity.x *= 0.9;
                    this.velocity.z *= 0.9;
                }
                
                // End dive after recovery time
                if (this.diveTime >= this.diveRecoveryTime) {
                    this.isDiving = false;
                    this.diveTime = 0;
                }
                
                // Update visual appearance during dive
                this.updateDivingAppearance();
            }
            
            // If this is a goalkeeper and a ball is provided, track the ball
            if (this.role === 'goalkeeper' && ball) {
                this.trackBallTrajectory(ball, deltaTime);
            }
            
            // Animate the active player marker if present
            if (this.markerAnimation) {
                this.markerAnimation.update(deltaTime);
            }
            
            // Apply friction / drag
            this.velocity.multiplyScalar(0.9);
            
            // Update spinning prevention timeout
            if (this.spinningPreventionTimeout > 0) {
                this.spinningPreventionTimeout -= deltaTime;
                if (this.spinningPreventionTimeout <= 0) {
                    this.spinningPreventionTimeout = 0;
                    this.potentialSpinningDetected = false;
                    // Clear history when the timeout ends
                    this.directionChangeHistory = [];
                }
            }
            
            // Keep player on the field using the constrainPositionToField method
            // This is more consistent with how the ball is constrained and handles goal areas
            this.constrainPositionToField(this.mesh.position);
            
            // Update appearance based on state
            this.updateAppearance();
        },
        
        move: function(direction, speed, speedMultiplier = 1.0) {
            // Don't override velocity during a dive
            if (this.isDiving) return;
            
            // Apply the game speed multiplier to the movement speed
            speed *= speedMultiplier;
            
            // Store previous direction for turn detection
            if (!this.lastDirection) {
                this.lastDirection = new THREE.Vector3();
            }
            this.lastDirection.copy(this.direction);
            
            // Set direction
            this.direction.copy(direction);
            
            // Calculate turn sharpness (0 to 1, where 1 is a complete reversal)
            const turnSharpness = this.lastDirection.length() > 0.1 ? 
                                 (1 - this.lastDirection.dot(direction)) / 2 : 0;
            
            // Anti-spinning detection - track significant direction changes
            if (turnSharpness > 0.4 && this.team === 'ai') { // Only apply to AI players
                const currentTime = Date.now() / 1000; // Current time in seconds
                
                // Initialize history array if needed
                if (!this.directionChangeHistory) {
                    this.directionChangeHistory = [];
                }
                
                // Add this direction change to history
                this.directionChangeHistory.push({
                    time: currentTime,
                    angle: Math.atan2(direction.x, direction.z)
                });
                
                // Only keep the last 5 direction changes
                if (this.directionChangeHistory.length > 5) {
                    this.directionChangeHistory.shift();
                }
                
                // Check for spinning pattern (multiple significant direction changes in a short period)
                if (this.directionChangeHistory.length >= 3) {
                    // Get the time span of the recorded changes
                    const oldestChangeTime = this.directionChangeHistory[0].time;
                    const timeSpan = currentTime - oldestChangeTime;
                    
                    // Check if we have at least 3 changes in less than 1 second
                    if (timeSpan < 1.0) {
                        // Calculate if the changes are forming a circular pattern
                        let directionChangesSum = 0;
                        for (let i = 1; i < this.directionChangeHistory.length; i++) {
                            const prev = this.directionChangeHistory[i-1].angle;
                            const curr = this.directionChangeHistory[i].angle;
                            let diff = curr - prev;
                            // Normalize angle
                            while (diff > Math.PI) diff -= Math.PI * 2;
                            while (diff < -Math.PI) diff += Math.PI * 2;
                            directionChangesSum += Math.abs(diff);
                        }
                        
                        // If the sum of direction changes is large and they're all in a short timespan,
                        // this is likely spinning behavior
                        if (directionChangesSum > Math.PI && !this.potentialSpinningDetected) {
                            console.log(`Spinning detected for ${this.team} ${this.role}! Preventing rapid turns.`);
                            this.potentialSpinningDetected = true;
                            this.spinningPreventionTimeout = 1.0; // Apply prevention for 1 second
                        }
                    }
                }
            }
            
            // If spinning prevention is active, use a smoothed direction
            if (this.potentialSpinningDetected) {
                // Use a much more gradual turn instead of the requested sharp turn
                // First, calculate the target angle and current angle
                const targetAngle = Math.atan2(direction.x, direction.z);
                const currentAngle = Math.atan2(this.lastDirection.x, this.lastDirection.z);
                
                // Calculate the smallest angle difference
                let angleDiff = targetAngle - currentAngle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                // Limit the amount of turn allowed during spinning prevention
                const maxTurnPerFrame = Math.PI * 0.05; // About 9 degrees max turn
                const limitedTurn = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurnPerFrame);
                
                // Create a new limited direction
                const newAngle = currentAngle + limitedTurn;
                direction.set(Math.sin(newAngle), 0, Math.cos(newAngle));
                
                // Also reduce speed during anti-spin correction
                speed *= 0.7;
            }
            
            // Apply to velocity - adjust speed if dribbling
            let adjustedSpeed = speed;
            
            // Apply speed adjustment based on turn sharpness (sharper turns = slower)
            adjustedSpeed *= (1 - turnSharpness * 0.5);
            
            if (this.isControllingBall) {
                // Further reduce speed when controlling the ball, based on skill
                const ballControlFactor = 0.7 + (0.3 * this.ballControlStrength);
                adjustedSpeed *= ballControlFactor;
                
                // Even better players slow down during sharp turns with the ball
                if (turnSharpness > 0.3) {
                    adjustedSpeed *= (1 - (turnSharpness - 0.3) * 0.5);
                }
            }
            
            // Apply momentum - players can't change direction instantly
            // Blend old velocity with new direction based on player's agility
            const agility = this.role === 'attacker' ? 0.3 : 
                           this.role === 'midfielder' ? 0.25 : 0.2; // Attackers are more agile
            
            // Preserve some of the existing velocity (momentum)
            const newVelocity = new THREE.Vector3();
            newVelocity.x = direction.x * adjustedSpeed;
            newVelocity.z = direction.z * adjustedSpeed;
            
            // Blend between current velocity and new velocity
            this.velocity.x = this.velocity.x * (1 - agility) + newVelocity.x * agility;
            this.velocity.z = this.velocity.z * (1 - agility) + newVelocity.z * agility;
            
            // Rotate player mesh to face movement direction (if significant movement)
            if (direction.length() > 0.1) {
                // Calculate target angle
                const targetAngle = Math.atan2(direction.x, direction.z);
                
                // Current angle
                const currentAngle = this.mesh.rotation.y;
                
                // Smooth rotation - players turn gradually, not instantly
                const rotationSpeed = 0.2; // How quickly player rotates to face direction
                
                // Use the shortest angular distance
                let angleDiff = targetAngle - currentAngle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                // Apply smooth rotation
                this.mesh.rotation.y += angleDiff * rotationSpeed;
            }
        },
        
        // Method to start controlling the ball (dribbling)
        startControllingBall: function(ball) {
            this.isControllingBall = true;
            this.hasBall = true;
            
            // Create a visual indicator to show this player is controlling the ball
            this.updateAppearance();
        },
        
        // Method to stop controlling the ball
        stopControllingBall: function() {
            this.isControllingBall = false;
            this.hasBall = false;
            
            // Remove visual indicator
            this.updateAppearance();
        },
        
        // Method to update ball position during dribbling
        updateBallControl: function(ball, deltaTime) {
            if (!this.isControllingBall) return;
            
            // Initialize ball control data if it doesn't exist
            if (!this.ballControlData) {
                this.ballControlData = {
                    lastTargetPos: new THREE.Vector3(),
                    smoothedDirection: new THREE.Vector3(),
                    oscillationPhase: Math.random() * Math.PI * 2, // Random starting phase
                    lastBounceTime: 0
                };
            }
            
            // Calculate ideal ball position relative to player
            // Ball should be slightly in front of player in the direction they're facing
            const ballOffset = new THREE.Vector3();
            
            // If player is moving, place ball in front of player in movement direction
            if (this.velocity.length() > 0.1) {
                // Improved speed factor calculation - more consistent at high speeds
                const speedFactor = Math.min(1.5, 0.9 + (this.velocity.length() / this.speed) * 0.6); // Modified for better scaling
                
                // Adjust base distance for better positioning at all speeds
                const baseDistance = this.team === 'ai' ? 1.0 : 1.2; // Slightly closer to player
                const controlDistance = baseDistance * this.ballControlDistance * speedFactor;
                
                // Improved direction smoothing for more precise control
                if (this.team === 'ai') {
                    // Stronger smoothing for AI
                    const smoothFactor = 0.15; // Only 15% of new direction per frame
                    this.ballControlData.smoothedDirection.lerp(this.direction, smoothFactor);
                } else {
                    // Better responsiveness for human player while maintaining stability
                    const smoothFactor = 0.7; // Increased from 0.6 for even more responsive ball control
                    this.ballControlData.smoothedDirection.lerp(this.direction, smoothFactor);
                }
                
                // Normalize the smoothed direction
                if (this.ballControlData.smoothedDirection.length() > 0) {
                    this.ballControlData.smoothedDirection.normalize();
                } else {
                    this.ballControlData.smoothedDirection.copy(this.direction);
                }
                
                // Use the smoothed direction for ball positioning
                ballOffset.copy(this.ballControlData.smoothedDirection).multiplyScalar(controlDistance);
            } else {
                // If player is stationary, place ball in front of player based on rotation
                ballOffset.z = this.ballControlDistance * 0.7; // Decreased from 0.8 to keep ball closer
                ballOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y); // Rotate to match player orientation
                
                // Reset smoothed direction when stationary
                this.ballControlData.smoothedDirection.set(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
            }
            
            // Calculate target position for ball
            const targetPos = new THREE.Vector3().copy(this.mesh.position).add(ballOffset);
            
            // Don't place ball below ground
            targetPos.y = Math.max(0.5, targetPos.y); // 0.5 is ball radius
            
            // Store the last target position for smoothing
            if (this.ballControlData.lastTargetPos.length() === 0) {
                this.ballControlData.lastTargetPos.copy(targetPos);
            }
            
            // Smooth between last target and current target to reduce jerky movement
            // Human players get more responsive ball control
            const targetSmoothFactor = this.team === 'ai' ? 0.15 : 0.45; // Increased from 0.3 for human players
            const smoothedTargetPos = new THREE.Vector3().copy(this.ballControlData.lastTargetPos)
                .lerp(targetPos, targetSmoothFactor);
            
            // Update last target position
            this.ballControlData.lastTargetPos.copy(smoothedTargetPos);
            
            // Ensure the target position is within field boundaries
            this.constrainPositionToField(smoothedTargetPos);
            
            // During dribbling, ball movement should feel responsive but not instant
            // Calculate smoothed ball velocity to reach target position
            const ballToTarget = new THREE.Vector3().subVectors(smoothedTargetPos, ball.mesh.position);
            
            // Increase the ball attraction strength based on current conditions
            let attractionStrength = 25; // Base attraction strength - increased from previous values
            
            // Increase attraction when player changes direction abruptly
            const directionChange = new THREE.Vector3().subVectors(
                this.direction, this.ballControlData.smoothedDirection
            ).length();
            
            // Add more attraction when player is changing direction
            attractionStrength += directionChange * 15;
            
            // Add more attraction when ball is far from target
            const ballTargetDistance = ballToTarget.length();
            if (ballTargetDistance > 1.5) {
                // Extra pull when ball is getting too far
                attractionStrength += (ballTargetDistance - 1.5) * 20;
            }
            
            // Stronger attraction for human players (better control feel)
            if (this.team !== 'ai') {
                attractionStrength *= 1.2;
            }
            
            // Clamp attraction to avoid excessive forces
            attractionStrength = Math.min(70, attractionStrength);
            
            // Apply attraction force to move ball toward target
            // Scale by deltaTime to make it framerate independent
            const attractionForce = ballToTarget.multiplyScalar(attractionStrength * deltaTime);
            
            // Update ball velocity with calculated attraction
            ball.velocity.add(attractionForce);
            
            // Dampen horizontal velocity to prevent excessive oscillation
            ball.velocity.x *= 0.9;
            ball.velocity.z *= 0.9;
            
            // Make sure the ball remains at reasonable height when controlled
            if (ball.mesh.position.y > 0.6) {
                ball.velocity.y -= 20 * deltaTime; // Enhanced gravity force to keep ball grounded
            }
        },
        
        // New method to constrain positions to the field boundaries
        constrainPositionToField: function(position) {
            // Field boundaries - match values used in ball.js and field.js
            const fieldBoundaryX = 30;  // fieldWidth/2 = 60/2 = 30
            const fieldBoundaryZ = 20;  // fieldLength/2 = 40/2 = 20
            const goalWidth = 12;       // from field.js addGoals method
            const goalDepth = 5;        // increased from field.js for better gameplay
            
            // Check if position is in goal area
            const isInGoalZRange = Math.abs(position.z) < goalWidth / 2;
            
            // Handle X boundaries (sidelines)
            if (Math.abs(position.x) > fieldBoundaryX) {
                // Allow positions beyond boundary only in goal areas
                if (isInGoalZRange && Math.abs(position.x) < fieldBoundaryX + goalDepth) {
                    // Within goal area - allow
                } else {
                    // Not in goal area - constrain to field
                    position.x = Math.sign(position.x) * fieldBoundaryX;
                }
            }
            
            // Handle Z boundaries (endlines)
            if (Math.abs(position.z) > fieldBoundaryZ) {
                position.z = Math.sign(position.z) * fieldBoundaryZ;
            }
            
            return position;
        },
        
        // New method for goalkeeper to dive
        dive: function(targetPosition, strength) {
            // Don't dive if already diving
            if (this.isDiving) return;
            
            // Only goalkeepers can dive
            if (this.role !== 'goalkeeper') return;
            
            // Start diving
            this.isDiving = true;
            this.diveTime = 0;
            
            // Calculate dive direction
            const diveDirection = new THREE.Vector3()
                .subVectors(targetPosition, this.mesh.position)
                .normalize();
            
            // Set velocity for dive - higher strength means faster dive
            const diveSpeed = this.speed * 2.0 * strength;
            this.velocity.x = diveDirection.x * diveSpeed;
            this.velocity.z = diveDirection.z * diveSpeed;
            
            // Add upward component for jumping saves
            const needsJump = targetPosition.y > 1.0;
            if (needsJump) {
                this.velocity.y = 10; // Jump force
            }
            
            // Adjust player orientation to face the dive direction
            this.mesh.rotation.y = Math.atan2(diveDirection.x, diveDirection.z);
            
            return true;
        },
        
        updateDivingAppearance: function() {
            // Visual indicator for diving state
            if (this.mesh && this.mesh.children.length > 0) {
                // Body is the first child
                const body = this.mesh.children[0];
                
                // During a dive, rotate the body to simulate a diving motion
                if (this.diveTime < 0.3) {
                    // Initial dive - lean forward
                    const diveProgress = this.diveTime / 0.3;
                    this.mesh.rotation.z = (this.velocity.x > 0 ? -1 : 1) * Math.PI * 0.25 * diveProgress;
                } else {
                    // Hold dive position
                    this.mesh.rotation.z = (this.velocity.x > 0 ? -1 : 1) * Math.PI * 0.25;
                }
                
                // Gloves visual enhancement during dive
                if (this.mesh.children.length > 3) {
                    // Left and right gloves are typically children 3 and 4
                    const leftGlove = this.mesh.children[3]; 
                    const rightGlove = this.mesh.children[4];
                    
                    if (leftGlove && rightGlove) {
                        // Extend gloves during dive
                        const originalPosition = new THREE.Vector3(-0.7, 1.4, 0.2);
                        const diveOffset = new THREE.Vector3(0, 0, 0.5);
                        
                        if (this.diveTime < 0.3) {
                            const stretchFactor = this.diveTime / 0.3;
                            leftGlove.position.copy(originalPosition).add(diveOffset.clone().multiplyScalar(stretchFactor));
                            rightGlove.position.copy(originalPosition.clone().setX(0.7)).add(diveOffset.clone().multiplyScalar(stretchFactor));
                        } else {
                            leftGlove.position.copy(originalPosition).add(diveOffset);
                            rightGlove.position.copy(originalPosition.clone().setX(0.7)).add(diveOffset);
                        }
                    }
                }
            }
        },
        
        setActive: function(isActive) {
            this.isActive = isActive;
            this.updateAppearance();
            
            // Add a visible marker above active player when selected
            if (this.mesh) {
                // Remove existing marker if any
                const existingMarker = this.mesh.children.find(child => child.userData.isActiveMarker);
                if (existingMarker) {
                    this.mesh.remove(existingMarker);
                }
                
                // Add new marker if active
                if (isActive) {
                    // Create an arrow pointing down above the player
                    // Using a bigger, more visible arrow design
                    const arrowGroup = new THREE.Group();
                    arrowGroup.userData.isActiveMarker = true;
                    
                    // Create arrow head (cone) - larger than before
                    const headGeometry = new THREE.ConeGeometry(0.5, 1.0, 4);
                    const headMaterial = new THREE.MeshBasicMaterial({ 
                        color: 0xffff00,
                        transparent: true,
                        opacity: 0.9
                    });
                    
                    const arrowHead = new THREE.Mesh(headGeometry, headMaterial);
                    arrowHead.position.set(0, 0.5, 0);
                    arrowHead.rotation.x = Math.PI; // Point downward
                    arrowGroup.add(arrowHead);
                    
                    // Add arrow shaft
                    const shaftGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
                    const shaftMaterial = new THREE.MeshBasicMaterial({ 
                        color: 0xffff00,
                        transparent: true,
                        opacity: 0.9
                    });
                    
                    const arrowShaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
                    arrowShaft.position.set(0, 1.1, 0);
                    arrowGroup.add(arrowShaft);
                    
                    // Position the entire arrow above player's head
                    arrowGroup.position.set(0, 3.8, 0);
                    
                    // Add a glow effect
                    const glowGeometry = new THREE.SphereGeometry(0.3, 16, 16);
                    const glowMaterial = new THREE.MeshBasicMaterial({
                        color: 0xffff00,
                        transparent: true,
                        opacity: 0.5
                    });
                    
                    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
                    glow.scale.set(2, 1, 2); // Elliptical shape
                    glow.position.set(0, 0.5, 0);
                    arrowGroup.add(glow);
                    
                    // Add animation effect - floating and pulsing arrow
                    this.markerAnimation = {
                        time: 0,
                        update: (deltaTime) => {
                            this.markerAnimation.time += deltaTime * 5;
                            // Vertical floating motion
                            arrowGroup.position.y = 3.8 + Math.sin(this.markerAnimation.time) * 0.3;
                            // Rotation effect
                            arrowGroup.rotation.y += deltaTime * 3;
                            // Pulsing glow effect
                            const pulseScale = 1.0 + Math.sin(this.markerAnimation.time * 0.5) * 0.2;
                            glow.scale.set(2 * pulseScale, 1 * pulseScale, 2 * pulseScale);
                            glow.material.opacity = 0.3 + Math.sin(this.markerAnimation.time * 0.5) * 0.2;
                        }
                    };
                    
                    this.mesh.add(arrowGroup);
                } else {
                    // Remove animation when not active
                    this.markerAnimation = null;
                }
            }
        },
        
        useStamina: function(deltaTime) {
            // Always return max stamina as stamina system is disabled
            return this.maxStamina;
        },
        
        recoverStamina: function(deltaTime) {
            // Always return max stamina as stamina system is disabled
            return this.maxStamina;
        },
        
        updateAppearance: function() {
            // Update player appearance based on active state and ball control
            if (this.mesh && this.mesh.children.length > 0) {
                // Body is the first child
                const body = this.mesh.children[0];
                
                // Base color depends on team, role and state
                let playerColor;
                let emissive = this.isControllingBall ? 0xffff00 : 0x000000;
                let emissiveIntensity = this.isControllingBall ? 0.3 : 0;
                
                if (this.isActive) {
                    // Highlight active player
                    playerColor = this.role === 'goalkeeper' ? 
                        (this.team === 'you' ? 0x00BFFF : 0xFF6347) : // Goalkeeper colors
                        (this.team === 'you' ? 0x2196F3 : 0xFF5252);  // Regular player colors
                    
                    // Add stronger highlight if controlling ball
                    if (this.isControllingBall) {
                        emissiveIntensity = 0.5;
                    } else {
                        emissive = this.team === 'you' ? 0x0D47A1 : 0xB71C1C;
                        emissiveIntensity = 0.3;
                    }
                } else {
                    // Regular player color
                    playerColor = this.role === 'goalkeeper' ? 
                        (this.team === 'you' ? 0x00BFFF : 0xFF6347) : // Goalkeeper colors
                        (this.team === 'you' ? 0x42A5F5 : 0xEF5350);  // Regular player colors
                }
                
                // Apply material
                const playerMaterial = new THREE.MeshStandardMaterial({
                    color: playerColor,
                    emissive: emissive,
                    emissiveIntensity: emissiveIntensity,
                    roughness: 0.6,
                    metalness: 0.2
                });
                
                body.material = playerMaterial;
                
                // Add dribbling visual feedback - slight player lean in movement direction
                if (this.isControllingBall && this.velocity.length() > 0.5) {
                    // Lean forward slightly when dribbling
                    const leanAmount = Math.min(0.2, this.velocity.length() / this.speed * 0.2);
                    this.mesh.rotation.x = leanAmount;
                } else {
                    this.mesh.rotation.x = 0;
                }
            }
        },
        
        // New method to predict and track ball trajectory for goalkeepers
        trackBallTrajectory: function(ball, deltaTime) {
            // Only for goalkeepers
            if (this.role !== 'goalkeeper') return;
            
            // Predict where the ball will be in a short time
            const predictionTime = 0.5; // Look ahead 0.5 seconds
            const ballPos = ball.mesh.position.clone();
            const ballVel = ball.velocity.clone();
            
            // Predict future ball position based on current velocity
            const predictedPos = new THREE.Vector3().copy(ballPos).add(
                ballVel.clone().multiplyScalar(predictionTime)
            );
            
            // Calculate if ball is moving toward our goal
            const isMovingTowardGoal = this.team === 'you' ? 
                ballVel.x < -3 && ballPos.x < 0 : // Moving toward left goal (human team)
                ballVel.x > 3 && ballPos.x > 0;   // Moving toward right goal (AI team)
                
            // If the ball is moving fast toward goal, consider diving
            if (isMovingTowardGoal && ballVel.length() > 15) {
                // Check if ball path will intersect with goal
                let ballWillReachGoal = false;
                const goalX = this.team === 'you' ? -28 : 28;
                
                // Simple linear prediction to see if ball will reach goal line
                if ((this.team === 'you' && ballVel.x < 0) || (this.team === 'ai' && ballVel.x > 0)) {
                    // Calculate time to reach goal line
                    const timeToGoal = Math.abs((goalX - ballPos.x) / ballVel.x);
                    
                    // Predict z position at goal line
                    const zAtGoal = ballPos.z + ballVel.z * timeToGoal;
                    const yAtGoal = ballPos.y + ballVel.y * timeToGoal - 0.5 * 20 * timeToGoal * timeToGoal; // Include gravity
                    
                    // Check if within goal dimensions (width: 14 units, height: 5 units)
                    if (Math.abs(zAtGoal) < 7 && yAtGoal > 0 && yAtGoal < 5) {
                        ballWillReachGoal = true;
                        
                        // Calculate dive target - slightly ahead of where ball will be
                        const diveTarget = new THREE.Vector3(
                            goalX + (this.team === 'you' ? 1 : -1), // Slightly in front of goal
                            Math.max(0.5, Math.min(4, yAtGoal)), // Clamp to reasonable height
                            zAtGoal
                        );
                        
                        // Calculate dive urgency based on time to goal
                        const urgency = Math.min(1.0, 1.5 / Math.max(0.3, timeToGoal));
                        
                        // Calculate save difficulty (0-1) based on distance from keeper to intercept point
                        const interceptPoint = new THREE.Vector3(
                            this.mesh.position.x,
                            Math.max(0.5, Math.min(4, yAtGoal)), // Same height as ball will be
                            zAtGoal
                        );
                        
                        const distanceToIntercept = this.mesh.position.distanceTo(interceptPoint);
                        const difficulty = Math.min(1.0, distanceToIntercept / 8); // Normalize to 0-1
                        
                        // Decide whether to dive based on reflexes and difficulty
                        const diveThreshold = 0.3 + 0.5 * (1 - this.goalkeepingReflexes);
                        
                        if (difficulty > diveThreshold && !this.isDiving) {
                            // Attempt a diving save
                            this.dive(diveTarget, urgency);
                        }
                    }
                }
            }
            
            // When not diving, position based on ball position
            if (!this.isDiving && !this.isActive) {
                const goalX = this.team === 'you' ? -28 : 28;
                const maxDistance = 2.0; // Maximum distance to come off line
                
                // Position goalkeeper appropriately
                let targetX = goalX;
                if (this.team === 'you' && ballPos.x < -20) {
                    // Come off the line slightly as ball approaches
                    targetX = Math.max(goalX, Math.min(goalX + maxDistance, ballPos.x + 5));
                } else if (this.team === 'ai' && ballPos.x > 20) {
                    targetX = Math.min(goalX, Math.max(goalX - maxDistance, ballPos.x - 5));
                }
                
                // Follow ball horizontally (z-axis) with clamping to goal width
                const targetZ = Math.max(-6, Math.min(6, ballPos.z * 0.7));
                
                // Create target position
                const targetPosition = new THREE.Vector3(targetX, 0, targetZ);
                
                // Calculate direction to target
                const direction = new THREE.Vector3()
                    .subVectors(targetPosition, this.mesh.position)
                    .normalize();
                
                // Only move if not already at target
                if (this.mesh.position.distanceTo(targetPosition) > 0.5) {
                    // Move toward target position
                    const goalkeeperSpeed = this.speed * 1.2; // Slightly faster goalkeeper movement
                    this.move(direction, goalkeeperSpeed);
                }
            }
        }
    };
    
    // Create player mesh
    player.mesh = createPlayerMesh(color, role);
    
    return player;
}

function createPlayerMesh(color, role) {
    const playerGroup = new THREE.Group();
    
    // Create player body (use simple shapes for procedural generation)
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.6,
        metalness: 0.2
    });
    
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.9; // Half height
    body.castShadow = true;
    body.receiveShadow = true;
    playerGroup.add(body);
    
    // Create head
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xffdbac, // Skin tone
        roughness: 0.8,
        metalness: 0.1
    });
    
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.1; // Top of body plus radius
    head.castShadow = true;
    playerGroup.add(head);
    
    // Create limbs
    // Arms
    const armGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
    const armMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.8,
        metalness: 0.2
    });
    
    // Left arm
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.65, 1.4, 0);
    leftArm.rotation.z = Math.PI / 6;
    leftArm.castShadow = true;
    playerGroup.add(leftArm);
    
    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.65, 1.4, 0);
    rightArm.rotation.z = -Math.PI / 6;
    rightArm.castShadow = true;
    playerGroup.add(rightArm);
    
    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.9, 8);
    const legMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222, // Dark color for shorts/pants
        roughness: 0.8,
        metalness: 0.1
    });
    
    // Left leg
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.3, 0.45, 0);
    leftLeg.castShadow = true;
    playerGroup.add(leftLeg);
    
    // Right leg
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.3, 0.45, 0);
    rightLeg.castShadow = true;
    playerGroup.add(rightLeg);
    
    // Add role indicator (different shape/accessory based on role)
    addRoleIndicator(playerGroup, role);
    
    // Add number on the back
    addPlayerNumber(playerGroup, role);
    
    return playerGroup;
}

function addRoleIndicator(playerGroup, role) {
    let indicator;
    
    switch (role) {
        case 'goalkeeper':
            // Add a special goalkeeper indicator (gloves)
            const gloveGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.5);
            const gloveMaterial = new THREE.MeshStandardMaterial({
                color: 0xffff00, // Yellow gloves
                roughness: 0.6,
                metalness: 0.3
            });
            
            // Left glove
            const leftGlove = new THREE.Mesh(gloveGeometry, gloveMaterial);
            leftGlove.position.set(-0.7, 1.4, 0.2);
            playerGroup.add(leftGlove);
            
            // Right glove
            const rightGlove = new THREE.Mesh(gloveGeometry, gloveMaterial);
            rightGlove.position.set(0.7, 1.4, 0.2);
            playerGroup.add(rightGlove);
            
            // Goalkeeper cap
            const capGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.2, 8);
            const capMaterial = new THREE.MeshStandardMaterial({
                color: 0xffff00, // Yellow cap
                roughness: 0.7,
                metalness: 0.1
            });
            
            const cap = new THREE.Mesh(capGeometry, capMaterial);
            cap.position.set(0, 2.4, 0);
            playerGroup.add(cap);
            
            break;
            
        case 'attacker':
            // Add a small cone pointing forward
            const attackerGeometry = new THREE.ConeGeometry(0.2, 0.4, 8);
            const attackerMaterial = new THREE.MeshStandardMaterial({
                color: 0xffcc00,
                roughness: 0.7,
                metalness: 0.3
            });
            
            indicator = new THREE.Mesh(attackerGeometry, attackerMaterial);
            indicator.rotation.x = Math.PI / 2;
            indicator.position.set(0, 1.8, 0.6);
            playerGroup.add(indicator);
            break;
            
        case 'midfielder':
            // Add a small sphere
            const midfielderGeometry = new THREE.SphereGeometry(0.2, 8, 8);
            const midfielderMaterial = new THREE.MeshStandardMaterial({
                color: 0x00cc00,
                roughness: 0.7,
                metalness: 0.3
            });
            
            indicator = new THREE.Mesh(midfielderGeometry, midfielderMaterial);
            indicator.position.set(0, 2.6, 0);
            playerGroup.add(indicator);
            break;
            
        case 'defender':
            // Add a small shield-like shape
            const defenderGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.1);
            const defenderMaterial = new THREE.MeshStandardMaterial({
                color: 0x0000cc,
                roughness: 0.7,
                metalness: 0.3
            });
            
            indicator = new THREE.Mesh(defenderGeometry, defenderMaterial);
            indicator.position.set(0, 1.8, -0.6);
            playerGroup.add(indicator);
            break;
            
        default:
            return;
    }
}

function addPlayerNumber(playerGroup, role) {
    // Different number based on role
    let number;
    
    switch (role) {
        case 'goalkeeper':
            number = 1;
            break;
        case 'defender':
            number = 4;
            break;
        case 'midfielder':
            number = 8;
            break;
        case 'attacker':
            number = 9;
            break;
        default:
            number = 7;
    }
    
    // Create a small box with the number (simplified as we can't do textures easily)
    const numberGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.05);
    const numberMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.3
    });
    
    const numberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
    numberMesh.position.set(0, 1.4, -0.55); // On the back
    playerGroup.add(numberMesh);
}

function getRoleSpeed(role) {
    // Return appropriate speed for each player role
    switch (role) {
        case 'goalkeeper':
            return 6.5;
        case 'defender':
            return 7.5;
        case 'midfielder':
            return 8.0;
        case 'attacker':
            return 8.5;
        default:
            return 7.0;
    }
}

function getRoleDribblingSkill(role) {
    // Return appropriate dribbling skill for each player role
    switch (role) {
        case 'goalkeeper':
            return 0.5;
        case 'defender':
            return 0.7;
        case 'midfielder':
            return 0.85;
        case 'attacker':
            return 0.95;
        default:
            return 0.7;
    }
}

// Export utility functions
export { getRoleSpeed, getRoleDribblingSkill }; 