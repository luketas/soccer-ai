import * as THREE from 'three';

// Create field with all markings
export function createField() {
    const fieldGroup = new THREE.Group();
    
    // Field dimensions (based on a scaled-down soccer field)
    const fieldWidth = 60;  // x-axis
    const fieldLength = 40; // z-axis
    
    // Create main field
    const fieldGeometry = new THREE.PlaneGeometry(fieldWidth, fieldLength);
    const fieldMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4CAF50, // Brighter green grass
        roughness: 0.6,
        metalness: 0.1
    });
    
    const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.rotation.x = -Math.PI / 2; // Rotate to horizontal
    field.receiveShadow = true;
    fieldGroup.add(field);
    
    // Add field markings
    addFieldMarkings(fieldGroup, fieldWidth, fieldLength);
    
    // Add goals
    addGoals(fieldGroup, fieldWidth, fieldLength);
    
    // Add stadium surroundings (simple boundary)
    addStadiumBoundary(fieldGroup, fieldWidth, fieldLength);
    
    return fieldGroup;
}

function addFieldMarkings(fieldGroup, fieldWidth, fieldLength) {
    const lineWidth = 0.2;
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    // Boundary lines
    // Top boundary
    createLine(
        fieldGroup,
        fieldWidth - lineWidth, 
        lineWidth, 
        0, 
        fieldLength / 2 - lineWidth / 2, 
        lineMaterial
    );
    
    // Bottom boundary
    createLine(
        fieldGroup,
        fieldWidth - lineWidth, 
        lineWidth, 
        0, 
        -fieldLength / 2 + lineWidth / 2, 
        lineMaterial
    );
    
    // Left boundary
    createLine(
        fieldGroup,
        lineWidth, 
        fieldLength, 
        -fieldWidth / 2 + lineWidth / 2, 
        0, 
        lineMaterial
    );
    
    // Right boundary
    createLine(
        fieldGroup,
        lineWidth, 
        fieldLength, 
        fieldWidth / 2 - lineWidth / 2, 
        0, 
        lineMaterial
    );
    
    // Center line
    createLine(
        fieldGroup,
        lineWidth, 
        fieldLength, 
        0, 
        0, 
        lineMaterial
    );
    
    // Center circle
    const centerCircle = new THREE.RingGeometry(5, 5 + lineWidth, 32);
    const centerCircleMesh = new THREE.Mesh(centerCircle, lineMaterial);
    centerCircleMesh.rotation.x = -Math.PI / 2;
    centerCircleMesh.position.y = 0.01; // Slightly above field to prevent z-fighting
    fieldGroup.add(centerCircleMesh);
    
    // Penalty areas
    // Left penalty area
    createLine(
        fieldGroup,
        lineWidth, 
        16, 
        -fieldWidth / 2 + 10, 
        0, 
        lineMaterial
    );
    
    createLine(
        fieldGroup,
        10, 
        lineWidth, 
        -fieldWidth / 2 + 5, 
        8, 
        lineMaterial
    );
    
    createLine(
        fieldGroup,
        10, 
        lineWidth, 
        -fieldWidth / 2 + 5, 
        -8, 
        lineMaterial
    );
    
    // Right penalty area
    createLine(
        fieldGroup,
        lineWidth, 
        16, 
        fieldWidth / 2 - 10, 
        0, 
        lineMaterial
    );
    
    createLine(
        fieldGroup,
        10, 
        lineWidth, 
        fieldWidth / 2 - 5, 
        8, 
        lineMaterial
    );
    
    createLine(
        fieldGroup,
        10, 
        lineWidth, 
        fieldWidth / 2 - 5, 
        -8, 
        lineMaterial
    );
    
    // Penalty spots
    const penaltySpotGeometry = new THREE.CircleGeometry(0.3, 16);
    
    // Left penalty spot
    const leftPenaltySpot = new THREE.Mesh(penaltySpotGeometry, lineMaterial);
    leftPenaltySpot.rotation.x = -Math.PI / 2;
    leftPenaltySpot.position.set(-fieldWidth / 2 + 8, 0.02, 0);
    fieldGroup.add(leftPenaltySpot);
    
    // Right penalty spot
    const rightPenaltySpot = new THREE.Mesh(penaltySpotGeometry, lineMaterial);
    rightPenaltySpot.rotation.x = -Math.PI / 2;
    rightPenaltySpot.position.set(fieldWidth / 2 - 8, 0.02, 0);
    fieldGroup.add(rightPenaltySpot);
}

function createLine(fieldGroup, width, length, x, z, material) {
    const geometry = new THREE.PlaneGeometry(width, length);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.01, z); // Slightly above field to prevent z-fighting
    fieldGroup.add(mesh);
    return mesh;
}

