import * as THREE from 'three';

export function createBall() {
    // Create the ball object with physics properties
    const ball = {
        mesh: null,
        velocity: new THREE.Vector3(0, 0, 0),
        gravity: 20, // gravity strength
        bounceFactor: 0.7, // how bouncy the ball is (1 = perfect bounce, 0 = no bounce)
        friction: 0.98, // friction when rolling on the ground
        airResistance: 0.995, // air resistance factor
        spin: new THREE.Vector3(0, 0, 0), // Add spin vector for ball rotation effects
        lastPlayerContact: null, // Track which player last touched the ball
        lastContactTime: 0, // Time since last player contact
        isControlled: false, // Whether any player is controlling this ball
        controllingPlayer: null, // The player currently controlling the ball
        isInGoal: false, // Flag to indicate if ball is in the goal and should be frozen
        
        update: function(deltaTime, players) {
            // Update time since last contact
            this.lastContactTime += deltaTime;
            
            // If ball is in goal, don't update position (freeze it)
            if (this.isInGoal) {
                // Completely zero out velocity to ensure the ball doesn't move
                this.velocity.set(0, 0, 0);
                this.spin.set(0, 0, 0);
                return;
            }
            
            // If ball is being controlled by a player, let the player handle movement
            if (this.isControlled && this.controllingPlayer) {
                this.controllingPlayer.updateBallControl(this, deltaTime);
                
                // Ball is still affected by gravity when controlled
                if (this.mesh.position.y > 0.5) { // 0.5 is ball radius
                    this.velocity.y -= this.gravity * deltaTime;
                }
                
                // Apply velocity to position
                const newPosition = new THREE.Vector3(
                    this.mesh.position.x + this.velocity.x * deltaTime,
                    this.mesh.position.y + this.velocity.y * deltaTime,
                    this.mesh.position.z + this.velocity.z * deltaTime
                );
                
                // Check for field boundaries even when controlled
                const adjustedPosition = this.handleFieldBoundaries(newPosition);
                
                // Update position
                this.mesh.position.copy(adjustedPosition);
                
                // Check for ground collision
                if (this.mesh.position.y < 0.5) { // 0.5 is ball radius
                    this.mesh.position.y = 0.5; // prevent falling through ground
                    this.velocity.y = 0; // No bouncing when controlled
                }
                
                // Rotate the ball based on movement even when controlled
                this.rotateBall(deltaTime);
                
                return; // Skip rest of physics when controlled
            }
            
            // Apply gravity if ball is above ground
            if (this.mesh.position.y > 0.5) { // 0.5 is ball radius
                this.velocity.y -= this.gravity * deltaTime;
            }
            
            // Handle player collisions before moving the ball
            if (players) {
                this.handlePlayerCollisions(players, deltaTime);
            }
            
            // Calculate new position based on velocity
            const newPosition = new THREE.Vector3(
                this.mesh.position.x + this.velocity.x * deltaTime,
                this.mesh.position.y + this.velocity.y * deltaTime,
                this.mesh.position.z + this.velocity.z * deltaTime
            );
            
            // Handle field boundaries with the new position
            const adjustedPosition = this.handleFieldBoundaries(newPosition);
            
            // Update actual position
            this.mesh.position.copy(adjustedPosition);
            
            // Check for ground collision
            if (this.mesh.position.y < 0.5) { // 0.5 is ball radius
                this.mesh.position.y = 0.5; // prevent falling through ground
                
                // Bounce
                if (Math.abs(this.velocity.y) > 0.5) {
                    this.velocity.y = -this.velocity.y * this.bounceFactor;
                } else {
                    this.velocity.y = 0;
                }
                
                // Apply friction when on ground
                this.velocity.x *= this.friction;
                this.velocity.z *= this.friction;
            } else {
                // Apply air resistance
                this.velocity.x *= this.airResistance;
                this.velocity.z *= this.airResistance;
            }
            
            // Prevent excessive velocity from shots
            const maxVelocity = 40;
            const currentVelocity = this.velocity.length();
            if (currentVelocity > maxVelocity) {
                this.velocity.normalize().multiplyScalar(maxVelocity);
            }
            
            // Stop the ball if it's moving very slowly
            if (Math.abs(this.velocity.x) < 0.05 && 
                Math.abs(this.velocity.z) < 0.05 &&
                Math.abs(this.velocity.y) < 0.05) {
                this.velocity.set(0, 0, 0);
            }
            
            // Rotate the ball based on movement
            this.rotateBall(deltaTime);
        },
        
        // New method to handle field boundaries
        handleFieldBoundaries: function(position) {
            // Field boundaries - improved to prevent escaping
            // Field dimensions from field.js (60x40)
            const fieldBoundaryX = 30;  // fieldWidth/2 = 60/2 = 30
            const fieldBoundaryZ = 20;  // fieldLength/2 = 40/2 = 20
            const goalWidth = 12;       // from field.js addGoals method
            const goalDepth = 5;        // increased from field.js for better gameplay
            
            // First check X boundaries (side lines)
            if (Math.abs(position.x) > fieldBoundaryX) {
                // Check if the ball is in the goal area
                const isInGoalZRange = Math.abs(position.z) < goalWidth / 2;
                
                // Handle side boundaries differently based on whether in goal area
                if (!isInGoalZRange || Math.abs(position.x) > fieldBoundaryX + goalDepth) {
                    // Either not in goal area, or beyond the goal depth
                    position.x = Math.sign(position.x) * fieldBoundaryX;
                    this.velocity.x = -this.velocity.x * this.bounceFactor;
                    
                    // Add small random deflection when hitting the side boundary
                    this.velocity.z += (Math.random() * 2 - 1) * 0.5;
                }
                
                // Add additional check for goal posts (side of goal area)
                if (Math.abs(position.z) >= goalWidth / 2 - 0.5 && 
                    Math.abs(position.z) <= goalWidth / 2 + 0.5 &&
                    Math.abs(position.x) <= fieldBoundaryX + goalDepth) {
                    // Collision with goal post - stronger bounce
                    position.x = Math.sign(position.x) * fieldBoundaryX;
                    position.z = Math.sign(position.z) * (goalWidth / 2 + 0.5);
                    
                    // Strong bounce off post
                    this.velocity.x = -this.velocity.x * this.bounceFactor * 1.2;
                    this.velocity.z = -this.velocity.z * this.bounceFactor * 1.2;
                    
                    // Add vertical component for realistic post hit
                    this.velocity.y += 3 + Math.random() * 2;
                }
            }
            
            // Then check Z boundaries (goal lines)
            if (Math.abs(position.z) > fieldBoundaryZ) {
                position.z = Math.sign(position.z) * fieldBoundaryZ;
                this.velocity.z = -this.velocity.z * this.bounceFactor;
                
                // Add small random deflection when hitting the end boundary
                this.velocity.x += (Math.random() * 2 - 1) * 0.5;
            }
            
            // Check goal boundary collision (back of the goal)
            if (Math.abs(position.x) > fieldBoundaryX && Math.abs(position.x) <= fieldBoundaryX + goalDepth) {
                const isInGoalZRange = Math.abs(position.z) < goalWidth / 2;
                
                if (isInGoalZRange) {
                    // Inside goal area - check collision with goal sides/top
                    if (Math.abs(position.z) > goalWidth / 2 - 0.5) {
                        // Collision with side of goal
                        position.z = Math.sign(position.z) * (goalWidth / 2 - 0.5);
                        this.velocity.z = -this.velocity.z * this.bounceFactor;
                    }
                    
                    // Check for collision with top of goal (if ball is high enough)
                    if (position.y > 6.5) {  // goalHeight from field.js is 6
                        position.y = 6.5;
                        this.velocity.y = -this.velocity.y * this.bounceFactor;
                    }
                    
                    // Check for collision with back of goal
                    if (Math.abs(position.x) > fieldBoundaryX + goalDepth - 0.5) {
                        position.x = Math.sign(position.x) * (fieldBoundaryX + goalDepth - 0.5);
                        this.velocity.x = -this.velocity.x * this.bounceFactor;
                    }
                }
            }
            
            // Return the modified position
            return position;
        },
        
        handlePlayerCollisions: function(players, deltaTime) {
            // Get all players (both teams)
            const allPlayers = [...players.you, ...players.ai];
            
            // Ball properties
            const ballRadius = 0.5;
            const ballPosition = this.mesh.position.clone();
            const ballVelocity = this.velocity.length();
            
            // Player collision radius (significantly larger than actual size for better gameplay)
            const playerRadius = 1.2; // Increased from 0.8 for easier ball control
            
            // Check collision with each player
            for (const player of allPlayers) {
                // Skip if this player is already controlling the ball
                if (player === this.controllingPlayer) continue;
                
                // Get player position (only consider x/z plane for collision)
                const playerPosition = new THREE.Vector3(
                    player.mesh.position.x,
                    0,
                    player.mesh.position.z
                );
                
                const ballPositionXZ = new THREE.Vector3(
                    ballPosition.x,
                    0,
                    ballPosition.z
                );
                
                // Calculate distance between ball and player in the XZ plane
                const distance = ballPositionXZ.distanceTo(playerPosition);
                
                // Increase collision detection radius for ball control attempts
                const controlRadius = ballRadius + playerRadius + 0.8; // Increased from 0.5
                
                // Check for collision or nearby proximity
                if (distance < controlRadius) {
                    // Avoid collision delay (prevent multiple collisions in short time)
                    // Reduced delay time for more responsive ball control
                    if (this.lastPlayerContact === player && this.lastContactTime < 0.1) {
                        continue;
                    }
                    
                    // Record this player as the last to touch the ball
                    this.lastPlayerContact = player;
                    this.lastContactTime = 0;
                    
                    // Calculate relative velocity between ball and player
                    const playerVelocity = player.velocity.clone();
                    const playerSpeed = playerVelocity.length();
                    const relativeSpeed = ballVelocity + playerSpeed;
                    
                    // Calculate collision vector (direction from player to ball)
                    const collisionVector = new THREE.Vector3()
                        .subVectors(ballPositionXZ, playerPosition)
                        .normalize();
                    
                    // Calculate player's movement direction alignment with collision
                    const playerDirection = player.direction.clone().normalize();
                    const directionAlignment = playerDirection.dot(collisionVector);
                    
                    // IMPROVED AUTOMATIC BALL CONTROL LOGIC:
                    // Check conditions for automatic ball control with more lenient criteria
                    
                    // Much higher threshold for "gentle" collision
                    const isGentleCollision = relativeSpeed < 20; // Increased from 15
                    
                    // Less strict requirement for moving toward ball
                    const isMovingTowardBall = directionAlignment > -0.5; // Even more forgiving, was -0.2
                    
                    // Higher speed threshold for ball
                    const isBallSlow = ballVelocity < 25; // Increased from 18
                    
                    // Allow control for all player types (user team and AI team)
                    const canControlBall = true;
                    
                    // Significantly higher probability based on player's ball control skill
                    const controlProbability = 0.7 + (player.ballControlStrength * 0.3); // Increased base probability from 0.5
                    
                    // Special boost for user's active player (makes it easier for the player)
                    const isActiveBoost = player.isActive ? 0.3 : 0; // Increased from 0.25
                    
                    // Apply all criteria with more lenient conditions
                    if ((distance < controlRadius) && 
                        canControlBall && 
                        isGentleCollision && 
                        isMovingTowardBall && 
                        isBallSlow && 
                        Math.random() < (controlProbability + isActiveBoost)) {
                        
                        // Player gains control of the ball automatically
                        this.isControlled = true;
                        this.controllingPlayer = player;
                        player.startControllingBall(this);
                        
                        // Apply small velocity in player's direction to keep the ball moving
                        const controlVelocity = player.direction.clone().normalize().multiplyScalar(playerSpeed * 0.8);
                        this.velocity.copy(controlVelocity);
                        this.velocity.y = 0; // Keep ball on ground during control start
                        
                        return; // Skip the rest of collision handling
                    }
                    
                    // If the ball is very close to the player and moving slowly, give an extra chance
                    // This helps when the ball is rolling near the player
                    if (distance < 2.0 && ballVelocity < 8 && player.isActive) { // Increased distance from 1.5, speed from 5
                        if (Math.random() < 0.8) { // Increased chance from 0.5 to 0.8 (80% chance)
                            this.isControlled = true;
                            this.controllingPlayer = player;
                            player.startControllingBall(this);
                            
                            // Apply minimal velocity to get the ball moving with player
                            const controlVelocity = player.direction.clone().normalize().multiplyScalar(2);
                            this.velocity.copy(controlVelocity);
                            this.velocity.y = 0;
                            
                            return;
                        }
                    }
                    
                    // Special case: Ball is on the ground and rolling slowly - make it easier to control
                    if (this.mesh.position.y <= 0.51 && ballVelocity < 12 && player.isActive) {
                        if (Math.random() < 0.6) { // 60% chance
                            this.isControlled = true;
                            this.controllingPlayer = player;
                            player.startControllingBall(this);
                            
                            // Apply minimal velocity
                            const controlVelocity = player.direction.clone().normalize().multiplyScalar(1.5);
                            this.velocity.copy(controlVelocity);
                            this.velocity.y = 0;
                            
                            return;
                        }
                    }
                    
                    // IMPROVED COLLISION PHYSICS:
                    // If not controlling, handle as normal collision with physics proportional to speed
                    
                    // Base force is proportional to player speed
                    let baseForce = Math.max(5, playerSpeed * 3); // Minimum force with scaling
                    
                    // Add more force if player is actively moving toward the ball
                    if (directionAlignment > 0) {
                        baseForce += directionAlignment * playerSpeed * 2;
                    }
                    
                    // Add directional influence from player's movement
                    const playerInfluence = 0.3; // How much player direction affects ball direction
                    const blendedDirection = new THREE.Vector3()
                        .addScaledVector(collisionVector, 1 - playerInfluence)
                        .addScaledVector(playerDirection, playerInfluence)
                        .normalize();
                    
                    // Apply scaled force to ball
                    this.velocity.add(blendedDirection.multiplyScalar(baseForce));
                    
                    // Add slight vertical velocity for a small bounce
                    this.velocity.y += 1.0 + Math.random() * 2.0;
                    
                    // Apply ball spin when hit from side
                    const sideAlignment = Math.abs(directionAlignment);
                    if (sideAlignment < 0.5) {
                        // Ball was hit from the side, add some spin
                        const spinAxis = new THREE.Vector3(0, 1, 0);
                        const spinMagnitude = baseForce * 0.2 * (1 - sideAlignment);
                        
                        // Determine spin direction based on hit side (cross product)
                        const spinDirection = new THREE.Vector3().crossVectors(playerDirection, new THREE.Vector3(0, 1, 0));
                        this.spin.addScaledVector(spinDirection, spinMagnitude);
                    }
                }
            }
            
            // Check if controlled ball is too far from controlling player
            if (this.isControlled && this.controllingPlayer) {
                const controlDistance = this.mesh.position.distanceTo(this.controllingPlayer.mesh.position);
                
                // Increase the maximum distance to make control more forgiving
                const maxControlDistance = 3.5; // Increased from 3.0 for looser ball control
                
                // If ball gets too far from player, they lose control
                if (controlDistance > maxControlDistance) {
                    this.isControlled = false;
                    this.controllingPlayer.stopControllingBall();
                    this.controllingPlayer = null;
                }
            }
        },
        
        // Method to manually release the ball from player control (for passes/shots)
        releaseFromControl: function(releaseVelocity) {
            if (!this.isControlled) return;
            
            // Stop player control
            this.isControlled = false;
            
            if (this.controllingPlayer) {
                this.controllingPlayer.stopControllingBall();
                this.controllingPlayer = null;
            }
            
            // Apply the release velocity if provided
            if (releaseVelocity) {
                this.velocity.copy(releaseVelocity);
            }
        },
        
        rotateBall: function(deltaTime) {
            if (!this.mesh) return;
            
            // Get the ball's movement in the XZ plane
            const xzMovement = new THREE.Vector2(this.velocity.x, this.velocity.z);
            const speed = xzMovement.length();
            
            // Don't rotate if barely moving
            if (speed < 0.1) return;
            
            // Calculate rotation axis (perpendicular to movement direction)
            const rotationAxis = new THREE.Vector3(-this.velocity.z, 0, this.velocity.x).normalize();
            
            // Calculate rotation amount based on speed and ball size
            // Ball diameter is 1, so circumference is PI
            // One full rotation per circumference traveled
            const ballRadius = 0.5;
            const rotationSpeed = speed / (2 * Math.PI * ballRadius);
            const rotationAmount = rotationSpeed * deltaTime;
            
            // Apply rotation to the ball
            if (this.mesh && this.mesh.children.length > 0) {
                // Apply rotation to whole group
                this.mesh.children[0].rotateOnAxis(rotationAxis, rotationAmount);
                
                // Apply any additional spin effects
                if (this.spin.length() > 0) {
                    // Apply spin effects that gradually decrease
                    this.mesh.children[0].rotateX(this.spin.x * deltaTime);
                    this.mesh.children[0].rotateY(this.spin.y * deltaTime);
                    this.mesh.children[0].rotateZ(this.spin.z * deltaTime);
                    
                    // Decay spin over time
                    this.spin.multiplyScalar(0.95);
                    
                    // Zero out very small spin values
                    if (this.spin.length() < 0.1) {
                        this.spin.set(0, 0, 0);
                    }
                }
            }
        },
        
        reset: function() {
            this.mesh.position.set(0, 1, 0);
            this.velocity.set(0, 0, 0);
            this.lastPlayerContact = null;
            this.lastContactTime = 0;
            this.isControlled = false;
            this.isInGoal = false; // Reset the isInGoal flag
            
            if (this.controllingPlayer) {
                this.controllingPlayer.stopControllingBall();
                this.controllingPlayer = null;
            }
        },
        
        // Added method to apply spin to the ball (useful for curved shots and passes)
        applySpin: function(spinVector) {
            this.spin.copy(spinVector);
        }
    };
    
    // Create the ball mesh
    ball.mesh = createBallMesh();
    
    return ball;
}

