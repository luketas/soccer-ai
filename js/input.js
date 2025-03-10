import * as THREE from 'three';

export class InputManager {
    constructor() {
        // Set of currently pressed keys
        this.keys = new Set();
        
        // Key mapping for different input types - allows custom configuration later
        this.keyMap = {
            // Movement
            up: ['w', 'ArrowUp'],
            down: ['s', 'ArrowDown'],
            left: ['a', 'ArrowLeft'],
            right: ['d', 'ArrowRight'],
            
            // Actions
            sprint: ['Shift'],
            shoot: ['x'],
            pass: [' '], // Space bar
            playerSwitch: ['q'],
            
            // Game control
            pause: ['Escape', 'p']
        };
        
        // Normalized states for different actions
        this.actionStates = {
            movement: new THREE.Vector2(0, 0), // x: left/right, y: up/down
            sprint: false,
            shoot: false,
            pass: false,
            playerSwitch: false,
            pause: false
        };

        // Mouse control
        this.mousePosition = new THREE.Vector2(0, 0);
        this.mouseDirection = new THREE.Vector2(0, 0);
        // Mouse control is always active
    }
    
    // Handle key down events
    onKeyDown(event) {
        const key = event.key.toLowerCase();
        this.keys.add(key);
        
        // Update action states based on key presses
        this.updateActionStates();
    }
    
    // Handle key up events
    onKeyUp(event) {
        const key = event.key.toLowerCase();
        this.keys.delete(key);
        
        // Update action states based on key presses
        this.updateActionStates();
    }

    // Handle mouse move events
    onMouseMove(event) {
        // Update mouse position
        this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mousePosition.y = -((event.clientY / window.innerHeight) * 2 - 1);
    }
    
    // Update the normalized action states based on current key presses
    updateActionStates() {
        // Reset movement vector
        this.actionStates.movement.set(0, 0);
        
        // Check movement keys
        if (this.isActionActive('up')) {
            this.actionStates.movement.y = -1;
        }
        
        if (this.isActionActive('down')) {
            this.actionStates.movement.y = 1;
        }
        
        if (this.isActionActive('left')) {
            this.actionStates.movement.x = -1;
        }
        
        if (this.isActionActive('right')) {
            this.actionStates.movement.x = 1;
        }
        
        // Normalize diagonal movement
        if (this.actionStates.movement.length() > 1) {
            this.actionStates.movement.normalize();
        }
        
        // Update other action states
        this.actionStates.sprint = this.isActionActive('sprint');
        this.actionStates.shoot = this.isActionActive('shoot');
        this.actionStates.pass = this.isActionActive('pass');
        this.actionStates.playerSwitch = this.isActionActive('playerSwitch');
        this.actionStates.pause = this.isActionActive('pause');
    }
    
    // Check if a specific action is currently active
    isActionActive(action) {
        const actionKeys = this.keyMap[action];
        if (!actionKeys) return false;
        
        return actionKeys.some(key => this.keys.has(key.toLowerCase()));
    }
    
    // Get the current movement direction (for player control)
    getMovementDirection() {
        // If keyboard input is active, use that
        if (this.actionStates.movement.length() > 0) {
            return this.actionStates.movement;
        }
        
        // Otherwise use mouse direction if it exists
        if (this.mouseDirection.length() > 0) {
            return this.mouseDirection;
        }
        
        // Default to no movement
        return new THREE.Vector2(0, 0);
    }

    // Update mouse direction based on player position and mouse position
    updateMouseDirection(playerPosition, camera) {
        // Create a raycaster from the camera through the mouse position
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.mousePosition, camera);
        
        // Define the plane that represents the field
        const fieldPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        // Calculate the intersection point
        const targetPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(fieldPlane, targetPoint);
        
        // Calculate direction from player to intersection point
        const direction = new THREE.Vector2(
            targetPoint.x - playerPosition.x,
            targetPoint.z - playerPosition.z
        );
        
        // Normalize the direction if it has length
        if (direction.length() > 0) {
            direction.normalize();
        }
        
        // Set the mouse direction
        this.mouseDirection.copy(direction);
    }
    
    // Check if sprint is active
    isSprinting() {
        return this.actionStates.sprint;
    }
    
    // Check if shoot action is triggered
    isShooting() {
        return this.actionStates.shoot;
    }
    
    // Check if pass action is triggered
    isPassing() {
        return this.actionStates.pass;
    }
    
    // Check if player switch is triggered
    isPlayerSwitching() {
        return this.actionStates.playerSwitch;
    }
    
    // Check if pause is triggered
    isPausing() {
        return this.actionStates.pause;
    }
} 