function addGoals(fieldGroup, fieldWidth, fieldLength) {
    const goalDepth = 2;
    const goalWidth = 12;
    const goalHeight = 6;
    const goalPostThickness = 0.5;
    
    // Goal materials
    const goalPostMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.5
    });
    
    const goalNetMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.4,
        side: THREE.DoubleSide,
        wireframe: true
    });
    
    // Left goal (your goal)
    createGoal(
        fieldGroup,
        -fieldWidth / 2 - goalDepth / 2,
        0,
        goalDepth,
        goalWidth,
        goalHeight,
        goalPostThickness,
        goalPostMaterial,
        goalNetMaterial
    );
    
    // Right goal (AI goal)
    createGoal(
        fieldGroup,
        fieldWidth / 2 + goalDepth / 2,
        0,
        goalDepth,
        goalWidth,
        goalHeight,
        goalPostThickness,
        goalPostMaterial,
        goalNetMaterial
    );
}

function createGoal(fieldGroup, x, z, depth, width, height, postThickness, postMaterial, netMaterial) {
    const goalGroup = new THREE.Group();
    
    // Goal posts
    // Left post
    const leftPostGeometry = new THREE.BoxGeometry(postThickness, height, postThickness);
    const leftPost = new THREE.Mesh(leftPostGeometry, postMaterial);
    leftPost.position.set(0, height / 2, -width / 2);
    leftPost.castShadow = true;
    goalGroup.add(leftPost);
    
    // Right post
    const rightPostGeometry = new THREE.BoxGeometry(postThickness, height, postThickness);
    const rightPost = new THREE.Mesh(rightPostGeometry, postMaterial);
    rightPost.position.set(0, height / 2, width / 2);
    rightPost.castShadow = true;
    goalGroup.add(rightPost);
    
    // Crossbar
    const crossbarGeometry = new THREE.BoxGeometry(postThickness, postThickness, width + postThickness);
    const crossbar = new THREE.Mesh(crossbarGeometry, postMaterial);
    crossbar.position.set(0, height, 0);
    crossbar.castShadow = true;
    goalGroup.add(crossbar);
    
    // No nets anymore - removed as requested
    
    // Position the entire goal
    goalGroup.position.set(x, 0, z);
    fieldGroup.add(goalGroup);
    
    return goalGroup;
}

function addStadiumBoundary(fieldGroup, fieldWidth, fieldLength) {
    // Add some simple boundary around the field
    const boundaryWidth = fieldWidth + 10;
    const boundaryLength = fieldLength + 10;
    
    const boundaryGeometry = new THREE.PlaneGeometry(boundaryWidth, boundaryLength);
    const boundaryMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2E7D32, // Darker green but still vibrant
        roughness: 0.7,
        metalness: 0.1
    });
    
    const boundary = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    boundary.rotation.x = -Math.PI / 2;
    boundary.position.y = -0.01; // Slightly below field
    boundary.receiveShadow = true;
    fieldGroup.add(boundary);
    
    // Add simple stands on all sides (just blocks for now)
    const standHeight = 5;
    const standDepth = 10;
    const standMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x607D8B, // Brighter gray
        roughness: 0.8
    });
    
    // North stand
    const northStandGeometry = new THREE.BoxGeometry(boundaryWidth + standDepth, standHeight, standDepth);
    const northStand = new THREE.Mesh(northStandGeometry, standMaterial);
    northStand.position.set(0, standHeight / 2, -boundaryLength / 2 - standDepth / 2);
    northStand.castShadow = true;
    northStand.receiveShadow = true;
    fieldGroup.add(northStand);
    
    // South stand
    const southStandGeometry = new THREE.BoxGeometry(boundaryWidth + standDepth, standHeight, standDepth);
    const southStand = new THREE.Mesh(southStandGeometry, standMaterial);
    southStand.position.set(0, standHeight / 2, boundaryLength / 2 + standDepth / 2);
    southStand.castShadow = true;
    southStand.receiveShadow = true;
    fieldGroup.add(southStand);
    
    // East stand
    const eastStandGeometry = new THREE.BoxGeometry(standDepth, standHeight, boundaryLength);
    const eastStand = new THREE.Mesh(eastStandGeometry, standMaterial);
    eastStand.position.set(boundaryWidth / 2 + standDepth / 2, standHeight / 2, 0);
    eastStand.castShadow = true;
    eastStand.receiveShadow = true;
    fieldGroup.add(eastStand);
    
    // West stand
    const westStandGeometry = new THREE.BoxGeometry(standDepth, standHeight, boundaryLength);
    const westStand = new THREE.Mesh(westStandGeometry, standMaterial);
    westStand.position.set(-boundaryWidth / 2 - standDepth / 2, standHeight / 2, 0);
    westStand.castShadow = true;
    westStand.receiveShadow = true;
    fieldGroup.add(westStand);
    
    return fieldGroup;
} 