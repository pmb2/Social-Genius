// Custom window interfaces to extend the Window interface
interface Window {
  __modalOpen?: boolean;
  __modalHandlersInitialized?: boolean;
  
  // Add any other custom properties used in the application
  modalOpenCount?: number;
}

// Extend History interface
interface History {
  go(delta?: number): void;
}

// Extend Element interface to include data-state
interface HTMLElement {
  dataset: {
    [key: string]: string | undefined;
    state?: "open" | "closed";
  };
}