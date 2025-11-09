// Initialize Lucide icons after library loads
window.addEventListener('load', function() {
  // Wait a tick to ensure lucide is fully loaded
  setTimeout(function() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      try {
        lucide.createIcons();
        console.log('Lucide icons initialized');
      } catch (error) {
        console.error('Error initializing Lucide icons:', error);
      }
    } else {
      console.error('Lucide library not loaded');
    }
  }, 100);
});
