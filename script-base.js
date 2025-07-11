// script-base.js
'use strict'; // Added strict mode for better code quality and error prevention

// --- DOM Elements ---
const usernameInput = document.getElementById('usernameInput');
const roomIdInput = document.getElementById('roomIdInput');
const createMeetingBtn = document.getElementById('createMeetingBtn');
const joinMeetingBtn = document.getElementById('joinMeetingBtn');
const roomSelectionDiv = document.getElementById('room-selection');
const loadingScreenDiv = document.getElementById('loading-screen');
const callInterfaceDiv = document.getElementById('call-interface');
const activeRoomCodeSpan = document.getElementById('activeRoomCode');
const mainVideo = document.getElementById('mainVideo');
const mainVideoContainer = document.getElementById('mainVideoContainer');
const miniVideo = document.getElementById('miniVideo');
const mainVideoNameLabel = document.getElementById('mainVideoNameLabel');
const miniVideoNameLabel = document.getElementById('miniVideoNameLabel');
const miniVideoContainer = document.getElementById('miniVideoContainer');
const toggleMicBtn = document.getElementById('toggleMicBtn');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const endCallBtn = document.getElementById('endCallBtn');
const callTimerSpan = document.getElementById('callTimer');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const fileInput = document.getElementById('fileInput');
const fileIcon = document.getElementById('fileIcon');
const takePictureBtn = document.getElementById('takePictureBtn');
// const photoCanvas = document.getElementById('photoCanvas'); // This was unused, hiddenPhotoCanvas is used now.
const toggleChatBtn = document.getElementById('toggleChatBtn');
const chatContainer = document.getElementById('chat-container');
const exitChatBtn = document.getElementById('exitChatBtn');
const chatPeerNameDisplay = document.getElementById('chatPeerNameDisplay');
const peerStatusDot = document.getElementById('peerStatusDot');
const typingIndicator = document.getElementById('typingIndicator'); // DOM element for typing indicator
const saveChatHistoryBtn = document.getElementById('saveChatHistoryBtn'); // Added this

// New DOM elements for Camera POV Interface
const cameraPovInterface = document.getElementById('camera-pov-interface');
const cameraPovVideo = document.getElementById('cameraPovVideo');
const hiddenPhotoCanvas = document.getElementById('hiddenPhotoCanvas');
const captureShotBtn = document.getElementById('captureShotBtn');
const switchCamPovBtn = document.getElementById('switchCamPovBtn'); // NEW: Switch Camera Button
const recordingIndicator = document.getElementById('recordingIndicator'); // NEW: Recording indicator
const backToCallBtn = document.getElementById('backToCallBtn');

// New DOM elements for Shot Preview UI
const shotPreviewInterface = document.getElementById('shot-preview-interface');
const capturedShotImage = document.getElementById('capturedShotImage');
const capturedVideoPreview = document.getElementById('capturedVideoPreview'); // NEW: Video preview element
const retakeShotBtn = document.getElementById('retakeShotBtn');
const sendShotBtn = document.getElementById('sendShotBtn');
const controlTab = document.getElementById('control-tab'); // or the correct ID/class

// --- Global Variables ---
let localStream;
let remoteStream = new MediaStream(); // Initialize remoteStream as an empty MediaStream
let peerConnections = new Map(); // Stores peerId -> RTCPeerConnection
let peerNameMap = new Map(); // This `peerNameMap` is likely superseded by `remoteUsernames` in script-logic.js
                                // It's safe to keep as a stub if other parts of your code refer to it,
                                // but `remoteUsernames` should be the primary mapping.
let currentRoomId = null;
let currentUsername = null;
let callStartTime;
let callTimerInterval;
let selectedFileForUpload = null; // To hold the file selected for staged sending
let typingTimeout; // To manage when typing stops for the typing indicator (sender side)
const TYPING_TIMEOUT_DELAY = 1500; // 1.5 seconds delay to consider typing stopped
let remoteTypingDisplayTimeout; // To manage when typing stops for the typing indicator (receiver side)
const REMOTE_TYPING_DISPLAY_DURATION = 3000; // Hide typing indicator after 3 seconds of no updates from remote peer

// --- Mini Video Container & Control Tab Logic (Consolidated) ---
let miniVideoHideTimer; // Renamed from miniVideoContainerTimeout for clarity
let controlTabHideTimer; // Renamed from controlTabTimeout for clarity

/**
 * Shows the mini video container and resets its hide timer.
 */