function createBallMesh() {
    const ballGroup = new THREE.Group();
    
    // Basic ball geometry
    const radius = 0.5;
    const segments = 32;
    
    // Create basic sphere
    const sphereGeometry = new THREE.SphereGeometry(radius, segments, segments);
    const sphereMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.4,
        metalness: 0.1
    });
    
    const ballMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    ballGroup.add(ballMesh);
    
    // Add black pentagon patterns
    addSoccerBallPattern(ballGroup, radius);
    
    // Set initial position
    ballGroup.position.set(0, radius, 0);
    
    return ballGroup;
}

function addSoccerBallPattern(ballGroup, radius) {
    // Create black pentagons on the ball
    // This is a simplified approach - real soccer balls have a complex pattern
    // We'll create a few black pentagon-like shapes on the ball surface
    
    const pentagonMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    
    // Create 12 evenly distributed points on the sphere (icosahedron vertices)
    const icosahedronPositions = [
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0.894, 0.447, 0),
        new THREE.Vector3(0.276, 0.447, 0.85),
        new THREE.Vector3(-0.724, 0.447, 0.526),
        new THREE.Vector3(-0.724, 0.447, -0.526),
        new THREE.Vector3(0.276, 0.447, -0.85),
        new THREE.Vector3(0.724, -0.447, 0.526),
        new THREE.Vector3(-0.276, -0.447, 0.85),
        new THREE.Vector3(-0.894, -0.447, 0),
        new THREE.Vector3(-0.276, -0.447, -0.85),
        new THREE.Vector3(0.724, -0.447, -0.526),
        new THREE.Vector3(0, -1, 0)
    ];
    
    // Create a pentagon at each position
    icosahedronPositions.forEach(position => {
        const scaledPos = position.clone().multiplyScalar(radius);
        
        // Small scaled sphere for simple pattern
        const patternGeometry = new THREE.SphereGeometry(radius * 0.25, 5, 5);
        const pattern = new THREE.Mesh(patternGeometry, pentagonMaterial);
        
        // Position on the surface of the ball
        pattern.position.copy(scaledPos);
        
        // Orient to face outward from center
        pattern.lookAt(0, 0, 0);
        pattern.position.z *= -1;
        
        // Add pattern to ball
        pattern.position.add(ballGroup.position);
        ballGroup.add(pattern);
    });
    
    return ballGroup;
} 