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

        // Mobile touch control states
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.touchJoystickActive = false;
        this.touchJoystickCenter = new THREE.Vector2(0, 0);
        this.touchJoystickPosition = new THREE.Vector2(0, 0);
        this.touchJoystickThreshold = 10; // Minimum distance to consider joystick active
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
    
    // Handle touch start for directional joystick
    onTouchStart(event) {
        console.log("Touch start in InputManager", event.touches.length, "touches");
        
        // Only handle the first touch for joystick
        if (event.touches.length > 0) {
            const touch = event.touches[0];
            const touchElement = document.elementFromPoint(touch.clientX, touch.clientY);
            
            console.log("Touch on element:", touchElement ? touchElement.id : "unknown");
            
            // Check which touch control was activated
            if (touchElement && touchElement.id === 'touch-joystick-area' || 
                touchElement && touchElement.id === 'touch-joystick-base' || 
                touchElement && touchElement.id === 'touch-joystick-handle') {
                
                console.log("Joystick control activated");
                this.touchJoystickActive = true;
                this.touchJoystickCenter.set(touch.clientX, touch.clientY);
                this.touchJoystickPosition.copy(this.touchJoystickCenter);
                
                // Update joystick UI position
                const joystickBase = document.getElementById('touch-joystick-base');
                const joystickHandle = document.getElementById('touch-joystick-handle');
                if (joystickBase && joystickHandle) {
                    joystickBase.style.left = `${touch.clientX}px`;
                    joystickBase.style.top = `${touch.clientY}px`;
                    joystickBase.style.display = 'block';
                    joystickHandle.style.left = `${touch.clientX}px`;
                    joystickHandle.style.top = `${touch.clientY}px`;
                    joystickHandle.style.display = 'block';
                    console.log("Joystick visuals updated");
                }
            } else if (touchElement && touchElement.id === 'touch-shoot-btn') {
                console.log("Shoot button pressed");
                this.keys.add('x'); // Simulate X key press
                this.updateActionStates();
                
                // Add visual feedback (handled by CSS)
            } else if (touchElement && touchElement.id === 'touch-pass-btn') {
                console.log("Pass button pressed");
                this.keys.add(' '); // Simulate Space key press
                this.updateActionStates();
                
                // Add visual feedback (handled by CSS)
            } else if (touchElement && touchElement.id === 'touch-switch-btn') {
                console.log("Switch button pressed");
                this.keys.add('q'); // Simulate Q key press
                this.updateActionStates();
                
                // Add visual feedback (handled by CSS)
            }
        }
    }
    
    // Handle touch move for directional joystick
    onTouchMove(event) {
        if (!this.touchJoystickActive) return;
        
        // Find the touch that started in the joystick area
        for (let i = 0; i < event.touches.length; i++) {
            const touch = event.touches[i];
            
            // Update joystick position
            this.touchJoystickPosition.set(touch.clientX, touch.clientY);
            
            // Calculate joystick direction and magnitude
            const direction = new THREE.Vector2(
                this.touchJoystickPosition.x - this.touchJoystickCenter.x,
                this.touchJoystickPosition.y - this.touchJoystickCenter.y
            );
            
            // Calculate distance from center
            const distance = direction.length();
            
            // Normalize direction
            if (distance > 0) {
                direction.normalize();
            }
            
            // Create a clamped joystick position for UI
            const maxRadius = 50; // Maximum joystick displacement radius
            const clampedPosition = new THREE.Vector2(
                this.touchJoystickCenter.x + direction.x * Math.min(distance, maxRadius),
                this.touchJoystickCenter.y + direction.y * Math.min(distance, maxRadius)
            );
            
            // Update joystick handle position in UI
            const joystickHandle = document.getElementById('touch-joystick-handle');
            if (joystickHandle) {
                joystickHandle.style.left = `${clampedPosition.x}px`;
                joystickHandle.style.top = `${clampedPosition.y}px`;
            }
            
            // Update action states based on joystick direction
            if (distance > this.touchJoystickThreshold) {
                // FIXED: Do NOT invert the Y direction to fix the inverted movement issue
                // Screen coordinates are Y-down, but we want joystick up to move player up
                this.actionStates.movement.set(direction.x, direction.y);
                
                // Always use sprint on mobile for better experience
                this.actionStates.sprint = true;
                
                // Log to confirm joystick is moving with correct orientation
                if (distance > 30) {
                    console.log("Joystick moved:", 
                        direction.x.toFixed(2), 
                        direction.y.toFixed(2), 
                        "Distance:", distance.toFixed(2),
                        "Movement:", this.actionStates.movement.x.toFixed(2), this.actionStates.movement.y.toFixed(2));
                }
            }
            break;
        }
    }
    
    // Handle touch end for directional joystick
    onTouchEnd(event) {
        // Check if all touches related to the joystick are gone
        let joystickTouchStillActive = false;
        
        for (let i = 0; i < event.touches.length; i++) {
            const touch = event.touches[i];
            const touchElement = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (touchElement && (touchElement.id === 'touch-joystick-area' || 
                                touchElement.id === 'touch-joystick-handle' || 
                                touchElement.id === 'touch-joystick-base')) {
                joystickTouchStillActive = true;
                break;
            }
        }
        
        if (!joystickTouchStillActive && this.touchJoystickActive) {
            this.touchJoystickActive = false;
            this.actionStates.movement.set(0, 0);
            this.actionStates.sprint = false;
            
            // Hide joystick UI elements
            const joystickBase = document.getElementById('touch-joystick-base');
            const joystickHandle = document.getElementById('touch-joystick-handle');
            if (joystickBase && joystickHandle) {
                joystickBase.style.display = 'none';
                joystickHandle.style.display = 'none';
            }
        }
    }
    
    // Update the normalized action states based on current key presses
    updateActionStates() {
        if (!this.touchJoystickActive) {
            // If touch joystick is not active, get input from keyboard
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
        }
        
        // Update other action states
        this.actionStates.sprint = this.isActionActive('sprint') || this.touchJoystickActive;
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
        // If keyboard or touch joystick input is active, use that
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

    // Update mouse direction based on player position and camera
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
    
    // Check if this is a touch device
    isMobileDevice() {
        return this.isTouchDevice;
    }
} 