function showMiniVideo() {
    if (!miniVideoContainer) return;

    console.log('[MiniVideo_Trace] showMiniVideo called. Current classList:', miniVideoContainer.classList.value);
    // CRUCIAL: Clear any existing hide timer FIRST.
    // This cancels any pending 'pause()' calls that might interrupt the new 'play()' attempt.
    clearTimeout(miniVideoHideTimer);

    miniVideoContainer.classList.remove('mini-preview-hidden');

    // Always reset the hide timer so the mini video hides after 3 seconds of inactivity.
    miniVideoHideTimer = setTimeout(hideMiniVideo, 3000);

    // ADDED LOG: Check miniVideo state after showing
    if (miniVideo) {
        console.log('[MiniVideo_Trace] showMiniVideo - miniVideo state: paused=', miniVideo.paused, ' readyState=', miniVideo.readyState, ' currentTime=', miniVideo.currentTime);
        if (miniVideo.srcObject && miniVideo.srcObject.getVideoTracks().length > 0) {
            const track = miniVideo.srcObject.getVideoTracks()[0];
            console.log('[MiniVideo_Trace] showMiniVideo - Track state: enabled=', track.enabled, ' readyState=', track.readyState);
        }
    }
}

/**
 * Hides the mini video container.
 */
function hideMiniVideo() {
    if (!miniVideoContainer) return;
    console.log('[MiniVideo_Trace] hideMiniVideo called. Current classList:', miniVideoContainer.classList.value);
    miniVideoContainer.classList.add('mini-preview-hidden');
    // The video will now continue playing silently in the background when hidden.
    // REMOVED: miniVideo.pause(); // Explicitly pause when hidden to save resources
    console.log('[MiniVideo_Trace] hideMiniVideo - miniVideo is now hidden.');
}

/**
 * Resets the timer for hiding the mini video.
 */
function resetMiniVideoHideTimer() {
    clearTimeout(miniVideoHideTimer);
    miniVideoHideTimer = setTimeout(hideMiniVideo, 3000); // This will only be called from specific cases if needed
}

/**
 * Shows the control tab and sets a timer to hide it after a delay.
 */
function showControlTab() {
    if (!controlTab) return;
    controlTab.classList.remove('hidden');
    clearTimeout(controlTabHideTimer);
    controlTabHideTimer = setTimeout(() => {
        controlTab.classList.add('hidden');
    }, 4000); // Controls hide after 4 seconds
}

// --- General Display/UI Control Functions ---

/**
 * Displays the loading screen and hides other interfaces.
 */
function showLoadingScreen() {
    roomSelectionDiv.style.display = 'none';
    callInterfaceDiv.style.display = 'none';
    cameraPovInterface.style.display = 'none';
    shotPreviewInterface.style.display = 'none';
    loadingScreenDiv.style.display = 'flex';

    // Hide puppy and stickers when loading, as they typically only show on room selection
    if (puppyIcon) puppyIcon.style.display = 'none'; 
}

/**
 * Displays the room selection interface and hides other interfaces.
 */
function showRoomSelection() {
    roomSelectionDiv.style.display = 'flex';
    callInterfaceDiv.style.display = 'none';
    cameraPovInterface.style.display = 'none';
    shotPreviewInterface.style.display = 'none';
    loadingScreenDiv.style.display = 'none';

    // Puppy and stickers are typically visible here, CSS takes care of .background-sticker
    // Puppy will be moved by script-logic.js
    if (puppyIcon) puppyIcon.style.display = 'block'; 
}

/**
 * Displays the main call interface and hides other interfaces.
 */
function showCallInterface() {
    roomSelectionDiv.style.display = 'none';
    loadingScreenDiv.style.display = 'none';
    cameraPovInterface.style.display = 'none';
    shotPreviewInterface.style.display = 'none';
    callInterfaceDiv.style.display = 'flex';

    // Stickers are visible via CSS. Puppy is hidden via CSS for call interface.
    if (puppyIcon) puppyIcon.style.display = 'none'; 
}

/**
 * Displays the camera POV interface for taking pictures.
 */
function showCameraPovInterface() {
    console.log('[showCameraPovInterface] Function called.');
    callInterfaceDiv.style.display = 'none';
    roomSelectionDiv.style.display = 'none';
    loadingScreenDiv.style.display = 'none';
    shotPreviewInterface.style.display = 'none';
    cameraPovInterface.style.display = 'flex';

    // Hide puppy and stickers
    if (puppyIcon) puppyIcon.style.display = 'none'; 
    // Stickers are handled by CSS :has() selector for this interface

    if (cameraPovVideo) {
        cameraPovVideo.style.display = 'block';
        cameraPovVideo.style.width = '100%';
        cameraPovVideo.style.height = '100%';
        cameraPovVideo.style.objectFit = 'cover';
        // Transformation for cameraPovVideo is now handled by applyVideoTransform in script-logic.js
        if (recordingIndicator) recordingIndicator.style.display = 'none'; // Hide recording indicator by default
    } else {
        console.error('[showCameraPovInterface] cameraPovVideo element not found!');
    }
}

