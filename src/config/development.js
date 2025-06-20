// Development-specific configuration to suppress warnings
if (process.env.NODE_ENV === 'development') {
  // Suppress specific console warnings
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args.join(' ');
    
    // Skip SES warnings
    if (message.includes('dateTaming') || 
        message.includes('mathTaming') || 
        message.includes('SES')) {
      return;
    }
    
    // Skip font preload warnings
    if (message.includes('preloaded with link preload was not used')) {
      return;
    }
    
    // Skip source map warnings
    if (message.includes('Source map error')) {
      return;
    }
    
    originalWarn.apply(console, args);
  };
}
