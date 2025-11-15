import { driveClient } from '../background/drive-api.js';

// DOM elements
const authSection = document.getElementById('auth-section');
const loadingSection = document.getElementById('loading-section');
const errorSection = document.getElementById('error-section');
const successSection = document.getElementById('success-section');

const signInBtn = document.getElementById('sign-in-btn');
const skipBtn = document.getElementById('skip-btn');
const retryBtn = document.getElementById('retry-btn');
const skipErrorBtn = document.getElementById('skip-error-btn');
const continueBtn = document.getElementById('continue-btn');

const errorMessage = document.getElementById('error-message');
const userEmail = document.getElementById('user-email');

/**
 * Show a specific section and hide others
 */
function showSection(section) {
  authSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  successSection.classList.add('hidden');
  section.classList.remove('hidden');
}

/**
 * Handle sign-in process
 */
async function handleSignIn() {
  showSection(loadingSection);

  try {
    // Authenticate with Google
    await driveClient.authenticate(true);

    // Get user info
    const userInfo = await driveClient.getUserInfo();

    // Perform initial sync
    // Note: We'll need to pass the storage instance here
    // For now, we'll just mark sync as enabled
    await chrome.storage.local.set({
      googleDriveEnabled: true,
      googleDriveUser: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }
    });

    // Show success
    userEmail.textContent = userInfo.email;
    showSection(successSection);

    // Send message to background to trigger initial sync
    chrome.runtime.sendMessage({ type: 'INITIAL_SYNC' });

  } catch (error) {
    console.error('Sign-in failed:', error);
    errorMessage.textContent = error.message || 'Failed to sign in. Please try again.';
    showSection(errorSection);
  }
}

/**
 * Handle skip (continue without sign-in)
 */
function handleSkip() {
  // Mark that user chose to skip
  chrome.storage.local.set({
    googleDriveEnabled: false,
    skipLoginShown: true
  });

  // Redirect to main app
  window.location.href = 'popup.html';
}

/**
 * Handle continue after successful sign-in
 */
function handleContinue() {
  window.location.href = 'popup.html';
}

/**
 * Initialize page
 */
async function init() {
  // Check if already authenticated
  const stored = await chrome.storage.local.get(['googleDriveEnabled', 'googleDriveUser']);

  if (stored.googleDriveEnabled && stored.googleDriveUser) {
    // Already authenticated, show success
    userEmail.textContent = stored.googleDriveUser.email;
    showSection(successSection);
    return;
  }

  // Show auth section
  showSection(authSection);
}

// Event listeners
signInBtn.addEventListener('click', handleSignIn);
skipBtn.addEventListener('click', handleSkip);
retryBtn.addEventListener('click', handleSignIn);
skipErrorBtn.addEventListener('click', handleSkip);
continueBtn.addEventListener('click', handleContinue);

// Initialize
init();
