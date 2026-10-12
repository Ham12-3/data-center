/**
 * Live camera position, written every frame by CameraRig and read (polled) by
 * 2D UI such as the minimap. A plain mutable object avoids pushing per-frame
 * updates through React state.
 */
export const cameraTracker = { x: 0, y: 0, z: 0 };
