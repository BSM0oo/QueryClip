export const appStyles = `
  .app-container {
    width: 100%;
    min-height: 100vh;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  .content-container {
    width: 100%;
    max-width: 100%;
    padding: 0.5rem;
    margin: 0;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  .content-container.constrained {
    max-width: 80rem;
    margin: 0 auto;
    padding: 0.5rem;
    padding-bottom: 1rem;
  }

  .content-container.split-view {
    max-width: 100%;
    margin: 0;
    padding: 0.5rem;
  }
  
  /* Styles for split view layout */
  .split-view-gallery .grid {
    grid-template-columns: 1fr !important; /* Force single column display */
    gap: 1.5rem !important; /* Increase spacing between cards */
  }
  
  /* Ensure cards have proper sizing in split view */
  .split-view-gallery .grid > div {
    width: 100% !important; 
    margin-bottom: 0.5rem;
  }

  @media (min-width: 640px) {
    .content-container {
      padding: 1rem;
    }
    .content-container.constrained {
      padding: 2rem;
    }
    .content-container.split-view {
      padding: 1rem;
    }
  }

  .video-container {
    width: 100%;
    position: relative;
    padding-top: 56.25%; /* 16:9 Aspect Ratio */
  }

  .video-container > div {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
`;