/**
 * Displays the shot preview interface after a picture is captured.
 */
function showShotPreviewInterface() {
    console.log('[showShotPreviewInterface] Function called.');
    callInterfaceDiv.style.display = 'none';
    roomSelectionDiv.style.display = 'none';
    loadingScreenDiv.style.display = 'none';
    cameraPovInterface.style.display = 'none';
    shotPreviewInterface.style.display = 'flex';

    // Hide puppy and stickers
    if (puppyIcon) puppyIcon.style.display = 'none'; 
    // Stickers are handled by CSS :has() selector for this interface
}

/**
 * Starts the call timer and updates the display every second.
 */
function startCallTimer() {
    callStartTime = Date.now();
    callTimerInterval = setInterval(() => {
        const elapsedTime = Date.now() - callStartTime;
        const hours = Math.floor(elapsedTime / (1000 * 60 * 60));
        const minutes = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((elapsedTime % (1000 * 60)) / 1000);

        const formatTime = (time) => String(time).padStart(2, '0');
        callTimerSpan.textContent = `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`;
    }, 1000);
}

/**
 * Stops the call timer and resets its display.
 */
function stopCallTimer() {
    clearInterval(callTimerInterval);
    callTimerSpan.textContent = '00:00:00';
}

/**
 * Formats an ISO string timestamp into a readable time format (e.g., "10:30 AM").
 * @param {string} isoString - The ISO 8601 string timestamp.
 * @returns {string} The formatted time string.
 */
function formatTimestamp(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

/**
 * Displays a message in the chat box.
 * If fileUrl exists and it's an image, it displays it as an <img> tag that downloads on click.
 * Otherwise, it displays the fileUrl as a link.
 * @param {string} sender - The name of the message sender.
 * @param {string} message - The message content (used for text messages).
 * @param {boolean} isCurrentUser - True if the message was sent by the current user.
 * @param {string|null} fileUrl - URL of an attached file, if any.
 * @param {string|null} timestamp - ISO string timestamp of the message.
 */
function displayMessage(sender, message, isCurrentUser, fileUrl = null, timestamp = null) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message');
    if (isCurrentUser) {
        messageDiv.classList.add('local-message');
    } else {
        messageDiv.classList.add('remote-message');
    }

    const senderInfoDiv = document.createElement('div');
    senderInfoDiv.classList.add('sender-info');

    const senderNameSpan = document.createElement('span');
    senderNameSpan.classList.add('sender-name');
    senderNameSpan.textContent = isCurrentUser ? 'You' : sender;
    senderInfoDiv.appendChild(senderNameSpan);

    if (timestamp) {
        const timestampSpan = document.createElement('span');
        timestampSpan.classList.add('timestamp');
        timestampSpan.textContent = formatTimestamp(timestamp);
        senderInfoDiv.appendChild(timestampSpan);
    }

    messageDiv.appendChild(senderInfoDiv);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('chat-content');

    if (fileUrl) {
        const fileExtension = fileUrl.split('.').pop().toLowerCase();
        // Check if the file is an image (including GIF)
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExtension)) {
            const imgElement = document.createElement('img');
            imgElement.src = fileUrl;
            imgElement.alt = "Shared Image";
            imgElement.classList.add('chat-image'); // Add a class for styling

            // Create an anchor tag for download and wrap the image in it
            const downloadLink = document.createElement('a');
            downloadLink.href = fileUrl;
            // Set the download attribute with a suggested filename
            downloadLink.download = `shared_image_${Date.now()}.${fileExtension}`; 
//             
            // Append the image to the anchor, then the anchor to the content div
            downloadLink.appendChild(imgElement);
            contentDiv.appendChild(downloadLink);
            
        } else {
            // For other file types, display as a link and make it downloadable
            const fileLink = document.createElement('a');
            fileLink.href = fileUrl;
            fileLink.target = '_blank'; // Still opens in new tab by default if download fails or is not supported
            
            // Set the link text to the file URL itself, or a more descriptive text
            // Also, ensure the download attribute gets a good filename
            const fileNameFromUrl = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
            // Use file name if message is default "File shared." or empty, otherwise use actual message.
            fileLink.textContent = (message && message !== 'File shared.') ? message : `Download: ${fileNameFromUrl}`; 

            fileLink.classList.add('chat-file-link');
            
            // Set the download attribute using the derived filename from URL
            fileLink.download = fileNameFromUrl; // Use filename from URL to suggest download name
            
            contentDiv.appendChild(fileLink);
        }
    } else {
        // For regular text messages
        const messageText = document.createElement('p');
        messageText.textContent = message;
        contentDiv.appendChild(messageText);
    }

    messageDiv.appendChild(contentDiv);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Updates the online/offline status and name display of the peer in the chat header.
 * @param {boolean} isPeerConnected - True if a peer is connected, false otherwise.
 * @param {string} [peerName=''] - The name of the connected peer.
 */
function updatePeerStatus(isPeerConnected, peerName = '') {
    if (peerStatusDot && chatPeerNameDisplay) {
        if (isPeerConnected) {
            peerStatusDot.classList.remove('status-offline');
            peerStatusDot.classList.add('status-online');
            chatPeerNameDisplay.textContent = `Chat with ${peerName || 'Peer'}`;
        } else {
            peerStatusDot.classList.remove('status-online');
            peerStatusDot.classList.add('status-offline');
            chatPeerNameDisplay.textContent = 'Waiting for user';
        }
    }
}

/**
 * Stub function for saving chat history. The actual implementation is in `script-logic.js`.
 */
function saveChatHistory() {
    console.log("saveChatHistory function stub in script-base.js called. Actual implementation is in script-logic.js.");
    // This is a stub. The real function logic resides in script-logic.js
    // because it needs access to the 'socket' object and global variables like currentRoomId.
}

// --- Event Listeners for Mini Video and Control Tab ---

// Global document click/tap to show mini video and controls
document.addEventListener('click', () => {
    showMiniVideo();
    showControlTab();
});

// Marked touchstart event listener as passive for better responsiveness.
document.addEventListener('touchstart', (event) => {
    // Only show if not on an interactive element (e.g., button, input)
    // This prevents showing the video/controls when interacting with chat or other UI
    if (event.target.closest('button, input, a, video, .chat-container')) {
        return;
    }
    showMiniVideo();
    showControlTab();
}, { passive: true }); // Added { passive: true } here


// Prevent clicks on mini video itself from immediately re-hiding it by resetting timer
if (miniVideoContainer) {
    // Marked touchstart event listener as passive for better responsiveness.
    miniVideoContainer.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent this click from bubbling to document and re-triggering show
        resetMiniVideoHideTimer(); // Just reset its own timer
    });
    miniVideoContainer.addEventListener('touchstart', (event) => {
        event.stopPropagation(); // Prevent this touch from bubbling to document and re-triggering show
        resetMiniVideoHideTimer(); // Just reset its own timer
    }, { passive: true }); // Added { passive: true } here
}

// Initial hide for mini video and controls after page load
document.addEventListener('DOMContentLoaded', () => {
    showRoomSelection();
    updatePeerStatus(false);
    if (typingIndicator) { // Check if typing indicator element exists
        typingIndicator.style.display = 'none'; // Ensure it's hidden on load
    }
    // sendChatBtn.disabled = false; // Initial state set by script-logic.js on stream success
    // chatInput.disabled = false; // Initial state set by script-logic.js on stream success

    // Calling setRoomSelectionButtonsState from script-logic.js.
    // It's assumed script-logic.js will be loaded after this file and define it.
    if (typeof setRoomSelectionButtonsState !== 'undefined') {
        setRoomSelectionButtonsState(false); // Enable buttons by default
    }


    // Listen for loadedmetadata on miniVideo to reliably play after srcObject changes.
    if (miniVideo) {
        miniVideo.addEventListener('loadedmetadata', () => {
            // After metadata is loaded, if the video is visible and not playing, try to play.
            // This is a more robust way to ensure playback after srcObject changes.
            if (!miniVideoContainer.classList.contains('mini-preview-hidden') && miniVideo.paused) {
                miniVideo.play().catch(e => {
                    if (e.name === 'AbortError') {
                        console.warn('Mini video play AbortError (from loadedmetadata, often expected):', e.message);
                    } else {
                        console.error('Mini video play error after loadedmetadata:', e);
                    }
                });
            }
        });
        // Also listen for 'emptied' to pause the video explicitly when its source is cleared or changed
        miniVideo.addEventListener('emptied', () => {
            if (!miniVideo.paused) {
                miniVideo.pause();
            }
        });
        // ADDED LOG for play/pause events
        miniVideo.addEventListener('play', () => console.log('[MiniVideo_Trace] miniVideo PLAY event fired!'));
        miniVideo.addEventListener('pause', () => console.log('[MiniVideo_Trace] miniVideo PAUSE event fired!'));
        miniVideo.addEventListener('ended', () => console.log('[MiniVideo_Trace] miniVideo ENDED event fired!'));
    }

    // Initial hide for mini video (3 seconds after load)
    resetMiniVideoHideTimer(); // This call requires resetMiniVideoHideTimer to be defined above.

    // Initial hide for control tab (4 seconds after load)
    if (controlTab) {
        controlTab.classList.add('hidden'); // Start hidden as per typical video call UI
        showControlTab(); // Show momentarily, then hide after 4s
    }
});